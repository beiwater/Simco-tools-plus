const assert = require("node:assert/strict");
const test = require("node:test");
const { findHrMatches, parseHrRows } = require("../tools/hrAssessment.js");

test("parses and matches HR assessment rows", () => {
  const rows = parseHrRows("HR Assessment,Samples,Mgmt,Acct,Comm,Tech,Salaries,Avg. Skills\nReliable manager,12,5,4,3,2,1000,3.5\n");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].management, 5);
  const [match] = findHrMatches(rows, "Reliable manager");
  assert.equal(match.matched, true);
  assert.equal(match.score, 1);
});
