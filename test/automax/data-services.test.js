const assert = require("node:assert/strict");
const test = require("node:test");

const {
  calculateExecutiveSkills,
  createAutoMaxCache,
  createRequestClient,
  mergeWarehouseResources,
  processBuildings,
} = require("../../tools/automax/data.js");
const { parseConstantsBundle } = require("../../tools/automax/constants.js");

function response({ ok = true, status = 200, body }) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
    async text() {
      return typeof body === "string" ? body : JSON.stringify(body);
    },
  };
}

test("retries failed JSON requests before returning a successful result", async () => {
  let calls = 0;
  const client = createRequestClient({
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) throw new Error("temporary failure");
      return response({ body: { realmId: 0 } });
    },
    retries: 2,
  });

  const result = await client.requestJson("/example");
  assert.deepEqual(result, { ok: true, value: { realmId: 0 } });
  assert.equal(calls, 3);
});

test("returns a typed request failure after retry exhaustion", async () => {
  const client = createRequestClient({
    fetchImpl: async () => response({ ok: false, status: 503, body: {} }),
    retries: 1,
  });

  const result = await client.requestJson("/unavailable");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "REQUEST_FAILED");
});

test("calculates academy and bank state without mutating source buildings", () => {
  const buildings = [
    { kind: "y", size: 4, busy: undefined, position: "0" },
    { kind: "y", size: 3, busy: { expanding: true }, position: "1" },
    { kind: "n", size: 6, busy: undefined, position: "2" },
    { kind: "n", size: 5, purchasedRecently: true, position: "3" },
  ];

  assert.deepEqual(processBuildings(buildings), { active: 4, slots: 6, bankLevel: 6 });
  assert.equal(buildings[0].size, 4);
});

test("keeps data isolated by realm and rejects stale cache records", () => {
  let now = 1_000;
  const cache = createAutoMaxCache({}, () => now);
  cache.writeRegion(0, { realmId: 0, timestamp: new Date(now).toISOString(), academyActive: 5 });
  cache.writeRegion(1, { realmId: 1, timestamp: new Date(now).toISOString(), academyActive: 15 });

  assert.equal(cache.readRegion(0, 10).academyActive, 5);
  assert.equal(cache.readRegion(1, 10).academyActive, 15);
  now += 11;
  assert.equal(cache.readRegion(0, 10), null);
});

test("merges warehouse resources without dropping existing region details", () => {
  const merged = mergeWarehouseResources(
    { academyActive: 5, buildings: [{ id: 1 }] },
    [{ kind: 12, quantity: 42 }],
  );

  assert.deepEqual(merged, {
    academyActive: 5,
    buildings: [{ id: 1 }],
    warehouseResources: [{ kind: 12, quantity: 42 }],
  });
});

test("calculates all executive skill lanes with academy apprentice thresholds", () => {
  const executives = [
    { currentWorkHistory: { position: "o" }, skills: { coo: 20, cfo: 1, cmo: 5, cto: 1 } },
    { currentWorkHistory: { position: "f" }, skills: { coo: 5, cfo: 18, cmo: 0, cto: 0 } },
    { currentWorkHistory: { position: "m" }, skills: { coo: 8, cfo: 0, cmo: 21, cto: 0 } },
    { currentWorkHistory: { position: "t" }, skills: { coo: 12, cfo: 0, cmo: 0, cto: 20 } },
    { currentWorkHistory: { position: "v" }, skills: { coo: 10 } },
    { currentWorkHistory: { position: "x" }, skills: { cfo: 8 } },
    { currentWorkHistory: { position: "y" }, skills: { cmo: 6 } },
    { currentWorkHistory: { position: "z" }, skills: { cto: 12 } },
  ];

  assert.deepEqual(calculateExecutiveSkills(executives, 20), {
    effective: { cfo: 22, cmo: 25, coo: 31, cto: 26 },
    raw: { cfo: 22, cmo: 25, coo: 31, cto: 26 },
  });
});

test("parses source-compatible constants without executing bundle text", () => {
  const bundle = `
    let avg=12.5,quality=.75;
    let sales={B:[1],r:[2],x:[3,4]};
    let resources={1:{dbLetter:"x",salaryModifier:1.2,transportation:2,image:"tree.png",producedFrom:[7]}};
    const retail={0: JSON.parse('[{"quality":0}]')};
    const config={AVERAGE_SALARY:avg,SALES:sales,RETAIL_MODELING_QUALITY_WEIGHT:quality};
  `;

  const result = parseConstantsBundle(bundle);
  assert.equal(result.ok, true);
  assert.equal(result.value.data.AVERAGE_SALARY, 12.5);
  assert.deepEqual(result.value.data.SALES, { x: [3, 4] });
  assert.equal(result.value.buildingsSalaryModifier.x, 1.2);
  assert.equal(result.value.constantsResources[1].transportation, 2);
  assert.deepEqual(result.value.retailInfo[0], [{ quality: 0 }]);
});

test("rejects a constants bundle without required source fields", () => {
  const result = parseConstantsBundle("const noUsefulData = true;");
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "CONSTANTS_PARSE_FAILED");
});
