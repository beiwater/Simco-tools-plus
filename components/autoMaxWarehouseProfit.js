const BaseComponent = require("../tools/baseComponent.js");
const { componentList } = require("../tools/tools.js");
const { administrationMultiplier, modeledRetailData, retailSearchWorkerSource } = require("../tools/automax/retailMath.js");
const { getPageActionEnabled } = require("../tools/automax/settings.js");
const { getRealmIdFromDocument } = require("../tools/automax/lifecycle.js");
const { runWorkerTask } = require("../tools/automax/worker.js");

const PROFIT_MARKER = "data-automax-warehouse-profit";

class autoMaxWarehouseProfit extends BaseComponent {
  constructor() {
    super();
    this.name = "仓库时利润计算";
    this.describe = "在仓库零售物品堆叠旁显示按当前成本计算的最大时利润。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "仓库", "利润"];
  }

  componentData = {
    pending: new WeakSet(),
    revision: 0,
  }

  commonFuncList = [{
    match: () => this.isWarehouseItemPage(),
    func: this.refresh,
  }]

  cssText = [
    `
      [${PROFIT_MARKER}] { color: var(--fontColor); font-size: 13px; font-weight: 700; margin-left: 8px; white-space: nowrap; }
      [${PROFIT_MARKER}][data-negative="true"] { color: var(--sct-error, red); }
    `,
  ]

  isWarehouseItemPage() {
    return /\/headquarters\/warehouse\/(?!.*\/(?:sell|contract)\/?$)[^/]+\/?$/.test(location.pathname);
  }

  enabled() {
    return Boolean(this.enable);
  }

  refresh() {
    if (!this.enabled()) return this.clear();
    const context = this.context();
    if (!context) return;
    const revision = ++this.componentData.revision;
    for (const stack of this.itemStacks()) this.enqueue(stack, context, revision);
  }

  clear() {
    this.componentData.revision += 1;
    for (const node of document.querySelectorAll(`[${PROFIT_MARKER}]`)) node.remove();
  }

  context() {
    const resourceId = this.resourceId();
    const constants = componentList.autoMaxFoundation?.indexDBData?.cache?.constants;
    const regions = componentList.autoMaxFoundation?.indexDBData?.cache?.regions ?? {};
    const realmId = getRealmIdFromDocument(document);
    const region = (realmId === 0 || realmId === 1) ? regions[String(realmId)] : Object.values(regions)[0];
    if (!Number.isInteger(resourceId) || !constants || !region) return undefined;
    const resource = constants.constantsResources?.[resourceId];
    const buildingKind = Object.entries(constants.data?.SALES ?? {}).find(([, ids]) => Array.isArray(ids) && ids.map(Number).includes(resourceId))?.[0];
    if (!resource || !buildingKind) return undefined;
    const custom = componentList.autoMaxExecutiveCustomToggle?.enable ? componentList.autoMaxExecutive?.customBonuses?.(realmId) : undefined;
    return { buildingKind, constants, custom, realmId, region, resource, resourceId };
  }

  resourceId() {
    const link = document.querySelector('a[href*="/encyclopedia/"][href*="/resource/"]');
    const match = link?.href?.match(/\/resource\/(\d+)\/?/);
    return match ? Number(match[1]) : undefined;
  }

  findCostElements() {
    // Find elements showing cost data (e.g. "$123") within the warehouse item detail area
    const root = document.querySelector('[class*="warehouse"], [class*="resource"], main, #root') ?? document;
    const candidates = root.querySelectorAll("span, div, td");
    return Array.from(candidates).filter(el => {
      if (el.children.length > 0) return false;
      const text = el.textContent || "";
      return /^\$[\d,]+/.test(text.trim()) || text.includes("成本") || text.toLowerCase().includes("cost");
    });
  }

  findQuantityElement(node) {
    if (!node) return null;
    const candidates = node.querySelectorAll("b, strong");
    for (const el of candidates) {
      const text = el.textContent?.replaceAll(",", "").trim();
      if (text && /^\d+$/.test(text)) return el;
    }
    return null;
  }

  itemStacks() {
    const stacks = new Set();
    for (const costRow of this.findCostElements()) {
      let node = costRow.parentElement;
      while (node && node !== document.body) {
        if (this.findQuantityElement(node)) { stacks.add(node); break; }
        node = node.parentElement;
      }
    }
    return [...stacks];
  }

