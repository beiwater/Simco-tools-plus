const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const verifierPath = path.resolve(__dirname, "../scripts/verify-userscript.js");

function writeFixture(headerLines) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "userscript-metadata-"));
  const filePath = path.join(directory, "fixture.user.js");
  fs.writeFileSync(filePath, `${headerLines.join("\n")}\nconsole.log('fixture');\n`);
  return { directory, filePath };
}

function validHeader() {
  return [
    "// ==UserScript==",
    "// @name         Fixture",
    "// @match        https://www.simcompanies.com/*",
    "// @license      AGPL-3.0-or-later",
    "// @grant        GM_xmlhttpRequest",
    "// @connect      api.simcotools.com",
    "// ==/UserScript==",
  ];
}

test("verifies the required AutoMax userscript contract", () => {
  const fixture = writeFixture(validHeader());
  try {
    const result = spawnSync(process.execPath, [verifierPath, fixture.filePath], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Userscript metadata verified/);
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test("rejects a missing GM grant", () => {
  const fixture = writeFixture(validHeader().filter((line) => !line.includes("@grant")));
  try {
    const result = spawnSync(process.execPath, [verifierPath, fixture.filePath], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected @grant GM_xmlhttpRequest/);
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});
