// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");
const { flattenIncomingContracts, normalizeForecastEntry } = require("../tools/automax/forecast.js");
const { getRealmIdFromDocument } = require("../tools/automax/lifecycle.js");
const { enableFloatingPanelDrag } = require("../tools/automax/floatingPanel.js");

const KIND_NAMES = Object.freeze({ 153: "巧克力冰淇淋", 154: "苹果冰淇淋" });

class autoMaxForecast extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax 易腐品预测";
    this.describe = "计算冰淇淋在库存、合同和市场订单中的未来剩余量。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "库存", "预测"];
  }

  componentData = {
    panel: undefined,
    content: undefined,
    refreshing: false,
  }

  indexDBData = {
    updatedAt: undefined,
    entries: [],
  }

  frontUI = () => this.open()

  cssText = [
    `
      #automax_forecast_panel { background: var(--sct-surface, rgba(0, 0, 0, 0.9)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5); box-sizing: border-box; color: var(--fontColor); left: 10px; max-height: min(75vh, 620px); max-width: calc(100vw - 20px); overflow: auto; padding: 12px; position: fixed; top: 50px; width: min(620px, calc(100vw - 20px)); z-index: 1048; }
      #automax_forecast_panel header { align-items: center; display: flex; gap: 8px; justify-content: space-between; }
      #automax_forecast_panel h2 { font-size: 20px; margin: 0; }
      #automax_forecast_panel button { background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); min-height: 30px; }
      #automax_forecast_panel details { border-top: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding: 8px 0; }
      #automax_forecast_panel summary { cursor: pointer; overflow-wrap: anywhere; }
      #automax_forecast_panel table { border-collapse: collapse; margin: 6px 0; width: 100%; }
      #automax_forecast_panel td, #automax_forecast_panel th { border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding: 4px; text-align: left; }
    `,
  ]

  open() {
    if (!this.componentData.panel?.isConnected) this.mount();
    this.componentData.panel.hidden = false;
    this.render();
  }

  close() {
    if (this.componentData.panel) this.componentData.panel.hidden = true;
  }

  mount() {
    const panel = document.getElementById("automax_forecast_panel") ?? document.createElement("section");
    if (panel.isConnected) {
      this.componentData.panel = panel;
      this.componentData.content = panel.querySelector(".automax-forecast-content");
      return;
    }
    panel.id = "automax_forecast_panel";
    panel.setAttribute("aria-label", "易腐品预测");
    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = "易腐品预测";
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.textContent = "刷新数据";
    refresh.addEventListener("click", () => void this.refreshData(refresh));
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "关闭";
    close.addEventListener("click", () => this.close());
    header.append(title, refresh, close);
    const content = document.createElement("div");
    content.className = "automax-forecast-content";
    panel.append(header, content);
    document.body.append(panel);
    enableFloatingPanelDrag(panel, header);
    this.componentData.panel = panel;
    this.componentData.content = content;
  }

  realm() {
    const realmId = getRealmIdFromDocument(document);
    const regions = componentList.autoMaxFoundation?.indexDBData?.cache?.regions ?? {};
    if ((realmId === 0 || realmId === 1) && regions[String(realmId)]) return regions[String(realmId)];
    return Object.values(regions).length === 1 ? Object.values(regions)[0] : undefined;
  }

  async refreshData(button) {
    if (this.componentData.refreshing) return;
    const region = this.realm();
    if (!region?.companyId) {
      this.setMessage("尚未获得当前公司资料，等待 AutoMax 数据基础服务刷新后再试。");
      return;
    }
    this.componentData.refreshing = true;
    button.disabled = true;
    button.textContent = "刷新中";
    try {
      const [inventory, outgoing, incoming, market] = await Promise.all([
        this.fetchArray(`https://www.simcompanies.com/api/v3/resources/${region.companyId}/`),
        this.fetchArray("https://www.simcompanies.com/api/v2/contracts-outgoing/"),
        this.fetchJson("https://www.simcompanies.com/api/v2/contracts-incoming/"),
        this.fetchArray(`https://www.simcompanies.com/api/v2/companies/${region.companyId}/market-orders/`),
      ]);
      const now = Date.now();
      const entries = [
        ...inventory.map((entry) => normalizeForecastEntry(entry, "库存", now)),
        ...outgoing.map((entry) => normalizeForecastEntry(entry, "出库合同", now)),
        ...flattenIncomingContracts(incoming).map((entry) => normalizeForecastEntry(entry, "入库合同", now)),
        ...market.map((entry) => normalizeForecastEntry(entry, "市场订单", now)),
      ].filter(Boolean);
      this.indexDBData.entries = entries;
      this.indexDBData.updatedAt = new Date(now).toISOString();
      await tools.indexDB_updateIndexDBData();
      this.render();
    } catch (error) {
      tools.errorLog("[AutoMax:FORECAST]", error);
      this.setMessage("刷新失败，请稍后重试。");
    } finally {
      this.componentData.refreshing = false;
      button.disabled = false;
      button.textContent = "刷新数据";
    }
  }

  async fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async fetchArray(url) {
    const value = await this.fetchJson(url);
    return Array.isArray(value) ? value : [];
  }

  setMessage(message) {
    if (!this.componentData.content) return;
    this.componentData.content.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    this.componentData.content.append(paragraph);
  }

  render() {
    const content = this.componentData.content;
    if (!content) return;
    content.replaceChildren();
    const updated = document.createElement("p");
    updated.textContent = this.indexDBData.updatedAt ? `数据更新：${new Date(this.indexDBData.updatedAt).toLocaleString()}` : "尚未刷新数据。";
    content.append(updated);
    const entries = Array.isArray(this.indexDBData.entries) ? this.indexDBData.entries : [];
    if (!entries.length) return;
    const groups = new Map();
    for (const entry of entries) {
      const key = `${entry.source}:${entry.kind}`;
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    for (const [key, values] of groups) content.append(this.renderGroup(key, values));
  }

  renderGroup(key, entries) {
    const detail = document.createElement("details");
    const summary = document.createElement("summary");
    const [source, kind] = key.split(":");
    summary.textContent = `${source} · ${KIND_NAMES[kind] ?? `物品 ${kind}`}（${entries.length} 条）`;
    detail.append(summary);
    for (const entry of entries) detail.append(this.renderEntry(entry));
    return detail;
  }

  renderEntry(entry) {
    const detail = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = `Q${entry.quality}：现余 ${this.number(entry.current)}${entry.price !== undefined ? `，单价 $${this.number(entry.price)}` : ""}${entry.owner ? `，${entry.owner}` : ""}`;
    detail.append(summary);
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    for (const title of ["剩余量", "达到时间", "单位成本"]) {
      const cell = document.createElement("th");
      cell.textContent = title;
      headerRow.append(cell);
    }
    head.append(headerRow);
    const body = document.createElement("tbody");
    for (const event of entry.events) {
      const row = document.createElement("tr");
      const amount = document.createElement("td");
      amount.textContent = this.number(event.amount);
      const time = document.createElement("td");
      time.textContent = new Date(event.at).toLocaleString();
      const cost = document.createElement("td");
      cost.textContent = event.unitCost === Infinity ? "∞" : event.unitCost === undefined ? "-" : this.number(event.unitCost, 3);
      row.append(amount, time, cost);
      body.append(row);
    }
    if (!entry.events.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.textContent = "已全部衰减或没有可预测变化。";
      row.append(cell);
      body.append(row);
    }
    table.append(head, body);
    detail.append(table);
    return detail;
  }

  number(value, digits = 0) {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
}

new autoMaxForecast();
