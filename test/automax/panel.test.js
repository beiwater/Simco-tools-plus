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
    this.offsetHeight = 36;
    this.offsetWidth = 74;
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

  contains(node) {
    return node === this || this.children.some((child) => child.contains(node));
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

test("AutoMax panel uses the SCT front entry, imports legacy choices once, and persists page-action changes", async () => {
  require("../../components/autoMaxPanel.js");
  const component = componentList.autoMaxPanel;
  const originalDocument = global.document;
  const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(global, "localStorage");
  const originalWindow = global.window;
  const originalPersist = tools.indexDB_updateIndexDBData;
  const document = createDom();
  const windowListeners = new Map();
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
    innerHeight: 600,
    innerWidth: 800,
    removeEventListener(type) { windowListeners.delete(type); },
    setTimeout(callback) { callback(); return 1; },
  };
  tools.indexDB_updateIndexDBData = async () => { persistCount += 1; };

  try {
    component.componentData = {
      drag: undefined,
      panel: undefined,
      panelStatus: undefined,
      panelSettings: undefined,
      open: false,
      outsideListener: undefined,
      resizeListener: undefined,
    };
    component.indexDBData.settings = createAutoMaxSettings();

    component.startup();
    component.startup();

    assert.equal(document.body.children.length, 1);
    assert.equal(document.getElementById("automax_panel_launcher"), undefined);
    assert.equal(component.indexDBData.settings.pageActions.marketMaxProfitToggle, true);
    assert.equal(component.indexDBData.settings.legacyImportVersion, 1);
    assert.equal(persistCount, 1);

    component.componentData.panel.offsetWidth = 320;
    component.componentData.panel.offsetHeight = 480;
    component.indexDBData.settings.panelPosition = { left: 301, bottom: 631 };
    global.window.innerWidth = 375;
    global.window.innerHeight = 667;
    component.syncPosition();
    assert.equal(component.componentData.panel.style.left, "55px");
    assert.equal(component.componentData.panel.style.bottom, "187px");

    component.frontUI();
    assert.equal(component.componentData.panel.dataset.open, "true");
    assert.equal(component.componentData.panel.getAttribute("aria-hidden"), "false");

    component.toggleInlineSettings();
    const actionControls = component.componentData.panelSettings.children[0];
    assert.equal(actionControls.className, "automax-action-controls");
    assert.equal(actionControls.children[1].className, "automax-action-label");
    const checkbox = findByTag(component.componentData.panelSettings, "input");
    checkbox.checked = false;
    checkbox.listeners.get("change")();
    await Promise.resolve();
    assert.equal(component.indexDBData.settings.pageActions.runtimeDuration, false);
    assert.equal(persistCount, 2);

    component.closePanel();
    assert.equal(component.componentData.panel.getAttribute("aria-hidden"), "true");
  } finally {
    component.componentData = {
      drag: undefined,
      panel: undefined,
      panelStatus: undefined,
      panelSettings: undefined,
      open: false,
      outsideListener: undefined,
      resizeListener: undefined,
    };
    component.indexDBData.settings = createAutoMaxSettings();
    global.document = originalDocument;
    if (originalLocalStorageDescriptor) Object.defineProperty(global, "localStorage", originalLocalStorageDescriptor);
    else delete global.localStorage;
    global.window = originalWindow;
    tools.indexDB_updateIndexDBData = originalPersist;
  }
});
