const assert = require("node:assert/strict");
const test = require("node:test");
const { buildingIdFromUrl, profit, toArray } = require("../components/restaurantDashboard.js");

test("normalizes restaurant dashboard data without persistence", () => {
  assert.equal(buildingIdFromUrl("https://www.simcompanies.com/b/123/"), "123");
  assert.equal(buildingIdFromUrl("https://www.simcompanies.com/buildings/456/restaurant"), "456");
  assert.deepEqual(toArray({ data: [1] }), [1]);
  assert.equal(profit({ revenue: 100, cogs: 30, wages: 20 }), 50);
});
