// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");

class autoMaxMapIdleHighlight extends BaseComponent {
  constructor() {
    super();
    this.name = "地图空闲建筑高亮";
    this.describe = "在总公司地图页面，仅高亮闲置建筑的名称文字；可选择需要提醒的建筑类型。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "辅助"];
  }

  indexDBData = {
    allKinds: true,
    selectedKinds: [],
  }

  allowsKind(kind) {
    if (this.indexDBData.allKinds !== false) return true;
    return Array.isArray(this.indexDBData.selectedKinds)
      && this.indexDBData.selectedKinds.map(String).includes(String(kind));
  }

  availableKinds() {
    const realm = componentList.autoMaxAccessibility?.currentRealm?.();
    const buildings = Array.isArray(realm?.buildings) ? realm.buildings : [];
    const links = [...document.querySelectorAll("a[href*='/b/']")];
    const linksById = new Map(links.map((link) => [link.href.match(/\/b\/(\d+)/)?.[1], link]));
    const kinds = new Map();
    for (const building of buildings) {
      const kind = String(building?.kind ?? "");
      if (!kind || ["n", "y", "3", "4", "5"].includes(kind)) continue;
      const link = linksById.get(String(building.id));
      const label = this.buildingLabel(link, kind);
      if (!kinds.has(kind) || kinds.get(kind) === `建筑类型 ${kind}`) kinds.set(kind, label);
    }
    return [...kinds].map(([kind, label]) => ({ kind, label })).sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
  }

  buildingLabel(link, kind) {
    const candidates = [
      link?.querySelector?.("span > span")?.textContent,
      link?.querySelector?.("span > small > span")?.textContent,
      link?.getAttribute?.("aria-label"),
      link?.getAttribute?.("title"),
      link?.textContent,
    ];
    const label = candidates.map((value) => String(value ?? "").trim()).find(Boolean);
    return label ? label.replace(/\s*(?:Lvl|Level|等级)\s*\d+.*$/i, "").trim() || label : `建筑类型 ${kind}`;
  }

  settingUI = async () => {
    const root = document.createElement("div");
    root.id = "autoMaxMapIdleHighlightSetting";
    const header = document.createElement("div");
    header.className = "header";
    header.textContent = "地图空闲建筑高亮设置";
    const container = document.createElement("div");
    container.className = "container";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "btn script_opt_submit";
    save.textContent = "保存更改";
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><td>功能</td><td>设置</td></tr></thead><tbody><tr><td>高亮范围</td><td></td></tr></tbody>";
    const controls = document.createElement("div");
    const allLabel = document.createElement("label");
    const allInput = document.createElement("input");
    allInput.type = "radio";
    allInput.name = "automax-building-kind-mode";
    allInput.value = "all";
    allInput.checked = this.indexDBData.allKinds !== false;
    allLabel.append(allInput, document.createTextNode(" 全部空闲建筑"));
    const customLabel = document.createElement("label");
    const customInput = document.createElement("input");
    customInput.type = "radio";
    customInput.name = "automax-building-kind-mode";
    customInput.value = "custom";
    customInput.checked = this.indexDBData.allKinds === false;
    customLabel.append(customInput, document.createTextNode(" 自定义建筑类型"));
    controls.append(allLabel, document.createElement("br"), customLabel);
    table.querySelector("tbody td:last-child").append(controls);

    const options = document.createElement("div");
    options.className = "automax-building-kind-options";
    const selectedKinds = new Set((this.indexDBData.selectedKinds ?? []).map(String));
    for (const { kind, label } of this.availableKinds()) {
      const option = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.buildingKind = kind;
      checkbox.checked = selectedKinds.has(kind);
      option.append(checkbox, document.createTextNode(label));
      options.append(option);
    }
    if (!options.children.length) {
      const empty = document.createElement("p");
      empty.className = "automax-building-kind-empty";
      empty.textContent = "请先打开一次公司地图，插件会读取并列出你的建筑类型。";
      options.append(empty);
    }
    const syncDisabled = () => {
      const custom = customInput.checked;
      options.querySelectorAll("input[type='checkbox']").forEach((input) => { input.disabled = !custom; });
    };
    allInput.addEventListener("change", syncDisabled);
    customInput.addEventListener("change", syncDisabled);
    syncDisabled();
    save.addEventListener("click", () => {
      this.indexDBData.allKinds = allInput.checked;
      this.indexDBData.selectedKinds = [...options.querySelectorAll("input[data-building-kind]:checked")]
        .map((input) => input.dataset.buildingKind);
      tools.indexDB_updateIndexDBData();
      componentList.autoMaxAccessibility?.refreshIdleHighlights?.();
      tools.alert("已保存建筑高亮范围");
    });
    container.append(save, table, options);
    root.append(header, container);
    return root;
  }
}

new autoMaxMapIdleHighlight();

module.exports = autoMaxMapIdleHighlight;
