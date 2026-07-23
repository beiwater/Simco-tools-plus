const assert = require("node:assert/strict");
const test = require("node:test");

const { createAutoMaxCache } = require("../../tools/automax/data.js");
const { success } = require("../../tools/automax/result.js");
const {
  AUTO_MAX_ROUTE_PATTERNS,
  HOUR_MS,
  createResponseCapture,
  createRouteMonitor,
  createRouteRegistry,
  createTtlRefreshScheduler,
  createXhrCaptureRegistration,
  installFetchCapture,
} = require("../../tools/automax/lifecycle.js");

function createJsonResponse(body, { status = 200, malformed = false } = {}) {
  const state = { cloneCalls: 0, originalReads: 0 };
  const makeBody = (original) => {
    let consumed = false;
    return {
      status,
      ok: status >= 200 && status < 400,
      clone() {
        assert.equal(original, true);
        state.cloneCalls += 1;
        return makeBody(false);
      },
      async json() {
        if (consumed) throw new TypeError("Body has already been consumed");
        consumed = true;
        if (original) state.originalReads += 1;
        if (malformed) throw new SyntaxError("Unexpected token");
        return structuredClone(body);
      },
    };
  };
  return { response: makeBody(true), state };
}

function building(id = 1, size = 5) {
  return { id, kind: "y", position: "0", size, robotsSpecialization: null };
}

test("fetch capture clones one eligible response and duplicate installation preserves fetch behavior", async () => {
  const cache = createAutoMaxCache({});
  const persisted = [];
  const errors = [];
  const capture = createResponseCapture({
    cache,
    getRealmId: () => 0,
    persist: async (state) => persisted.push(structuredClone(state)),
    onError: (error) => errors.push(error),
    now: () => 1_000,
  });
  const payload = [building()];
  const fixture = createJsonResponse(payload);
  const receiver = {
    calls: 0,
    fetch(input) {
      assert.equal(this, receiver);
      assert.equal(input, "/api/v2/companies/me/buildings/?view=landscape");
      this.calls += 1;
      return Promise.resolve(fixture.response);
    },
  };
  const originalFetch = receiver.fetch;

  const first = installFetchCapture({ target: receiver, onResponse: capture.capture, onError: capture.reportError });
  const second = installFetchCapture({ target: receiver, onResponse: capture.capture, onError: capture.reportError });
  const returned = await receiver.fetch("/api/v2/companies/me/buildings/?view=landscape");
  await first.flush();

  assert.strictEqual(returned, fixture.response);
  assert.deepEqual(await returned.json(), payload);
  assert.equal(receiver.calls, 1);
  assert.equal(fixture.state.cloneCalls, 1);
  assert.equal(fixture.state.originalReads, 1);
  assert.equal(persisted.length, 1);
  assert.equal(cache.state.regions[0].academyActive, 5);
  assert.deepEqual(errors, []);

  first.cleanup();
  assert.notStrictEqual(receiver.fetch, originalFetch);
  second.cleanup();
  assert.strictEqual(receiver.fetch, originalFetch);
});

test("fetch rejection remains the original rejection and is not reported as a capture failure", async () => {
  const networkError = new Error("offline");
  const errors = [];
  const target = { fetch: () => Promise.reject(networkError) };
  const capture = createResponseCapture({
    cache: createAutoMaxCache({}),
    getRealmId: () => 0,
    onError: (error) => errors.push(error),
  });
  const installed = installFetchCapture({ target, onResponse: capture.capture, onError: capture.reportError });

  await assert.rejects(target.fetch("/api/v3/resources/?realm=0"), (error) => error === networkError);
  await installed.flush();
  assert.deepEqual(errors, []);
  installed.cleanup();
});

test("XHR capture uses the existing dispatch seam without replacing constructor, open, or onload", async () => {
  const cache = createAutoMaxCache({});
  let captures = 0;
  const capture = createResponseCapture({
    cache,
    getRealmId: () => 1,
    persist: async () => { captures += 1; },
    now: () => 2_000,
  });
  const registration = createXhrCaptureRegistration(capture);

  class FakeXHR {
    open(method, url) {
      this.method = method;
      this.url = url;
      this.opened = true;
    }

    async send() {
      assert.equal(this.opened, true);
      this.status = 200;
      this.responseText = JSON.stringify([{ kind: 3, quantity: 12 }]);
      if (registration.urlMatch(this.url)) {
        await registration.func(this.url, this.method, this.responseText);
      }
      this.onload?.({ type: "load", target: this });
    }
  }
  const target = { XMLHttpRequest: FakeXHR };
  const originalConstructor = target.XMLHttpRequest;
  const originalOpen = target.XMLHttpRequest.prototype.open;
  let loadCalls = 0;

  const xhr = new target.XMLHttpRequest();
  xhr.open("GET", "https://www.simcompanies.com/api/v3/resources/?quality=all");
  xhr.onload = () => { loadCalls += 1; };
  await xhr.send();

  assert.strictEqual(target.XMLHttpRequest, originalConstructor);
  assert.strictEqual(target.XMLHttpRequest.prototype.open, originalOpen);
  assert.equal(loadCalls, 1);
  assert.equal(captures, 1);
  assert.deepEqual(cache.state.regions[1].warehouseResources, [{ kind: 3, quantity: 12 }]);
});

