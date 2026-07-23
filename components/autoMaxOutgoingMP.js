// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");
const { getRealmIdFromDocument } = require("../tools/automax/lifecycle.js");

const CONTROL_MARKER = "data-automax-outgoing-mp";
const MARKET_TTL = 60_000;
const VWAP_TTL = 10 * 60_000;
const SELL_STEPS = Object.freeze([[20000, 500], [10000, 100], [5000, 25], [1000, 10], [500, 5], [200, 2], [100, 1], [50, 0.5], [20, 0.25], [5, 0.1], [2, 0.05], [1, 0.01], [0.5, 0.005], [0, 0.001]]);

class autoMaxOutgoingMP extends BaseComponent {
  constructor() {
    super();
    this.name = "出库合同 MP-?%";
    this.describe = "为出库合同和交易所上架提供 MP/VWAP 预设价格按钮。";
    this.enable = false;
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

  enabled() {
    return Boolean(this.enable);
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
    for (const node of document.querySelectorAll(".automax-transport-profit-display")) node.remove();
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

    // Mount transport profit display
    this.mountProfitDisplay(priceInput, context);
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
    return typeof location !== "undefined" && /\/contract\/?$/.test(location.pathname);
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

  mountProfitDisplay(priceInput, context) {
    const root = priceInput.closest("form") ?? priceInput.parentElement?.parentElement ?? document.body;
    const qtyInput = root.querySelector('input[name="amount"], input[name="quantity"]');
    if (!qtyInput) return;

    const rowContainer = priceInput.closest(".row");
    if (!rowContainer || !rowContainer.parentNode) return;

    let displayDiv = rowContainer.parentNode.querySelector(".automax-transport-profit-display");
    if (!displayDiv) {
      displayDiv = document.createElement("div");
      displayDiv.className = "automax-transport-profit-display";
      displayDiv.style.cssText = `
        margin: 8px 0;
        padding: 10px 14px;
        border-radius: 8px;
        background: var(--sct-surface-muted, rgba(0, 0, 0, 0.7));
        border: 1px solid var(--sct-control-hover, rgb(114, 114, 114));
        line-height: 1.6;
        color: var(--fontColor);
        font-family: sans-serif;
        user-select: none;
      `;
      rowContainer.parentNode.insertBefore(displayDiv, rowContainer.nextSibling);
    }

    const recalculate = () => {
      const price = parseFloat(priceInput.value) || 0;
      const quantity = parseFloat(qtyInput.value) || 0;
      if (price <= 0 || quantity <= 0) {
        displayDiv.style.display = "none";
        return;
      }
      displayDiv.style.display = "";
      this.calculateAndRenderProfit(displayDiv, price, quantity, context, priceInput);
    };

    priceInput.addEventListener("input", recalculate);
    qtyInput.addEventListener("input", recalculate);

    recalculate();
  }

  calculateAndRenderProfit(displayDiv, price, quantity, context, priceInput) {
    const cache = componentList.autoMaxFoundation?.indexDBData?.cache;
    if (!cache) return;

    const constants = cache.constants;
    if (!constants) return;

    const perUnitTransport = constants.constantsResources?.[context.resourceId]?.transportation ?? 0;
    const isContract = this.isContractPage();

    const contractExactTransport = perUnitTransport * quantity * 0.5;
    const contractTransportTotal = Math.ceil(contractExactTransport);
    const sellExactTransport = perUnitTransport * quantity * 1;
    const sellTransportTotal = Math.ceil(sellExactTransport);

    const region = cache.regions?.[String(context.realmId)];
    const warehouse = region?.warehouseResources;
    if (!warehouse || !Array.isArray(warehouse)) {
      displayDiv.textContent = "仓库数据加载中...";
      return;
    }

    const quality = this.quality(priceInput);

    let productUnitCost = 0;
    const productEntries = warehouse.filter(e => Number(e.kind) === context.resourceId && Number(e.quality) === quality);
    if (productEntries.length > 0) {
      const e = productEntries[0];
      const costSum = Object.values(e.cost || {}).reduce((s, v) => s + (Number(v) || 0), 0);
      const amount = Number(e.amount || e.quantity || 0);
      productUnitCost = amount > 0 ? costSum / amount : 0;
    }

    let transportUnitCost = 0;
    const transportEntries = warehouse.filter(e => Number(e.kind) === 13);
    if (transportEntries.length > 0) {
      const e = transportEntries[0];
      const costSum = Object.values(e.cost || {}).reduce((s, v) => s + (Number(v) || 0), 0);
      const amount = Number(e.amount || e.quantity || 0);
      transportUnitCost = amount > 0 ? costSum / amount : 0;
    }

    const revenue = price * quantity;
    const productCost = productUnitCost * quantity;
    const contractTransportCost = contractTransportTotal * transportUnitCost;
    const sellTransportCost = sellTransportTotal * transportUnitCost;
    const contractNet = revenue - productCost - contractTransportCost;
    const marketNet = revenue * 0.96 - productCost - sellTransportCost;

    const sellWasteTransport = sellTransportTotal - sellExactTransport;
    const transportWasteNote = (sellWasteTransport > 0.001 && perUnitTransport > 0)
      ? `运输向上取整：消耗 ${sellTransportTotal} 运输单位，浪费 ${sellWasteTransport.toFixed(2)} 单位` : '';

    const marketFee = revenue * 0.04;

    const profitColor = (v) => v >= 0 ? "var(--sct-enabled, #14541d)" : "var(--sct-error, red)";
    const fmt = (v) => '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let expanded = displayDiv.getAttribute("data-expanded") === "true";

    displayDiv.replaceChildren();

    const header = document.createElement("div");
    header.style.cssText = "font-weight:bold;cursor:pointer;display:flex;align-items:center;gap:4px;";
    const arrow = document.createElement("span");
    arrow.textContent = expanded ? "▼" : "▶";
    header.append(arrow, " 📊 利润明细");
    header.addEventListener("click", () => {
      expanded = !expanded;
      displayDiv.setAttribute("data-expanded", expanded ? "true" : "false");
      arrow.textContent = expanded ? "▼" : "▶";
      detail.style.display = expanded ? "block" : "none";
    });
    displayDiv.appendChild(header);

    const summary = document.createElement("div");
    summary.style.cssText = "display:flex;flex-wrap:wrap;gap:16px;margin-top:4px;";
    if (isContract) {
      summary.innerHTML = `<span>合同利润: <b style="color:${profitColor(contractNet)};">${fmt(contractNet)}</b></span>`;
    } else {
      summary.innerHTML = `<span>市场利润: <b style="color:${profitColor(marketNet)};">${fmt(marketNet)}</b></span>` +
        `<span>合同利润: <b style="color:${profitColor(contractNet)};">${fmt(contractNet)}</b></span>`;
    }
    displayDiv.appendChild(summary);

    const detail = document.createElement("div");
    detail.style.cssText = `display:${expanded ? "block" : "none"};margin-top:6px;`;
    const table = document.createElement("table");
    table.style.cssText = "border-collapse:collapse;width:100%;";

    const thStyle = "padding:2px 6px;text-align:right;font-weight:bold;color:var(--fontColor);";
    const tdStyle = "padding:2px 6px;text-align:right;white-space:nowrap;";
    const rowStyle = "border-bottom:1px solid var(--sct-control-hover, rgb(114, 114, 114));";
    const labelTd = (t, bold) => `<td style="${thStyle}text-align:left;${bold ? 'font-weight:bold;' : ''}">${t}</td>`;

    if (isContract) {
      table.innerHTML = `
        <tr>${labelTd('')}<th style="${thStyle}">合同</th></tr>
        <tr style="${rowStyle}">${labelTd('收入')}<td style="${tdStyle}">${fmt(revenue)}</td></tr>
        <tr style="${rowStyle}">${labelTd('成本')}<td style="${tdStyle};color:var(--sct-error, red);">-${fmt(productCost)}</td></tr>
        <tr style="${rowStyle}">${labelTd('手续费')}<td style="${tdStyle}">${fmt(0)}</td></tr>
        <tr style="${rowStyle}">${labelTd('运输费用')}<td style="${tdStyle};color:var(--sct-error, red);">-${fmt(contractTransportCost)}</td></tr>
        <tr>${labelTd('利润', true)}<td style="${tdStyle};font-weight:bold;color:${profitColor(contractNet)};">${fmt(contractNet)}</td></tr>
      `;
    } else {
      table.innerHTML = `
        <tr>${labelTd('')}<th style="${thStyle}">市场</th><th style="${thStyle}">合同</th></tr>
        <tr style="${rowStyle}">${labelTd('收入')}<td style="${tdStyle}">${fmt(revenue)}</td><td style="${tdStyle}">${fmt(revenue)}</td></tr>
        <tr style="${rowStyle}">${labelTd('成本')}<td style="${tdStyle};color:var(--sct-error, red);">-${fmt(productCost)}</td><td style="${tdStyle};color:var(--sct-error, red);">-${fmt(productCost)}</td></tr>
        <tr style="${rowStyle}">${labelTd('手续费')}<td style="${tdStyle};color:var(--sct-error, red);">-${fmt(marketFee)}</td><td style="${tdStyle}">${fmt(0)}</td></tr>
        <tr style="${rowStyle}">${labelTd('运输费用')}<td style="${tdStyle};color:var(--sct-error, red);">-${fmt(sellTransportCost)}</td><td style="${tdStyle};color:var(--sct-error, red);">-${fmt(contractTransportCost)}</td></tr>
        <tr>${labelTd('利润', true)}<td style="${tdStyle};font-weight:bold;color:${profitColor(marketNet)};">${fmt(marketNet)}</td><td style="${tdStyle};font-weight:bold;color:${profitColor(contractNet)};">${fmt(contractNet)}</td></tr>
      `;
    }
    detail.appendChild(table);
    displayDiv.appendChild(detail);

    if (transportWasteNote) {
      const waste = document.createElement("div");
      waste.style.cssText = "color:var(--sct-focus, wheat);margin-top:4px;";
      waste.textContent = `⚠️ ${transportWasteNote}`;
      displayDiv.appendChild(waste);
    }
  }
}

new autoMaxOutgoingMP();
