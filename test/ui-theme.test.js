const assert = require("node:assert/strict");
const test = require("node:test");

const { componentList } = require("../tools/tools.js");
const { AUTO_MAX_UI_THEME_CSS } = require("../components/autoMaxUITheme.js");

test("UI theme is mandatory infrastructure", () => {
  const theme = componentList.autoMaxUITheme;
  assert.ok(theme);
  assert.equal(theme.enable, true);
  assert.equal(theme.canDisable, false);
});

test("SCT-owned text controls have an explicit contrasting surface and foreground", () => {
  assert.match(AUTO_MAX_UI_THEME_CSS, /--sct-control-opaque:\s*#252b28/);
  assert.match(
    AUTO_MAX_UI_THEME_CSS,
    /input:not\(\[type="checkbox"\].*select, textarea\)[\s\S]*background-color:\s*var\(--sct-control-opaque[\s\S]*color:\s*var\(--fontColor/s
  );
  assert.match(AUTO_MAX_UI_THEME_CSS, /select option[\s\S]*background-color:[\s\S]*color:/);
});

test("placeholder, disabled, and browser autofill states stay readable", () => {
  assert.match(AUTO_MAX_UI_THEME_CSS, /::placeholder[\s\S]*--sct-text-secondary/);
  assert.match(AUTO_MAX_UI_THEME_CSS, /:is\(input, select, textarea\):disabled[\s\S]*opacity:/);
  assert.match(AUTO_MAX_UI_THEME_CSS, /input:-webkit-autofill[\s\S]*-webkit-text-fill-color:/);
});
