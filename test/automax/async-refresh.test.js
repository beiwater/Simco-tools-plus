const assert = require("node:assert/strict");
const test = require("node:test");

const { componentList } = require("../../tools/tools.js");

require("../../components/autoMaxIncomingContractProfit.js");
require("../../components/autoMaxWarehouseProfit.js");
require("../../components/autoMaxMarketProfit.js");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function settle(promise) {
  await promise;
  await new Promise((resolve) => setImmediate(resolve));
}

test("incoming profit survives an unchanged refresh while calculation is pending", async () => {
  const component = componentList.autoMaxIncomingContractProfit;
  const originalDocument = global.document;
  const originals = {
    applyHighPriceGuard: component.applyHighPriceGuard,
    calculate: component.calculate,
    context: component.context,
    createDisplay: component.createDisplay,
    insertDisplay: component.insertDisplay,
    parseCard: component.parseCard,
    render: component.render,
  };
  const calculation = deferred();
  const display = { isConnected: true, textContent: "利润/MP 计算中" };
  let calculationCalls = 0;
  let renderCalls = 0;
  let insertedDisplay;
  const card = {
    querySelector() { return insertedDisplay; },
  };

  try {
    component.enable = true;
    component.componentData.generation = 0;
    component.componentData.pending = new WeakMap();
    component.context = () => ({ constants: {}, realmId: 0, region: {} });
    component.parseCard = () => ({ quality: 0, quantity: 1, resourceId: 1, totalPrice: 1, unitPrice: 1 });
    component.createDisplay = () => display;
    component.insertDisplay = (_card, output) => { insertedDisplay = output; };
    component.calculate = () => {
      calculationCalls += 1;
      return calculation.promise;
    };
    component.render = (output) => {
      renderCalls += 1;
      output.textContent = "已渲染";
    };
    component.applyHighPriceGuard = () => {};
    global.document = {
      querySelectorAll(selector) {
        return selector === 'div[tabindex="0"]' ? [card] : [];
      },
    };

    component.refresh();
    component.refresh();
    assert.equal(calculationCalls, 1);

    calculation.resolve({ mp: {} });
    await settle(calculation.promise);

    assert.equal(renderCalls, 1);
    assert.equal(display.textContent, "已渲染");
  } finally {
    Object.assign(component, originals);
    component.componentData.generation = 0;
    component.componentData.pending = new WeakMap();
    global.document = originalDocument;
  }
});

test("warehouse profit survives an unchanged refresh while calculation is pending", async () => {
  const component = componentList.autoMaxWarehouseProfit;
  const originalDocument = global.document;
  const originals = {
    calculate: component.calculate,
    context: component.context,
    itemFromStack: component.itemFromStack,
    itemStacks: component.itemStacks,
    quantityRow: component.quantityRow,
  };
  const calculation = deferred();
  let calculationCalls = 0;
  let output;
  const target = {
    append(node) {
      output = node;
      node.isConnected = true;
    },
  };
  const stack = {
    querySelector() { return output; },
  };

  try {
    component.enable = true;
    component.componentData.pending = new WeakMap();
    component.componentData.revision = 0;
    component.context = () => ({});
    component.itemStacks = () => [stack];
    component.itemFromStack = () => ({ quality: 0, quantity: 1, unitCost: 1 });
    component.quantityRow = () => target;
    component.calculate = () => {
      calculationCalls += 1;
      return calculation.promise;
    };
    global.document = {
      createElement() {
        return {
          isConnected: false,
          setAttribute() {},
          textContent: "",
          toggleAttribute() {},
        };
      },
      querySelectorAll() { return []; },
    };

    component.refresh();
    component.refresh();
    assert.equal(calculationCalls, 1);

    calculation.resolve({ hourlyProfit: 12, price: 34 });
    await settle(calculation.promise);

    assert.match(output.textContent, /^时利润：\$12\.00（建议 \$34\.00）$/);
  } finally {
    Object.assign(component, originals);
    component.componentData.pending = new WeakMap();
    component.componentData.revision = 0;
    global.document = originalDocument;
  }
});

test("incoming clear followed by refresh supersedes pending work", async () => {
  const component = componentList.autoMaxIncomingContractProfit;
  const originalDocument = global.document;
  const originals = {
    applyHighPriceGuard: component.applyHighPriceGuard,
    calculate: component.calculate,
    context: component.context,
    createDisplay: component.createDisplay,
    insertDisplay: component.insertDisplay,
    parseCard: component.parseCard,
    render: component.render,
  };
  const calculations = [deferred(), deferred()];
  const displays = [];
  let calculationCalls = 0;
  let currentDisplay;
  const card = {
    classList: { remove() {} },
    querySelector() { return currentDisplay?.isConnected ? currentDisplay : undefined; },
  };

  try {
    component.enable = true;
    component.componentData.generation = 0;
    component.componentData.pending = new WeakMap();
    component.context = () => ({ constants: {}, realmId: 0, region: {} });
    component.parseCard = () => ({ quality: 0, quantity: 1, resourceId: 1, totalPrice: 1, unitPrice: 1 });
    component.createDisplay = () => {
      const display = {
        isConnected: true,
        remove() { this.isConnected = false; },
        textContent: "利润/MP 计算中",
      };
      displays.push(display);
      return display;
    };
    component.insertDisplay = (_card, output) => { currentDisplay = output; };
    component.calculate = () => calculations[calculationCalls++].promise;
    component.render = (output) => { output.textContent = "已渲染"; };
    component.applyHighPriceGuard = () => {};
    global.document = {
      querySelectorAll(selector) {
        if (selector === 'div[tabindex="0"]') return [card];
        if (selector === "[data-automax-incoming-profit]") return displays.filter((display) => display.isConnected);
        return [];
      },
    };

    component.refresh();
    component.clear();
    component.refresh();

    assert.equal(calculationCalls, 2);
    calculations[0].resolve({ mp: {} });
    await settle(calculations[0].promise);
    assert.equal(currentDisplay.textContent, "利润/MP 计算中");
    calculations[1].resolve({ mp: {} });
    await settle(calculations[1].promise);
    assert.equal(currentDisplay.textContent, "已渲染");
  } finally {
    Object.assign(component, originals);
    component.componentData.generation = 0;
    component.componentData.pending = new WeakMap();
    global.document = originalDocument;
  }
});

