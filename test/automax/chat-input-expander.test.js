const assert = require("node:assert/strict");
const test = require("node:test");

require("../../components/autoMaxAccessibility.js");
const { componentList } = require("../../tools/tools.js");
const { getPageActionEnabled, PAGE_ACTIONS } = require("../../tools/automax/settings.js");

test("the incompatible AutoMax chat expander stays inactive even with a persisted enabled switch", () => {
  const accessibility = componentList.autoMaxAccessibility;
  const expander = componentList.autoMaxChatAutoExpand || { enable: false };
  expander.enable = true;

  assert.equal(accessibility.isActionEnabled("chatInputExpander"), false);
  assert.doesNotMatch(accessibility.cssText.join("\n"), /automax-chat-expanded/);
  assert.equal(getPageActionEnabled({ pageActions: { chatInputExpander: true } }, "chatInputExpander"), false);
  assert.equal(PAGE_ACTIONS.some((action) => action.key === "chatInputExpander"), false);
});

test("AutoMax startup no longer listens to chat input focus events", () => {
  const accessibility = componentList.autoMaxAccessibility;
  const originalDocument = global.document;
  const originalWindow = global.window;
  const documentEvents = [];
  const windowEvents = [];
  const originalRefresh = accessibility.refresh;

  global.document = { addEventListener: (type) => documentEvents.push(type) };
  global.window = { addEventListener: (type) => windowEvents.push(type) };
  accessibility.componentData.initialized = false;
  accessibility.refresh = () => {};
  try {
    accessibility.startup();
    assert.deepEqual(documentEvents, []);
    assert.deepEqual(windowEvents, ["automax-settings-changed"]);
  } finally {
    accessibility.refresh = originalRefresh;
    accessibility.componentData.initialized = false;
    if (originalDocument === undefined) delete global.document;
    else global.document = originalDocument;
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
});