test("always-on component initializes once and persists XHR captures through the existing IndexedDB method", async () => {
  require("../../components/autoMaxFoundation.js");
  const { componentList, tools } = require("../../tools/tools.js");
  const component = componentList.autoMaxFoundation;
  const originalWindow = global.window;
  const originalDocument = global.document;
  const originalPersist = tools.indexDB_updateIndexDBData;
  const timers = new Map();
  const observers = [];
  let timerId = 0;
  let persistCalls = 0;
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.disconnected = false;
      observers.push(this);
    }

    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const originalFetch = async () => createJsonResponse({}).response;
  const fakeWindow = {
    fetch: originalFetch,
    location: { href: "https://www.simcompanies.com/landscape/" },
    MutationObserver: FakeMutationObserver,
    addEventListener() {},
    removeEventListener() {},
    setTimeout(callback) {
      timerId += 1;
      timers.set(timerId, callback);
      return timerId;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  const fakeDocument = {
    querySelector(selector) {
      if (selector === 'a[href*="/company/"]') {
        return { href: "https://www.simcompanies.com/company/0/example/" };
      }
      return null;
    },
  };

  try {
    global.window = fakeWindow;
    global.document = fakeDocument;
    tools.indexDB_updateIndexDBData = async () => { persistCalls += 1; };
    component.indexDBData.cache = {
      regions: { 0: { realmId: 0, academyActive: 5 } },
    };
    component.componentData.lifecycle = undefined;
    component.componentData.responseCapture = undefined;
    component.componentData.router = undefined;

    const first = component.startLifecycle();
    const second = component.startLifecycle();
    assert.strictEqual(first, second);
    assert.equal(observers.length, 1);
    assert.notStrictEqual(fakeWindow.fetch, originalFetch);

    await component.captureXhr(
      "/api/v2/companies/me/buildings/?source=xhr",
      "GET",
      JSON.stringify([building(4, 5)])
    );
    assert.equal(persistCalls, 1);
    assert.equal(component.indexDBData.cache.regions[0].buildings[0].id, 4);

    first.cleanup();
    assert.strictEqual(fakeWindow.fetch, originalFetch);
    assert.equal(observers[0].disconnected, true);
    assert.equal(timers.size, 0);
  } finally {
    component.componentData.lifecycle?.cleanup();
    component.componentData.lifecycle = undefined;
    component.componentData.responseCapture = undefined;
    component.componentData.router = undefined;
    component.indexDBData.cache = { regions: {} };
    tools.indexDB_updateIndexDBData = originalPersist;
    global.window = originalWindow;
    global.document = originalDocument;
  }
});

test("route monitor initializes once, dispatches only matching SPA handlers, and cleans up", () => {
  const events = [];
  const timers = [];
  const listeners = new Map();
  const observers = [];
  const target = {
    location: { href: "https://www.simcompanies.com/en/market/resource/3/" },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {},
  };
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.active = true;
      observers.push(this);
    }

    observe(document, options) {
      assert.deepEqual(options, { childList: true, subtree: true });
      assert.equal(document.kind, "document");
    }

    disconnect() { this.active = false; }
    trigger() { if (this.active) this.callback([]); }
  }
  const router = createRouteRegistry([
    {
      id: "market",
      match: AUTO_MAX_ROUTE_PATTERNS.marketPage,
      handler: (url) => events.push(["market", url]),
    },
    {
      id: "contracts",
      match: AUTO_MAX_ROUTE_PATTERNS.contractPage,
      handler: (url) => events.push(["contracts", url]),
    },
  ]);

  const first = createRouteMonitor({
    target,
    document: { kind: "document" },
    router,
    MutationObserverCtor: FakeMutationObserver,
  });
  const second = createRouteMonitor({
    target,
    document: { kind: "document" },
    router,
    MutationObserverCtor: FakeMutationObserver,
  });
  assert.strictEqual(first, second);
  assert.equal(observers.length, 1);

  timers.shift()();
  assert.deepEqual(events.map(([name]) => name), ["market"]);
  target.location.href = "https://www.simcompanies.com/headquarters/warehouse/incoming-contracts/";
  observers[0].trigger();
  observers[0].trigger();
  assert.deepEqual(events.map(([name]) => name), ["market", "contracts"]);

  first.cleanup();
  target.location.href = "https://www.simcompanies.com/en/market/resource/8/";
  observers[0].trigger();
  assert.deepEqual(events.map(([name]) => name), ["market", "contracts"]);
  assert.equal(listeners.has("popstate"), false);
});

