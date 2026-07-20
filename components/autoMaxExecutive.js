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
    func: this.refreshExecutivesPage,
  }]

  netFuncList = [{
    urlMatch: (url) => executiveUrl(url),
    func: this.captureXhr,
  }]

  frontUI = () => this.openBoardroomSimulator()

  settingUI = () => this.buildSettings()

  cssText = [
    `
      .automax-exec-panel { background: var(--sct-surface-muted, rgba(0, 0, 0, 0.7)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); display: grid; gap: 8px; margin-top: 12px; padding: 12px; }
      .automax-exec-panel p { margin: 0; overflow-wrap: anywhere; }
      .automax-exec-button, .automax-exec-modal button, .automax-exec-settings button { background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); min-height: 30px; border-radius: 4px; padding: 4px 10px; cursor: pointer; }
      .automax-exec-modal { align-items: center; background: rgba(0, 0, 0, 0.6); display: flex; inset: 0; justify-content: center; position: fixed; z-index: 10000; }
      .automax-exec-modal > section { background: var(--sct-surface, rgb(36, 36, 36)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); box-sizing: border-box; color: var(--fontColor); max-height: 90vh; max-width: min(95vw, 1000px); overflow: auto; padding: 16px; width: 100%; border-radius: 12px; display: flex; flex-direction: column; }
      .automax-exec-modal h2, .automax-exec-modal h3 { margin: 0; }
      .automax-exec-modal table { border-collapse: collapse; width: 100%; }
      .automax-exec-modal td, .automax-exec-modal th { border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding: 4px; text-align: left; }
      .automax-exec-settings { display: grid; gap: 12px; }
      .automax-exec-settings label { display: grid; gap: 4px; }
      .automax-exec-settings input { background: var(--sct-control, rgb(76, 76, 76)); color: var(--fontColor); min-height: 30px; }

      .sc-boardroom-layout { display: flex; flex-direction: row; width: 100%; height: 100%; margin-top: 15px; }
      .sc-boardroom-left { flex: 7; display: flex; flex-direction: column; padding-right: 20px; border-right: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); max-height: 70vh; overflow-y: auto; }
      .sc-boardroom-right { flex: 3; padding-left: 20px; display: flex; flex-direction: column; max-height: 70vh; overflow-y: auto; }
      @media (max-width: 768px) {
        .sc-boardroom-layout { flex-direction: column; }
        .sc-boardroom-left { flex: none; border-right: none; padding-right: 0; border-bottom: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding-bottom: 20px; max-height: none; }
        .sc-boardroom-right { flex: none; padding-left: 0; padding-top: 20px; max-height: none; }
      }
      .sc-slots-group { margin-bottom: 20px; }
      .sc-slots-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 3px solid var(--sct-focus, wheat); padding-left: 8px; }
      .sc-slots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
      .sc-exec-card { background: var(--sct-surface-muted, rgba(0, 0, 0, 0.4)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); border-radius: 8px; padding: 10px; cursor: move; user-select: none; position: relative; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
      .sc-exec-card:hover { box-shadow: 0 4px 10px rgba(0,0,0,0.15); }
      .sc-exec-card.dragged { opacity: 0.4; }
      .sc-exec-card-empty { border: 2px dashed var(--sct-control-hover, rgb(114, 114, 114)); background: rgba(0,0,0,0.1); border-radius: 8px; height: 110px; display: flex; align-items: center; justify-content: center; color: var(--sct-control-hover, rgb(114, 114, 114)); font-size: 12px; text-align: center; padding: 10px; box-sizing: border-box; }
      .sc-exec-card-empty.dragover { border-color: var(--sct-focus, wheat); background: rgba(255,255,255,0.05); }
      .sc-card-name { font-weight: bold; font-size: 13px; margin-bottom: 8px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sc-card-skills { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .sc-card-skill-row { display: flex; align-items: center; gap: 3px; font-size: 11px; }
      .sc-card-skill-label { font-weight: bold; width: 25px; font-size: 11px; }
      .sc-card-skill-input { width: 100%; padding: 2px 4px; border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); border-radius: 3px; background: var(--sct-control, rgb(76, 76, 76)); color: var(--fontColor); font-size: 11px; box-sizing: border-box; text-align: center; }
      .sc-card-skill-input::-webkit-outer-spin-button, .sc-card-skill-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      .sc-card-skill-input { -moz-appearance: textfield; }
      .sc-exec-card.selected { border-color: var(--sct-focus, wheat); box-shadow: 0 0 10px rgba(255,235,100,0.3); background: rgba(255,255,255,0.05); }
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
      if (componentList.autoMaxExecutiveTrainLog?.enable) this.renderDetailPanel(payload);
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

  refreshExecutivesPage() {
    this.injectBoardroomButtons();
    this.injectFormerExecutiveButtons();
  }

  injectBoardroomButtons() {
    const container = document.querySelector('.css-1wne25x');
    if (!container) return;

    const targetHeader = container.querySelector('h3');
    if (!targetHeader) return;

    if (!targetHeader.querySelector('#sc-custom-exec-btn')) {
      const btnCustom = document.createElement('button');
      btnCustom.id = 'sc-custom-exec-btn';
      btnCustom.type = 'button';
      btnCustom.className = 'automax-exec-button';
      btnCustom.textContent = "自定义高管数据";
      btnCustom.style.cssText = "margin-left: 10px; background-color: #673ab7; font-size: 12px; font-weight: bold; border: none; color: white;";
      btnCustom.addEventListener("click", (e) => {
        e.preventDefault();
        this.openBoardroomSimulator();
      });
      targetHeader.appendChild(btnCustom);
    }

    if (!targetHeader.querySelector('#sc-coo-earning-btn')) {
      const btnCOO = document.createElement('button');
      btnCOO.id = 'sc-coo-earning-btn';
      btnCOO.type = 'button';
      btnCOO.className = 'automax-exec-button';
      btnCOO.textContent = "COO收益";
      btnCOO.style.cssText = "margin-left: 10px; background-color: #4CAF50; font-size: 12px; font-weight: bold; border: none; color: white;";
      btnCOO.addEventListener("click", (e) => {
        e.preventDefault();
        this.openCooCalculator();
      });
      targetHeader.appendChild(btnCOO);
    }
  }

  injectFormerExecutiveButtons() {
    if (!componentList.autoMaxFormerExecEnhance?.enable) return;
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

  loadSavedBoardroom() {
    const realm = this.realmId();
    if (realm !== 0 && realm !== 1) return undefined;
    this.indexDBData.boardroomState ??= {};
    this.indexDBData.boardroomState[String(realm)] ??= {
      o: null, f: null, m: null, t: null,
      v: null, x: null, y: null, z: null,
      1: null, 2: null, 3: null, 4: null, 5: null
    };
    return this.indexDBData.boardroomState[String(realm)];
  }

  async fetchMeExecutives() {
    try {
      const response = await fetch("/api/v3/companies/me/executives/");
      if (!response.ok) throw new Error("API responded with status " + response.status);
      const data = await response.json();
      return data?.executives ?? [];
    } catch (error) {
      tools.errorLog("[AutoMax:FETCH_ME_EXECS]", error);
      return [];
    }
  }

  mapExecutivesToState(execList, boardroomState) {
    Object.keys(boardroomState).forEach(k => boardroomState[k] = null);
    let staffIdx = 1;
    execList.forEach(exec => {
      const pos = exec.currentWorkHistory?.position;
      const posStr = pos ? String(pos) : null;
      const emp = {
        name: exec.name || '未命名',
        skills: {
          coo: exec.skills?.coo || 0,
          cfo: exec.skills?.cfo || 0,
          cmo: exec.skills?.cmo || 0,
          cto: exec.skills?.cto || 0
        }
      };
      if (posStr && boardroomState.hasOwnProperty(posStr)) {
        boardroomState[posStr] = emp;
      } else {
        while (staffIdx <= 5 && boardroomState[String(staffIdx)] !== null) {
          staffIdx++;
        }
        if (staffIdx <= 5) {
          boardroomState[String(staffIdx)] = emp;
          staffIdx++;
        }
      }
    });
  }

  openBoardroomSimulator() {
    const realm = this.realmId();
    if (realm !== 0 && realm !== 1) return tools.alert("当前领域尚未识别。");

    const boardroomState = this.loadSavedBoardroom();

    const overlay = document.createElement("div");
    overlay.className = "automax-exec-modal";

    const panel = document.createElement("section");

    const header = document.createElement("header");
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;";
    const title = document.createElement("h2");
    title.textContent = "高管加成模拟（自定义高管数据）";
    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "关闭";
    close.className = "automax-exec-button";
    const dismiss = () => overlay.remove();
    close.addEventListener("click", dismiss);
    header.append(title, close);

    const layout = document.createElement("div");
    layout.className = "sc-boardroom-layout";

    const left = document.createElement("div");
    left.className = "sc-boardroom-left";

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex; gap:10px; margin-bottom:12px;";

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "automax-exec-button";
    saveBtn.textContent = "保存";
    saveBtn.addEventListener("click", () => {
      const res = this.calculateBoardroomResults(overlay, boardroomState);
      this.indexDBData.customBonuses[String(realm)] = {
        adminBonus: res.adminBonus,
        saleBonus: res.saleBonus
      };
      tools.indexDB_updateIndexDBData();
      window.dispatchEvent(new CustomEvent("automax-settings-changed"));
      tools.alert("数据保存成功！并在后续利润计算中生效。");
    });

    const fetchBtn = document.createElement("button");
    fetchBtn.type = "button";
    fetchBtn.className = "automax-exec-button";
    fetchBtn.textContent = "同步当前最新高管";
    fetchBtn.addEventListener("click", async () => {
      const originalText = fetchBtn.textContent;
      fetchBtn.textContent = "获取中...";
      fetchBtn.disabled = true;
      try {
        const execs = await this.fetchMeExecutives();
        if (execs && execs.length > 0) {
          this.mapExecutivesToState(execs, boardroomState);
          this.renderBoardroom(overlay, boardroomState);
          this.calculateBoardroomResults(overlay, boardroomState);
          tools.alert("已成功同步当前最新高管数据！");
        } else {
          tools.alert("未获取到当前高管数据，请确认是否处于已登录状态。");
        }
      } catch (err) {
        tools.alert("网络请求失败，请稍后重试");
      } finally {
        fetchBtn.textContent = originalText;
        fetchBtn.disabled = false;
      }
    });

    const calcBtn = document.createElement("button");
    calcBtn.type = "button";
    calcBtn.className = "automax-exec-button";
    calcBtn.textContent = "COO收益计算器";
    calcBtn.addEventListener("click", () => this.openCooCalculator());

    btnRow.append(saveBtn, fetchBtn, calcBtn);

    const helpNote = document.createElement("div");
    helpNote.style.cssText = "font-size:11px; color:var(--sct-control-hover, rgb(114, 114, 114)); margin-bottom:15px;";
    helpNote.textContent = "* 拖拽高管卡片，或点击两张卡片可以相互调换席位。点击空席位可添加自定义高管卡片。";

    const slotsContainer = document.createElement("div");
    slotsContainer.id = "sc-slots-container";

    left.append(btnRow, helpNote, slotsContainer);

    const right = document.createElement("div");
    right.className = "sc-boardroom-right";

    right.innerHTML = `
      <div style="font-size: 15px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding-bottom: 10px;">
        高管加成模拟计算
      </div>
      
      <div style="margin-bottom: 15px; font-size: 13px; background: var(--sct-surface-muted, rgba(0, 0, 0, 0.4)); padding: 10px; border-radius: 8px; border: 1px solid var(--sct-control-hover, rgb(114, 114, 114));">
        <strong style="display: block; margin-bottom: 6px; font-size: 12px;">学院总等级:</strong>
        <div style="display: flex; flex-wrap: wrap; gap: 8px 12px; font-size: 12px;">
          <label style="cursor:pointer;"><input type="radio" name="sc-aca-r" value="0" style="vertical-align:middle;"> 0-4</label>
          <label style="cursor:pointer;"><input type="radio" name="sc-aca-r" value="5" style="vertical-align:middle;"> 5-9</label>
          <label style="cursor:pointer;"><input type="radio" name="sc-aca-r" value="10" style="vertical-align:middle;"> 10-14</label>
          <label style="cursor:pointer;"><input type="radio" name="sc-aca-r" value="15" checked style="vertical-align:middle;"> 15-19</label>
          <label style="cursor:pointer;"><input type="radio" name="sc-aca-r" value="20" style="vertical-align:middle;"> 20+</label>
        </div>
      </div>
      
      <!-- Calculation Table -->
      <div id="sc-calc-table-container"></div>
      
      <!-- Calculation Details Box -->
      <div id="sc-detail-box" style="padding: 10px; border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); border-radius: 8px; background: var(--sct-surface-muted, rgba(0, 0, 0, 0.2)); font-size: 11px; line-height: 1.5; min-height: 120px; box-sizing: border-box; color: var(--fontColor);">
        💡 提示：点击或悬浮在上方任意行，可在此处查看详细计算公式。
      </div>
    `;

    layout.append(left, right);
    panel.append(header, layout);
    overlay.append(panel);

    overlay.addEventListener("click", (event) => { if (event.target === overlay) dismiss(); });

    document.body.append(overlay);

    right.querySelectorAll('input[name="sc-aca-r"]').forEach(radio => {
      radio.onchange = () => this.calculateBoardroomResults(overlay, boardroomState);
    });

    this.renderBoardroom(overlay, boardroomState);
    this.calculateBoardroomResults(overlay, boardroomState);
  }

  renderBoardroom(overlay, boardroomState) {
    const leftContainer = overlay.querySelector('#sc-slots-container');
    if (!leftContainer) return;
    leftContainer.replaceChildren();

    const slotGroups = [
      {
        title: '高管',
        slots: [
          { id: 'o', label: 'COO' },
          { id: 'f', label: 'CFO' },
          { id: 'm', label: 'CMO' },
          { id: 't', label: 'CTO' }
        ]
      },
      {
        title: '学徒',
        slots: [
          { id: 'v', label: 'COO 学徒' },
          { id: 'x', label: 'CFO 学徒' },
          { id: 'y', label: 'CMO 学徒' },
          { id: 'z', label: 'CTO 学徒' }
        ]
      },
      {
        title: '职员',
        slots: [
          { id: '1', label: '职员 1' },
          { id: '2', label: '职员 2' },
          { id: '3', label: '职员 3' },
          { id: '4', label: '职员 4' },
          { id: '5', label: '职员 5' }
        ]
      }
    ];

    let draggedSlotId = null;
    let selectedSlotId = null;

    slotGroups.forEach(group => {
      const groupEl = document.createElement('div');
      groupEl.className = 'sc-slots-group';

      const titleEl = document.createElement('div');
      titleEl.className = 'sc-slots-title';
      titleEl.textContent = group.title;
      groupEl.appendChild(titleEl);

      const gridEl = document.createElement('div');
      gridEl.className = 'sc-slots-grid';

      group.slots.forEach(slot => {
        const slotEl = document.createElement('div');
        slotEl.dataset.slotId = slot.id;

        slotEl.ondragover = (e) => { e.preventDefault(); };
        slotEl.ondragenter = (e) => { e.preventDefault(); slotEl.classList.add('dragover'); };
        slotEl.ondragleave = () => { slotEl.classList.remove('dragover'); };
        slotEl.ondrop = (e) => {
          e.preventDefault();
          slotEl.classList.remove('dragover');
          const targetSlotId = slot.id;
          if (draggedSlotId && draggedSlotId !== targetSlotId) {
            const temp = boardroomState[draggedSlotId];
            boardroomState[draggedSlotId] = boardroomState[targetSlotId];
            boardroomState[targetSlotId] = temp;
            this.renderBoardroom(overlay, boardroomState);
            this.calculateBoardroomResults(overlay, boardroomState);
          }
        };

        slotEl.onclick = (e) => {
          if (selectedSlotId !== null && !boardroomState[slot.id]) {
            e.stopPropagation();
            const temp = boardroomState[selectedSlotId];
            boardroomState[selectedSlotId] = boardroomState[slot.id];
            boardroomState[slot.id] = temp;
            selectedSlotId = null;
            this.renderBoardroom(overlay, boardroomState);
            this.calculateBoardroomResults(overlay, boardroomState);
          }
        };

        const emp = boardroomState[slot.id];
        if (emp) {
          const cardEl = document.createElement('div');
          cardEl.className = 'sc-exec-card';
          cardEl.setAttribute('draggable', 'true');

          cardEl.ondragstart = () => {
            draggedSlotId = slot.id;
            cardEl.classList.add('dragged');
          };
          cardEl.ondragend = () => {
            draggedSlotId = null;
            cardEl.classList.remove('dragged');
          };

          cardEl.onclick = (e) => {
            if (e.target.tagName === 'INPUT') return;
            e.stopPropagation();
            if (selectedSlotId === null) {
              selectedSlotId = slot.id;
              cardEl.classList.add('selected');
            } else if (selectedSlotId === slot.id) {
              selectedSlotId = null;
              cardEl.classList.remove('selected');
            } else {
              const temp = boardroomState[selectedSlotId];
              boardroomState[selectedSlotId] = boardroomState[slot.id];
              boardroomState[slot.id] = temp;
              selectedSlotId = null;
              this.renderBoardroom(overlay, boardroomState);
              this.calculateBoardroomResults(overlay, boardroomState);
            }
          };

          const closeBtn = document.createElement('span');
          closeBtn.innerHTML = '&times;';
          closeBtn.style.cssText = 'position:absolute; top:2px; right:6px; cursor:pointer; font-size:14px; font-weight:bold; color:var(--sct-control-hover, rgb(114, 114, 114));';
          closeBtn.onclick = (e) => {
            e.stopPropagation();
            boardroomState[slot.id] = null;
            this.renderBoardroom(overlay, boardroomState);
            this.calculateBoardroomResults(overlay, boardroomState);
          };
          cardEl.appendChild(closeBtn);

          const roleEl = document.createElement('div');
          roleEl.style.cssText = 'font-size: 9px; color: var(--sct-control-hover, rgb(114, 114, 114)); text-align: center; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;';
          roleEl.textContent = slot.label;
          cardEl.appendChild(roleEl);

          const nameEl = document.createElement('input');
          nameEl.type = 'text';
          nameEl.style.cssText = 'font-weight:bold; font-size:12px; margin-bottom:8px; text-align:center; width:100%; border:none; background:transparent; color:var(--fontColor);';
          nameEl.value = emp.name;
          nameEl.onchange = () => { emp.name = nameEl.value; };
          cardEl.appendChild(nameEl);

          const skillsGrid = document.createElement('div');
          skillsGrid.className = 'sc-card-skills';

          const skillNames = [
            { key: 'coo', label: 'COO', color: '#2196F3' },
            { key: 'cfo', label: 'CFO', color: '#ff9800' },
            { key: 'cmo', label: 'CMO', color: '#e91e63' },
            { key: 'cto', label: 'CTO', color: '#9c27b0' }
          ];

          skillNames.forEach(sk => {
            const row = document.createElement('div');
            row.className = 'sc-card-skill-row';

            const label = document.createElement('span');
            label.className = 'sc-card-skill-label';
            label.style.color = sk.color;
            label.textContent = sk.label;

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'sc-card-skill-input';
            input.min = '0';
            input.step = '1';
            input.value = emp.skills[sk.key];

            input.onfocus = () => cardEl.setAttribute('draggable', 'false');
            input.onblur = () => cardEl.setAttribute('draggable', 'true');

            input.onchange = () => {
              let val = parseInt(input.value) || 0;
              if (val < 0) val = 0;
              input.value = val;
              emp.skills[sk.key] = val;
              this.calculateBoardroomResults(overlay, boardroomState);
            };

            row.appendChild(label);
            row.appendChild(input);
            skillsGrid.appendChild(row);
          });

          cardEl.appendChild(skillsGrid);
          slotEl.appendChild(cardEl);
        } else {
          const emptyEl = document.createElement('div');
          emptyEl.className = 'sc-exec-card-empty';
          emptyEl.textContent = `空 ${slot.label} 席`;
          emptyEl.onclick = (e) => {
            if (selectedSlotId === null) {
              e.stopPropagation();
              boardroomState[slot.id] = {
                name: '自定义高管',
                skills: { coo: 0, cfo: 0, cmo: 0, cto: 0 }
              };
              this.renderBoardroom(overlay, boardroomState);
              this.calculateBoardroomResults(overlay, boardroomState);
            }
          };
          slotEl.appendChild(emptyEl);
        }

        gridEl.appendChild(slotEl);
      });

      groupEl.appendChild(gridEl);
      leftContainer.appendChild(groupEl);
    });
  }

  calculateBoardroomResults(overlay, boardroomState) {
    const getSkill = (slotId, skillKey) => {
      return (boardroomState[slotId] && boardroomState[slotId].skills)
        ? boardroomState[slotId].skills[skillKey]
        : 0;
    };

    const selectedRadio = overlay.querySelector('input[name="sc-aca-r"]:checked');
    const academyLevel = selectedRadio ? parseInt(selectedRadio.value) : 15;

    const hasCooApp = academyLevel >= 5;
    const hasCfoApp = academyLevel >= 10;
    const hasCmoApp = academyLevel >= 15;
    const hasCtoApp = academyLevel >= 20;

    const rawCoo = Math.floor(
      getSkill('o', 'coo') +
      (hasCooApp ? getSkill('v', 'coo') / 2 : 0) +
      (getSkill('f', 'coo') + getSkill('m', 'coo') + getSkill('t', 'coo')) / 4
    );

    const rawCfo = Math.floor(
      getSkill('f', 'cfo') +
      (hasCfoApp ? getSkill('x', 'cfo') / 2 : 0) +
      (getSkill('o', 'cfo') + getSkill('m', 'cfo') + getSkill('t', 'cfo')) / 4
    );

    const rawCmo = Math.floor(
      getSkill('m', 'cmo') +
      (hasCmoApp ? getSkill('y', 'cmo') / 2 : 0) +
      (getSkill('o', 'cmo') + getSkill('f', 'cmo') + getSkill('t', 'cmo')) / 4
    );

    const rawCto = Math.floor(
      getSkill('t', 'cto') +
      (hasCtoApp ? getSkill('z', 'cto') / 2 : 0) +
      (getSkill('o', 'cto') + getSkill('f', 'cto') + getSkill('m', 'cto')) / 4
    );

    const applyDecay = (raw) => {
      let val = raw;
      if (val > 80) val = 80 + (val - 80) / 2;
      if (val > 60) val = 60 + (val - 60) / 2;
      return Math.floor(val);
    };

    const effCoo = applyDecay(rawCoo);
    const effCfo = applyDecay(rawCfo);
    const effCmo = applyDecay(rawCmo);
    const effCto = applyDecay(rawCto);

    const realmId = this.realmId();
    const cache = componentList.autoMaxFoundation?.indexDBData?.cache;
    const region = cache?.regions?.[String(realmId)];

    const baseAdminVal = (Number(region?.administration) || 1) - 1;
    const baseAdminText = (baseAdminVal * 100).toFixed(2) + '%';
    const changeAdminText = effCoo === 0 ? '0.00%' : '-' + (baseAdminVal * effCoo).toFixed(2) + '%';
    const finalAdminText = (baseAdminVal * (1 - effCoo / 100) * 100).toFixed(2) + '%';

    const bankLevel = Number(region?.bankLevel) || 0;
    const baseCfoText = '$3.0M';
    const changeCfoVal = effCfo * 0.5 * (1 + bankLevel / 10);
    const changeCfoText = '+$' + changeCfoVal.toFixed(2) + 'M';
    const finalCfoVal = 3.0 + changeCfoVal;
    const finalCfoText = '$' + finalCfoVal.toFixed(2) + 'M';

    const baseSalesVal = (Number(region?.salesModifier) || 0) + (Number(region?.recreationBonus) || 0);
    const baseSalesText = baseSalesVal.toFixed(1) + '%';
    const changeSalesText = '+' + Math.floor(effCmo / 3) + '%';
    const finalSalesText = (baseSalesVal + Math.floor(effCmo / 3)).toFixed(1) + '%';

    const baseRestaurantText = '+' + (baseSalesVal * 0.02).toFixed(2);
    const changeRestaurantText = '+' + (effCmo * 0.01).toFixed(3);
    const finalRestaurantText = '+' + ((baseSalesVal * 0.02) + (effCmo * 0.01)).toFixed(3);

    const basePatentText = '6.25%';
    const changePatentText = '+' + (effCto * 0.0625).toFixed(2) + '%';
    const finalPatentText = (6.25 + effCto * 0.0625).toFixed(2) + '%';

    const baseResearchText = '0.0%';
    const changeResearchText = '+' + (effCto * 2.0).toFixed(1) + '%';
    const finalResearchText = (effCto * 2.0).toFixed(1) + '%';

    const details = {
      admin: `
        <strong>管理费用计算详情：</strong><br>
        1. <strong>基础管理费用</strong>：总建筑等级=工人/100，管理费用=(总建筑等级-1)/170。<br>
        2. <strong>高管加成</strong>：COO 有效点数 <code>${effCoo}</code>（原始汇总点数 ${rawCoo}，衰减折算后为 ${effCoo}）。<br>
        3. <strong>计算公式</strong>：每 1 点有效 COO 减少基础管理费用的 1%。<br>
           <code>${baseAdminText} &times; ${effCoo}% = ${Math.abs(baseAdminVal * effCoo).toFixed(2)}%</code> 扣减。<br>
        4. <strong>最终结果</strong>：<code>${baseAdminText} - ${Math.abs(baseAdminVal * effCoo).toFixed(2)}% = ${finalAdminText}</code>。
      `,
      cfo: `
        <strong>会计费用起始点计算详情：</strong><br>
        1. <strong>基础限额</strong>：固定值 <code>$3.0M</code>（所有公司初始免税上限均为 $3,000,000）。<br>
        2. <strong>高管加成</strong>：CFO 有效点数 <code>${effCfo}</code>（原始汇总点数 ${rawCfo}，衰减折算后为 ${effCfo}）。<br>
        3. <strong>银行加成</strong>：当前银行等级为 <code>${bankLevel}</code>，提供额外 <code>${(bankLevel * 10).toFixed(0)}%</code> 的 CFO 效果增幅。<br>
        4. <strong>计算公式</strong>：<code>$3.0M + CFO 有效点数 &times; $0.5M &times; (1 + 银行等级 / 10)</code>。<br>
           <code>$3.0M + ${effCfo} &times; $0.5M &times; (1 + ${bankLevel} / 10) = ${finalCfoText}</code>。<br>
        5. <strong>最终结果</strong>：<code>${finalCfoText}</code>。
      `,
      salesSpeed: `
        <strong>销售速度计算详情：</strong><br>
        1. <strong>基础销售速度</strong>：等级加成与休闲加成之和 <code>${baseSalesText}</code>。<br>
        2. <strong>高管加成</strong>：CMO 有效点数 <code>${effCmo}</code>（原始汇总点数 ${rawCmo}，衰减折算后为 ${effCmo}）。<br>
        3. <strong>计算公式</strong>：每 3 点有效 CMO 增加 1% 销售速度。<br>
           <code>Math.floor(${effCmo} / 3) = +${Math.floor(effCmo / 3)}%</code> 速度提升。<br>
        4. <strong>最终结果</strong>：<code>${baseSalesText} + ${Math.floor(effCmo / 3)}% = ${finalSalesText}</code>。
      `,
      restaurant: `
        <strong>餐馆评级计算详情：</strong><br>
        1. <strong>基础评级</strong>：基础销售速度 * 0.02<br>
        2. <strong>高管加成</strong>：CMO 有效点数 <code>${effCmo}</code>（原始汇总点数 ${rawCmo}，衰减折算后为 ${effCmo}）。<br>
        3. <strong>计算公式</strong>：每 1 点有效 CMO 增加 0.01 餐馆评级。<br>
           <code>${effCmo} &times; 0.01 = +${(effCmo * 0.01).toFixed(2)}</code> 评级提升。<br>
        4. <strong>最终结果</strong>：<code>${baseRestaurantText} + ${(effCmo * 0.01).toFixed(2)} = ${finalRestaurantText}</code>。
      `,
      patent: `
        <strong>专利转化概率计算详情：</strong><br>
        1. <strong>基础概率</strong>：游戏固定基础转化率 <code>6.25%</code>。<br>
        2. <strong>高管加成</strong>：CTO 有效点数 <code>${effCto}</code>（原始汇总点数 ${rawCto}，衰减折算后为 ${effCto}）。<br>
        3. <strong>计算公式</strong>：每 1 点有效 CTO 增加 1% 的基础专利转化概率（即 6.25% 的 1% = 0.0625%）。<br>
           <code>${effCto} &times; 0.0625% = +${(effCto * 0.0625).toFixed(2)}%</code> 概率提升。<br>
        4. <strong>最终结果</strong>：<code>6.25% + ${(effCto * 0.0625).toFixed(2)}% = ${finalPatentText}</code>。
      `,
      research: `
        <strong>研究生产速度提升计算详情：</strong><br>
        1. <strong>基础速度</strong>：固定基础值 <code>0.0%</code>。<br>
        2. <strong>高管加成</strong>：CTO 有效点数 <code>${effCto}</code>（原始汇总点数 ${rawCto}，衰减折算后为 ${effCto}）。<br>
        3. <strong>计算公式</strong>：每 1 点有效 CTO 增加 2% 的研究类生产速度。<br>
           <code>${effCto} &times; 2% = +${(effCto * 2.0).toFixed(1)}%</code> 速度提升。<br>
        4. <strong>最终结果</strong>：<code>${finalResearchText}</code>。
      `
    };

    const tableContainer = overlay.querySelector('#sc-calc-table-container');
    if (tableContainer) {
      tableContainer.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:15px;">
          <thead>
            <tr style="border-bottom:1px solid var(--sct-control-hover, rgb(114, 114, 114)); color:var(--sct-control-hover, rgb(114, 114, 114)); font-size:11px;">
              <th align="left" style="padding:6px 2px;">项目</th>
              <th align="right" style="padding:6px 2px;">基础</th>
              <th align="right" style="padding:6px 2px;">高管加成</th>
              <th align="right" style="padding:6px 2px;">最终</th>
            </tr>
          </thead>
          <tbody>
            <tr class="sc-calc-row" data-type="admin" style="cursor:pointer; border-bottom:1px solid var(--sct-control-hover, rgb(114, 114, 114));">
              <td style="padding:6px 2px; font-weight:bold;">管理费用</td>
              <td align="right" style="padding:6px 2px;">${baseAdminText}</td>
              <td align="right" style="padding:6px 2px; color:var(--sct-error, red);">${changeAdminText}</td>
              <td align="right" style="padding:6px 2px; font-weight:bold; color:var(--sct-enabled, green);">${finalAdminText}</td>
            </tr>
            <tr class="sc-calc-row" data-type="cfo" style="cursor:pointer; border-bottom:1px solid var(--sct-control-hover, rgb(114, 114, 114));">
              <td style="padding:6px 2px; font-weight:bold;">会计费用起始于</td>
              <td align="right" style="padding:6px 2px;">${baseCfoText}</td>
              <td align="right" style="padding:6px 2px; color:var(--sct-enabled, green);">${changeCfoText}</td>
              <td align="right" style="padding:6px 2px; font-weight:bold; color:var(--sct-enabled, green);">${finalCfoText}</td>
            </tr>
            <tr class="sc-calc-row" data-type="salesSpeed" style="cursor:pointer; border-bottom:1px solid var(--sct-control-hover, rgb(114, 114, 114));">
              <td style="padding:6px 2px; font-weight:bold;">销售速度</td>
              <td align="right" style="padding:6px 2px;">${baseSalesText}</td>
              <td align="right" style="padding:6px 2px; color:var(--sct-enabled, green);">${changeSalesText}</td>
              <td align="right" style="padding:6px 2px; font-weight:bold; color:var(--sct-enabled, green);">${finalSalesText}</td>
            </tr>
            <tr class="sc-calc-row" data-type="restaurant" style="cursor:pointer; border-bottom:1px solid var(--sct-control-hover, rgb(114, 114, 114));">
              <td style="padding:6px 2px; font-weight:bold;">餐馆评级</td>
              <td align="right" style="padding:6px 2px;">${baseRestaurantText}</td>
              <td align="right" style="padding:6px 2px; color:var(--sct-enabled, green);">${changeRestaurantText}</td>
              <td align="right" style="padding:6px 2px; font-weight:bold; color:var(--sct-enabled, green);">${finalRestaurantText}</td>
            </tr>
            <tr class="sc-calc-row" data-type="patent" style="cursor:pointer; border-bottom:1px solid var(--sct-control-hover, rgb(114, 114, 114));">
              <td style="padding:6px 2px; font-weight:bold;">专利转化概率</td>
              <td align="right" style="padding:6px 2px;">${basePatentText}</td>
              <td align="right" style="padding:6px 2px; color:var(--sct-enabled, green);">${changePatentText}</td>
              <td align="right" style="padding:6px 2px; font-weight:bold; color:var(--sct-enabled, green);">${finalPatentText}</td>
            </tr>
            <tr class="sc-calc-row" data-type="research" style="cursor:pointer; border-bottom:1px solid var(--sct-control-hover, rgb(114, 114, 114));">
              <td style="padding:6px 2px; font-weight:bold;">研究类生产提升</td>
              <td align="right" style="padding:6px 2px;">${baseResearchText}</td>
              <td align="right" style="padding:6px 2px; color:var(--sct-enabled, green);">${changeResearchText}</td>
              <td align="right" style="padding:6px 2px; font-weight:bold; color:var(--sct-enabled, green);">${finalResearchText}</td>
            </tr>
          </tbody>
        </table>
      `;

      const rows = tableContainer.querySelectorAll('.sc-calc-row');
      const detailBox = overlay.querySelector('#sc-detail-box');
      rows.forEach(row => {
        const type = row.dataset.type;
        const updateDetail = () => {
          if (details[type]) {
            detailBox.innerHTML = details[type];
            rows.forEach(r => r.style.background = 'transparent');
            row.style.background = 'rgba(255, 235, 100, 0.15)';
          }
        };
        row.onmouseenter = updateDetail;
        row.onclick = updateDetail;
      });
    }

    return { adminBonus: effCoo, saleBonus: Math.floor(effCmo / 3) };
  }
}

new autoMaxExecutive();

class autoMaxExecutiveTrainLog extends BaseComponent {
  constructor() {
    super();
    this.name = "显示高管培训记录";
    this.describe = "在高管详情页，展示高管的历史培训课程和属性加成记录。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "高管"];
  }
}
new autoMaxExecutiveTrainLog();

class autoMaxFormerExecEnhance extends BaseComponent {
  constructor() {
    super();
    this.name = "前任高管更多信息";
    this.describe = "在离职前任高管列表添加「详细」按键查看其历史加成。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "高管"];
  }
}
new autoMaxFormerExecEnhance();

class autoMaxExecutiveCustomToggle extends BaseComponent {
  constructor() {
    super();
    this.name = "高管自定义加成";
    this.describe = "开启后，利润计算将优先使用您在董事会中模拟/保存的自定义高管加成数值。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "高管"];
  }
}
new autoMaxExecutiveCustomToggle();
