// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");
const { administrationMultiplier, modeledRetailData, retailSearchWorkerSource } = require("../tools/automax/retailMath.js");
const { getRealmIdFromDocument } = require("../tools/automax/lifecycle.js");
const { runWorkerTask } = require("../tools/automax/worker.js");
const {
  DEFAULT_MARKET_PROFIT_SETTINGS,
  MARKET_PROFIT_CSS,
  adjustedMarketCost,
  createMarketProfitControls,
  formatMoney,
  formatMarketSummary,
  isDarkPage,
  normalizeMarketProfitSettings,
  summarizeMarketOrders,
} = require("../tools/automax/marketProfitControls.js");

const CELL_MARKER = "data-automax-market-profit";

class autoMaxMarketProfit extends BaseComponent {
  constructor() {
    super();
    this.name = "交易所计算时利润";
    this.describe = "在交易所资源订单中显示按零售模型计算的最大每级时利润。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "交易所", "利润"];
  }

  componentData = {
    controls: undefined,
    pending: new WeakSet(),
    pendingCount: 0,
    refreshVersion: 0,
    settingsListener: undefined,
  }

  indexDBData = { settings: { ...DEFAULT_MARKET_PROFIT_SETTINGS } }

  startupFuncList = [this.startup]

  commonFuncList = [{
    match: () => this.resourceId() !== undefined,
    func: this.refresh,
  }]

  cssText = [MARKET_PROFIT_CSS]

  startup() {
    this.indexDBData.settings = normalizeMarketProfitSettings(this.indexDBData.settings);
    if (this.componentData.settingsListener) return;
    this.componentData.settingsListener = () => this.recalculate();
    window.addEventListener("automax-settings-changed", this.componentData.settingsListener);
  }

  resourceId() {
    const match = location.pathname.match(/\/market\/resource\/(\d+)\/?$/);
    return match ? Number(match[1]) : undefined;
  }

  enabled() {
    return Boolean(this.enable);
  }

  refresh() {
    if (!this.enabled()) return this.clear();
    const resourceId = this.resourceId();
    const context = this.contextFor(resourceId);
    if (!context) return;
    this.mountControls();
    const version = this.componentData.refreshVersion;
    const rows = [...document.querySelectorAll("tr[aria-label]")];
    for (const row of rows) this.enqueueRow(row, context, version);
    this.renderSummary();
  }

  clear() {
    for (const cell of document.querySelectorAll(`td[${CELL_MARKER}]`)) cell.remove();
    for (const row of document.querySelectorAll("tr[aria-label]")) {
      row.removeAttribute("data-automax-market-best");
      delete row.__automaxMarketResult;
    }
    this.componentData.controls?.root.remove();
    this.componentData.controls = undefined;
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
    const override = this.indexDBData.settings.economyState;
    const economyState = override === "" ? region?.economyState : Number(override);
    if (!constants?.data?.SALES || !resource?.dbLetter || economyState === undefined) return undefined;
    const buildingKind = Object.entries(constants.data.SALES).find(([, ids]) => Array.isArray(ids) && ids.map(Number).includes(resourceId))?.[0];
    if (!buildingKind) return undefined;
    const wages = Number(constants.data.AVERAGE_SALARY) * (Number(constants.buildingsSalaryModifier?.[buildingKind]) || 1);
    const weatherMultiplier = resource.retailSeason === "Summer"
      ? Number(region?.sellingSpeedMultiplier?.sellingSpeedMultiplier ?? region?.sellingSpeedMultiplier)
      : undefined;
    const realmId = getRealmIdFromDocument(document) ?? region?.realmId;
    const custom = componentList.autoMaxExecutiveCustomToggle?.enable
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
    const price = Number(match[1].replace(/,/g, ""));
    const quantity = Number(match[2].replace(/,/g, ""));
    const quality = Number(match[3]);
    return Number.isFinite(price) && Number.isFinite(quantity) && Number.isFinite(quality) ? { price, quality, quantity } : undefined;
  }