test("TTL scheduler refreshes one stale current realm, skips fresh data, and coalesces concurrent checks", async () => {
  let now = 10 * HOUR_MS;
  const cache = createAutoMaxCache({
    constants: { timestamp: new Date(now).toISOString(), version: 1 },
    regions: {
      0: {
        realmId: 0,
        timestamp: new Date(now - HOUR_MS - 1).toISOString(),
        academyActive: 5,
        weatherUntil: new Date(now + HOUR_MS).toISOString(),
      },
      1: { realmId: 1, timestamp: new Date(now - HOUR_MS - 1).toISOString(), untouched: true },
    },
  }, () => now);
  let regionRefreshes = 0;
  let constantsRefreshes = 0;
  let releaseRefresh;
  const refreshGate = new Promise((resolve) => { releaseRefresh = resolve; });
  const scheduler = createTtlRefreshScheduler({
    cache,
    getRealmId: () => 0,
    now: () => now,
    refreshConstants: async () => {
      constantsRefreshes += 1;
      return success({ timestamp: new Date(now).toISOString() });
    },
    refreshRegion: async (realmId) => {
      regionRefreshes += 1;
      assert.equal(realmId, 0);
      await refreshGate;
      return success({ realmId, timestamp: new Date(now).toISOString(), refreshed: true });
    },
  });

  const first = scheduler.check();
  const second = scheduler.check();
  assert.equal(regionRefreshes, 1);
  assert.equal(constantsRefreshes, 0);
  releaseRefresh();
  await Promise.all([first, second]);
  await scheduler.check();

  assert.equal(regionRefreshes, 1);
  assert.equal(cache.state.regions[0].refreshed, true);
  assert.equal(cache.state.regions[1].untouched, true);
  scheduler.cleanup();
});

test("expired weather makes a fresh region stale without crossing realm boundaries", async () => {
  const now = 5 * HOUR_MS;
  const cache = createAutoMaxCache({
    regions: {
      0: {
        realmId: 0,
        timestamp: new Date(now).toISOString(),
        weatherUntil: new Date(now - 1).toISOString(),
      },
      1: {
        realmId: 1,
        timestamp: new Date(now).toISOString(),
        weatherUntil: new Date(now + HOUR_MS).toISOString(),
      },
    },
  }, () => now);
  const refreshed = [];
  const scheduler = createTtlRefreshScheduler({
    cache,
    getRealmId: () => 0,
    now: () => now,
    refreshRegion: async (realmId) => {
      refreshed.push(realmId);
      return success({ realmId, timestamp: new Date(now).toISOString(), weatherUntil: new Date(now + HOUR_MS).toISOString() });
    },
  });

  await scheduler.check();
  assert.deepEqual(refreshed, [0]);
  assert.equal(cache.state.regions[1].weatherUntil, new Date(now + HOUR_MS).toISOString());
});

test("missing or invalid weather expiry makes a fresh current region stale", async () => {
  const now = 5 * HOUR_MS;
  for (const weatherUntil of [undefined, "not-a-date"]) {
    const cache = createAutoMaxCache({
      regions: {
        0: { realmId: 0, timestamp: new Date(now).toISOString(), weatherUntil },
      },
    }, () => now);
    const refreshed = [];
    const scheduler = createTtlRefreshScheduler({
      cache,
      getRealmId: () => 0,
      now: () => now,
      refreshRegion: async (realmId) => {
        refreshed.push(realmId);
        return success({ realmId, timestamp: new Date(now).toISOString(), weatherUntil: new Date(now + HOUR_MS).toISOString() });
      },
    });

    await scheduler.check();

    assert.deepEqual(refreshed, [0]);
    scheduler.cleanup();
  }
});

