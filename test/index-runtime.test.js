const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");

function createIndexHarness({ immediateDelays = false, now = Date.now, rootAvailable = true, xhrStatus = 200 } = {}) {
  const state = {
    delayQueue: [],
    delayDurations: [],
    documentListeners: [],
    errors: [],
    netEvents: [],
    observeTargets: [],
    root: rootAvailable ? {} : null,
    windowListeners: [],
  };

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe(target) {
      state.observeTargets.push(target);
      if (!target) {
        state.root = {};
        throw new TypeError("MutationObserver target is null");
      }
    }
  }

  class FakeXHR {
    constructor() {
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    open(method, url) {
      if (method === "TRACE") throw new TypeError("Forbidden method");
      this.method = method;
      this.url = url;
    }

    send() {
      const response = this.responses?.shift() ?? { responseText: "[]", status: xhrStatus };
      this.status = response.status;
      this.responseText = response.responseText;
      this.readyState = 4;
      for (const listener of this.listeners.get("readystatechange") ?? []) {
        listener.call(this, { type: "readystatechange", target: this });
      }
      this.onreadystatechange?.({ type: "readystatechange", target: this });
      for (const listener of this.listeners.get("load") ?? []) {
        listener.call(this, { type: "load", target: this });
      }
      this.onload?.({ type: "load", target: this });
      for (const listener of this.listeners.get("loadend") ?? []) {
        listener.call(this, { type: "loadend", target: this });
      }
    }
  }

  const componentList = {};
  const tools = {
    buildAlert() {},
    buildConfirm() {},
    checkBrowser() {},
    checkIPArea() {},
    checkWindowHorV() {},
    clientHorV: 0,
    CSSMount() {},
    dely(ms) {
      state.delayDurations.push(ms);
      if (immediateDelays) return Promise.resolve();
      return new Promise((resolve) => state.delayQueue.push({ ms, resolve }));
    },
    dependenceCheck: async () => {},
    errorLog(...args) { state.errors.push(args); },
    eventBus() {},
    indexDB_loadFeatureConf: async () => {},
    indexDB_loadIndexDBData: async () => {},
    indexDB_loadLangData: async () => {},
    indexDB_loadTapCount: async () => {},
    indexDB_openDB: async () => {},
    indexDB_updateIndexDBData() {},
    indexDB_updateLoadCount: async () => {},
    indexDB_updateUUID: async () => {},
    intervalEventBus() {},
    msg_check() {},
    mutationHandle() {},
    netEventBus(...args) { state.netEvents.push(args); },
    noSaveClose: false,
    scriptLoadAcc: false,
    zoomRateApply() {},
  };
  const document = {
    addEventListener(type, listener) { state.documentListeners.push({ listener, type }); },
    querySelector(selector) {
      if (selector === "div#root") return state.root;
      return null;
    },
  };
  const window = {
    XMLHttpRequest: FakeXHR,
    addEventListener(type, listener) { state.windowListeners.push({ listener, type }); },
  };
  function localRequire(request) {
    if (request === "./tools/tools.js") {
      return { componentList, feature_config: { componentSwitchList: {} }, indexDBData: {}, runtimeData: {}, tools };
    }
    return {};
  }
  localRequire.context = () => {
    const context = () => {};
    context.keys = () => [];
    return context;
  };

  const startup = vm.runInNewContext(indexSource, {
    MutationObserver: FakeMutationObserver,
    Date: { now },
    console: { log() {} },
    document,
    require: localRequire,
    sctData: { version: [0, 0, 0] },
    setInterval() {},
    window,
  }, { filename: "index.js" });

  return { state, startup, window };
}

test("startup waits for #root before registering observers and listeners", async () => {
  const harness = createIndexHarness({ rootAvailable: false });
  await Promise.resolve();

  assert.equal(harness.state.observeTargets.length, 0, "must not observe a missing root or retry synchronously");
  assert.deepEqual(harness.state.delayQueue.map(({ ms }) => ms), [100]);

  harness.state.root = {};
  harness.state.delayQueue.shift().resolve();
  await harness.startup;

  assert.equal(harness.state.observeTargets.length, 1);
  assert.equal(harness.state.documentListeners.filter(({ type }) => type === "click").length, 1);
  assert.equal(harness.state.documentListeners.filter(({ type }) => type === "keydown").length, 1);
  assert.equal(harness.state.windowListeners.filter(({ type }) => type === "beforeunload").length, 1);
});