  enqueueRow(row, context, version) {
    if (this.componentData.pending.has(row) || row.querySelector(`td[${CELL_MARKER}]`)) return;
    const order = this.parseOrder(row);
    if (!order) return;
    this.componentData.pending.add(row);
    this.componentData.pendingCount += 1;
    const cell = document.createElement("td");
    cell.setAttribute(CELL_MARKER, "true");
    cell.style.textAlign = "center";
    const inner = document.createElement("span");
    inner.textContent = "计算中...";
    cell.appendChild(inner);
    const target = row.children[row.children.length - 1];
    if (target) row.insertBefore(cell, target);
    else row.appendChild(cell);
    this.calculateProfit(order, context).then((result) => {
      this.componentData.pending.delete(row);
      if (version !== this.componentData.refreshVersion) return;
      this.componentData.pendingCount = Math.max(0, this.componentData.pendingCount - 1);
      if (!cell.isConnected) return;
      if (!result) {
        inner.textContent = "计算失败";
        this.renderSummary();
        return;
      }
      row.__automaxMarketResult = result;
      inner.textContent = `$${formatMoney(result.hourlyProfit)}/h`;
      this.markBestRow(row);
      if (this.componentData.pendingCount === 0) this.markBestRow(null, true);
      this.renderSummary();
    }).catch((error) => {
      this.componentData.pending.delete(row);
      if (version !== this.componentData.refreshVersion) return;
      this.componentData.pendingCount = Math.max(0, this.componentData.pendingCount - 1);
      if (!cell.isConnected) return;
      inner.textContent = "计算失败";
      tools.errorLog("[AutoMax:MARKET_PROFIT]", error);
      this.renderSummary();
    });
  }

  async calculateProfit(order, context) {
    const forceQuality = context.resourceId === 150 ? order.quality : undefined;
    const calculationQuality = forceQuality === undefined ? order.quality : 0;
    const modeledData = modeledRetailData(context.constants.retailInfo, context.economyState, context.resource.dbLetter, forceQuality ?? null);
    const saturation = this.saturationFor(context.region, context.resource, order.quality, context.resourceId);
    if (!modeledData || !Number.isFinite(saturation)) return undefined;
    const unitCost = adjustedMarketCost(order.price, this.indexDBData.settings.mpAdjustment);
    if (unitCost === undefined) return undefined;
    const salesModifier = Number(context.region.salesModifier ?? 0) + Number(context.region.recreationBonus ?? 0) + Number(context.custom?.saleBonus ?? context.region.saleBonus ?? 0);
    const input = {
      administration: administrationMultiplier(context.region.administration, context.custom?.adminBonus ?? context.region.adminBonus),
      acceleration: Number(context.region.acceleration ?? 1),
      buildingKind: context.buildingKind,
      calculationQuality,
      cogs: unitCost,
      constants: context.constants.data,
      modeledData,
      quantity: 1,
      salesModifier,
      saturation,
      size: 1,
      wages: context.wages,
      weatherMultiplier: Number.isFinite(context.weatherMultiplier) && context.weatherMultiplier > 0 ? context.weatherMultiplier : undefined,
    };
    const result = await runWorkerTask(retailSearchWorkerSource(), { input, mode: "hourly", maxIterations: 15_000 });
    return result.ok ? result.value : undefined;
  }

  saturationFor(region, resource, quality, resourceId) {
    const rows = region?.ResourcesRetailInfo;
    if (!Array.isArray(rows)) return undefined;
    const resourceMatch = (row) => row?.dbLetter === resource.dbLetter || String(row?.dbLetter) === String(resourceId);
    const preferred = resourceId === 150 ? rows.find((row) => resourceMatch(row) && Number(row.quality) === Number(quality)) : rows.find(resourceMatch);
    return Number(preferred?.saturation ?? rows.find(resourceMatch)?.saturation);
  }

