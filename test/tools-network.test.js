const assert = require("node:assert/strict");
const test = require("node:test");

const { tools } = require("../tools/tools.js");

test("legacy startup uses the current executives endpoint", () => {
  assert.equal(tools.baseURL.executives, "https://www.simcompanies.com/api/v3/companies/me/executives/");
});

test("getNetData treats HTTP and malformed JSON responses as recoverable failures", async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async (url) => {
      if (url.endsWith("missing")) return { ok: false, status: 404, json: async () => { throw new Error("must not parse"); } };
      return { ok: true, status: 200, json: async () => { throw new SyntaxError("invalid JSON"); } };
    };

    assert.equal(await tools.getNetData("https://example.test/missing"), false);
    assert.equal(await tools.getNetData("https://example.test/malformed"), false);
  } finally {
    global.fetch = originalFetch;
  }
});
