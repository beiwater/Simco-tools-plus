// SPDX-License-Identifier: AGPL-3.0-or-later
const BASE_WAGES = Object.freeze({
  0: 759, 1: 448.5, 2: 379.5, 3: 0, 4: 0, 5: 0, 6: 241.5, 7: 586.5, 8: 724.5, 9: 759,
  A: 345, a: 552, b: 414, B: 586.5, C: 172.5, c: 414, D: 621, d: 172.5, E: 414, e: 414,
  F: 138, f: 448.5, G: 138, g: 345, H: 310.5, h: 586.5, I: 241.5, i: 379.5, j: 448.5, k: 379.5,
  L: 379.5, l: 517.5, M: 276, m: 655.5, n: 0, O: 517.5, o: 379.5, P: 103.5, p: 448.5, q: 517.5,
  Q: 276, R: 483, r: 586.5, S: 310.5, s: 586.5, T: 138, t: 207, u: 241.5, v: 79.35, W: 345,
  x: 483, Y: 414, y: 0, z: 241.5,
});

const POSITION_NAMES = Object.freeze({
  o: "COO", f: "CFO", m: "CMO", t: "CTO",
  v: "COO学徒", x: "CFO学徒", y: "CMO学徒", z: "CTO学徒",
  1: "职员1", 2: "职员2", 3: "职员3", 4: "职员4", 5: "职员5",
});

const TRAINING_NAMES = Object.freeze({
  o: "管理培训", f: "会计课程", m: "沟通工作室", t: "科学界研讨会", g: "各领域课程",
});

function executiveUrl(url) {
  return /\/api\/v2\/companies\/executives\/my-offers\/?|\/game-notifications\/?|\/api\/v4\/executives\/\d+\/?|\/api\/v2\/companies\/\d+\/former-executives\/?/.test(String(url));
}

function trainingTotals(trainings) {
  return (Array.isArray(trainings) ? trainings : []).reduce((result, item) => ({
    coo: result.coo + (Number(item?.skillCoo) || 0),
    cfo: result.cfo + (Number(item?.skillCfo) || 0),
    cmo: result.cmo + (Number(item?.skillCmo) || 0),
    cto: result.cto + (Number(item?.skillCto) || 0),
  }), { coo: 0, cfo: 0, cmo: 0, cto: 0 });
}

function calculateAdminFee(region) {
  const overhead = Number(region?.administration) || 1;
  if (!Array.isArray(region?.buildings) || overhead <= 1) return 0;
  return region.buildings.reduce((sum, building) => {
    const wage = Number(BASE_WAGES[building?.kind]) || 0;
    const robot = typeof building?.robotsSpecialization === "number" ? 0.97 : 1;
    return sum + wage * (Number(building?.size) || 0) * 24 * robot * (overhead - 1);
  }, 0);
}

function createBoardroomState() {
  return {
    o: null, f: null, m: null, t: null,
    v: null, x: null, y: null, z: null,
    1: null, 2: null, 3: null, 4: null, 5: null,
  };
}

function replaceBoardroomExecutives(boardroomState, executives) {
  Object.keys(boardroomState).forEach((slot) => { boardroomState[slot] = null; });
  let staffIndex = 1;
  for (const executive of Array.isArray(executives) ? executives : []) {
    const position = executive.currentWorkHistory?.position;
    const slot = position ? String(position) : null;
    const value = {
      name: executive.name || "未命名",
      skills: {
        coo: executive.skills?.coo || 0,
        cfo: executive.skills?.cfo || 0,
        cmo: executive.skills?.cmo || 0,
        cto: executive.skills?.cto || 0,
      },
    };
    if (slot && Object.prototype.hasOwnProperty.call(boardroomState, slot)) {
      boardroomState[slot] = value;
      continue;
    }
    while (staffIndex <= 5 && boardroomState[String(staffIndex)] !== null) staffIndex += 1;
    if (staffIndex > 5) continue;
    boardroomState[String(staffIndex)] = value;
    staffIndex += 1;
  }
}

function boardroomExecutives(boardroomState) {
  return Object.entries(boardroomState)
    .filter(([, executive]) => executive)
    .map(([position, executive]) => ({ ...executive, currentWorkHistory: { position } }));
}

module.exports = {
  POSITION_NAMES,
  TRAINING_NAMES,
  boardroomExecutives,
  calculateAdminFee,
  createBoardroomState,
  executiveUrl,
  replaceBoardroomExecutives,
  trainingTotals,
};