  markBestRow(row, allComplete = false) {
    const all = [...document.querySelectorAll("tr")].filter((candidate) => Number.isFinite(candidate.__automaxMarketResult?.hourlyProfit));
    const best = all.reduce((result, candidate) => !result || candidate.__automaxMarketResult.hourlyProfit > result.__automaxMarketResult.hourlyProfit ? candidate : result, undefined);
    for (const candidate of all) candidate.toggleAttribute("data-automax-market-best", candidate === best);
    if (allComplete && best && (componentList.autoMaxMarketAutoHighlight?.enable || this.indexDBData.settings?.autoSelectBestMarketRow)) {
      this.autoSelectBestRow(best);
    }
  }

  autoSelectBestRow(bestRow) {
    const order = this.parseOrder(bestRow);
    if (!order) return;
    const targetQuality = order.quality;
    const qBtn = document.getElementById("quality-selection");
    if (qBtn) {
      const currentSpan = qBtn.querySelector("span");
      const currentQuality = currentSpan ? parseInt(currentSpan.textContent?.trim() || "") : NaN;
      if (!isNaN(currentQuality) && currentQuality !== targetQuality) {
        qBtn.click();
        setTimeout(() => {
          const dropdownMenu = qBtn.parentElement?.querySelector(".dropdown-menu");
          if (!dropdownMenu) return;
          const items = dropdownMenu.querySelectorAll("li a");
          for (const item of items) {
            const txt = item.textContent?.trim();
            if (txt && parseInt(txt) === targetQuality) {
              item.click();
              return;
            }
          }
        }, 100);
        return;
      }
    }
    bestRow.focus();
    bestRow.click();
  }

  mountControls() {
    if (this.componentData.controls?.root.isConnected) {
      this.componentData.controls.setCustomEnabled(Boolean(componentList.autoMaxExecutiveCustomToggle?.enable));
      return;
    }
    const form = document.querySelector("form");
    const container = form?.parentElement?.parentElement?.parentElement;
    if (!container) return;
    const controls = createMarketProfitControls({
      customEnabled: Boolean(componentList.autoMaxExecutiveCustomToggle?.enable),
      document,
      isDark: isDarkPage(document, window),
      settings: this.indexDBData.settings,
      onCustomData: () => componentList.autoMaxExecutive?.openBoardroomSimulator?.(),
      onCustomToggle: () => {
        const component = componentList.autoMaxExecutiveCustomToggle;
        if (!component) return;
        component.enable = !component.enable;
        tools.indexDB_updateFeatureConf();
        controls.setCustomEnabled(component.enable);
        window.dispatchEvent(new CustomEvent("automax-settings-changed"));
      },
      onSettingsChange: (settings) => {
        this.indexDBData.settings = settings;
        tools.indexDB_updateIndexDBData();
        this.recalculate();
      },
    });
    container.append(controls.root);
    this.componentData.controls = controls;
  }

  recalculate() {
    this.componentData.refreshVersion += 1;
    this.componentData.pending = new WeakSet();
    this.componentData.pendingCount = 0;
    for (const cell of document.querySelectorAll(`td[${CELL_MARKER}]`)) cell.remove();
    for (const row of document.querySelectorAll("tr[aria-label]")) {
      delete row.__automaxMarketResult;
      row.removeAttribute("data-automax-market-best");
    }
    this.refresh();
  }

  renderSummary() {
    const output = this.componentData.controls?.output;
    if (!output) return;
    if (this.componentData.pendingCount > 0) {
      output.dataset.empty = "false";
      output.textContent = "正在计算订单…";
      return;
    }
    const results = [...document.querySelectorAll("tr[aria-label]")].map((row) => row.__automaxMarketResult).filter(Boolean);
    const summary = summarizeMarketOrders(results, this.indexDBData.settings);
    output.dataset.empty = String(summary.kind === "empty");
    const message = formatMarketSummary(summary, formatMoney);
    if (summary.kind === "empty") {
      output.textContent = message;
      return;
    }
    const [title, detail] = message.split("：");
    output.replaceChildren();
    for (const clause of [`${title}：`, ...detail.split("；")]) {
      const span = document.createElement("span");
      span.className = "automax-market-summary-clause";
      span.textContent = clause;
      output.append(span);
    }
  }
}

new autoMaxMarketProfit();
