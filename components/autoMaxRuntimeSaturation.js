const BaseComponent = require("../tools/baseComponent.js");
const { componentList, runtimeData, tools } = require("../tools/tools.js");
const {
  DEFAULT_RUNTIME_PRESETS,
  createSaturationRows,
  getPageActionEnabled,
  getRealmIdFromDocument,
  getWeatherMultiplier,
  normalizeRuntimePresets,
  parseRuntimePreset,
  sortSaturationRows,
} = require("../tools/automax/index.js");

const CARD_SELECTOR = ".col-xs-6.css-0.ewayztq2, .col-xs-6.resources.text-center";
const CARD_MARKER = "data-automax-runtime-mounted";
const CONTROLS_MARKER = "data-automax-runtime-controls";

class autoMaxRuntimeSaturation extends BaseComponent {
  constructor() {
    super();
    this.name = "自定义运行时长";
    this.describe = "在生产/零售卡片中填入自定义时长，并可点击展开查看领域饱和度。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "快捷", "零售"];
  }

  componentData = {
    saturationPanel: undefined,
    saturationRows: [],
    saturationSort: { key: "resourceName", direction: "asc" },
    settingsListener: undefined,
  }

  indexDBData = {
    legacyImportVersion: 0,
    runtimePresets: [...DEFAULT_RUNTIME_PRESETS],
  }

  startupFuncList = [this.startup]

  commonFuncList = [{
    match: () => this.isBuildingPage(),
    func: this.syncRuntimeControls,
  }]

  cssText = [`
    [${CONTROLS_MARKER}] { display: contents; }
    [${CONTROLS_MARKER}] button { min-height: 30px; text-transform: none !important; }
    [${CONTROLS_MARKER}] .automax-runtime-config { background: var(--sct-enabled, #14541d); color: var(--fontColor); }
    [${CONTROLS_MARKER}] .automax-runtime-error { flex-basis: 100%; color: var(--sct-error, red); font-size: 12px; overflow-wrap: anywhere; }
    #automax_saturation_panel { background: var(--sct-surface, rgba(0, 0, 0, 0.9)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); border-radius: 8px; box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5); box-sizing: border-box; color: var(--fontColor); left: 10px; max-height: min(70vh, 480px); max-width: calc(100vw - 20px); overflow: auto; padding: 12px; position: fixed; top: 50px; z-index: 1048; }
    #automax_saturation_panel header { align-items: center; display: flex; gap: 8px; justify-content: space-between; }
    #automax_saturation_panel h2 { font-size: 20px; margin: 0; }
    #automax_saturation_panel button { background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); cursor: pointer; min-height: 30px; }
    #automax_saturation_panel button:focus-visible { outline: 2px solid var(--sct-focus, wheat); outline-offset: 2px; }
    #automax_saturation_panel table { border-collapse: collapse; margin-top: 12px; width: 100%; }
    #automax_saturation_panel th, #automax_saturation_panel td { border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding: 4px 8px; text-align: center; }
    #automax_saturation_panel th button { width: 100%; }
    #automax_saturation_panel .automax-saturation-meta { font-size: 12px; line-height: 1.5; margin: 8px 0 0; }
    @media (prefers-reduced-motion: reduce) { [${CONTROLS_MARKER}] button { transition: none; } }
  `]

  startup() {
    this.indexDBData.runtimePresets = normalizeRuntimePresets(this.indexDBData.runtimePresets);
    this.importLegacyRuntimeSettings();
    if (!this.componentData.settingsListener) {
      this.componentData.settingsListener = () => this.syncRuntimeControls();
      window.addEventListener("automax-settings-changed", this.componentData.settingsListener);
    }
    this.syncRuntimeControls();
  }

  importLegacyRuntimeSettings() {
    if (this.indexDBData.legacyImportVersion >= 1) return;
    const storage = typeof localStorage === "undefined" ? undefined : localStorage;
    const rawPresets = storage?.getItem?.("SC_AutoAmount_CustomAmounts");
    if (typeof rawPresets === "string") this.indexDBData.runtimePresets = normalizeRuntimePresets(rawPresets, []);
    // Note: autoMaxPanel was removed; legacy runtimeDuration setting is no longer imported
    // since the panel's settings object no longer exists. The feature defaults to enabled.
    this.indexDBData.legacyImportVersion = 1;
    tools.indexDB_updateIndexDBData();
  }

