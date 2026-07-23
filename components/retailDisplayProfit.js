const BaseComponent = require("../tools/baseComponent.js");
const { componentList, runtimeData } = require("../tools/tools.js");
const { getRealmIdFromDocument, runWorkerTask } = require("../tools/automax/index.js");
const { isDarkPage } = require("../tools/automax/marketProfitControls.js");
const { createRetailProfitInput, RETAIL_PROFIT_WORKER_SOURCE } = require("../tools/automax/retailProfit.js");

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CALCULATION_RETRIES = 5;
const CONTROLS_MARKER = "data-automax-retail-profit-controls";
const MOUNTED_MARKER = "data-automax-retail-profit-mounted";

class retailDisplayProfit extends BaseComponent {
  constructor() {
    super();
    this.name = "零售最大时利润";
    this.describe = "在商店卡片中计算最大时利润或最大总利润，并支持假设单位成本。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "零售", "利润"];
  }

  componentData = {
    observer: undefined,
    mountTimer: undefined,
    inputStates: new WeakMap(),
    unloadListener: undefined,
  }

  indexDBData = {}

  startupFuncList = [this.startup]

  commonFuncList = [{
    match: () => this.isBuildingPage(),
    func: this.scheduleCardSync,
  }]

  cssText = [`
    [${CONTROLS_MARKER}] { display: grid; gap: 4px; grid-template-columns: 1fr; margin: 4px 0; }
    [${CONTROLS_MARKER}] button { background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); cursor: pointer; font: inherit; min-height: 36px; padding: 4px 8px; }
    [${CONTROLS_MARKER}] button:hover:not(:disabled) { background: var(--sct-control-hover, rgb(114, 114, 114)); }
    [${CONTROLS_MARKER}] button:disabled { cursor: wait; opacity: 0.7; }
    [${CONTROLS_MARKER}] button:focus-visible, .automax-retail-profit-cost input:focus-visible { outline: 2px solid var(--sct-focus, wheat); outline-offset: 2px; }
    .auto-profit-display { background: var(--sct-surface-muted, rgba(0, 0, 0, 0.7)); color: var(--fontColor); font-size: 12px; line-height: 1.5; margin: 4px 0; padding: 4px 8px; }
    .auto-profit-display[data-state="error"] { color: var(--sct-error, red); }
    .automax-retail-profit-cost { align-items: center; color: var(--fontColor); display: grid; font-size: 12px; gap: 4px; grid-template-columns: minmax(0, 1fr) minmax(96px, 42%); margin: 4px 0; }
    .automax-retail-profit-cost span { display: none; }
    .automax-retail-profit-cost input { background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); box-sizing: border-box; color: var(--fontColor); min-height: 30px; min-width: 0; padding: 4px 8px; width: 100%; }
    [${CONTROLS_MARKER}][data-theme="light"] button { background: #fff; border-color: #aaa; color: #333; }
    .auto-profit-display[data-theme="light"] { background: rgba(255, 255, 255, 0.86); color: #333; }
    .automax-retail-profit-cost[data-theme="light"] { color: #333; }
    .automax-retail-profit-cost[data-theme="light"] input { background: #fff; border-color: #aaa; color: #333; }
    [${CONTROLS_MARKER}] .btn-max-hourly-profit { background: #2196f3 !important; border-color: #2196f3 !important; color: #fff !important; }
    [${CONTROLS_MARKER}] .btn-max-total-profit { background: #e91e63 !important; border-color: #e91e63 !important; color: #fff !important; }
    .automax-retail-profit-cost { grid-template-columns: 1fr; }
    @media (max-width: 375px) { .automax-retail-profit-cost { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { [${CONTROLS_MARKER}] button { transition: none; } }
  `]

  startup() {
    this.installObserver();
    this.scheduleCardSync();
  }

  isBuildingPage() {
    return /\/b\/\d+\/?$/.test(location.href);
  }

