const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");
const { getPageActionEnabled } = require("../tools/automax/settings.js");
const { getRealmIdFromDocument, installFetchCapture } = require("../tools/automax/lifecycle.js");

const BASE_WAGES = Object.freeze({
  0: 759, 1: 448.5, 2: 379.5, 3: 0, 4: 0, 5: 0, 6: 241.5, 7: 586.5, 8: 724.5, 9: 759,
  A: 345, a: 552, b: 414, B: 586.5, C: 172.5, c: 414, D: 621, d: 172.5, E: 414, e: 414,
  F: 138, f: 448.5, G: 138, g: 345, H: 310.5, h: 586.5, I: 241.5, i: 379.5, j: 448.5, k: 379.5,
  L: 379.5, l: 517.5, M: 276, m: 655.5, n: 0, O: 517.5, o: 379.5, P: 103.5, p: 448.5, q: 517.5,
  Q: 276, R: 483, r: 586.5, S: 310.5, s: 586.5, T: 138, t: 207, u: 241.5, v: 79.35, W: 345,
  x: 483, Y: 414, y: 0, z: 241.5,
});
const POSITION_NAMES = Object.freeze({ o: "COO", f: "CFO", m: "CMO", t: "CTO", v: "COO学徒", x: "CFO学徒", y: "CMO学徒", z: "CTO学徒", 1: "职员1", 2: "职员2", 3: "职员3", 4: "职员4", 5: "职员5" });
const TRAINING_NAMES = Object.freeze({ o: "管理培训", f: "会计课程", m: "沟通工作室", t: "科学界研讨会", g: "各领域课程" });

function executiveUrl(url) {
  return /\/api\/v2\/companies\/executives\/my-offers\/?|\/game-notifications\/|\/api\/v4\/executives\/\d+\/?|\/api\/v2\/companies\/\d+\/former-executives\/?/.test(String(url));
}

