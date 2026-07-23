const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MARKET_PROFIT_CSS,
  adjustedMarketCost,
  createMarketProfitControls,
  summarizeMarketOrders,
} = require("../../tools/automax/marketProfitControls.js");

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.listeners = new Map();
    this.style = {};
    this.textContent = "";
    this.type = "";
    this.value = "";
  }

  append(...children) {
    this.children.push(...children);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }
}

function findText(node, text) {
  return node.textContent === text || node.children.some((child) => findText(child, text));
}

function createDocument() {
  return { createElement: (tagName) => new FakeElement(tagName) };
}

test("market profit controls restore every original market simulation input", () => {
  const controls = createMarketProfitControls({
    customEnabled: false,
    document: createDocument(),
    isDark: false,
    settings: { buildingHours: 24, buildingLevel: 100, economyState: "", mpAdjustment: 0 },
  });

  for (const label of ["自定义：关", "自定义数据", "MP-", "%", "4%", "清空", "周期:", "当前", "级建筑运行", "H"]) {
    assert.equal(findText(controls.root, label), true, `missing original control: ${label}`);
  }
  assert.equal(controls.mpInput.value, "0");
  assert.equal(controls.buildingLevelInput.value, "100");
  assert.equal(controls.buildingHoursInput.value, "24");
  assert.equal(controls.root.dataset.theme, "light");
});

test("enabled market controls keep enabled semantics across pointer states", () => {
  assert.match(MARKET_PROFIT_CSS, /data-enabled="true"[^}]+:is\(:hover, :active\)[^}]+--sct-enabled/);
  assert.match(MARKET_PROFIT_CSS, /data-theme="light"[^}]+data-enabled="true"[^}]+:is\(:hover, :active\)[^}]+--sct-light-enabled/);
  assert.match(MARKET_PROFIT_CSS, /data-automax-market-best[^}]+--sct-focus/);
});

test("market MP adjustment keeps percentage and fixed-reduction semantics", () => {
  assert.equal(adjustedMarketCost(100, 4), 96);
  assert.equal(adjustedMarketCost(100, -4), 96);
  assert.equal(adjustedMarketCost(3, -4), undefined);
});

test("market summary returns an empty state when no order is profitable", () => {
  const summary = summarizeMarketOrders([
    { hourlyProfit: -2, seconds: 3600 },
    { hourlyProfit: 0, seconds: 1800 },
  ], { buildingHours: 24, buildingLevel: 100 });

  assert.equal(summary.kind, "empty");
});

test("market summary fills the requested building runtime from the best orders", () => {
  const summary = summarizeMarketOrders([
    { hourlyProfit: 20, seconds: 3600 },
    { hourlyProfit: 10, seconds: 7200 },
  ], { buildingHours: 2, buildingLevel: 1 });

  assert.equal(summary.kind, "summary");
  assert.equal(summary.coveredHours, 2);
  assert.equal(summary.hourlyProfit, 15);
  assert.equal(summary.isFull, true);
  assert.equal(summary.title, "1级建筑运行2H正时利");
});