  installObserver() {
    if (this.componentData.observer) return;
    const target = document.getElementById("root") || document.body;
    if (!target || typeof MutationObserver !== "function") return;
    this.componentData.observer = new MutationObserver((mutations) => {
      if (!this.isBuildingPage() || !mutations.some((mutation) => mutation.type === "childList" && mutation.addedNodes.length > 0)) return;
      this.scheduleCardSync();
    });
    this.componentData.observer.observe(target, { childList: true, subtree: true });
    this.componentData.unloadListener = () => this.cleanup();
    window.addEventListener("beforeunload", this.componentData.unloadListener, { once: true });
  }

  cleanup() {
    if (this.componentData.mountTimer) window.clearTimeout(this.componentData.mountTimer);
    this.componentData.mountTimer = undefined;
    this.componentData.observer?.disconnect();
    this.componentData.observer = undefined;
    if (this.componentData.unloadListener) window.removeEventListener("beforeunload", this.componentData.unloadListener);
    this.componentData.unloadListener = undefined;
  }

  scheduleCardSync() {
    if (!this.isBuildingPage()) return;
    if (this.componentData.mountTimer) window.clearTimeout(this.componentData.mountTimer);
    this.componentData.mountTimer = window.setTimeout(() => {
      this.componentData.mountTimer = undefined;
      this.syncRetailCards();
    }, 80);
  }

  syncRetailCards() {
    if (!this.isBuildingPage()) return;
    document.querySelectorAll('input[name="price"]').forEach((priceInput) => {
      const card = this.findRetailCard(priceInput);
      if (card) this.mountRetailCard(card, priceInput);
    });
  }

  findRetailCard(priceInput) {
    const sourceCard = priceInput.closest('div[style*="overflow: visible"]');
    if (sourceCard) return sourceCard;
    let node = priceInput.parentElement;
    while (node && node !== document.body) {
      const prices = node.querySelectorAll('input[name="price"]');
      if (prices.length === 1 && node.querySelector('input[name="quantity"], input[name="amount"]')) return node;
      node = node.parentElement;
    }
    return priceInput.parentElement;
  }

  findReactRetailComponent(element) {
    const reactKeys = Object.keys(element).filter((key) => key.startsWith("__reactInternalInstance") || key.startsWith("__reactFiber"));
    for (const key of reactKeys) {
      const visited = new Set();
      let fiberNode = element[key];
      while (fiberNode && !visited.has(fiberNode)) {
        visited.add(fiberNode);
        const instance = fiberNode.stateNode;
        if (instance && typeof instance === "object" && (
          typeof instance.updateProfitPerUnit === "function"
          || (instance.props?.resource && instance.state && Object.prototype.hasOwnProperty.call(instance.state, "cogs"))
        )) return instance;
        fiberNode = fiberNode.return;
      }
    }
    return null;
  }

  getInputState(priceInput) {
    let state = this.componentData.inputStates.get(priceInput);
    if (state) return state;
    state = { priceInput, requestId: 0, running: false };
    this.componentData.inputStates.set(priceInput, state);
    return state;
  }