test("Beijing refresh schedule invalidates fresh region data only when a source checkpoint is crossed", async () => {
  const scenarios = [
    { now: "2026-07-20T00:00:00.000Z", last: "2026-07-19T23:00:00.000Z" },
    { now: "2026-07-20T14:02:00.000Z", last: "2026-07-20T13:00:00.000Z" },
    { now: "2026-07-24T15:02:00.000Z", last: "2026-07-24T14:00:00.000Z" },
  ];
  for (const scenario of scenarios) {
    const now = Date.parse(scenario.now);
    const cache = createAutoMaxCache({
      regions: {
        0: {
          realmId: 0,
          timestamp: scenario.last,
          weatherUntil: new Date(now + HOUR_MS).toISOString(),
        },
      },
    }, () => now);
    const refreshed = [];
    const scheduler = createTtlRefreshScheduler({
      cache,
      getRealmId: () => 0,
      now: () => now,
      refreshRegion: async (realmId) => {
        refreshed.push(realmId);
        return success({ realmId, timestamp: new Date(now).toISOString(), weatherUntil: new Date(now + HOUR_MS).toISOString() });
      },
    });

    await scheduler.check();

    assert.deepEqual(refreshed, [0]);
    scheduler.cleanup();
  }

  const now = Date.parse("2026-07-20T00:00:00.000Z");
  const cache = createAutoMaxCache({
    regions: {
      0: {
        realmId: 0,
        timestamp: "2026-07-19T23:50:00.000Z",
        weatherUntil: new Date(now + HOUR_MS).toISOString(),
      },
    },
  }, () => now);
  const scheduler = createTtlRefreshScheduler({
    cache,
    getRealmId: () => 0,
    now: () => now,
    refreshRegion: async () => assert.fail("records written after the checkpoint must stay fresh"),
  });

  await scheduler.check();
  scheduler.cleanup();
});

test("500 and malformed JSON responses report recoverable failures without cache mutation", async () => {
  const cache = createAutoMaxCache({ regions: { 0: { sentinel: true } } });
  const before = structuredClone(cache.state);
  const errors = [];
  const capture = createResponseCapture({
    cache,
    getRealmId: () => 0,
    persist: async () => assert.fail("invalid responses must not persist"),
    onError: (error) => errors.push(error),
  });
  const serverError = createJsonResponse([building()], { status: 500 });
  const malformed = createJsonResponse(null, { malformed: true });
  const responses = [serverError.response, malformed.response];
  const target = { fetch: async () => responses.shift() };
  const installed = installFetchCapture({ target, onResponse: capture.capture, onError: capture.reportError });

  assert.strictEqual(await target.fetch("/api/v2/companies/me/buildings/?attempt=1"), serverError.response);
  assert.strictEqual(await target.fetch("/api/v3/resources/?attempt=2"), malformed.response);
  await installed.flush();

  assert.deepEqual(cache.state, before);
  assert.deepEqual(errors.map(({ code }) => code).sort(), ["CAPTURE_HTTP_ERROR", "CAPTURE_JSON_INVALID"]);
  assert.equal(serverError.state.cloneCalls, 0);
  assert.equal(malformed.state.cloneCalls, 1);
  installed.cleanup();
});

test("an unknown realm never falls through to realm zero", async () => {
  const cache = createAutoMaxCache({ regions: { 0: { sentinel: true } } });
  const errors = [];
  const capture = createResponseCapture({
    cache,
    getRealmId: () => null,
    onError: (error) => errors.push(error),
  });

  const result = await capture.capture({
    url: "/api/v3/resources/",
    status: 200,
    data: [{ kind: 4, quantity: 2 }],
    transport: "xhr",
  });

  assert.equal(result.ok, false);
  assert.equal(errors[0].code, "CAPTURE_REALM_UNAVAILABLE");
  assert.deepEqual(cache.state.regions[0], { sentinel: true });
});

test("building refresh runs only when academy active changes while repeated cache merges remain idempotent", async () => {
  const cache = createAutoMaxCache({});
  const refreshes = [];
  const capture = createResponseCapture({
    cache,
    getRealmId: () => 0,
    onAcademyChange: async (realmId, academyActive) => refreshes.push([realmId, academyActive]),
    now: () => 3_000,
  });
  const url = "/api/v2/companies/me/buildings/";

  await capture.capture({ url, status: 200, data: [building(1, 5)], transport: "xhr" });
  await capture.capture({ url, status: 200, data: [building(1, 5)], transport: "fetch" });
  await capture.capture({ url, status: 200, data: [building(1, 6)], transport: "fetch" });

  assert.deepEqual(refreshes, [[0, 5], [0, 6]]);
  assert.equal(cache.state.regions[0].academyActive, 6);
  assert.equal(cache.state.regions[0].buildings.length, 1);
});