test("XHR capture survives application onload assignment after open", async () => {
  const harness = createIndexHarness({ xhrStatus: 204 });
  await harness.startup;
  let applicationLoadCalls = 0;

  const xhr = new harness.window.XMLHttpRequest();
  assert.equal(xhr instanceof harness.window.XMLHttpRequest, true);
  xhr.open("GET", "https://www.simcompanies.com/api/v3/resources/");
  xhr.onload = () => { applicationLoadCalls += 1; };
  xhr.send();

  assert.equal(applicationLoadCalls, 1);
  assert.equal(harness.state.netEvents.length, 1, "successful XHR must reach the network event bus");
  assert.deepEqual(harness.state.netEvents[0], [
    "https://www.simcompanies.com/api/v3/resources/",
    "GET",
    "[]",
    204,
  ]);
});

test("XHR capture keeps request metadata when application reuses the instance from onload", async () => {
  const harness = createIndexHarness();
  await harness.startup;
  const xhr = new harness.window.XMLHttpRequest();
  xhr.responses = [
    { responseText: "first", status: 200 },
    { responseText: "second", status: 201 },
  ];
  let applicationLoadCalls = 0;
  xhr.onload = () => {
    applicationLoadCalls += 1;
    if (applicationLoadCalls !== 1) return;
    xhr.open("POST", "https://www.simcompanies.com/api/v2/companies/me/buildings/");
    xhr.send();
  };

  xhr.open("GET", "https://www.simcompanies.com/api/v3/resources/");
  xhr.send();

  assert.equal(applicationLoadCalls, 2);
  assert.deepEqual(harness.state.netEvents, [
    ["https://www.simcompanies.com/api/v3/resources/", "GET", "first", 200],
    ["https://www.simcompanies.com/api/v2/companies/me/buildings/", "POST", "second", 201],
  ]);
});

test("XHR capture keeps request metadata when application reuses the instance at readyState DONE", async () => {
  const harness = createIndexHarness();
  await harness.startup;
  const xhr = new harness.window.XMLHttpRequest();
  xhr.responses = [
    { responseText: "first", status: 200 },
    { responseText: "second", status: 201 },
  ];
  let readyCalls = 0;
  xhr.onreadystatechange = () => {
    readyCalls += 1;
    if (readyCalls !== 1 || xhr.readyState !== 4) return;
    xhr.open("POST", "https://www.simcompanies.com/api/v2/companies/me/buildings/");
    xhr.send();
  };

  xhr.open("GET", "https://www.simcompanies.com/api/v3/resources/");
  xhr.send();

  assert.equal(readyCalls, 2);
  assert.deepEqual(harness.state.netEvents, [
    ["https://www.simcompanies.com/api/v3/resources/", "GET", "first", 200],
    ["https://www.simcompanies.com/api/v2/companies/me/buildings/", "POST", "second", 201],
  ]);
});

test("XHR capture keeps active request metadata when a later open throws", async () => {
  const harness = createIndexHarness();
  await harness.startup;
  const xhr = new harness.window.XMLHttpRequest();
  xhr.responses = [{ responseText: "old", status: 200 }];

  xhr.open("GET", "https://www.simcompanies.com/api/v3/resources/");
  assert.throws(
    () => xhr.open("TRACE", "https://www.simcompanies.com/api/v2/companies/me/buildings/"),
    /Forbidden method/
  );
  xhr.send();

  assert.deepEqual(harness.state.netEvents, [[
    "https://www.simcompanies.com/api/v3/resources/",
    "GET",
    "old",
    200,
  ]]);
});

test("wrapped XMLHttpRequest preserves subclass construction", async () => {
  const harness = createIndexHarness();
  await harness.startup;
  class CustomXHR extends harness.window.XMLHttpRequest {
    customMethod() { return "custom"; }
  }

  const xhr = new CustomXHR();

  assert.equal(xhr instanceof CustomXHR, true);
  assert.equal(xhr instanceof harness.window.XMLHttpRequest, true);
  assert.equal(xhr.customMethod(), "custom");
});

test("wrapped XMLHttpRequest avoids subclass overrides before class fields initialize", async () => {
  const harness = createIndexHarness();
  await harness.startup;
  class CustomXHR extends harness.window.XMLHttpRequest {
    registrations = [];
    openCalls = 0;

    addEventListener(type, listener) {
      this.registrations.push(type);
      return super.addEventListener(type, listener);
    }

    open(...args) {
      this.openCalls += 1;
      return super.open(...args);
    }
  }

  const xhr = new CustomXHR();
  xhr.open("GET", "https://www.simcompanies.com/api/v3/resources/");

  assert.deepEqual(xhr.registrations, []);
  assert.equal(xhr.openCalls, 1);
});

test("startup stops after the bounded number of missing-root retries", async () => {
  let time = -15_001;
  const harness = createIndexHarness({
    immediateDelays: true,
    now: () => { time += 15_001; return time; },
    rootAvailable: false,
  });

  await harness.startup;

  assert.equal(harness.state.observeTargets.length, 0);
  assert.equal(harness.state.errors.length, 4);
  assert.deepEqual(harness.state.delayDurations, [5000, 5000, 5000]);
  assert.equal(harness.window.SCTLoadFlag, false);
});
