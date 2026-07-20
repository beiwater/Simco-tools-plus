const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");
const { getPageActionEnabled } = require("../tools/automax/settings.js");
const { getRealmIdFromDocument } = require("../tools/automax/lifecycle.js");

const CONTROL_MARKER = "data-automax-outgoing-mp";
const MARKET_TTL = 60_000;
const VWAP_TTL = 10 * 60_000;
const SELL_STEPS = Object.freeze([[20000, 500], [10000, 100], [5000, 25], [1000, 10], [500, 5], [200, 2], [100, 1], [50, 0.5], [20, 0.25], [5, 0.1], [2, 0.05], [1, 0.01], [0.5, 0.005], [0, 0.001]]);

class autoMaxOutgoingMP extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax 出库 MP 价格";
    this.describe = "为出库合同和交易所上架提供 MP/VWAP 预设价格按钮。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "出库", "MP"];
  }

  componentData = {
    marketCache: new Map(),
    vwapCache: new Map(),
    pending: new WeakSet(),
  }

  indexDBData = {
    presets: ["MP-4%"],
    useInputPrice: false,
  }

  commonFuncList = [{
    match: () => /\/headquarters\/warehouse\/[^/]+\/(?:sell|contract)\/?$/.test(location.pathname),
    func: this.refresh,
  }]

  cssText = [
    `
      [${CONTROL_MARKER}] { align-items: center; display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
      [${CONTROL_MARKER}] button { background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); min-height: 30px; }
      [${CONTROL_MARKER}] .automax-outgoing-info { font-size: 11px; white-space: nowrap; }
    `,
  ]

  settings() {
    return componentList.autoMaxPanel?.indexDBData?.settings;
  }

  enabled() {
    return getPageActionEnabled(this.settings(), "outgoingMP");
  }

  settingUI = () => this.buildSettings()

  refresh() {
    if (!this.enabled()) return this.clear();
    const resourceId = this.resourceId();
    const realmId = getRealmIdFromDocument(document);
    if (!Number.isInteger(resourceId) || (realmId !== 0 && realmId !== 1)) return;
    for (const priceInput of document.querySelectorAll('input[name="price"]')) this.mount(priceInput, { realmId, resourceId });
  }

  clear() {
    for (const node of document.querySelectorAll(`[${CONTROL_MARKER}]`)) node.remove();
    for (const input of document.querySelectorAll('[data-automax-outgoing-mounted]')) delete input.dataset.automaxOutgoingMounted;
  }

  resourceId() {
    const link = document.querySelector('a[href*="/encyclopedia/"][href*="/resource/"]');
    const match = link?.href?.match(/\/resource\/(\d+)\/?/);
    return match ? Number(match[1]) : undefined;
  }

  mount(priceInput, context) {
    if (priceInput.dataset.automaxOutgoingMounted || this.componentData.pending.has(priceInput) || !priceInput.parentElement) return;
    priceInput.dataset.automaxOutgoingMounted = "true";
    this.componentData.pending.add(priceInput);
    const controls = document.createElement("div");
    controls.setAttribute(CONTROL_MARKER, "true");
    const info = document.createElement("span");
    info.className = "automax-outgoing-info";
    info.textContent = "MP 数据加载中";
    controls.append(info);
    priceInput.parentElement.append(controls);
    this.renderControls(priceInput, controls, info, context).finally(() => this.componentData.pending.delete(priceInput));
  }

  async renderControls(priceInput, controls, info, context) {
    const quality = this.quality(priceInput);
    const market = await this.marketData(context.realmId, context.resourceId);
    if (!controls.isConnected) return;
    const mp = this.lowestMarketPrice(market.data, context.resourceId, quality);
    if (!mp) {
      info.textContent = market.stale ? "没有匹配 MP（缓存已过期）" : "没有匹配 MP";
      return;
    }
    const exact = this.exactMarketPrice(market.data, quality);
    info.textContent = mp.quality === quality
      ? `Q${quality} 最低 $${this.format(mp.price)}`
      : `Q${quality}${exact ? `有 $${this.format(exact)}` : "无货"}，参考 Q${mp.quality} $${this.format(mp.price)}`;
    this.addButtons(priceInput, controls, mp.price, context, quality);
    const presets = this.normalizedPresets();
    if (this.isContractPage() && presets.some((preset) => /^vwap/i.test(preset))) {
      const vwap = await this.vwap(context.realmId, context.resourceId, quality);
      if (!controls.isConnected || !(vwap > 0)) return;
      info.textContent += ` | VWAP $${this.format(vwap)}`;
      this.addPresetButtons(priceInput, controls, vwap, presets.filter((preset) => /^vwap/i.test(preset)), true);
    }
  }

  async marketData(realmId, resourceId) {
    const key = `${realmId}:${resourceId}`;
    const cached = this.componentData.marketCache.get(key);
    if (cached && Date.now() - cached.timestamp < MARKET_TTL) return { data: cached.data, stale: false };
    try {
      const response = await fetch(`https://www.simcompanies.com/api/v3/market/all/${realmId}/${resourceId}/`);
      const data = response.ok ? await response.json() : undefined;
      if (!Array.isArray(data)) throw new Error("Market response is not an array.");
      this.componentData.marketCache.set(key, { data, timestamp: Date.now() });
      return { data, stale: false };
    } catch (error) {
      tools.errorLog("[AutoMax:OUTGOING_MARKET]", error);
      return { data: cached?.data ?? [], stale: Boolean(cached) };
    }
  }

  async vwap(realmId, resourceId, quality) {
    const key = `${realmId}:${resourceId}:${quality}`;
    const cached = this.componentData.vwapCache.get(key);
    if (cached && Date.now() - cached.timestamp < VWAP_TTL) return cached.value;
    const url = `https://api.simcotools.com/v1/realms/${realmId}/market/vwaps/${resourceId}/${quality}`;
    let payload;
    try {
      if (typeof GM_xmlhttpRequest === "function") {
        payload = await new Promise((resolve) => GM_xmlhttpRequest({
          method: "GET",
          url,
          timeout: 10_000,
          onload: (response) => resolve(response.status >= 200 && response.status < 300 ? response.responseText : undefined),
          onerror: () => resolve(undefined),
          ontimeout: () => resolve(undefined),
        }));
        payload = typeof payload === "string" ? JSON.parse(payload) : undefined;
      } else {
        const response = await fetch(url);
        payload = response.ok ? await response.json() : undefined;
      }
    } catch (error) {
      tools.errorLog("[AutoMax:VWAP]", error);
    }
    const value = Number(payload?.vwap ?? payload?.price ?? payload?.value ?? payload?.vwaps?.[0]?.vwap ?? (Array.isArray(payload) ? payload[0]?.vwap : undefined));
    if (Number.isFinite(value) && value > 0) this.componentData.vwapCache.set(key, { timestamp: Date.now(), value });
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }

  lowestMarketPrice(data, resourceId, quality) {
    return (Array.isArray(data) ? data : []).reduce((best, order) => {
      const price = Number(order?.price);
      const candidateQuality = Number(order?.quality);
      const matches = resourceId === 150 ? candidateQuality === quality : candidateQuality >= quality;
      return matches && price > 0 && Number.isFinite(candidateQuality) && (!best || price < best.price) ? { price, quality: candidateQuality } : best;
    }, undefined);
  }

  exactMarketPrice(data, quality) {
    return (Array.isArray(data) ? data : []).reduce((best, order) => {
      const price = Number(order?.price);
      return Number(order?.quality) === quality && price > 0 && (!best || price < best) ? price : best;
    }, undefined);
  }

  addButtons(priceInput, controls, marketPrice, context, quality) {
    if (this.isContractPage()) {
      const base = this.indexDBData.useInputPrice && Number(priceInput.value) > 0 ? Number(priceInput.value) : marketPrice;
      this.addPresetButtons(priceInput, controls, base, this.normalizedPresets().filter((preset) => !/^vwap/i.test(preset)), false);
      return;
    }
    const nativeClass = priceInput.parentElement?.querySelector("button")?.className || "btn btn-secondary";
    const market = this.button(`市场价 $${this.format(this.roundPrice(marketPrice, false))}`, nativeClass, () => this.setInput(priceInput, this.roundPrice(marketPrice, false)));
    controls.prepend(market);
    const down = this.roundPrice(marketPrice - this.sellStep(marketPrice), false);
    if (down > 0 && Math.abs(down - Number(market.value)) > Number.EPSILON) controls.insertBefore(this.button(`压价 $${this.format(down)}`, nativeClass, () => this.setInput(priceInput, down)), market.nextSibling);
  }

  addPresetButtons(priceInput, controls, basePrice, presets, isVwap) {
    const nativeClass = priceInput.parentElement?.querySelector("button")?.className || "btn btn-secondary";
    for (const preset of [...presets].reverse()) {
      const price = this.targetPrice(basePrice, preset);
      if (!(price > 0)) continue;
      const label = isVwap ? preset.replace(/^mp/i, "VWAP") : preset;
      controls.append(this.button(label, nativeClass, () => this.setInput(priceInput, this.roundPrice(price, true))));
    }
  }

  button(label, className, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", (event) => { event.preventDefault(); event.stopPropagation(); onClick(); });
    return button;
  }

  targetPrice(base, preset) {
    const value = String(preset).replace(/[＋]/g, "+").replace(/[－]/g, "-").trim().toLowerCase();
    let match = value.match(/^(?:mp|vwap)\s*([+-])\s*([\d.]+)\s*%$/);
    if (match) return match[1] === "-" ? base * (1 - Number(match[2]) / 100) : base * (1 + Number(match[2]) / 100);
    match = value.match(/^(?:mp|vwap)\s*([+-])\s*([\d.]+)$/);
    if (match) return match[1] === "-" ? base - Number(match[2]) : base + Number(match[2]);
    return /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : undefined;
  }

  setInput(input, value) {
    const prior = input.value;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, String(value));
    else input.value = String(value);
    input._valueTracker?.setValue(prior);
    for (let index = 0; index < 4; index += 1) input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  quality(priceInput) {
    const root = priceInput.closest("form") ?? priceInput.parentElement?.parentElement ?? document.body;
    const textQuality = root.textContent?.match(/\bQ(?:uality)?\s*(\d+)\b/i)?.[1] ?? root.textContent?.match(/质量\s*(\d+)/)?.[1] ?? root.textContent?.match(/品質\s*(\d+)/)?.[1];
    if (textQuality !== undefined) return Number(textQuality);
    const stars = root.querySelectorAll("svg[data-icon='star'], .fa-star").length;
    return Number.isInteger(stars) ? stars : 0;
  }

  isContractPage() {
    return /\/contract\/?$/.test(location.pathname);
  }

  sellStep(price) {
    return SELL_STEPS.find(([threshold]) => price >= threshold)?.[1] ?? 0.001;
  }

  roundPrice(price, contract) {
    if (contract) return Math.round(price * 1000) / 1000;
    const step = this.sellStep(price);
    return step >= 1 ? Math.round(price / step) * step : Math.round(price / step) * step;
  }

  normalizedPresets() {
    const source = Array.isArray(this.indexDBData.presets) ? this.indexDBData.presets : String(this.indexDBData.presets ?? "").split(/[,，]/);
    const values = source.map((item) => String(item).trim()).filter(Boolean);
    return values.length ? [...new Set(values)] : ["MP-4%"];
  }

  buildSettings() {
    const root = document.createElement("section");
    root.className = "automax-settings";
    const title = document.createElement("h2");
    title.textContent = "出库 MP/VWAP 预设";
    const input = document.createElement("textarea");
    input.value = this.normalizedPresets().join(", ");
    input.setAttribute("aria-label", "MP/VWAP 预设");
    const useInput = document.createElement("input");
    useInput.type = "checkbox";
    useInput.checked = Boolean(this.indexDBData.useInputPrice);
    const useInputLabel = document.createElement("label");
    useInputLabel.textContent = "合同页按已填写价格计算预设";
    useInputLabel.prepend(useInput);
    const help = document.createElement("p");
    help.textContent = "用逗号分隔，例如 MP-4%、MP+5、VWAP-4%。VWAP 仅在合同页按需请求。";
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "保存";
    save.addEventListener("click", () => {
      const presets = input.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
      this.indexDBData.presets = presets.length ? presets : ["MP-4%"];
      this.indexDBData.useInputPrice = useInput.checked;
      tools.indexDB_updateIndexDBData();
      this.clear();
      this.refresh();
    });
    root.append(title, help, input, useInputLabel, save);
    return root;
  }

  format(value) {
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3, minimumFractionDigits: 3 });
  }
}

new autoMaxOutgoingMP();