  enqueue(stack, context, revision) {
    if (this.componentData.pending.has(stack) || stack.querySelector(`[${PROFIT_MARKER}]`)) return;
    const item = this.itemFromStack(stack, context);
    if (!item) return;
    const target = this.quantityRow(stack) ?? stack;
    const output = document.createElement("span");
    output.setAttribute(PROFIT_MARKER, "true");
    output.textContent = "时利润：计算中";
    target.append(output);
    this.componentData.pending.add(stack);
    this.calculate(item, context).then((result) => {
      this.componentData.pending.delete(stack);
      if (!output.isConnected || revision !== this.componentData.revision) return;
      if (!result) {
        output.textContent = "时利润：无法计算";
        return;
      }
      output.textContent = `时利润：$${this.money(result.hourlyProfit)}（建议 $${this.money(result.price)}）`;
      output.toggleAttribute("data-negative", result.hourlyProfit < 0);
    }).catch((error) => {
      this.componentData.pending.delete(stack);
      if (!output.isConnected || revision !== this.componentData.revision) return;
      output.textContent = "时利润：计算失败";
    });
  }

  itemFromStack(stack, context) {
    const quantityText = this.findQuantityElement(stack)?.textContent?.replaceAll(",", "");
    const quantity = Number(quantityText);
    if (!(quantity > 0)) return undefined;
    const quality = this.quality(stack);
    const warehouse = (context.region.warehouseResources ?? []).find((entry) => Number(entry?.kind?.id ?? entry?.kind) === context.resourceId && Number(entry?.quality) === quality);
    if (!warehouse) return undefined;
    const totalCost = Object.values(warehouse.cost ?? {}).map(Number).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
    const unitCost = Number(warehouse.amount) > 0 ? totalCost / Number(warehouse.amount) : undefined;
    return Number.isFinite(unitCost) ? { quality, quantity, unitCost } : undefined;
  }

  quality(stack) {
    const text = stack.textContent?.match(/(?:Q|质量|品質)\s*(\d+)/i)?.[1];
    if (text !== undefined) return Number(text);
    const starGroups = [...stack.querySelectorAll('svg[data-icon="star"], .fa-star')].reduce((groups, star) => {
      const parent = star.parentElement;
      groups.set(parent, (groups.get(parent) ?? 0) + 1);
      return groups;
    }, new Map());
    return Math.max(0, ...starGroups.values());
  }

  quantityRow(stack) {
    const amount = this.findQuantityElement(stack);
    let node = amount?.parentElement;
    while (node && node.parentElement !== stack) node = node.parentElement;
    return node;
  }

  async calculate(item, context) {
    const forceQuality = context.resourceId === 150 ? item.quality : undefined;
    const modeledData = modeledRetailData(context.constants.retailInfo, context.region.economyState, context.resource.dbLetter, forceQuality ?? null);
    const saturation = this.saturation(context.region, context.resource, context.resourceId, item.quality);
    if (!modeledData || !Number.isFinite(saturation)) return undefined;
    const input = {
      administration: administrationMultiplier(context.region.administration, context.custom?.adminBonus ?? context.region.adminBonus),
      acceleration: Number(context.region.acceleration ?? 1),
      buildingKind: context.buildingKind,
      calculationQuality: forceQuality === undefined ? item.quality : 0,
      cogs: item.unitCost * item.quantity,
      constants: context.constants.data,
      modeledData,
      quantity: item.quantity,
      salesModifier: Number(context.region.salesModifier ?? 0) + Number(context.region.recreationBonus ?? 0) + Number(context.custom?.saleBonus ?? context.region.saleBonus ?? 0),
      saturation,
      size: 1,
      wages: Number(context.constants.data.AVERAGE_SALARY) * (Number(context.constants.buildingsSalaryModifier?.[context.buildingKind]) || 1),
      weatherMultiplier: context.resource.retailSeason === "Summer" ? Number(context.region.sellingSpeedMultiplier?.sellingSpeedMultiplier ?? context.region.sellingSpeedMultiplier) : undefined,
    };
    const result = await runWorkerTask(retailSearchWorkerSource(), { input, mode: "hourly", maxIterations: 15_000 });
    return result.ok && result.value ? result.value : undefined;
  }

  saturation(region, resource, resourceId, quality) {
    const rows = region.ResourcesRetailInfo ?? [];
    const matches = (row) => row?.dbLetter === resource.dbLetter || String(row?.dbLetter) === String(resourceId);
    const item = resourceId === 150 ? rows.find((row) => matches(row) && Number(row.quality) === quality) : rows.find(matches);
    return Number(item?.saturation ?? rows.find(matches)?.saturation);
  }

  money(value) {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

new autoMaxWarehouseProfit();