  mountRetailCard(card, priceInput) {
    const state = this.getInputState(priceInput);
    if (state.controls?.isConnected || priceInput.getAttribute(MOUNTED_MARKER) === "true") {
      if (state.controls?.isConnected) return;
      priceInput.removeAttribute(MOUNTED_MARKER);
    }
    const component = this.findReactRetailComponent(priceInput);
    if (!component || !priceInput.parentElement) return;

    const controls = document.createElement("div");
    controls.setAttribute(CONTROLS_MARKER, "true");
    const hourly = this.createCalculationButton("最大时利润", "hourly", priceInput);
    hourly.className = "btn-max-hourly-profit";
    const total = this.createCalculationButton("最大利润", "total", priceInput);
    total.className = "btn-max-total-profit";
    controls.append(hourly, total);

    const display = document.createElement("div");
    display.className = "auto-profit-display";
    display.dataset.state = "idle";
    display.setAttribute("aria-live", "polite");
    display.textContent = "等待计算。";

    const costLabel = document.createElement("label");
    costLabel.className = "automax-retail-profit-cost";
    const costText = document.createElement("span");
    costText.textContent = "假设单位成本";
    const customCost = document.createElement("input");
    customCost.type = "number";
    customCost.className = "custom-unit-cost-input";
    customCost.min = "0";
    customCost.step = "0.01";
    customCost.inputMode = "decimal";
    customCost.placeholder = "假设单位成本";
    customCost.setAttribute("aria-label", "假设单位成本");
    costLabel.append(costText, customCost);

    const theme = isDarkPage(document, window) ? "dark" : "light";
    controls.dataset.theme = theme;
    display.dataset.theme = theme;
    costLabel.dataset.theme = theme;

    priceInput.insertAdjacentElement("afterend", controls);
    controls.insertAdjacentElement("afterend", display);
    display.insertAdjacentElement("afterend", costLabel);
    Object.assign(state, { card, controls, hourly, total, display, customCost });
    priceInput.setAttribute(MOUNTED_MARKER, "true");
    card.doAutoCalc = (_component, retryCount = 0, calcMode = "hourly") => {
      void this.startCalculation(priceInput, calcMode, retryCount);
    };
  }

