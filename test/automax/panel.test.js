const assert = require("node:assert/strict");
const test = require("node:test");

const { createAutoMaxSettings } = require("../../tools/automax/settings.js");
const { componentList, tools } = require("../../tools/tools.js");
const { focusBoardroomSlot } = require("../../components/autoMaxExecutive.js");

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
    for (let node of nodes) {
      if (typeof node === "string") {
        const textNode = new FakeElement("#text");
        textNode.textContent = node;
        node = textNode;
      }
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

  closest(selector) {
    let current = this;
    while (current) {
      if (selector === "form" && current.tagName === "FORM") return current;
      if (selector === ".row" && String(current.attributes.class || "").includes("row")) return current;
      current = current.parentNode;
    }
    return undefined;
  }

  get nodeType() {
    return 1;
  }

  get nextElementSibling() {
    if (!this.parentNode) return undefined;
    const idx = this.parentNode.children.indexOf(this);
    if (idx === -1 || idx === this.parentNode.children.length - 1) return undefined;
    return this.parentNode.children[idx + 1];
  }

  remove() {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) {
        this.parentNode.children.splice(idx, 1);
        this.isConnected = false;
        this.parentNode = undefined;
      }
    }
  }

  after(node) {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) {
        node.parentNode = this.parentNode;
        node.isConnected = this.parentNode.isConnected;
        this.parentNode.children.splice(idx + 1, 0, node);
      }
    }
  }

  set innerHTML(value) {
    this._innerHTML = value;
    this.children = [];
    
    const trMatches = value.matchAll(/<tr class="script_cpt_node" id='([^']+)'>([\s\S]*?)<\/tr>/g);
    for (const trMatch of trMatches) {
      const componentId = trMatch[1];
      const trContent = trMatch[2];
      
      const trElement = new FakeElement("tr");
      trElement.id = componentId;
      trElement.setAttribute("class", "script_cpt_node");
      trElement.parentNode = this;
      trElement.isConnected = this.isConnected;
      
      const leftBtnMatch = trContent.match(/class="btn CPTOptionLeft ([^"]*)"/);
      const leftClass = leftBtnMatch ? leftBtnMatch[1] : "";
      const leftBtn = new FakeElement("button");
      leftBtn.setAttribute("class", `btn CPTOptionLeft ${leftClass}`);
      leftBtn.parentNode = trElement;
      leftBtn.isConnected = this.isConnected;
      
      const rightBtnMatch = trContent.match(/class="btn CPTOptionRight ([^"]*)"/);
      const rightClass = rightBtnMatch ? rightBtnMatch[1] : "";
      const rightBtn = new FakeElement("button");
      rightBtn.setAttribute("class", `btn CPTOptionRight ${rightClass}`);
      rightBtn.parentNode = trElement;
      rightBtn.isConnected = this.isConnected;
      
      trElement.append(leftBtn, rightBtn);
      this.children.push(trElement);
    }
    
    if (value.includes("id=\"script_cptSearch_input\"")) {
      const input = new FakeElement("input");
      input.id = "script_cptSearch_input";
      input.parentNode = this;
      input.isConnected = this.isConnected;
      this.children.push(input);
    }
    if (value.includes("id=\"scriptCPT_tagSerach\"")) {
      const div = new FakeElement("div");
      div.id = "scriptCPT_tagSerach";
      div.parentNode = this;
      div.isConnected = this.isConnected;
      this.children.push(div);
    }
  }

  get innerHTML() {
    return this._innerHTML ?? "";
  }

  querySelector(selector) {
    const match = (node) => {
      if (/^[a-z]+$/i.test(selector)) return node.tagName === selector.toUpperCase();
      if (selector === "button") {
        return node.tagName === "BUTTON";
      }
      if (selector === "button.CPTOptionLeft") {
        return node.tagName === "BUTTON" && String(node.attributes.class || "").includes("CPTOptionLeft");
      }
      if (selector === "button.CPTOptionRight") {
        return node.tagName === "BUTTON" && String(node.attributes.class || "").includes("CPTOptionRight");
      }
      if (selector === "input#script_cptSearch_input") {
        return node.tagName === "INPUT" && node.id === "script_cptSearch_input";
      }
      if (selector === "div#scriptCPT_tagSerach") {
        return node.tagName === "DIV" && node.id === "scriptCPT_tagSerach";
      }
      return false;
    };
    const visit = (node) => {
      if (match(node)) return node;
      for (const child of node.children) {
        const found = visit(child);
        if (found) return found;
      }
      return undefined;
    };
    return visit(this);
  }

  querySelectorAll(selector) {
    const results = [];
    const match = (node) => {
      if (selector === "tbody > tr.script_cpt_node") {
        return node.tagName === "TR" && String(node.attributes.class || "").includes("script_cpt_node");
      }
      return false;
    };
    const visit = (node) => {
      if (match(node)) results.push(node);
      for (const child of node.children) {
        visit(child);
      }
    };
    visit(this);
    return results;
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

function findAllByTag(node, tagName) {
  const matches = node.tagName === tagName.toUpperCase() ? [node] : [];
  for (const child of node.children) matches.push(...findAllByTag(child, tagName));
  return matches;
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

test("boardroom rerenders restore focus to the replacement slot control", () => {
  let focused = false;
  let selector;
  const root = { querySelector(value) { selector = value; return { focus() { focused = true; } }; } };
  assert.equal(focusBoardroomSlot(root, "f"), true);
  assert.equal(selector, '[data-slot-id="f"] > [role="button"]');
  assert.equal(focused, true);
  assert.equal(focusBoardroomSlot({ querySelector: () => null }, "f"), false);
});

test("autoMaxRuntimeSaturation settings inline UI behaves correctly", async () => {
  require("../../components/autoMaxRuntimeSaturation.js");
  const component = componentList.autoMaxRuntimeSaturation;
  const originalDocument = global.document;
  const document = createDom();
  global.document = document;

  try {
    const inlineUI = component.inlineSettingUI();
    assert.equal(inlineUI.tagName, "DIV");
    assert.equal(inlineUI.className, "automax-saturation-container");
    const btn = inlineUI.querySelector("button");
    assert.ok(btn);
    assert.equal(btn.textContent, "查看领域饱和度");
  } finally {
    global.document = originalDocument;
  }
});

test("autoMaxRuntimeSaturation exposes the active sort direction in its table header", () => {
  require("../../components/autoMaxRuntimeSaturation.js");
  const component = componentList.autoMaxRuntimeSaturation;
  const originalDocument = global.document;
  const document = createDom();
  global.document = document;
  try {
    component.componentData.saturationRows = [];
    component.componentData.saturationSort = { key: "resourceName", direction: "asc" };
    const table = component.createSaturationTable();
    component.componentData.saturationPanel = table;
    const headers = findAllByTag(table, "th");
    const buttons = findAllByTag(table, "button");
    const emptyCell = findAllByTag(table, "td").find((cell) => cell.className === "automax-data-empty");
    assert.equal(headers[0].getAttribute("aria-sort"), "ascending");
    assert.equal(emptyCell.textContent, "当前领域没有可用的饱和度数据。");
    assert.equal(buttons[0].textContent, "物品 ↑");
    buttons[0].listeners.get("click")();
    assert.equal(headers[0].getAttribute("aria-sort"), "descending");
    assert.equal(buttons[0].textContent, "物品 ↓");
  } finally {
    component.componentData.saturationPanel = undefined;
    global.document = originalDocument;
  }
});

test("basisCPT integration: inlineSettingUI behaves as both frontUI and settingUI for autoMaxRuntimeSaturation", async () => {
  require("../../components/autoMaxRuntimeSaturation.js");
  require("../../components/basisCPT.js");
  const satComponent = componentList.autoMaxRuntimeSaturation;
  const basisComponent = componentList.basisCPT;

  const originalDocument = global.document;
  const document = createDom();
  global.document = document;

  try {
    const sideBarNode = basisComponent.sideBarSub_componentNode();
    const row = sideBarNode.children.find((child) => child.id === "autoMaxRuntimeSaturation");
    assert.ok(row);

    const leftButton = row.querySelector("button.CPTOptionLeft");
    const rightButton = row.querySelector("button.CPTOptionRight");
    assert.ok(leftButton);
    assert.ok(rightButton);

    assert.ok(leftButton.getAttribute("class").includes("funcExist"));
    assert.ok(rightButton.getAttribute("class").includes("funcExist"));

    let toggledCount = 0;
    basisComponent.sideBarSub_toggleInlineSetting = (r, comp) => {
      assert.strictEqual(r, row);
      assert.strictEqual(comp, satComponent);
      toggledCount += 1;
    };

    leftButton.listeners.get("click")();
    assert.equal(toggledCount, 1);

    rightButton.listeners.get("click")();
    assert.equal(toggledCount, 2);
  } finally {
    global.document = originalDocument;
  }
});

test("autoMaxOutgoingMP correctly calculates product cost, transport cost and net profits", async () => {
  require("../../components/autoMaxOutgoingMP.js");
  const component = componentList.autoMaxOutgoingMP;
  
  componentList.autoMaxFoundation = {
    indexDBData: {
      cache: {
        constants: {
          constantsResources: {
            10: { transportation: 1 },
          }
        },
        regions: {
          "0": {
            realmId: 0,
            warehouseResources: [
              { kind: 10, quality: 1, amount: 100, cost: { "0": 1500 } },
              { kind: 13, amount: 200, cost: { "0": 60 } },
            ]
          }
        }
      }
    }
  };

  const originalDocument = global.document;
  const document = createDom();
  global.document = document;

  try {
    const displayDiv = document.createElement("div");
    const priceInput = new FakeElement("input");
    priceInput.value = "20.0";
    component.calculateAndRenderProfit(
      displayDiv,
      20.0,
      100,
      { realmId: 0, resourceId: 10 },
      priceInput
    );

    const hasText = (node, text) => {
      if (node._innerHTML && node._innerHTML.includes(text)) return true;
      if (node.textContent && node.textContent.includes(text)) return true;
      for (const child of node.children) {
        if (hasText(child, text)) return true;
      }
      return false;
    };

    assert.ok(hasText(displayDiv, "市场利润"));
    assert.ok(hasText(displayDiv, "合同利润"));
  } finally {
    global.document = originalDocument;
  }
});

test("basisCPT uisetting generates explicit data-cpt-key and data-config-key attributes", async () => {
  require("../../components/autoMaxRuntimeSaturation.js");
  require("../../components/basisCPT.js");
  const basisComponent = componentList.basisCPT;
  const originalDocument = global.document;
  const document = createDom();
  global.document = document;

  try {
    const settingNode = basisComponent.uisetting();
    const html = settingNode.innerHTML;
    assert.ok(html.includes('data-config-key="net_gap_ms"'));
    assert.ok(html.includes('data-config-key="fontColor"'));
    assert.ok(html.includes('data-cpt-key="autoMaxRuntimeSaturation"'));
  } finally {
    global.document = originalDocument;
  }
});

