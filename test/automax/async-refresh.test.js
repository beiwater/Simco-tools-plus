const assert = require("node:assert/strict");
const test = require("node:test");

const { componentList } = require("../../tools/tools.js");

require("../../components/autoMaxIncomingContractProfit.js");
require("../../components/autoMaxWarehouseProfit.js");

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
    component.componentData.pending = new WeakSet();
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
    component.componentData.pending = new WeakSet();
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
    component.componentData.pending = new WeakSet();
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
    component.componentData.pending = new WeakSet();
    component.componentData.revision = 0;
    global.document = originalDocument;
  }
});
