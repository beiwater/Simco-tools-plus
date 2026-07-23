const assert = require("node:assert/strict");
const test = require("node:test");

const { componentList } = require("../../tools/tools.js");

require("../../components/autoMaxExecutive.js");

const component = componentList.autoMaxExecutive;

function emptyBoardroom() {
  return Object.fromEntries(["o", "f", "m", "t", "v", "x", "y", "z", "1", "2", "3", "4", "5"].map((slot) => [slot, null]));
}

test("training totals coerce persisted values without mutating the source records", () => {
  const trainings = [
    { skillCoo: "2", skillCfo: 3 },
    { skillCmo: 4, skillCto: "5" },
  ];

  assert.deepEqual(component.trainingTotals(trainings), { cfo: 3, cmo: 4, coo: 2, cto: 5 });
  assert.deepEqual(trainings[0], { skillCoo: "2", skillCfo: 3 });
});

test("custom bonuses keep the public realm boundary and coerce persisted values", () => {
  component.indexDBData.customBonuses["0"] = { adminBonus: "12.5", saleBonus: "7" };

  assert.deepEqual(component.customBonuses(0), { adminBonus: 12.5, saleBonus: 7 });
  assert.deepEqual(component.customBonuses(null), { adminBonus: 0, saleBonus: 0 });
});

test("executive synchronization keeps named seats and fills staff seats in order", () => {
  const boardroom = emptyBoardroom();
  const executives = [
    { name: "COO", currentWorkHistory: { position: "o" }, skills: { coo: 12 } },
    { name: "Staff A", currentWorkHistory: {}, skills: { cfo: 3 } },
    { name: "Staff B", currentWorkHistory: { position: "unknown" }, skills: { cmo: 4 } },
  ];

  component.mapExecutivesToState(executives, boardroom);

  assert.equal(boardroom.o.name, "COO");
  assert.equal(boardroom[1].name, "Staff A");
  assert.equal(boardroom[2].name, "Staff B");
  assert.equal(boardroom[3], null);
});

test("boardroom calculation preserves all four effective skill formulas", () => {
  const originalRealmId = component.realmId;
  const originalFoundation = componentList.autoMaxFoundation;
  component.realmId = () => 0;
  componentList.autoMaxFoundation = {
    indexDBData: {
      cache: {
        regions: {
          0: { administration: 1.2, bankLevel: 4, recreationBonus: 2, salesModifier: 3 },
        },
      },
    },
  };
  const boardroom = emptyBoardroom();
  boardroom.o = { name: "COO", skills: { coo: 20, cfo: 1, cmo: 5, cto: 1 } };
  boardroom.f = { name: "CFO", skills: { coo: 5, cfo: 18, cmo: 0, cto: 0 } };
  boardroom.m = { name: "CMO", skills: { coo: 8, cfo: 0, cmo: 21, cto: 0 } };
  boardroom.t = { name: "CTO", skills: { coo: 12, cfo: 0, cmo: 0, cto: 20 } };
  boardroom.v = { name: "COO apprentice", skills: { coo: 10 } };
  boardroom.x = { name: "CFO apprentice", skills: { cfo: 8 } };
  boardroom.y = { name: "CMO apprentice", skills: { cmo: 6 } };
  boardroom.z = { name: "CTO apprentice", skills: { cto: 12 } };
  const overlay = {
    querySelector(selector) {
      if (selector === 'input[name="sc-aca-r"]:checked') return { value: "20" };
      return null;
    },
  };

  try {
    assert.deepEqual(component.calculateBoardroomResults(overlay, boardroom), { adminBonus: 31, saleBonus: 8 });
  } finally {
    component.realmId = originalRealmId;
    if (originalFoundation === undefined) delete componentList.autoMaxFoundation;
    else componentList.autoMaxFoundation = originalFoundation;
  }
});