test("warehouse clear followed by refresh supersedes pending work", async () => {
  const component = componentList.autoMaxWarehouseProfit;
  const originalDocument = global.document;
  const originals = {
    calculate: component.calculate,
    context: component.context,
    itemFromStack: component.itemFromStack,
    itemStacks: component.itemStacks,
    quantityRow: component.quantityRow,
  };
  const calculations = [deferred(), deferred()];
  const outputs = [];
  let calculationCalls = 0;
  let currentOutput;
  const target = {
    append(node) {
      currentOutput = node;
      node.isConnected = true;
      outputs.push(node);
    },
  };
  const stack = {
    querySelector() { return currentOutput?.isConnected ? currentOutput : undefined; },
  };

  try {
    component.enable = true;
    component.componentData.pending = new WeakMap();
    component.componentData.revision = 0;
    component.context = () => ({});
    component.itemStacks = () => [stack];
    component.itemFromStack = () => ({ quality: 0, quantity: 1, unitCost: 1 });
    component.quantityRow = () => target;
    component.calculate = () => calculations[calculationCalls++].promise;
    global.document = {
      createElement() {
        return {
          isConnected: false,
          remove() { this.isConnected = false; },
          setAttribute() {},
          textContent: "",
          toggleAttribute() {},
        };
      },
      querySelectorAll(selector) {
        return selector === "[data-automax-warehouse-profit]"
          ? outputs.filter((output) => output.isConnected)
          : [];
      },
    };

    component.refresh();
    component.clear();
    component.refresh();

    assert.equal(calculationCalls, 2);
    calculations[0].resolve({ hourlyProfit: 1, price: 2 });
    await settle(calculations[0].promise);
    assert.equal(currentOutput.textContent, "时利润：计算中");
    calculations[1].resolve({ hourlyProfit: 12, price: 34 });
    await settle(calculations[1].promise);
    assert.match(currentOutput.textContent, /^时利润：\$12\.00（建议 \$34\.00）$/);
  } finally {
    Object.assign(component, originals);
    component.componentData.pending = new WeakMap();
    component.componentData.revision = 0;
    global.document = originalDocument;
  }
});

test("market profit clear followed by refresh supersedes pending work", async () => {
  const component = componentList.autoMaxMarketProfit;
  const originalDocument = global.document;
  const originals = {
    calculateProfit: component.calculateProfit,
    contextFor: component.contextFor,
    enabled: component.enabled,
    mountControls: component.mountControls,
    parseOrder: component.parseOrder,
    renderSummary: component.renderSummary,
    resourceId: component.resourceId,
  };
  const calculations = [deferred(), deferred()];
  let calculationCalls = 0;
  const cells = [];
  const row = {
    __automaxMarketResult: undefined,
    appendChild(cell) {
      cell.isConnected = true;
      cells.push(cell);
    },
    children: [],
    getAttribute() { return "market order"; },
    insertBefore(cell) {
      cell.isConnected = true;
      cells.push(cell);
    },
    querySelector() { return undefined; },
    removeAttribute() {},
  };

  try {
    component.enable = true;
    component.componentData.refreshVersion = 0;
    component.componentData.pending = new WeakSet();
    component.componentData.pendingCount = 0;
    component.enabled = () => true;
    component.resourceId = () => 1;
    component.contextFor = () => ({});
    component.mountControls = () => {};
    component.renderSummary = () => {};
    component.parseOrder = () => ({ price: 10, quality: 0, quantity: 100 });
    component.calculateProfit = () => calculations[calculationCalls++].promise;

    global.document = {
      createElement(tag) {
        return {
          appendChild(child) { this.child = child; },
          isConnected: false,
          remove() { this.isConnected = false; },
          setAttribute() {},
          style: {},
          tagName: tag.toUpperCase(),
        };
      },
      querySelectorAll(selector) {
        if (selector === "tr[aria-label]") return [row];
        if (selector.startsWith("td[")) return cells.filter((c) => c.isConnected);
        return [];
      },
    };

    component.refresh();
    assert.equal(calculationCalls, 1);
    assert.equal(component.componentData.pendingCount, 1);

    component.clear();
    assert.equal(component.componentData.pendingCount, 0);

    component.refresh();
    assert.equal(calculationCalls, 2);
    assert.equal(component.componentData.pendingCount, 1);

    calculations[0].resolve({ hourlyProfit: 50 });
    await settle(calculations[0].promise);
    assert.equal(cells[0].isConnected, false);

    calculations[1].resolve({ hourlyProfit: 100 });
    await settle(calculations[1].promise);
    assert.equal(cells[1].isConnected, true);
    assert.equal(row.__automaxMarketResult.hourlyProfit, 100);
  } finally {
    Object.assign(component, originals);
    component.componentData.refreshVersion = 0;
    component.componentData.pending = new WeakSet();
    component.componentData.pendingCount = 0;
    global.document = originalDocument;
  }
});