  isBuildingPage() {
    return /\/b\/\d+\/?$/.test(location.href);
  }

  runtimeEnabled() {
    return Boolean(this.enable);
  }

  syncRuntimeControls() {
    if (!this.isBuildingPage()) return;
    if (!this.runtimeEnabled()) return this.removeRuntimeControls();
    document.querySelectorAll(CARD_SELECTOR).forEach((card) => this.mountRuntimeControl(card));
  }

  removeRuntimeControls() {
    document.querySelectorAll(`[${CONTROLS_MARKER}]`).forEach((node) => node.remove());
    document.querySelectorAll(`[${CARD_MARKER}]`).forEach((node) => node.removeAttribute(CARD_MARKER));
  }

  findButtonContainer(card) {
    const direct = card.querySelector("div.text-center");
    if (direct) return direct;
    return [...card.querySelectorAll("div")].reverse().find((node) => node.querySelector("button"));
  }

  mountRuntimeControl(card) {
    if (card.hasAttribute(CARD_MARKER)) return;
    const input = card.querySelector('input[name="amount"], input[name="quantity"]');
    const container = this.findButtonContainer(card);
    if (!input || !container) return;
    const controls = document.createElement("div");
    controls.setAttribute(CONTROLS_MARKER, "true");
    const className = container.querySelector("button")?.className || "btn btn-secondary";
    const config = document.createElement("button");
    config.className = `${className} automax-runtime-config`;
    config.type = "button";
    config.textContent = "+";
    config.title = "配置自定义时长";
    config.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.editRuntimePresets();
    });
    for (const preset of this.indexDBData.runtimePresets) controls.appendChild(this.createPresetButton(className, input, preset, controls));
    controls.appendChild(config);
    container.prepend(controls);
    card.setAttribute(CARD_MARKER, "true");
  }

  createPresetButton(className, input, preset, controls) {
    const button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.textContent = preset;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const result = parseRuntimePreset(preset);
      if (!result.ok) return this.showRuntimeError(controls, result.error);
      this.setInput(input, result.value);
      this.showRuntimeError(controls, "");
    });
    return button;
  }

  setInput(input, value) {
    const previous = input.value;
    const setter = typeof HTMLInputElement === "undefined" ? undefined : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    if (input._valueTracker) input._valueTracker.setValue(previous);
    for (let count = 0; count <= 3; count += 1) input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  showRuntimeError(controls, message) {
    let node = controls.querySelector(".automax-runtime-error");
    if (!message) return node?.remove();
    if (!node) {
      node = document.createElement("span");
      node.className = "automax-runtime-error";
      controls.appendChild(node);
    }
    node.textContent = message;
  }

  editRuntimePresets() {
    const entered = window.prompt("以逗号分隔自定义数量或时长，例如：10pm, 1d12h30m", this.indexDBData.runtimePresets.join(", "));
    if (entered === null) return;
    const presets = normalizeRuntimePresets(entered, []);
    if (presets.length === 0) return tools.alert("至少保留一个自定义数量或时长。");
    this.indexDBData.runtimePresets = presets;
    tools.indexDB_updateIndexDBData();
    this.removeRuntimeControls();
    this.syncRuntimeControls();
  }

  currentRegion() {
    const regions = componentList.autoMaxFoundation?.indexDBData?.cache?.regions ?? {};
    const realmId = getRealmIdFromDocument(document) ?? runtimeData.basisCPT?.realm;
    if ((realmId === 0 || realmId === 1) && regions[String(realmId)]) return regions[String(realmId)];
    const values = Object.values(regions);
    return values.length === 1 ? values[0] : undefined;
  }

  toggleSaturationTable(container) {
    if (this.componentData.saturationPanel?.isConnected) return this.closeSaturationTable();
    const region = this.currentRegion();
    const constants = componentList.autoMaxFoundation?.indexDBData?.cache?.constants?.constantsResources ?? {};
    this.componentData.saturationRows = createSaturationRows(region, constants, (id) => tools.itemIndex2Name(id));
    const panel = this.buildSaturationPanel(region);
    if (container) {
      panel.style.position = "static";
      panel.style.maxWidth = "100%";
      panel.style.maxHeight = "none";
      panel.style.boxShadow = "none";
      panel.style.border = "none";
      panel.style.background = "transparent";
      panel.style.padding = "0";
      const header = panel.querySelector("header");
      if (header) header.remove();
      container.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }
    this.componentData.saturationPanel = panel;
  }

  closeSaturationTable() {
    this.componentData.saturationPanel?.remove();
    this.componentData.saturationPanel = undefined;
  }

  buildSaturationPanel(region) {
    const panel = document.createElement("section");
    panel.id = "automax_saturation_panel";
    panel.className = "automax-panel-surface";
    panel.setAttribute("aria-label", "领域饱和度");
    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = "领域饱和度";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "关闭";
    close.addEventListener("click", () => this.closeSaturationTable());
    header.append(title, close);
    const meta = document.createElement("p");
    meta.className = "automax-saturation-meta";
    const multiplier = getWeatherMultiplier(region);
    meta.textContent = multiplier === null ? "天气销售速度加成：未获取。" : `天气销售速度加成：${multiplier}。`;
    const history = document.createElement("a");
    history.href = "https://marketsaturation.22-7.top/";
    history.rel = "noopener noreferrer";
    history.target = "_blank";
    history.className = "automax-panel-link";
    history.textContent = "查询历史饱和度";
    panel.append(header, meta, history, this.createSaturationTable());
    return panel;
  }

  createSaturationTable() {
    const table = document.createElement("table");
    table.className = "automax-data-table";
    const header = document.createElement("thead");
    const row = document.createElement("tr");
    const headers = new Map();
    for (const [key, label] of [["resourceName", "物品"], ["quality", "质量"], ["saturation", "饱和度"]]) {
      const cell = document.createElement("th");
      const button = document.createElement("button");
      button.type = "button";
      headers.set(key, { button, cell, label });
      button.addEventListener("click", () => {
        this.setSaturationSort(key);
        this.updateSaturationSortHeaders(headers);
      });
      cell.appendChild(button);
      row.appendChild(cell);
    }
    header.appendChild(row);
    table.append(header, document.createElement("tbody"));
    this.updateSaturationSortHeaders(headers);
    this.renderSaturationRows(table.querySelector("tbody"));
    return table;
  }

  updateSaturationSortHeaders(headers) {
    for (const [key, header] of headers) {
      const active = this.componentData.saturationSort.key === key;
      const ascending = this.componentData.saturationSort.direction === "asc";
      header.cell.setAttribute("aria-sort", active ? (ascending ? "ascending" : "descending") : "none");
      header.button.textContent = active ? `${header.label} ${ascending ? "↑" : "↓"}` : header.label;
    }
  }

  setSaturationSort(key) {
    const current = this.componentData.saturationSort;
    this.componentData.saturationSort = { key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" };
    this.renderSaturationRows(this.componentData.saturationPanel?.querySelector("tbody"));
  }

  renderSaturationRows(body) {
    if (!body) return;
    body.replaceChildren();
    const rows = sortSaturationRows(this.componentData.saturationRows, this.componentData.saturationSort.key, this.componentData.saturationSort.direction);
    if (rows.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.className = "automax-data-empty";
      cell.textContent = "当前领域没有可用的饱和度数据。";
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }
    for (const item of rows) {
      const row = document.createElement("tr");
      for (const value of [item.resourceName, item.quality ?? "-", item.saturation ?? "-"]) {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
  }

  inlineSettingUI = () => {
    const container = document.createElement("div");
    container.className = "automax-saturation-container";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn form-control automax-inline-action";
    btn.textContent = "查看领域饱和度";
    btn.addEventListener("click", () => this.toggleSaturationTable(container));
    container.append(btn);
    return container;
  }
}

new autoMaxRuntimeSaturation();
