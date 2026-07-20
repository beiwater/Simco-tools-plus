const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");
const {
  PAGE_ACTIONS,
  clampPanelPosition,
  createAutoMaxSettings,
  getPageActionEnabled,
  importLegacySettings,
} = require("../tools/automax/index.js");

class autoMaxPanel extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax 控制面板";
    this.describe = "管理 AutoMax 数据状态、页面动作开关和兼容设置导入。";
    this.enable = true;
    this.tagList = ["AutoMax", "设置", "面板"];
  }

  componentData = {
    drag: undefined,
    panel: undefined,
    panelStatus: undefined,
    panelSettings: undefined,
    open: false,
    outsideListener: undefined,
    resizeListener: undefined,
  }

  indexDBData = {
    settings: createAutoMaxSettings(),
  }

  startupFuncList = [this.startup]

  frontUI = () => this.openPanel()

  settingAction = () => this.openPanel(true)

  cssText = [`
    #automax_panel_root {
      --automax-surface: var(--sct-surface, rgba(0, 0, 0, 0.9));
      --automax-control: var(--sct-control, rgb(76, 76, 76));
      --automax-control-hover: var(--sct-control-hover, rgb(114, 114, 114));
      --automax-enabled: var(--sct-enabled, #14541d);
      --automax-focus: var(--sct-focus, wheat);
      color: var(--fontColor);
      font-family: inherit;
    }
    #automax_panel_root {
      position: fixed;
      z-index: 1048;
      box-sizing: border-box;
      width: min(320px, calc(100vw - 16px));
      max-height: min(70vh, 480px);
      overflow: auto;
      padding: 12px;
      border: 1px solid var(--automax-control-hover);
      border-radius: 8px;
      background: var(--automax-surface);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
      opacity: 0;
      pointer-events: none;
      transform: translateY(6px);
      visibility: hidden;
      transition: opacity 150ms ease-in-out, transform 150ms ease-in-out, visibility 0s linear 150ms;
    }
    #automax_panel_root[data-open="true"] {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
      visibility: visible;
      transition: opacity 150ms ease-in-out, transform 150ms ease-in-out;
    }
    #automax_panel_root h2 { margin: 0; font-size: 20px; }
    #automax_panel_root .automax-panel-header { align-items: center; cursor: grab; display: flex; gap: 8px; justify-content: space-between; touch-action: none; user-select: none; }
    #automax_panel_root .automax-panel-status { font-size: 12px; line-height: 1.5; margin: 12px 0; }
    #automax_panel_root .automax-panel-actions, .automax-settings-actions { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(min(132px, 100%), 1fr)); }
    #automax_panel_root button, .automax-settings button, .automax-settings input {
      background: var(--automax-control);
      color: var(--fontColor);
    }
    #automax_panel_root button, .automax-settings button {
      min-height: 36px;
      border: 1px solid var(--automax-control-hover);
      border-radius: 4px;
      cursor: pointer;
      padding: 8px;
      transition: transform 120ms ease-out, background-color 120ms ease-out;
    }
    #automax_panel_root button:hover, .automax-settings button:hover { background: var(--automax-control-hover); transform: translateY(-1px); }
    #automax_panel_root button:active, .automax-settings button:active { transform: translateY(0); }
    #automax_panel_root button:focus-visible, .automax-settings input:focus-visible, .automax-settings button:focus-visible { outline: 2px solid var(--automax-focus); outline-offset: 2px; }
    .automax-settings { display: grid; gap: 12px; }
    .automax-action-controls { border: 1px solid var(--automax-control-hover); display: grid; gap: 8px; margin: 0; padding: 12px; }
    .automax-action-controls legend { font-size: 14px; font-weight: 700; padding: 0 4px; }
    .automax-action-label { align-items: center; display: flex; font-size: 14px; gap: 8px; min-height: 36px; min-width: 0; }
    .automax-action-label span { min-width: 0; overflow-wrap: anywhere; }
    .automax-action-label input[type="checkbox"] { accent-color: var(--automax-enabled); flex: 0 0 auto; height: 20px; width: 20px; }
    .automax-settings .automax-settings-help { font-size: 12px; line-height: 1.5; margin: 0; }
    @media (max-width: 375px) {
      #automax_panel_root { border-radius: 5px; padding: 8px; }
      #automax_panel_root .automax-panel-actions, .automax-settings-actions { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      #automax_panel_root, #automax_panel_root button, .automax-settings button { transition: none; }
    }
  `]

  startup() {
    const imported = importLegacySettings(this.indexDBData.settings, typeof localStorage === "undefined" ? undefined : localStorage, this.viewport());
    this.indexDBData.settings = imported.settings;
    if (imported.imported) this.persistSettings();
    this.mount();
  }

  viewport() {
    const panel = this.componentData.panel;
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      panelWidth: panel?.offsetWidth || Math.min(320, window.innerWidth),
      panelHeight: panel?.offsetHeight || Math.min(480, window.innerHeight * 0.7),
    };
  }

  persistSettings() {
    return Promise.resolve(tools.indexDB_updateIndexDBData()).catch((error) => tools.errorLog(error));
  }

  mount() {
    if (this.componentData.panel?.isConnected) return;
    const existingPanel = document.getElementById("automax_panel_root");
    if (existingPanel) {
      this.componentData.panel = existingPanel;
      this.syncPosition();
      return;
    }
    const panel = this.buildPanel();
    document.body.append(panel);
    this.componentData.panel = panel;
    this.componentData.outsideListener = (event) => {
      if (!this.componentData.open || panel.contains(event.target)) return;
      this.closePanel();
    };
    this.componentData.resizeListener = () => this.syncPosition(true);
    document.addEventListener("pointerdown", this.componentData.outsideListener);
    window.addEventListener("resize", this.componentData.resizeListener);
    this.syncPosition();
  }

  buildPanel() {
    const panel = document.createElement("section");
    panel.id = "automax_panel_root";
    panel.dataset.open = "false";
    panel.setAttribute("aria-hidden", "true");
    panel.setAttribute("aria-label", "AutoMax 控制面板");

    const header = document.createElement("div");
    header.className = "automax-panel-header";
    header.addEventListener("pointerdown", (event) => this.startDrag(event));
    const title = document.createElement("h2");
    title.textContent = "AutoMax 控制面板";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "关闭";
    close.addEventListener("click", () => this.closePanel());
    header.append(title, close);

    const status = document.createElement("p");
    status.className = "automax-panel-status";
    status.setAttribute("role", "status");
    this.componentData.panelStatus = status;

    const actions = document.createElement("div");
    actions.className = "automax-panel-actions";
    const settings = document.createElement("button");
    settings.type = "button";
    settings.textContent = "功能开关";
    settings.addEventListener("click", () => this.toggleInlineSettings());
    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "重置面板位置";
    reset.addEventListener("click", () => this.resetPosition());
    const saturation = document.createElement("button");
    saturation.type = "button";
    saturation.textContent = "领域饱和度";
    saturation.addEventListener("click", () => {
      const runtime = componentList.autoMaxRuntimeSaturation;
      if (runtime?.toggleSaturationTable) runtime.toggleSaturationTable();
      else tools.alert("饱和度功能正在初始化，请稍后重试。");
    });
    actions.append(settings, reset, saturation);

    const settingsNode = document.createElement("div");
    settingsNode.hidden = true;
    this.componentData.panelSettings = settingsNode;
    panel.append(header, status, actions, settingsNode);
    this.refreshPanel();
    return panel;
  }

  cacheStatus() {
    const cache = componentList.autoMaxFoundation?.indexDBData?.cache;
    const regions = Object.keys(cache?.regions ?? {}).length;
    const constants = cache?.constants?.timestamp ? "已缓存" : "未缓存";
    return `数据缓存：${constants}；领域记录：${regions}。`;
  }

  refreshPanel() {
    if (this.componentData.panelStatus) this.componentData.panelStatus.textContent = this.cacheStatus();
  }

  openPanel(showSettings = false) {
    this.mount();
    this.componentData.open = true;
    this.componentData.panel.dataset.open = "true";
    this.componentData.panel.setAttribute("aria-hidden", "false");
    this.refreshPanel();
    if (showSettings) this.showInlineSettings();
    this.syncPosition();
  }

  closePanel() {
    if (!this.componentData.panel) return;
    this.componentData.open = false;
    this.componentData.panel.dataset.open = "false";
    this.componentData.panel.setAttribute("aria-hidden", "true");
  }

  syncPosition(save = false) {
    if (!this.componentData.panel) return;
    const viewport = this.viewport();
    const position = clampPanelPosition(this.indexDBData.settings.panelPosition, viewport);
    this.indexDBData.settings.panelPosition = position;
    this.componentData.panel.style.left = `${position.left}px`;
    this.componentData.panel.style.bottom = `${position.bottom}px`;
    if (save) this.persistSettings();
  }

  resetPosition() {
    this.indexDBData.settings = createAutoMaxSettings({
      ...this.indexDBData.settings,
      panelPosition: undefined,
    });
    this.syncPosition(true);
  }

  startDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target?.closest?.("button")) return;
    const position = this.indexDBData.settings.panelPosition;
    const drag = {
      dragged: false,
      originLeft: position.left,
      originBottom: position.bottom,
      ready: event.pointerType !== "touch",
      startX: event.clientX,
      startY: event.clientY,
      timer: undefined,
    };
    if (!drag.ready) drag.timer = window.setTimeout(() => { drag.ready = true; }, 500);
    this.componentData.drag = drag;
    window.addEventListener("pointermove", this.moveDrag);
    window.addEventListener("pointerup", this.endDrag, { once: true });
    window.addEventListener("pointercancel", this.endDrag, { once: true });
  }

  moveDrag = (event) => {
    const drag = this.componentData.drag;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.ready) {
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) this.endDrag();
      return;
    }
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    drag.dragged = true;
    const position = clampPanelPosition({ left: drag.originLeft + dx, bottom: drag.originBottom - dy }, this.viewport());
    this.indexDBData.settings.panelPosition = position;
    this.syncPosition();
    event.preventDefault();
  }

  endDrag = () => {
    const drag = this.componentData.drag;
    if (!drag) return;
    if (drag.timer) window.clearTimeout(drag.timer);
    window.removeEventListener("pointermove", this.moveDrag);
    this.componentData.drag = undefined;
    if (!drag.dragged) return;
    this.persistSettings();
  }

  actionControls() {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "automax-action-controls";
    const legend = document.createElement("legend");
    legend.textContent = "页面动作";
    fieldset.appendChild(legend);
    for (const action of PAGE_ACTIONS) {
      const label = document.createElement("label");
      label.className = "automax-action-label";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = `automax-${action.key}`;
      input.checked = getPageActionEnabled(this.indexDBData.settings, action.key);
      input.addEventListener("change", () => {
        const enabled = input.checked;
        this.indexDBData.settings = {
          ...this.indexDBData.settings,
          pageActions: { ...this.indexDBData.settings.pageActions, [action.key]: enabled },
        };
        this.persistSettings();
        if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
          window.dispatchEvent(new CustomEvent("automax-settings-changed"));
        }
      });
      const text = document.createElement("span");
      text.textContent = action.label;
      label.append(input, text);
      fieldset.appendChild(label);
    }
    return fieldset;
  }

  toggleInlineSettings() {
    const target = this.componentData.panelSettings;
    if (!target) return;
    target.hidden = !target.hidden;
    if (target.hidden) return;
    this.showInlineSettings();
  }

  showInlineSettings() {
    const target = this.componentData.panelSettings;
    if (!target) return;
    target.hidden = false;
    target.replaceChildren(this.actionControls());
    this.syncPosition();
  }
}

new autoMaxPanel();
