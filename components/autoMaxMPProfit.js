const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");
const { predictedAmount } = require("../tools/automax/forecast.js");
const { administrationMultiplier, modeledRetailData, retailSearchWorkerSource } = require("../tools/automax/retailMath.js");
const { getRealmIdFromDocument } = require("../tools/automax/lifecycle.js");
const { runWorkerTask } = require("../tools/automax/worker.js");
const { enableFloatingPanelDrag } = require("../tools/automax/floatingPanel.js");

class autoMaxMPProfit extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax MP 折扣利润";
    this.describe = "按 MP-?% 或固定减价模拟市场订单转合同后的最大时利润。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "交易所", "MP", "利润"];
  }

  componentData = {
    panel: undefined,
    content: undefined,
    calculating: false,
  }

  indexDBData = {
    inputPercent: 2.5,
  }

  frontUI = () => this.open()

  cssText = [
    `
      #automax_mp_profit_panel { background: var(--sct-surface, rgba(0, 0, 0, 0.9)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5); box-sizing: border-box; color: var(--fontColor); left: 10px; max-height: min(75vh, 620px); max-width: calc(100vw - 20px); overflow: auto; padding: 12px; position: fixed; top: 50px; width: min(680px, calc(100vw - 20px)); z-index: 1048; }
      #automax_mp_profit_panel header, #automax_mp_profit_panel .automax-mp-controls { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; }
      #automax_mp_profit_panel h2 { font-size: 20px; margin: 0; }
      #automax_mp_profit_panel button, #automax_mp_profit_panel input { background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); min-height: 30px; }
      #automax_mp_profit_panel table { border-collapse: collapse; font-size: 12px; margin-top: 8px; width: 100%; }
      #automax_mp_profit_panel td, #automax_mp_profit_panel th { border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding: 4px; text-align: left; }
      #automax_mp_profit_panel th button { border: 0; min-height: 0; padding: 0; }
    `,
  ]

  open() {
    if (!this.componentData.panel?.isConnected) this.mount();
    this.componentData.panel.hidden = false;
  }

  mount() {
    const panel = document.getElementById("automax_mp_profit_panel") ?? document.createElement("section");
    if (panel.isConnected) {
      this.componentData.panel = panel;
      this.componentData.content = panel.querySelector(".automax-mp-content");
      return;
    }
    panel.id = "automax_mp_profit_panel";
    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = "MP 折扣合同利润";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "关闭";
    close.addEventListener("click", () => { panel.hidden = true; });
    header.append(title, close);
    const controls = document.createElement("div");
    controls.className = "automax-mp-controls";
    const label = document.createElement("label");
    label.textContent = "MP-";
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.value = String(this.indexDBData.inputPercent);
    input.setAttribute("aria-label", "MP 折扣百分比，负数代表直接减去金额");
    const suffix = document.createElement("span");
    suffix.textContent = "%（负数为直接减去金额）";
    label.append(input, suffix);
    const calculate = document.createElement("button");
    calculate.type = "button";
    calculate.textContent = "计算当前市场订单";
    calculate.addEventListener("click", () => void this.calculate(input, calculate));
    controls.append(label, calculate);
    const content = document.createElement("div");
    content.className = "automax-mp-content";
    content.textContent = "请打开一个交易所资源页面后计算。";
    panel.append(header, controls, content);
    document.body.append(panel);
    enableFloatingPanelDrag(panel, header);
    this.componentData.panel = panel;
    this.componentData.content = content;
  }

  async calculate(input, button) {
    if (this.componentData.calculating) return;
    const context = this.context();
    if (!context) return this.setContent("请先打开交易所资源页，并等待基础数据刷新完成。");
    const discount = Number(input.value);
    if (!Number.isFinite(discount)) return this.setContent("MP 参数无效。");
    this.indexDBData.inputPercent = discount;
    tools.indexDB_updateIndexDBData();
    this.componentData.calculating = true;
    button.disabled = true;
    button.textContent = "计算中";
    this.setContent("正在读取市场订单…");
    try {
      const response = await fetch(`https://www.simcompanies.com/api/v3/market/all/${context.realmId}/${context.resourceId}/`);
      const orders = response.ok ? await response.json() : undefined;
      if (!Array.isArray(orders)) throw new Error(`HTTP ${response.status}`);
      const rows = await this.mapLimit(orders.slice(0, 80), 4, (order) => this.calculateOrder(order, discount, context));
      this.renderRows(rows.filter(Boolean).sort((left, right) => right.hourlyProfit - left.hourlyProfit));
    } catch (error) {
      tools.errorLog("[AutoMax:MP_PROFIT]", error);
      this.setContent("市场订单或利润计算失败。" );
    } finally {
      this.componentData.calculating = false;
      button.disabled = false;
      button.textContent = "计算当前市场订单";
    }
  }

  async mapLimit(values, limit, callback) {
    const output = new Array(values.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (next < values.length) {
        const index = next;
        next += 1;
        output[index] = await callback(values[index]);
      }
    }));
    return output;
  }

  context() {
    const match = location.pathname.match(/\/market\/resource\/(\d+)\/?$/);
    const resourceId = match ? Number(match[1]) : undefined;
    const cache = componentList.autoMaxFoundation?.indexDBData?.cache;
    const realmId = getRealmIdFromDocument(document);
    const region = (realmId === 0 || realmId === 1) ? cache?.regions?.[String(realmId)] : Object.values(cache?.regions ?? {})[0];
    const constants = cache?.constants;
    const resource = constants?.constantsResources?.[resourceId];
    const buildingKind = Object.entries(constants?.data?.SALES ?? {}).find(([, ids]) => Array.isArray(ids) && ids.map(Number).includes(resourceId))?.[0];
    const custom = componentList.autoMaxExecutiveCustomToggle?.enable
      ? componentList.autoMaxExecutive?.customBonuses?.(realmId)
      : undefined;
    return Number.isInteger(resourceId) && (realmId === 0 || realmId === 1) && constants && region && resource && buildingKind
      ? { buildingKind, constants, custom, realmId, region, resource, resourceId }
      : undefined;
  }

  async calculateOrder(order, discount, context) {
    const price = Number(order?.price);
    const quality = Number(order?.quality);
    let quantity = Number(order?.quantity);
    if (!(price > 0) || !(quantity > 0) || !Number.isFinite(quality)) return undefined;
    if (context.resourceId === 153 || context.resourceId === 154) quantity = predictedAmount(quantity, order.datetimeDecayUpdated) ?? quantity;
    if (!(quantity > 0)) return undefined;
    const contractPrice = discount < 0 ? price + discount : price * (1 - discount / 100);
    if (!(contractPrice > 0)) return undefined;
    const forceQuality = context.resourceId === 150 ? quality : undefined;
    const modeledData = modeledRetailData(context.constants.retailInfo, context.region.economyState, context.resource.dbLetter, forceQuality ?? null);
    const saturation = this.saturation(context, quality);
    if (!modeledData || !Number.isFinite(saturation)) return undefined;
    const input = {
      administration: administrationMultiplier(context.region.administration, context.custom?.adminBonus ?? context.region.adminBonus),
      acceleration: Number(context.region.acceleration ?? 1),
      buildingKind: context.buildingKind,
      calculationQuality: forceQuality === undefined ? quality : 0,
      cogs: contractPrice * quantity,
      constants: context.constants.data,
      modeledData,
      quantity,
      salesModifier: Number(context.region.salesModifier ?? 0) + Number(context.region.recreationBonus ?? 0) + Number(context.custom?.saleBonus ?? context.region.saleBonus ?? 0),
      saturation,
      size: 1,
      wages: Number(context.constants.data.AVERAGE_SALARY) * (Number(context.constants.buildingsSalaryModifier?.[context.buildingKind]) || 1),
      weatherMultiplier: context.resource.retailSeason === "Summer" ? Number(context.region.sellingSpeedMultiplier?.sellingSpeedMultiplier ?? context.region.sellingSpeedMultiplier) : undefined,
    };
    const result = await runWorkerTask(retailSearchWorkerSource(), { input, mode: "hourly", maxIterations: 12_000 });
    if (!result.ok || !result.value) return undefined;
    return {
      contractPrice,
      hourlyProfit: result.value.hourlyProfit,
      marketPrice: price,
      quality,
      quantity,
      seller: order?.seller?.company ?? order?.company?.company ?? "-",
    };
  }

  saturation(context, quality) {
    const rows = context.region.ResourcesRetailInfo ?? [];
    const matches = (row) => row?.dbLetter === context.resource.dbLetter || String(row?.dbLetter) === String(context.resourceId);
    const entry = context.resourceId === 150 ? rows.find((row) => matches(row) && Number(row.quality) === quality) : rows.find(matches);
    return Number(entry?.saturation ?? rows.find(matches)?.saturation);
  }

  renderRows(rows) {
    const content = this.componentData.content;
    if (!content) return;
    content.replaceChildren();
    if (!rows.length) return this.setContent("没有可计算的零售市场订单。");
    const status = document.createElement("p");
    status.textContent = `已计算 ${rows.length} 条订单，按合同时利润降序。`;
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const header = document.createElement("tr");
    for (const label of ["卖家", "市场价", "品质", "数量", "合同价", "合同时利润"]) {
      const cell = document.createElement("th");
      cell.textContent = label;
      header.append(cell);
    }
    head.append(header);
    const body = document.createElement("tbody");
    for (const row of rows) {
      const tableRow = document.createElement("tr");
      const seller = document.createElement("td");
      const link = document.createElement("a");
      link.href = `https://www.simcompanies.com/messages/${encodeURIComponent(row.seller)}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = row.seller;
      seller.append(link);
      const values = [this.money(row.marketPrice), `Q${row.quality}`, this.number(row.quantity), this.money(row.contractPrice), this.money(row.hourlyProfit)];
      tableRow.append(seller);
      for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value;
        tableRow.append(cell);
      }
      body.append(tableRow);
    }
    table.append(head, body);
    content.append(status, table);
  }

  setContent(text) {
    if (!this.componentData.content) return;
    this.componentData.content.replaceChildren();
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    this.componentData.content.append(paragraph);
  }

  money(value) {
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  number(value) {
    return Number(value).toLocaleString();
  }
}

new autoMaxMPProfit();
