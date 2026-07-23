const assert = require("node:assert/strict");
const test = require("node:test");
const { isGa4Url } = require("../components/ga4Blocker.js");

test("recognizes GA4 collection and loader URLs without blocking unrelated Google requests", () => {
  assert.equal(isGa4Url("https://www.google-analytics.com/g/collect?v=2"), true);
  assert.equal(isGa4Url("https://region1.google-analytics.com/g/collect?v=2"), true);
  assert.equal(isGa4Url("https://www.googletagmanager.com/gtag/js?id=G-TEST"), true);
  assert.equal(isGa4Url("https://stats.g.doubleclick.net/g/collect?v=2"), true);
  assert.equal(isGa4Url("https://translate.googleapis.com/translate_a/single"), false);
  assert.equal(isGa4Url("https://www.googletagmanager.com/gtm.js?id=GTM-TEST"), false);
});
