const assert = require("node:assert/strict");
const test = require("node:test");
const { buildingIdFromUrl, mergeRuns, profit, toArray } = require("../components/restaurantDashboard.js");

test("normalizes restaurant dashboard API data", () => {
  assert.equal(buildingIdFromUrl("https://www.simcompanies.com/b/123/"), "123");
  assert.equal(buildingIdFromUrl("https://www.simcompanies.com/buildings/456/restaurant"), "456");
  assert.deepEqual(toArray({ data: [1] }), [1]);
  assert.equal(profit({ revenue: 100, cogs: 30, wages: 20 }), 50);
});

test("merges persistent restaurant runs by stable identity and keeps the newest value", () => {
  const stored = [{ id: 1, datetime: "2026-01-01", revenue: 100 }];
  const incoming = [{ id: 1, datetime: "2026-01-01", revenue: 120 }, { id: 2, datetime: "2026-01-02", revenue: 90 }];
  const merged = mergeRuns(stored, incoming, 10);
  assert.deepEqual(merged.map((run) => run.id), [2, 1]);
  assert.equal(merged[1].revenue, 120);
});
