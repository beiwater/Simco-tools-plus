const BaseComponent = require("../tools/baseComponent.js");
const { componentList } = require("../tools/tools.js");
const { administrationMultiplier, modeledRetailData, retailSearchWorkerSource } = require("../tools/automax/retailMath.js");
const { getPageActionEnabled } = require("../tools/automax/settings.js");
const { getRealmIdFromDocument } = require("../tools/automax/lifecycle.js");
const { runWorkerTask } = require("../tools/automax/worker.js");

const CELL_MARKER = "data-automax-market-profit";

class autoMaxMarketProfit extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax 交易所时利润";
    this.describe = "在交易所资源订单中显示按零售模型计算的最大每级时利润。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "交易所", "利润"];
  }

  componentData = {
    pending: new WeakSet(),
    refreshVersion: 0,
  }

  commonFuncList = [{
    match: () => this.resourceId() !== undefined,
    func: this.refresh,
  }]

  cssText = [
    `
      td[${CELL_MARKER}] { white-space: nowrap; }
      td[${CELL_MARKER}] span { background: var(--sct-surface-muted, rgba(0, 0, 0, 0.7)); border-radius: 2px; color: var(--fontColor); display: inline-block; font-size: 12px; padding: 2px 4px; }
      tr[data-automax-market-best] td[${CELL_MARKER}] span { background: var(--sct-enabled, #14541d); }
    `,
  ]

  settings() {
    return componentList.autoMaxPanel?.indexDBData?.settings;
  }

  resourceId() {
    const match = location.pathname.match(/\/market\/resource\/(\d+)\/?$/);
    return match ? Number(match[1]) : undefined;
  }

  enabled() {
    return getPageActionEnabled(this.settings(), "marketMaxProfitToggle");
  }

  refresh() {
    if (!this.enabled()) return this.clear();
    const resourceId = this.resourceId();
    const context = this.contextFor(resourceId);
    if (!context) return;
    const version = ++this.componentData.refreshVersion;
    const rows = [...document.querySelectorAll("tr[aria-label]")];
    for (const row of rows) this.enqueueRow(row, context, version);
  }

  clear() {
    this.componentData.refreshVersion += 1;
    for (const cell of document.querySelectorAll(`td[${CELL_MARKER}]`)) cell.remove();
    for (const row of document.querySelectorAll("tr[data-automax-market-best]")) delete row.dataset.automaxMarketBest;
  }

  cache() {
    return componentList.autoMaxFoundation?.indexDBData?.cache;
  }

  region() {
    const realmId = getRealmIdFromDocument(document);
    const regions = this.cache()?.regions ?? {};
    if ((realmId === 0 || realmId === 1) && regions[String(realmId)]) return regions[String(realmId)];
    return Object.values(regions).length === 1 ? Object.values(regions)[0] : undefined;
  }

  contextFor(resourceId) {
    const constants = this.cache()?.constants;
    const region = this.region();
    const resource = constants?.constantsResources?.[resourceId];
    const economyState = region?.economyState;
    if (!constants?.data?.SALES || !resource?.dbLetter || economyState === undefined) return undefined;
    const buildingKind = Object.entries(constants.data.SALES).find(([, ids]) => Array.isArray(ids) && ids.map(Number).includes(resourceId))?.[0];
    if (!buildingKind) return undefined;
    const wages = Number(constants.data.AVERAGE_SALARY) * (Number(constants.buildingsSalaryModifier?.[buildingKind]) || 1);
    const weatherMultiplier = resource.retailSeason === "Summer"
      ? Number(region?.sellingSpeedMultiplier?.sellingSpeedMultiplier ?? region?.sellingSpeedMultiplier)
      : undefined;
    const realmId = getRealmIdFromDocument(document) ?? region?.realmId;
    const custom = getPageActionEnabled(this.settings(), "executiveCustomToggle")
      ? componentList.autoMaxExecutive?.customBonuses?.(realmId)
      : undefined;
    return { buildingKind, constants, custom, economyState, realmId, region, resource, resourceId, wages, weatherMultiplier };
  }

  parseOrder(row) {
    const label = row.getAttribute("aria-label") ?? "";
    const patterns = [
      /^market order, price \$?([\d,.]+), quantity ([\d,.]+), quality (\d+)/i,
      /^由.*公司提供的市场订单：价格\$?([\d,.]+)，数量([\d,.]+)，质量(\d+)/,
      /^由.*公司提供的市場訂單：價格\$?([\d,.]+)，數量([\d,.]+)，品質(\d+)/,
    ];
    const match = patterns.map((pattern) => label.match(pattern)).find(Boolean);
    if (!match) return undefined;
    const [price, quantity, quality] = match.slice(1).map((value) => Number(value.replaceAll(",", "")));
    return Number.isFinite(price) && price > 0 && Number.isFinite(quantity) && quantity > 0 && Number.isInteger(quality)
      ? { price, quality, quantity }
      : undefined;
  }

  enqueueRow(row, context, version) {
    if (this.componentData.pending.has(row) || row.querySelector(`td[${CELL_MARKER}]`)) return;
    const order = this.parseOrder(row);
    if (!order) return;
    this.componentData.pending.add(row);
    const cell = document.createElement("td");
    cell.setAttribute(CELL_MARKER, "true");
    const output = document.createElement("span");
    output.textContent = "时利润：计算中";
    cell.append(output);
    row.append(cell);
    this.calculateOrder(order, context).then((result) => {
      this.componentData.pending.delete(row);
      if (!row.isConnected || version !== this.componentData.refreshVersion || !cell.isConnected) return;
      if (!result) {
        output.textContent = "时利润：无有效零售模型";
        return;
      }
      row.__automaxMarketProfit = result.hourlyProfit;
      output.textContent = `时利润：$${this.money(result.hourlyProfit)}；用时：${this.duration(result.seconds)}`;
      this.markBestRow(row);
    });
  }

  async calculateOrder(order, context) {
    const forceQuality = context.resourceId === 150 ? order.quality : undefined;
    const calculationQuality = forceQuality === undefined ? order.quality : 0;
    const modeledData = modeledRetailData(context.constants.retailInfo, context.economyState, context.resource.dbLetter, forceQuality ?? null);
    const saturation = this.saturationFor(context.region, context.resource, order.quality, context.resourceId);
    if (!modeledData || !Number.isFinite(saturation)) return undefined;
    const salesModifier = Number(context.region.salesModifier ?? 0) + Number(context.region.recreationBonus ?? 0) + Number(context.custom?.saleBonus ?? context.region.saleBonus ?? 0);
    const input = {
      administration: administrationMultiplier(context.region.administration, context.custom?.adminBonus ?? context.region.adminBonus),
      acceleration: Number(context.region.acceleration ?? 1),
      buildingKind: context.buildingKind,
      calculationQuality,
      cogs: order.price * order.quantity,
      constants: context.constants.data,
      modeledData,
      quantity: order.quantity,
      salesModifier,
      saturation,
      size: 1,
      wages: context.wages,
      weatherMultiplier: Number.isFinite(context.weatherMultiplier) && context.weatherMultiplier > 0 ? context.weatherMultiplier : undefined,
    };
    const result = await runWorkerTask(retailSearchWorkerSource(), { input, mode: "hourly", maxIterations: 15_000 });
    return result.ok && result.value ? result.value : undefined;
  }

  saturationFor(region, resource, quality, resourceId) {
    const rows = region?.ResourcesRetailInfo;
    if (!Array.isArray(rows)) return undefined;
    const resourceMatch = (row) => row?.dbLetter === resource.dbLetter || String(row?.dbLetter) === String(resourceId);
    const preferred = resourceId === 150 ? rows.find((row) => resourceMatch(row) && Number(row.quality) === Number(quality)) : rows.find(resourceMatch);
    return Number(preferred?.saturation ?? rows.find(resourceMatch)?.saturation);
  }

  markBestRow(row) {
    const all = [...document.querySelectorAll("tr")].filter((candidate) => Number.isFinite(candidate.__automaxMarketProfit));
    const best = all.reduce((result, candidate) => !result || candidate.__automaxMarketProfit > result.__automaxMarketProfit ? candidate : result, undefined);
    for (const candidate of all) candidate.toggleAttribute("data-automax-market-best", candidate === best);
    if (best === row && getPageActionEnabled(this.settings(), "autoSelectBestMarketRow")) best.click();
  }

  duration(seconds) {
    const minutes = Math.max(0, Math.ceil(Number(seconds) / 60));
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  }

  money(value) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }
}

new autoMaxMarketProfit();
