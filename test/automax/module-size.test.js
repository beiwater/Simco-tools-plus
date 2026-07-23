const assert = require("node:assert/strict");
const { readdirSync, readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const projectRoot = path.resolve(__dirname, "../..");
const automaxTools = path.join(projectRoot, "tools/automax");
const sourceFiles = [
  path.join(projectRoot, "components/autoMaxExecutive.js"),
  ...readdirSync(automaxTools)
    .filter((name) => /^(?:capture|executive|lifecycle|refresh|route).*\.js$/.test(name))
    .map((name) => path.join(automaxTools, name)),
];

function pureLineCount(filePath) {
  return readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed !== "" && !trimmed.startsWith("//");
    })
    .length;
}

test("refactored AutoMax modules stay within the 250-line review boundary", () => {
  const oversized = sourceFiles
    .map((filePath) => ({ file: path.relative(projectRoot, filePath), lines: pureLineCount(filePath) }))
    .filter(({ lines }) => lines > 250);

  assert.deepEqual(oversized, []);
});

test("lifecycle barrel preserves the established public API", () => {
  const lifecycle = require("../../tools/automax/lifecycle.js");

  assert.deepEqual(Object.keys(lifecycle).sort(), [
    "AUTO_MAX_ROUTE_PATTERNS",
    "BEIJING_OFFSET_MS",
    "HOUR_MS",
    "captureRoute",
    "createResponseCapture",
    "createRouteMonitor",
    "createRouteRegistry",
    "createTtlRefreshScheduler",
    "createXhrCaptureRegistration",
    "getRealmIdFromDocument",
    "hasCrossedBeijingRefreshCheckpoint",
    "installFetchCapture",
    "isCaptureUrl",
  ]);
});
