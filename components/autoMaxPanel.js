const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");
const {
  PAGE_ACTIONS,
  createAutoMaxSettings,
  getPageActionEnabled,
  importLegacySettings,
} = require("../tools/automax/index.js");

class autoMaxPanel extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax 设置";
    this.describe = "在 SCT 组件列表中管理 AutoMax 页面功能开关。";
    this.enable = true;
    this.canDisable = false;
    this.tagList = ["AutoMax", "设置"];
  }

  indexDBData = {
    settings: createAutoMaxSettings(),
  }

  startupFuncList = [this.startup]

  cssText = [`
    #scriptCPT_mainBody .automax-sct-settings {
      background: var(--sct-surface-muted, rgba(0, 0, 0, 0.7));
      border: 1px solid var(--sct-control-hover, rgb(114, 114, 114));
      color: var(--fontColor);
      display: grid;
      gap: 12px;
      padding: 12px;
    }
    #scriptCPT_mainBody .automax-sct-settings h2 { font-size: 20px; margin: 0; }
    #scriptCPT_mainBody .automax-sct-settings p { font-size: 12px; line-height: 1.5; margin: 0; }
    #scriptCPT_mainBody .automax-sct-settings fieldset { border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); display: grid; gap: 8px; margin: 0; padding: 12px; }
    #scriptCPT_mainBody .automax-sct-settings legend { font-size: 14px; font-weight: 700; padding: 0 4px; }
    #scriptCPT_mainBody .automax-sct-settings label { align-items: center; display: flex; font-size: 14px; gap: 8px; min-height: 36px; }
    #scriptCPT_mainBody .automax-sct-settings label span { min-width: 0; overflow-wrap: anywhere; }
    #scriptCPT_mainBody .automax-sct-settings input[type="checkbox"] { accent-color: var(--sct-enabled, #14541d); flex: 0 0 auto; height: 20px; width: 20px; }
    #scriptCPT_mainBody .automax-sct-settings button { background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); min-height: 36px; padding: 8px; }
    #scriptCPT_mainBody .automax-sct-settings button:focus-visible, #scriptCPT_mainBody .automax-sct-settings input:focus-visible { outline: 2px solid var(--sct-focus, wheat); outline-offset: 2px; }
  `]

  startup() {
    const storage = typeof localStorage === "undefined" ? undefined : localStorage;
    const imported = importLegacySettings(this.indexDBData.settings, storage);
    this.indexDBData.settings = imported.settings;
    if (imported.imported) this.persistSettings();
  }

  persistSettings() {
    return Promise.resolve(tools.indexDB_updateIndexDBData()).catch((error) => tools.errorLog(error));
  }

  inlineSettingUI = () => {
    const section = document.createElement("section");
    section.className = "automax-sct-settings";

    const title = document.createElement("h2");
    title.textContent = "AutoMax 功能开关";
    const description = document.createElement("p");
    description.textContent = "设置直接嵌在 SCT 组件列表中，不会再打开独立 AutoMax 面板。";
    const saturation = document.createElement("button");
    saturation.type = "button";
    saturation.textContent = "查看领域饱和度";
    saturation.addEventListener("click", () => {
      const runtime = componentList.autoMaxRuntimeSaturation;
      if (runtime?.toggleSaturationTable) runtime.toggleSaturationTable();
      else tools.alert("饱和度功能正在初始化，请稍后重试。");
    });

    section.append(title, description, this.actionControls(), saturation);
    return section;
  }

  actionControls() {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "页面动作";
    fieldset.append(legend);
    for (const action of PAGE_ACTIONS) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = `automax-${action.key}`;
      input.checked = getPageActionEnabled(this.indexDBData.settings, action.key);
      input.addEventListener("change", () => {
        this.indexDBData.settings = {
          ...this.indexDBData.settings,
          pageActions: { ...this.indexDBData.settings.pageActions, [action.key]: input.checked },
        };
        this.persistSettings();
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
          window.dispatchEvent(new CustomEvent("automax-settings-changed"));
        }
      });
      const text = document.createElement("span");
      text.textContent = action.label;
      label.append(input, text);
      fieldset.append(label);
    }
    return fieldset;
  }
}

new autoMaxPanel();
