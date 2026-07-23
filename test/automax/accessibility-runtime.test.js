const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "..", "..", "components", "autoMaxAccessibility.js"),
  "utf8"
);

function createHarness(buildings) {
  const componentList = {};
  const links = buildings.map((building) => ({
    className: `test-building-${building.kind}`,
    dataset: {},
    href: `https://www.simcompanies.com/landscape/b/${building.id}/`,
  }));
  const document = {
    querySelectorAll(selector) {
      if (selector === "a[href*='/b/']") return links;
      if (selector === "[data-automax-idle-highlight]") {
        return links.filter((link) => link.dataset.automaxIdleHighlight);
      }
      return [];
    },
  };
  class BaseComponent {
    constructor() {
      componentList[this.constructor.name] = this;
    }
  }
  function localRequire(request) {
    if (request.endsWith("baseComponent.js")) return BaseComponent;
    if (request.endsWith("tools.js")) {
      return {
        componentList,
        indexDBData: { basisCPT: { building: { 0: buildings } } },
        runtimeData: { basisCPT: { realm: 0 } },
        tools: { errorLog() {} },
      };
    }
    if (request.endsWith("assist.js")) {
      return {
        COLOR_EMOJI_LABELS: {},
        findChatContainers: () => [],
        findQuestMatch: () => null,
        normalizeSnipboardUrl: () => null,
      };
    }
    if (request.endsWith("lifecycle.js")) return { getRealmIdFromDocument: () => 0 };
    throw new Error(`Unexpected dependency: ${request}`);
  }
  vm.runInNewContext(source, {
    MutationObserver: class {},
    URL,
    document,
    fetch: async () => ({ ok: false }),
    localStorage: { getItem: () => null },
    location: { pathname: "/landscape/" },
    require: localRequire,
    window: { addEventListener() {}, setTimeout() {} },
  }, { filename: "autoMaxAccessibility.js" });
  componentList.autoMaxMapIdleHighlight.enable = true;
  return { component: componentList.autoMaxAccessibility, links };
}

test("map highlighting marks only genuinely idle supported buildings", () => {
  const { component, links } = createHarness([
    { id: 1, kind: "a", busy: undefined },
    { id: 2, kind: "a", busy: { production: true } },
    { id: 3, kind: "n", busy: undefined },
    { id: 4, kind: "B", busy: undefined, salesContract: true },
  ]);

  component.refreshIdleHighlights();

  assert.equal(links[0].dataset.automaxIdleHighlight, "true");
  assert.equal(links[1].dataset.automaxIdleHighlight, undefined);
  assert.equal(links[2].dataset.automaxIdleHighlight, undefined);
  assert.equal(links[3].dataset.automaxIdleHighlight, undefined);
});

test("map highlighting clears stale markers when a building becomes busy", () => {
  const buildings = [{ id: 1, kind: "a", busy: undefined }];
  const { component, links } = createHarness(buildings);
  component.refreshIdleHighlights();
  buildings[0].busy = { production: true };

  component.refreshIdleHighlights();

  assert.equal(links[0].dataset.automaxIdleHighlight, undefined);
});
