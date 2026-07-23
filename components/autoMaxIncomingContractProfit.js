// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");
const { administrationMultiplier, modeledRetailData, retailSearchWorkerSource } = require("../tools/automax/retailMath.js");
const { getRealmIdFromDocument } = require("../tools/automax/lifecycle.js");
const { runWorkerTask } = require("../tools/automax/worker.js");

async function mapLimit(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

const DISPLAY_MARKER = "data-automax-incoming-profit";
const MARKET_CACHE_TTL = 60_000;

class autoMaxIncomingContractProfit extends BaseComponent {
  constructor() {
    super();
    this.name = "合同计算时利润";
    this.describe = "在入库合同中显示零售最大时利润、MP 差价和可选的市场最大时利润。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "合同", "利润"];
  }

  componentData = {
    marketCache: new Map(),
    pending: new WeakMap(),
    generation: 0,
    settingsListener: undefined,
  }

  indexDBData = {
    highPriceRules: { global: "", individual: "" },
  }

  startupFuncList = [this.startup]

  commonFuncList = [{
    match: () => /\/headquarters\/warehouse\/incoming-contracts\/?$/.test(location.pathname),
    func: this.refresh,
  }]

  settingUI = () => this.buildSettings()

  cssText = [
    `
      [${DISPLAY_MARKER}] { color: var(--fontColor); display: inline-flex; flex-wrap: wrap; font-size: 12px; gap: 4px; margin-left: 8px; }
      [${DISPLAY_MARKER}] span { white-space: nowrap; }
      [${DISPLAY_MARKER}] .automax-contract-note { color: var(--sct-focus, wheat); }
      [${DISPLAY_MARKER}] .automax-contract-negative { color: var(--sct-error, red); font-weight: 700; }
      div[tabindex="0"].automax-high-price-contract { border: 2px dashed var(--sct-error, red); border-radius: 8px; }
      [${DISPLAY_MARKER}] .automax-contract-high-warning { color: var(--sct-error, red); font-weight: 700; }
    `,
  ]

  startup() {
    if (!this.componentData.settingsListener) {
      this.componentData.settingsListener = () => {
        this.clear();
        this.refresh();
      };
      window.addEventListener("automax-settings-changed", this.componentData.settingsListener);
    }
  }

  enabled() {
    return Boolean(this.enable);
  }

  refresh() {
    if (!this.enabled()) return this.clear();
    const context = this.context();
    if (!context) return;
    const generation = this.componentData.generation;
    for (const card of document.querySelectorAll('div[tabindex="0"]')) this.enqueue(card, context, generation);
  }

  clear() {
    this.componentData.generation += 1;
    for (const node of document.querySelectorAll(`[${DISPLAY_MARKER}]`)) node.remove();
    for (const card of document.querySelectorAll(".automax-high-price-contract")) card.classList.remove("automax-high-price-contract");
  }

  cache() {
    return componentList.autoMaxFoundation?.indexDBData?.cache;
  }

  region() {
    const regions = this.cache()?.regions ?? {};
    const realmId = getRealmIdFromDocument(document);
    if ((realmId === 0 || realmId === 1) && regions[String(realmId)]) return regions[String(realmId)];
    return Object.values(regions).length === 1 ? Object.values(regions)[0] : undefined;
  }

  context() {
    const constants = this.cache()?.constants;
    const region = this.region();
    const realmId = getRealmIdFromDocument(document) ?? region?.realmId;
    const custom = componentList.autoMaxExecutiveCustomToggle?.enable
      ? componentList.autoMaxExecutive?.customBonuses?.(realmId)
      : undefined;
    return constants && region && (realmId === 0 || realmId === 1) ? { constants, custom, realmId, region } : undefined;
  }

  enqueue(card, context, generation) {
    if (this.componentData.pending.get(card) === generation || card.querySelector(`[${DISPLAY_MARKER}]`)) return;
    const contract = this.parseCard(card, context.constants);
    if (!contract) return;
    this.componentData.pending.set(card, generation);
    const display = this.createDisplay();
    this.insertDisplay(card, display);
    this.calculate(contract, context).then((outcome) => {
      if (this.componentData.pending.get(card) === generation) this.componentData.pending.delete(card);
      if (!display.isConnected || generation !== this.componentData.generation) return;
      this.render(display, outcome);
      this.applyHighPriceGuard(card, contract, outcome.mp);
    }).catch((error) => {
      if (this.componentData.pending.get(card) === generation) this.componentData.pending.delete(card);
      if (!display.isConnected || generation !== this.componentData.generation) return;
      tools.errorLog("[AutoMax:INCOMING_CONTRACT]", error);
      this.render(display, { note: "计算失败" });
    });
  }

  parseCard(card, constants) {
    const label = card.getAttribute("aria-label") ?? "";
    const patterns = [
      /^incoming contract,\s*([\d,]+).*?quality\s+(\d+),\s*at\s*\$([\d,.]+)\s+per unit,\s*total price\s*\$([\d,.]+)/i,
      /^来自.*?的入库合同，([\d,]+)单位的Q(\d+).*?，价格为\$([\d,.]+)每单位，总价\$([\d,.]+)/,
      /^來自.*?的入庫合同，([\d,]+)單位的Q(\d+).*?，價格為\$([\d,.]+)每單位，總價\$([\d,.]+)/,
    ];
    const match = patterns.map((pattern) => label.match(pattern)).find(Boolean);
    if (!match) return undefined;
    const [quantity, quality, unitPrice, totalPrice] = match.slice(1).map((value) => Number(value.replaceAll(",", "")));
    if (![quantity, quality, unitPrice, totalPrice].every(Number.isFinite) || quantity <= 0 || unitPrice <= 0) return undefined;
    const image = card.querySelector("img[src*='/resources/']");
    const resourceId = this.resourceIdForImage(image?.getAttribute("src"), constants?.constantsResources);
    return resourceId === undefined ? undefined : { quality, quantity, resourceId, totalPrice, unitPrice };
  }

  resourceIdForImage(source, resources) {
    if (!source || !resources) return undefined;
    const normalized = source.replace(/^https?:\/\/[^/]+/, "").replace(/^\//, "").replace(/\.[0-9a-f]{6,}\.(png|jpe?g|gif|svg)$/i, ".$1");
    for (const [id, resource] of Object.entries(resources)) {
      const image = String(resource?.image ?? "").replace(/^\//, "");
      if (image && (image === normalized || normalized.endsWith(image) || image.endsWith(normalized))) return Number(id);
    }
    return undefined;
  }

  createDisplay() {
    const display = document.createElement("span");
    display.setAttribute(DISPLAY_MARKER, "true");
    const pending = document.createElement("span");
    pending.className = "automax-contract-note";
    pending.textContent = "利润/MP 计算中";
    display.append(pending);
    return display;
  }

  insertDisplay(card, display) {
    const price = [...card.querySelectorAll("b")].find((node) => /\$|@/.test(node.textContent ?? "")) ?? card.querySelector("b");
    if (price?.parentNode) price.after(display);
    else card.append(display);
  }

  async calculate(contract, context) {
    const market = await this.marketData(context.realmId, contract.resourceId);
    const mp = this.marketPercentage(contract, market.data, market.stale);
    const contractProfit = await this.searchRetailProfit(contract, contract.unitPrice, contract.quality, context);
    let marketProfit;
    let marketChoice;
    if (componentList.autoMaxMarketProfit?.enable && Array.isArray(market.data)) {
      const candidates = this.marketCandidates(contract, market.data).slice(0, 40);
      const results = await mapLimit(candidates, 4, async (candidate) => ({
        candidate,
        profit: await this.searchRetailProfit({ ...contract, quantity: candidate.quantity }, candidate.price, candidate.quality, context),
      }));
      const best = results.reduce((winner, candidate) => !winner || (candidate.profit?.hourlyProfit ?? -Infinity) > (winner.profit?.hourlyProfit ?? -Infinity) ? candidate : winner, undefined);
      marketProfit = best?.profit;
      marketChoice = best?.candidate;
    }
    return { contractProfit, marketChoice, marketProfit, mp, note: market.error ? "MP 请求失败" : undefined };
  }

  async marketData(realmId, resourceId) {
    const key = `${realmId}:${resourceId}`;
    const cached = this.componentData.marketCache.get(key);
    if (cached && Date.now() - cached.timestamp < MARKET_CACHE_TTL) return { data: cached.data, stale: false };
    try {
      const response = await fetch(`https://www.simcompanies.com/api/v3/market/all/${realmId}/${resourceId}/`);
      const data = response.ok ? await response.json() : undefined;
      if (!Array.isArray(data)) throw new Error(`HTTP ${response.status}`);
      this.componentData.marketCache.set(key, { data, timestamp: Date.now() });
      return { data, stale: false };
    } catch {
      return cached ? { data: cached.data, stale: true } : { data: undefined, error: true, stale: false };
    }
  }

  marketPercentage(contract, data, stale) {
    if (!Array.isArray(data)) return { note: "MP 请求失败" };
    const eligible = data.filter((order) => {
      const price = Number(order?.price);
      const quality = Number(order?.quality);
      return price > 0 && Number.isFinite(price) && Number.isFinite(quality)
        && (contract.resourceId === 150 ? quality === contract.quality : quality >= contract.quality);
    });
    const best = eligible.reduce((winner, order) => !winner || Number(order.price) < Number(winner.price) ? order : winner, undefined);
    if (!best) return { note: `市场无对应品质${stale ? "（缓存已过期）" : ""}` };
    const price = Number(best.price);
    const percent = (price - contract.unitPrice) / price * 100;
    return { bestPrice: price, bestQuality: Number(best.quality), percent, stale };
  }

  marketCandidates(contract, data) {
    const accepted = data.filter((order) => {
      const price = Number(order?.price);
      const quality = Number(order?.quality);
      const quantity = Number(order?.quantity);
      return price > 0 && quantity > 0 && Number.isFinite(quality)
        && (contract.resourceId === 150 ? quality === contract.quality : quality >= contract.quality);
    }).map((order) => ({ price: Number(order.price), quality: Number(order.quality), quantity: Number(order.quantity) }));
    return accepted.sort((left, right) => left.price - right.price);
  }

  async searchRetailProfit(contract, costPrice, quality, context) {
    const resource = context.constants.constantsResources?.[contract.resourceId];
    const buildingKind = Object.entries(context.constants.data.SALES ?? {}).find(([, ids]) => Array.isArray(ids) && ids.map(Number).includes(contract.resourceId))?.[0];
    const forceQuality = contract.resourceId === 150 ? quality : undefined;
    const modeledData = modeledRetailData(context.constants.retailInfo, context.region.economyState, resource?.dbLetter, forceQuality ?? null);
    const saturation = this.saturation(context.region, resource, contract.resourceId, quality);
    if (!resource || !buildingKind || !modeledData || !Number.isFinite(saturation)) return undefined;
    const input = {
      administration: administrationMultiplier(context.region.administration, context.custom?.adminBonus ?? context.region.adminBonus),
      acceleration: Number(context.region.acceleration ?? 1),
      buildingKind,
      calculationQuality: forceQuality === undefined ? quality : 0,
      cogs: Number(costPrice) * contract.quantity,
      constants: context.constants.data,
      modeledData,
      quantity: contract.quantity,
      salesModifier: Number(context.region.salesModifier ?? 0) + Number(context.region.recreationBonus ?? 0) + Number(context.custom?.saleBonus ?? context.region.saleBonus ?? 0),
      saturation,
      size: 1,
      wages: Number(context.constants.data.AVERAGE_SALARY) * (Number(context.constants.buildingsSalaryModifier?.[buildingKind]) || 1),
      weatherMultiplier: resource.retailSeason === "Summer" ? Number(context.region.sellingSpeedMultiplier?.sellingSpeedMultiplier ?? context.region.sellingSpeedMultiplier) : undefined,
    };
    const result = await runWorkerTask(retailSearchWorkerSource(), { input, mode: "hourly", maxIterations: 15_000 });
    return result.ok && result.value ? result.value : undefined;
  }

  saturation(region, resource, resourceId, quality) {
    const rows = region?.ResourcesRetailInfo;
    if (!Array.isArray(rows)) return undefined;
    const matches = (row) => row?.dbLetter === resource?.dbLetter || String(row?.dbLetter) === String(resourceId);
    const row = resourceId === 150 ? rows.find((item) => matches(item) && Number(item.quality) === Number(quality)) : rows.find(matches);
    return Number(row?.saturation ?? rows.find(matches)?.saturation);
  }

  render(display, outcome) {
    display.replaceChildren();
    if (outcome.contractProfit) this.addResult(display, `时利润：$${this.money(outcome.contractProfit.hourlyProfit)}`, outcome.contractProfit.hourlyProfit < 0);
    if (outcome.mp?.percent !== undefined) {
      const prefix = outcome.mp.percent < 0 ? "MP+" : "MP-";
      const qualityNote = outcome.mp.bestQuality !== undefined ? ` Q${outcome.mp.bestQuality} $${this.money(outcome.mp.bestPrice)}` : "";
      this.addResult(display, `${prefix}${this.money(Math.abs(outcome.mp.percent))}%${qualityNote}${outcome.mp.stale ? "（缓存已过期）" : ""}`);
    }
    if (outcome.marketProfit && outcome.marketChoice) this.addResult(display, `市场最大时利：$${this.money(outcome.marketProfit.hourlyProfit)}（Q${outcome.marketChoice.quality} $${this.money(outcome.marketChoice.price)}）`, outcome.marketProfit.hourlyProfit < 0);
    if (!display.children.length) this.addResult(display, outcome.note ?? outcome.mp?.note ?? "没有可用的零售利润模型", false, true);
  }

  addResult(display, text, negative = false, note = false) {
    const item = document.createElement("span");
    item.textContent = text;
    if (negative) item.className = "automax-contract-negative";
    if (note) item.className = "automax-contract-note";
    display.append(item);
  }

  parsedRules() {
    const source = this.indexDBData.highPriceRules && typeof this.indexDBData.highPriceRules === "object"
      ? this.indexDBData.highPriceRules
      : { global: "", individual: "" };
    const parseValue = (value, allowAbsolute) => {
      const text = String(value ?? "").trim();
      if (!text) return undefined;
      if (/^-?\d+(?:\.\d+)?%$/.test(text)) return { type: "percent", value: Number(text.slice(0, -1)) };
      if (/^-?\d+(?:\.\d+)?$/.test(text)) {
        const number = Number(text);
        return allowAbsolute && number >= 0 ? { type: "absolute", value: number } : { type: "delta", value: number };
      }
      return undefined;
    };
    const individual = new Map();
    for (const line of String(source.individual ?? "").split("\n")) {
      const [id, quality, rule] = line.split(/[,，]/).map((value) => value.trim());
      const parsed = parseValue(rule, true);
      if (!/^\d+$/.test(id) || !/^\d+$/.test(quality) || !parsed) continue;
      individual.set(`${id}:${quality}`, parsed);
    }
    return { global: parseValue(source.global, false), individual };
  }

  threshold(rule, mpPrice) {
    if (!rule) return undefined;
    if (rule.type === "absolute") return rule.value;
    if (!(mpPrice > 0)) return undefined;
    return rule.type === "percent" ? mpPrice * (1 + rule.value / 100) : mpPrice + rule.value;
  }

  isHighPrice(contract, mp) {
    if (!contract || !(contract.unitPrice > 0)) return false;
    const rules = this.parsedRules();
    const rule = rules.individual.get(`${contract.resourceId}:${contract.quality}`) ?? rules.global;
    const threshold = this.threshold(rule, mp?.bestPrice);
    return Number.isFinite(threshold) && contract.unitPrice > threshold;
  }

  applyHighPriceGuard(card, contract, mp) {
    const high = this.isHighPrice(contract, mp);
    card.classList.toggle("automax-high-price-contract", high);
    const display = card.querySelector(`[${DISPLAY_MARKER}]`);
    display?.querySelector(".automax-contract-high-warning")?.remove();
    if (!high) return;
    const warning = document.createElement("span");
    warning.className = "automax-contract-high-warning";
    warning.textContent = "高价合同，需要再次确认";
    display?.append(warning);
    const accept = card.querySelector('a[aria-label="接受合同"], a.css-14hcbmv');
    if (!accept || accept.dataset.automaxHighPriceBound === "true") return;
    accept.dataset.automaxHighPriceBound = "true";
    accept.addEventListener("click", (event) => {
      if (!this.isHighPrice(contract, mp)) return;
      if (accept.dataset.automaxConfirmed === "true") {
        delete accept.dataset.automaxConfirmed;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      accept.dataset.automaxConfirmed = "true";
      const text = accept.querySelector("span") ?? accept;
      const original = text.textContent;
      text.textContent = `${original}?`;
      window.setTimeout(() => {
        if (accept.dataset.automaxConfirmed !== "true") return;
        delete accept.dataset.automaxConfirmed;
        text.textContent = original;
      }, 5000);
    }, true);
  }

  buildSettings() {
    const root = document.createElement("section");
    root.className = "automax-settings";
    const title = document.createElement("h2");
    title.textContent = "入库合同高价确认";
    const description = document.createElement("p");
    description.textContent = "全局规则使用相对 MP 的偏离值，例如 -1.8% 或 -0.5；单独规则每行：物品ID,品质,规则。单独规则也支持绝对价格，例如 153,0,1.7。";
    const global = document.createElement("input");
    global.type = "text";
    global.value = this.indexDBData.highPriceRules?.global ?? "";
    global.placeholder = "全局规则，例如 -1.8%";
    const individual = document.createElement("textarea");
    individual.value = this.indexDBData.highPriceRules?.individual ?? "";
    individual.placeholder = "153,0,-1.8%\n154,2,1.7";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "保存并刷新合同";
    save.addEventListener("click", () => {
      this.indexDBData.highPriceRules = { global: global.value.trim(), individual: individual.value.trim() };
      tools.indexDB_updateIndexDBData();
      this.clear();
      this.refresh();
    });
    root.append(title, description, global, individual, save);
    return root;
  }

  money(value) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  }
}

new autoMaxIncomingContractProfit();
