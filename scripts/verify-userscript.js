const fs = require("node:fs");
const path = require("node:path");

const requiredFields = new Map([
  ["@license", "AGPL-3.0-or-later"],
  ["@grant", "GM_xmlhttpRequest"],
  ["@connect", "api.simcotools.com"],
]);

const forbiddenText = [
  "sc.22-7.top",
  "@grant        unsafeWindow",
  "@grant        GM_registerMenuCommand",
];

function getHeader(text) {
  const match = text.match(/^\/\/ ==UserScript==\r?\n([\s\S]*?)^\/\/ ==\/UserScript==$/m);
  if (!match) throw new Error("Missing userscript metadata header.");
  return match[0];
}

function getFieldValues(header, field) {
  const expression = new RegExp(`^//\\s+${field.replace("@", "@")}\\s+(.+)$`, "gm");
  return [...header.matchAll(expression)].map((match) => match[1].trim());
}

function verifyUserscript(text) {
  const header = getHeader(text);
  const failures = [];

  for (const [field, expected] of requiredFields) {
    const values = getFieldValues(header, field);
    if (!values.includes(expected)) {
      failures.push(`Expected ${field} ${expected}.`);
    }
  }

  const matches = getFieldValues(header, "@match");
  if (matches.length !== 1 || matches[0] !== "https://www.simcompanies.com/*") {
    failures.push("Expected exactly one SimCompanies @match entry.");
  }

  for (const textToReject of forbiddenText) {
    if (header.includes(textToReject)) {
      failures.push(`Forbidden metadata found: ${textToReject}.`);
    }
  }

  return failures;
}

function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/verify-userscript.js <userscript-file>");
    process.exitCode = 2;
    return;
  }

  const absolutePath = path.resolve(filePath);
  const failures = verifyUserscript(fs.readFileSync(absolutePath, "utf8"));
  if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exitCode = 1;
    return;
  }

  console.log(`Userscript metadata verified: ${absolutePath}`);
}

if (require.main === module) main();

module.exports = { verifyUserscript };