  createCalculationButton(label, mode, priceInput) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      void this.startCalculation(priceInput, mode);
    });
    return button;
  }

  isFresh(record) {
    const timestamp = Date.parse(record?.timestamp);
    return Number.isFinite(timestamp) && Date.now() - timestamp <= CACHE_TTL_MS;
  }

  activeRealmId() {
    const detected = getRealmIdFromDocument(document);
    if (detected === 0 || detected === 1) return detected;
    const fallback = Number(runtimeData.basisCPT?.realm);
    return fallback === 0 || fallback === 1 ? fallback : undefined;
  }

  requestCacheRefresh(lifecycle) {
    const request = lifecycle?.scheduler?.check;
    if (typeof request !== "function") return;
    Promise.resolve(request.call(lifecycle.scheduler)).catch(() => undefined);
  }

  getAutoMaxData() {
    const foundation = componentList.autoMaxFoundation;
    const lifecycle = foundation?.componentData?.lifecycle;
    const cache = lifecycle?.cache;
    const stored = foundation?.indexDBData?.cache;
    const realmId = this.activeRealmId();
    const constants = cache?.readConstants?.(CACHE_TTL_MS) ?? (this.isFresh(stored?.constants) ? stored.constants : undefined);
    const region = realmId === undefined ? undefined : (
      cache?.readRegion?.(realmId, CACHE_TTL_MS) ?? (this.isFresh(stored?.regions?.[String(realmId)]) ? stored.regions[String(realmId)] : undefined)
    );
    const weatherUntil = Date.parse(region?.weatherUntil);
    if (!constants || !region || (Number.isFinite(weatherUntil) && Date.now() > weatherUntil)) {
      this.requestCacheRefresh(lifecycle);
      return { ok: false, error: "AutoMax 基础数据正在更新，请稍后重试。" };
    }
    return { ok: true, value: { constants, region } };
  }

  setReactInput(input, value) {
    const previous = input.value;
    const setter = typeof HTMLInputElement === "undefined" ? undefined : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, String(value));
    else input.value = String(value);
    if (input._valueTracker) input._valueTracker.setValue(previous);
    for (let count = 0; count < 4; count += 1) input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  setBusy(state, mode, retryCount) {
    state.hourly.disabled = true;
    state.total.disabled = true;
    state.hourly.textContent = mode === "hourly" ? "计算中…" : "最大时利润";
    state.total.textContent = mode === "total" ? "计算中…" : "最大利润";
    state.display.dataset.state = "pending";
    state.display.textContent = retryCount > 0 ? `正在校正数量（${retryCount}/${MAX_CALCULATION_RETRIES}）…` : "计算中…";
  }

  restoreButtons(state) {
    if (state.hourly) {
      state.hourly.disabled = false;
      state.hourly.textContent = "最大时利润";
    }
    if (state.total) {
      state.total.disabled = false;
      state.total.textContent = "最大利润";
    }
  }

  showFailure(state, requestId, message) {
    if (state.requestId !== requestId) return;
    state.running = false;
    this.restoreButtons(state);
    if (!state.display?.isConnected) return;
    state.display.dataset.state = "error";
    state.display.textContent = message;
  }

  finishCalculation(state, requestId) {
    if (state.requestId !== requestId) return;
    state.running = false;
    this.restoreButtons(state);
  }

  formatValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : "—";
  }

  applyCalculationResult(state, priceInput, result) {
    this.setReactInput(priceInput, Number(result.bestPrice).toFixed(2));
    const hourlyProfit = result.finalW > 0 ? result.finalTotalProfit / result.finalW / result.size * 3600 : NaN;
    state.display.dataset.state = "success";
    state.display.textContent = `总利润：${this.formatValue(result.finalTotalProfit)}；每级时利润：${this.formatValue(hourlyProfit)}。`;
  }

  verifyCalculation(state, priceInput, mode, retryCount, requestId, result) {
    window.setTimeout(() => {
      if (state.requestId !== requestId || !state.display?.isConnected) return;
      const updated = this.findReactRetailComponent(priceInput);
      const actualWages = Number(updated?.state?.wagesTotal);
      if (Number.isFinite(actualWages) && Math.abs(Number(result.calculatedWages) - actualWages) > 1) {
        if (retryCount < MAX_CALCULATION_RETRIES) {
          void this.startCalculation(priceInput, mode, retryCount + 1, requestId);
          return;
        }
        this.showFailure(state, requestId, "利润计算偏差过大；请手动确认数量或等待基础数据更新。");
        return;
      }
      this.finishCalculation(state, requestId);
    }, 100);
  }

  async startCalculation(priceInput, mode = "hourly", retryCount = 0, existingRequestId) {
    const state = this.getInputState(priceInput);
    if (!state.controls?.isConnected) return;
    let requestId = existingRequestId;
    if (requestId === undefined) {
      if (state.running) return;
      state.running = true;
      requestId = state.requestId + 1;
      state.requestId = requestId;
    }
    if (state.requestId !== requestId) return;
    this.setBusy(state, mode, retryCount);

    const component = this.findReactRetailComponent(priceInput);
    if (!component) {
      this.showFailure(state, requestId, "无法读取当前商店卡片，请等待页面加载完成后重试。");
      return;
    }
    const cacheData = this.getAutoMaxData();
    if (!cacheData.ok) {
      this.showFailure(state, requestId, cacheData.error);
      return;
    }
    const payload = createRetailProfitInput({
      constants: cacheData.value.constants,
      region: cacheData.value.region,
      props: component.props,
      state: component.state,
      customUnitCost: state.customCost?.value,
    });
    if (!payload.ok) {
      this.showFailure(state, requestId, payload.error);
      return;
    }

    const workerResult = await runWorkerTask(RETAIL_PROFIT_WORKER_SOURCE, { ...payload.value, calcMode: mode });
    if (state.requestId !== requestId || !state.controls?.isConnected) return;
    if (!workerResult.ok) {
      this.showFailure(state, requestId, "利润计算工作线程未能完成，请稍后重试。");
      return;
    }
    if (!workerResult.value?.ok) {
      this.showFailure(state, requestId, workerResult.value?.error ?? "利润计算未返回有效结果。");
      return;
    }
    this.applyCalculationResult(state, priceInput, workerResult.value);
    this.verifyCalculation(state, priceInput, mode, retryCount, requestId, workerResult.value);
  }
}

new retailDisplayProfit();
