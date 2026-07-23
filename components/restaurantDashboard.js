const BaseComponent = require("../tools/baseComponent.js");
const { tools } = require("../tools/tools.js");
const { openSecondaryWindow } = require("../tools/secondaryWindowHost.js");

function buildingIdFromUrl(url = location.href) {
  return String(url).match(/\/(?:b|buildings)\/(\d+)(?:\/restaurant)?\/?$/)?.[1] || "";
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  return Array.isArray(value?.data) ? value.data : Array.isArray(value?.buildings) ? value.buildings : [];
}

function number(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function valueOf(record, names) {
  for (const name of names) if (record?.[name] != null) return record[name];
  return null;
}

function profit(run) {
  const stored = number(valueOf(run, ["profit", "netProfit"]));
  if (stored != null) return stored;
  const revenue = number(valueOf(run, ["revenue", "income"]));
  if (revenue == null) return null;
  return revenue - (number(valueOf(run, ["cogs", "cost", "materialCost"])) || 0) - (number(valueOf(run, ["wages", "wageCost"])) || 0);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function runIdentity(run) {
  const direct = valueOf(run, ["id", "uuid", "runId"]);
  if (direct != null) return `id:${direct}`;
  return JSON.stringify([
    valueOf(run, ["datetime", "createdAt", "date"]),
    valueOf(run, ["revenue", "income"]),
    valueOf(run, ["cogs", "cost", "materialCost"]),
    valueOf(run, ["wages", "wageCost"]),
    valueOf(run, ["resolved", "status"]),
  ]);
}

function mergeRuns(stored, incoming, limit = 1000) {
  const merged = new Map();
  for (const run of [...toArray(stored), ...toArray(incoming)]) merged.set(runIdentity(run), run);
  return [...merged.values()]
    .sort((left, right) => String(valueOf(right, ["datetime", "createdAt", "date"]) || "").localeCompare(String(valueOf(left, ["datetime", "createdAt", "date"]) || "")))
    .slice(0, limit);
}

class restaurantDashboard extends BaseComponent {
  constructor() {
    super();
    this.name = "餐厅实时看板";
    this.describe = "查看餐厅当前菜单与历史结算；使用 SCT IndexedDB 长效保存并去重，可导出 CSV。";
    this.enable = false;
    this.tagList = ["工具"];
  }

  indexDBData = { historyByBuilding: {}, restaurantByBuilding: {}, maxHistoryPerBuilding: 1000 }
  componentData = { latest: null }
  frontUI = this.open
  cssText = [`.sct-restaurant-dashboard { color:var(--fontColor); display:grid; gap:10px; max-width:760px; min-width:min(620px, 86vw); } .sct-restaurant-dashboard__actions { display:flex; flex-wrap:wrap; gap:8px; } .sct-restaurant-dashboard button { background:var(--sct-control,#4c4c4c); color:var(--fontColor); min-height:34px; } .sct-restaurant-dashboard table { border-collapse:collapse; width:100%; } .sct-restaurant-dashboard td,.sct-restaurant-dashboard th { border-bottom:1px solid var(--sct-control-hover,#777); padding:6px; text-align:left; } .sct-restaurant-dashboard__note { color:var(--sct-muted,#aaa); font-size:12px; } @media(max-width:650px) { .sct-restaurant-dashboard { min-width:0; width:min(94vw,760px); } .sct-restaurant-dashboard table { display:block; overflow:auto; } }`]

  async requestJson(path) {
    const response = await fetch(path, { credentials: "include", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${path}：HTTP ${response.status}`);
    return response.json();
  }
  async load() {
    const buildingId = buildingIdFromUrl();
    if (!buildingId) throw new Error("请先进入一个餐厅建筑页面，再打开看板。");
    const [buildingsRaw, runsRaw] = await Promise.all([
      this.requestJson("/api/v2/companies/me/buildings/"),
      this.requestJson(`/api/v2/companies/buildings/${buildingId}/restaurant-runs/`),
    ]);
    const buildings = toArray(buildingsRaw);
    const restaurant = buildings.find((building) => String(building.id || building.buildingId) === buildingId) || { id: buildingId };
    const runs = toArray(runsRaw).sort((left, right) => String(valueOf(right, ["datetime", "createdAt", "date"]) || "").localeCompare(String(valueOf(left, ["datetime", "createdAt", "date"]) || "")));
    return { buildingId, restaurant, runs, fetchedRuns: runs.length, loadedAt: new Date().toISOString() };
  }
  stored(buildingId = buildingIdFromUrl()) {
    if (!buildingId) return null;
    const histories = this.indexDBData.historyByBuilding || {};
    const restaurants = this.indexDBData.restaurantByBuilding || {};
    const runs = toArray(histories[buildingId]);
    if (!runs.length && !restaurants[buildingId]) return null;
    return { buildingId, restaurant: restaurants[buildingId] || { id: buildingId }, runs, fetchedRuns: 0, loadedAt: "" };
  }
  async persist(data) {
    const buildingId = data.buildingId;
    const limit = Math.max(100, Math.min(5000, Number(this.indexDBData.maxHistoryPerBuilding) || 1000));
    this.indexDBData.historyByBuilding ||= {};
    this.indexDBData.restaurantByBuilding ||= {};
    const runs = mergeRuns(this.indexDBData.historyByBuilding[buildingId], data.runs, limit);
    this.indexDBData.historyByBuilding[buildingId] = runs;
    this.indexDBData.restaurantByBuilding[buildingId] = JSON.parse(JSON.stringify(data.restaurant || { id: buildingId }));
    await tools.indexDB_updateIndexDBData();
    return { ...data, runs, storedRuns: runs.length };
  }
  async clearStored(buildingId) {
    if (!buildingId) return;
    this.indexDBData.historyByBuilding ||= {};
    this.indexDBData.restaurantByBuilding ||= {};
    delete this.indexDBData.historyByBuilding[buildingId];
    delete this.indexDBData.restaurantByBuilding[buildingId];
    await tools.indexDB_updateIndexDBData();
    this.componentData.latest = null;
  }
  open() {
    const content = document.createElement("section");
    content.className = "sct-restaurant-dashboard";
    const actions = document.createElement("div"); actions.className = "sct-restaurant-dashboard__actions";
    const refresh = document.createElement("button"); refresh.type = "button"; refresh.className = "btn"; refresh.textContent = "刷新实时数据";
    const exportButton = document.createElement("button"); exportButton.type = "button"; exportButton.className = "btn"; exportButton.textContent = "导出最近结算 CSV"; exportButton.disabled = true;
    const clearButton = document.createElement("button"); clearButton.type = "button"; clearButton.className = "btn"; clearButton.textContent = "清空本餐厅历史";
    const result = document.createElement("div"); result.className = "sct-restaurant-dashboard__result";
    const note = document.createElement("div"); note.className = "sct-restaurant-dashboard__note"; note.textContent = "历史保存在 SCT IndexedDB 中，按餐厅分开、自动去重，每个餐厅最多保留 1000 条；除非主动清空或删除浏览器站点数据，否则会跨刷新和重启保留。";
    const refreshData = async () => {
      result.textContent = "正在读取餐厅数据…"; exportButton.disabled = true;
      try { this.componentData.latest = await this.persist(await this.load()); this.render(result, this.componentData.latest); exportButton.disabled = false; }
      catch (error) { result.textContent = error.message || String(error); }
    };
    refresh.addEventListener("click", refreshData);
    exportButton.addEventListener("click", () => this.downloadCsv(this.componentData.latest));
    clearButton.addEventListener("click", async () => {
      const buildingId = buildingIdFromUrl();
      if (!buildingId || !window.confirm("确定清空当前餐厅在 SCT 中保存的全部历史吗？")) return;
      await this.clearStored(buildingId); result.textContent = "当前餐厅的长期历史已清空。"; exportButton.disabled = true;
    });
    actions.append(refresh, exportButton, clearButton); content.append(actions, result, note);
    openSecondaryWindow({ id: "restaurant-dashboard", title: "餐厅实时看板", content });
    const stored = this.stored();
    if (stored) { this.componentData.latest = stored; this.render(result, stored); exportButton.disabled = false; }
    refreshData();
  }
  render(root, data) {
    const latest = data.runs[0];
    const name = valueOf(data.restaurant, ["name", "buildingName"]) || `餐厅 #${data.buildingId}`;
    const menu = valueOf(data.restaurant, ["menu", "restaurantMenu"]);
    const summary = document.createElement("div");
    summary.textContent = `${name}｜长期保存 ${data.runs.length} 条${data.fetchedRuns ? `｜本次读取 ${data.fetchedRuns} 条` : ""}${latest ? `｜最近利润 ${this.money(profit(latest))}` : ""}`;
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>时间</th><th>收入</th><th>成本</th><th>工资</th><th>利润</th><th>状态</th></tr></thead>";
    const body = document.createElement("tbody");
    for (const run of data.runs.slice(0, 12)) {
      const row = document.createElement("tr");
      const cells = [valueOf(run, ["datetime", "createdAt", "date"]) || "-", this.money(valueOf(run, ["revenue", "income"])), this.money(valueOf(run, ["cogs", "cost", "materialCost"])), this.money(valueOf(run, ["wages", "wageCost"])), this.money(profit(run)), valueOf(run, ["resolved", "status"]) === false ? "未结算" : "已结算"];
      for (const value of cells) { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); }
      body.append(row);
    }
    table.append(body); root.replaceChildren(summary, menu ? this.menuNode(menu) : document.createTextNode("未读取到菜单详情。"), table);
  }
  menuNode(menu) {
    const node = document.createElement("div"); node.className = "sct-restaurant-dashboard__note";
    const items = Array.isArray(menu) ? menu : Object.values(menu || {});
    node.textContent = `当前菜单：${items.map((item) => typeof item === "string" ? item : item.name || item.resourceName || item.resourceId || "未知菜品").join("、") || "暂无"}`;
    return node;
  }
  money(value) { const parsed = number(value); return parsed == null ? "-" : `$${parsed.toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
  downloadCsv(data) {
    if (!data?.runs?.length) return;
    const rows = [["time", "revenue", "cost", "wages", "profit", "resolved"], ...data.runs.map((run) => [valueOf(run, ["datetime", "createdAt", "date"]), valueOf(run, ["revenue", "income"]), valueOf(run, ["cogs", "cost", "materialCost"]), valueOf(run, ["wages", "wageCost"]), profit(run), valueOf(run, ["resolved", "status"])])];
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.map(csvEscape).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `simcompanies-restaurant-${data.buildingId}.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

new restaurantDashboard();

module.exports = { buildingIdFromUrl, mergeRuns, profit, runIdentity, toArray };
