const assert = require("node:assert/strict");
const test = require("node:test");

const { createAutoMaxSettings } = require("../../tools/automax/settings.js");
const { componentList, tools } = require("../../tools/tools.js");

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.attributes = {};
    this.children = [];
    this.dataset = {};
    this.hidden = false;
    this.id = "";
    this.isConnected = false;
    this.listeners = new Map();
    this.parentNode = undefined;
    this.style = {};
    this.textContent = "";
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      node.isConnected = true;
      this.children.push(node);
    }
  }

  appendChild(node) {
    this.append(node);
    return node;
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
}

function findByTag(node, tagName) {
  if (node.tagName === tagName.toUpperCase()) return node;
  for (const child of node.children) {
    const match = findByTag(child, tagName);
    if (match) return match;
  }
  return undefined;
}

function createDom() {
  const documentListeners = new Map();
  const body = new FakeElement("body");
  return {
    body,
    addEventListener(type, listener) { documentListeners.set(type, listener); },
    createElement(tagName) { return new FakeElement(tagName); },
    getElementById(id) {
      const visit = (node) => {
        if (node.id === id) return node;
        for (const child of node.children) {
          const found = visit(child);
          if (found) return found;
        }
        return undefined;
      };
      return visit(body);
    },
    removeEventListener(type) { documentListeners.delete(type); },
  };
}

test("AutoMax settings stay inside SCT, import legacy choices once, and persist page-action changes", async () => {
  require("../../components/autoMaxPanel.js");
  const component = componentList.autoMaxPanel;
  const originalDocument = global.document;
  const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(global, "localStorage");
  const originalWindow = global.window;
  const originalCustomEvent = global.CustomEvent;
  const originalPersist = tools.indexDB_updateIndexDBData;
  const document = createDom();
  const windowListeners = new Map();
  const dispatchedEvents = [];
  let persistCount = 0;
  global.document = document;
  Object.defineProperty(global, "localStorage", { configurable: true, value: {
    getItem(key) {
      if (key === "SC_PageActions_Settings") return JSON.stringify({ marketProfit: true });
      if (key === "SC_PanelPosition") return JSON.stringify({ left: 24, bottom: 32 });
      return null;
    },
  } });
  global.window = {
    addEventListener(type, listener) { windowListeners.set(type, listener); },
    clearTimeout() {},
    dispatchEvent(event) { dispatchedEvents.push(event.type); },
    removeEventListener(type) { windowListeners.delete(type); },
    setTimeout(callback) { callback(); return 1; },
  };
  global.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  tools.indexDB_updateIndexDBData = async () => { persistCount += 1; };

  try {
    component.indexDBData.settings = createAutoMaxSettings();

    component.startup();
    component.startup();

    assert.equal(document.body.children.length, 0);
    assert.equal(component.frontUI, undefined);
    assert.equal(component.settingUI, undefined);
    assert.equal(component.indexDBData.settings.pageActions.marketMaxProfitToggle, true);
    assert.equal(component.indexDBData.settings.legacyImportVersion, 1);
    assert.equal(persistCount, 1);

    const settings = component.inlineSettingUI();
    assert.equal(settings.tagName, "SECTION");
    assert.equal(settings.className, "automax-sct-settings");
    const checkbox = findByTag(settings, "input");
    checkbox.checked = false;
    checkbox.listeners.get("change")();
    await Promise.resolve();
    assert.equal(component.indexDBData.settings.pageActions.runtimeDuration, false);
    assert.equal(persistCount, 2);
    assert.deepEqual(dispatchedEvents, ["automax-settings-changed"]);
  } finally {
    component.indexDBData.settings = createAutoMaxSettings();
    global.document = originalDocument;
    if (originalLocalStorageDescriptor) Object.defineProperty(global, "localStorage", originalLocalStorageDescriptor);
    else delete global.localStorage;
    global.window = originalWindow;
    global.CustomEvent = originalCustomEvent;
    tools.indexDB_updateIndexDBData = originalPersist;
  }
});