class autoMaxExecutive extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax 高管助手";
    this.describe = "保存高管培训/前任履历，提供自定义加成和 COO 管理费收益计算。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "高管", "计算"];
  }

  componentData = {
    fetchCapture: undefined,
    settingsListener: undefined,
  }

  indexDBData = {
    realms: {},
    customBonuses: {},
  }

  startupFuncList = [this.startup]

  commonFuncList = [{
    match: () => /\/headquarters\/executives\/?$/.test(location.pathname),
    func: this.injectFormerExecutiveButtons,
  }]

  netFuncList = [{
    urlMatch: (url) => executiveUrl(url),
    func: this.captureXhr,
  }]

  frontUI = () => this.openCooCalculator()

  settingUI = () => this.buildSettings()

  cssText = [
    `
      .automax-exec-panel { background: var(--sct-surface-muted, rgba(0, 0, 0, 0.7)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); display: grid; gap: 8px; margin-top: 12px; padding: 12px; }
      .automax-exec-panel p { margin: 0; overflow-wrap: anywhere; }
      .automax-exec-button, .automax-exec-modal button, .automax-exec-settings button { background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); min-height: 30px; }
      .automax-exec-modal { align-items: center; background: var(--sct-surface, rgba(0, 0, 0, 0.9)); display: flex; inset: 0; justify-content: center; position: fixed; z-index: 10000; }
      .automax-exec-modal > section { background: var(--sct-surface-muted, rgba(0, 0, 0, 0.7)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); box-sizing: border-box; color: var(--fontColor); max-height: 85vh; max-width: min(92vw, 620px); overflow: auto; padding: 16px; width: 100%; }
      .automax-exec-modal h2, .automax-exec-modal h3 { margin: 0; }
      .automax-exec-modal table { border-collapse: collapse; width: 100%; }
      .automax-exec-modal td, .automax-exec-modal th { border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding: 4px; text-align: left; }
      .automax-exec-settings { display: grid; gap: 12px; }
      .automax-exec-settings label { display: grid; gap: 4px; }
      .automax-exec-settings input { background: var(--sct-control, rgb(76, 76, 76)); color: var(--fontColor); min-height: 30px; }
    `,
  ]

  startup() {
    if (!this.componentData.fetchCapture) {
      this.componentData.fetchCapture = installFetchCapture({
        target: window,
        matchUrl: executiveUrl,
        onError: (error) => tools.errorLog("[AutoMax:EXEC_CAPTURE]", error),
        onResponse: (context) => this.captureResponse(context.url, context.data),
      });
    }
    if (!this.componentData.settingsListener) {
      this.componentData.settingsListener = () => this.injectFormerExecutiveButtons();
      window.addEventListener("automax-settings-changed", this.componentData.settingsListener);
    }
  }

  settings() {
    return componentList.autoMaxPanel?.indexDBData?.settings;
  }

  realmId() {
    return getRealmIdFromDocument(document);
  }

  realmData(realmId = this.realmId()) {
    if (realmId !== 0 && realmId !== 1) return undefined;
    const key = String(realmId);
    this.indexDBData.realms[key] ??= { details: {}, formerExecutives: [], found: [], offers: [] };
    return this.indexDBData.realms[key];
  }

  customBonuses(realmId = this.realmId()) {
    if (realmId !== 0 && realmId !== 1) return { adminBonus: 0, saleBonus: 0 };
    const value = this.indexDBData.customBonuses[String(realmId)];
    return { adminBonus: Number(value?.adminBonus) || 0, saleBonus: Number(value?.saleBonus) || 0 };
  }

  captureXhr(url, method, responseText) {
    try { return this.captureResponse(url, JSON.parse(responseText)); }
    catch { return undefined; }
  }

  captureResponse(url, payload) {
    if (!executiveUrl(url) || !payload) return;
    const realm = this.realmData();
    if (!realm) return;
    const normalizedUrl = String(url);
    if (/\/api\/v4\/executives\/(\d+)\/?/.test(normalizedUrl) && payload.id !== undefined) {
      realm.details[String(payload.id)] = payload;
      if (getPageActionEnabled(this.settings(), "executiveHistory")) this.renderDetailPanel(payload);
    }
    if (normalizedUrl.includes("/api/v2/companies/executives/my-offers/")) {
      const offers = Array.isArray(payload?.offers) ? payload.offers : [];
      const slotIds = new Set(offers.map((offer) => offer.slotPosition));
      realm.offers = realm.offers.filter((offer) => !slotIds.has(offer.slotPosition));
      for (const offer of offers) if (offer?.id) realm.offers.push({ id: offer.id, slotPosition: offer.slotPosition });
    }
    if (normalizedUrl.includes("/game-notifications/")) {
      const notifications = Array.isArray(payload) ? payload : payload.notifications ?? [];
      for (const notice of notifications) {
        if (notice?.notificationKind !== "AGENCY_FOUND_EXECUTIVE" || !notice.offerId || !notice.executiveId) continue;
        const index = realm.found.findIndex((item) => item.offerId === notice.offerId);
        const value = { executiveId: notice.executiveId, offerId: notice.offerId };
        if (index < 0) realm.found.push(value); else realm.found[index] = value;
      }
      realm.found = realm.found.slice(-100);
    }
    if (/\/api\/v2\/companies\/\d+\/former-executives\//.test(normalizedUrl)) {
      realm.formerExecutives = Array.isArray(payload?.executives) ? payload.executives : [];
      this.injectFormerExecutiveButtons();
    }
    tools.indexDB_updateIndexDBData();
  }

  renderDetailPanel(data) {
    const target = document.querySelector("button.css-1r3lxky")?.parentElement;
    if (!target || document.getElementById("automax_executive_detail")) return;
    const panel = document.createElement("section");
    panel.id = "automax_executive_detail";
    panel.className = "automax-exec-panel";
    const title = document.createElement("strong");
    title.textContent = `高管记录：${data.name ?? "未知"}（ID ${data.id ?? "-"}）`;
    const totals = this.trainingTotals(data.trainings);
    const total = document.createElement("p");
    total.textContent = `培训累计：管理 +${totals.coo}；会计 +${totals.cfo}；沟通 +${totals.cmo}；科学 +${totals.cto}`;
    const training = document.createElement("p");
    training.textContent = data.currentTraining ? `进行中：${TRAINING_NAMES[data.currentTraining.training] ?? data.currentTraining.training}` : "当前无培训";
    panel.append(title, total, training);
    target.after(panel);
  }

  trainingTotals(trainings) {
    return (Array.isArray(trainings) ? trainings : []).reduce((result, item) => ({
      coo: result.coo + (Number(item?.skillCoo) || 0), cfo: result.cfo + (Number(item?.skillCfo) || 0),
      cmo: result.cmo + (Number(item?.skillCmo) || 0), cto: result.cto + (Number(item?.skillCto) || 0),
    }), { coo: 0, cfo: 0, cmo: 0, cto: 0 });
  }

  injectFormerExecutiveButtons() {
    if (!getPageActionEnabled(this.settings(), "formerExecEnhance")) return;
    const former = this.realmData()?.formerExecutives ?? [];
    if (!former.length) return;
    for (const row of document.querySelectorAll(".css-19er0v9")) {
      if (row.querySelector("[data-automax-former-exec]")) continue;
      const name = row.children[1]?.children[0]?.textContent?.replace(/\s*\(.*$/, "").trim();
      const executive = former.find((item) => item?.name === name);
      if (!executive?.id) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "automax-exec-button";
      button.dataset.automaxFormerExec = "true";
      button.textContent = "详细";
      button.addEventListener("click", () => void this.openExecutiveModal(executive.id));
      row.append(button);
    }
  }

  async openExecutiveModal(id) {
    let data = this.realmData()?.details?.[String(id)];
    if (!data) {
      const response = await fetch(`https://www.simcompanies.com/api/v4/executives/${id}/`);
      if (!response.ok) return tools.alert("无法获取高管资料。");
      data = await response.json();
      this.captureResponse(`/api/v4/executives/${id}/`, data);
    }
    const overlay = document.createElement("div");
    overlay.className = "automax-exec-modal";
    const panel = document.createElement("section");
    const header = document.createElement("header");
    const title = document.createElement("h2");
    title.textContent = `${data.name ?? "高管"} 的详细资料`;
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "关闭";
    const dismiss = () => overlay.remove();
    close.addEventListener("click", dismiss);
    header.append(title, close);
    panel.append(header, this.historyTable(data));
    overlay.append(panel);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) dismiss(); });
    document.body.append(overlay);
  }

  historyTable(data) {
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const top = document.createElement("tr");
    for (const label of ["公司", "职位", "天数", "状态"]) {
      const cell = document.createElement("th");
      cell.textContent = label;
      top.append(cell);
    }
    head.append(top);
    const body = document.createElement("tbody");
    for (const history of Array.isArray(data.workHistory) ? data.workHistory : []) {
      const row = document.createElement("tr");
      for (const value of [history.employer?.company ?? "-", POSITION_NAMES[history.position] ?? history.position ?? "-", history.daysActive ?? "-", history.end ? "已离职" : "当前任职"]) {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.append(cell);
      }
      body.append(row);
    }
    table.append(head, body);
    return table;
  }

  totalAdminFee() {
    const region = (() => {
      const realms = componentList.autoMaxFoundation?.indexDBData?.cache?.regions ?? {};
      const realm = this.realmId();
      return (realm === 0 || realm === 1) ? realms[String(realm)] : Object.values(realms)[0];
    })();
    const overhead = Number(region?.administration) || 1;
    if (!Array.isArray(region?.buildings) || overhead <= 1) return { total: 0, region };
    const total = region.buildings.reduce((sum, building) => {
      const wage = Number(BASE_WAGES[building?.kind]) || 0;
      const robot = typeof building?.robotsSpecialization === "number" ? 0.97 : 1;
      return sum + wage * (Number(building?.size) || 0) * 24 * robot * (overhead - 1);
    }, 0);
    return { total, region };
  }

  openCooCalculator() {
    const { total, region } = this.totalAdminFee();
    const overlay = document.createElement("div");
    overlay.className = "automax-exec-modal";
    const panel = document.createElement("section");
    const title = document.createElement("h2");
    title.textContent = "COO 收益计算";
    const base = document.createElement("p");
    base.textContent = `当前建筑 24 小时管理费：$${this.money(total)}（管理费 ${(Math.max(0, (Number(region?.administration) || 1) - 1) * 100).toFixed(1)}%）`;
    const label = document.createElement("label");
    label.textContent = "COO 有效点数";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = String(Number(region?.adminBonus) || 0);
    const result = document.createElement("p");
    const update = () => {
      const points = Math.max(0, Number(input.value) || 0);
      result.textContent = `节省管理费：$${this.money(total * points / 100)}；每日实际管理费：$${this.money(total * (1 - points / 100))}`;
    };
    input.addEventListener("input", update);
    label.append(input);
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "关闭";
    close.addEventListener("click", () => overlay.remove());
    panel.append(title, base, label, result, close);
    overlay.append(panel);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    document.body.append(overlay);
    update();
  }

  buildSettings() {
    const realm = this.realmId();
    const values = this.customBonuses(realm);
    const root = document.createElement("section");
    root.className = "automax-exec-settings";
    const title = document.createElement("h2");
    title.textContent = "自定义高管加成";
    const note = document.createElement("p");
    note.textContent = "开启 AutoMax 面板中的“高管自定义加成”后，利润计算会使用这里的管理/销售加成。";
    const admin = this.numberField("管理（COO）加成", values.adminBonus);
    const sales = this.numberField("销售（CMO）加成", values.saleBonus);
    const save = document.createElement("button");
    save.type = "button";
    save.textContent = "保存";
    save.addEventListener("click", () => {
      if (realm !== 0 && realm !== 1) return tools.alert("当前领域尚未识别。");
      this.indexDBData.customBonuses[String(realm)] = { adminBonus: Math.max(0, Number(admin.input.value) || 0), saleBonus: Math.max(0, Number(sales.input.value) || 0) };
      tools.indexDB_updateIndexDBData();
      window.dispatchEvent(new CustomEvent("automax-settings-changed"));
    });
    root.append(title, note, admin.label, sales.label, save);
    return root;
  }

  numberField(text, value) {
    const label = document.createElement("label");
    label.textContent = text;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "0.01";
    input.value = String(value);
    label.append(input);
    return { input, label };
  }

  money(value) {
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

new autoMaxExecutive();
