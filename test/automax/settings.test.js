const assert = require("node:assert/strict");
const test = require("node:test");

const {
  clampPanelPosition,
  createAutoMaxSettings,
  getPageActionEnabled,
  importLegacySettings,
  togglePageAction,
} = require("../../tools/automax/settings.js");

function createStorage(values = {}) {
  return {
    getItem(key) {
      return Object.hasOwn(values, key) ? values[key] : null;
    },
  };
}

test("imports only user-authored panel and page-action settings once", () => {
  const storage = createStorage({
    SC_PageActions_Settings: JSON.stringify({ marketProfit: true, chatAccessibility: false, futureTool: true }),
    SC_PanelPosition: JSON.stringify({ left: 9999, bottom: -20 }),
    SimcompaniesRetailCalculation_0: JSON.stringify({ stale: "must not be imported" }),
  });

  const first = importLegacySettings(createAutoMaxSettings(), storage, { width: 400, height: 300, panelWidth: 220, panelHeight: 120 });

  assert.equal(first.imported, true);
  assert.equal(first.settings.pageActions.marketMaxProfitToggle, true);
  assert.equal(first.settings.pageActions.chatAccessibility, false);
  assert.equal(first.settings.pageActions.futureTool, true);
  assert.deepEqual(first.settings.panelPosition, { left: 180, bottom: 0 });
  assert.equal(Object.hasOwn(first.settings, "regions"), false);

  const second = importLegacySettings(first.settings, createStorage({
    SC_PageActions_Settings: JSON.stringify({ marketProfit: false }),
    SC_PanelPosition: JSON.stringify({ left: 1, bottom: 1 }),
  }));

  assert.equal(second.imported, false);
  assert.equal(second.settings.pageActions.marketMaxProfitToggle, true);
  assert.deepEqual(second.settings.panelPosition, { left: 180, bottom: 0 });
});

test("malformed legacy settings preserve safe defaults and page-action defaults stay source-compatible", () => {
  const result = importLegacySettings(createAutoMaxSettings(), createStorage({
    SC_PageActions_Settings: "{broken",
    SC_PanelPosition: "[]",
  }));

  assert.equal(result.imported, true);
  assert.equal(getPageActionEnabled(result.settings, "contractProfit"), true);
  assert.equal(getPageActionEnabled(result.settings, "marketMaxProfitToggle"), false);
  assert.equal(getPageActionEnabled(result.settings, "autoSelectBestMarketRow"), false);
  assert.equal(getPageActionEnabled(result.settings, "newlyAddedAction"), true);
  assert.deepEqual(result.settings.panelPosition, { left: 10, bottom: 55 });
});

test("page actions toggle without dropping explicit unknown user settings", () => {
  const settings = createAutoMaxSettings({ pageActions: { futureTool: true, contractProfit: true } });
  const changed = togglePageAction(settings, "contractProfit");

  assert.equal(changed.pageActions.contractProfit, false);
  assert.equal(changed.pageActions.futureTool, true);
  assert.equal(getPageActionEnabled(changed, "contractProfit"), false);
});

test("panel positions clamp malformed and off-screen values to the viewport", () => {
  assert.deepEqual(
    clampPanelPosition({ left: "bad", bottom: Infinity }, { width: 320, height: 240, panelWidth: 280, panelHeight: 180 }),
    { left: 10, bottom: 55 }
  );
  assert.deepEqual(
    clampPanelPosition({ left: -1, bottom: 9999 }, { width: 320, height: 240, panelWidth: 280, panelHeight: 180 }),
    { left: 0, bottom: 60 }
  );
});
