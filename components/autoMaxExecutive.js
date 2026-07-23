const BaseComponent = require("../tools/baseComponent.js");
const { componentList, tools } = require("../tools/tools.js");
const { getRealmIdFromDocument, installFetchCapture } = require("../tools/automax/lifecycle.js");
const {
  createBoardroomState,
  executiveUrl,
  replaceBoardroomExecutives,
  trainingTotals,
} = require("../tools/automax/executiveState.js");
const { EXECUTIVE_STYLES } = require("../tools/automax/executiveStyles.js");
const executivePanels = require("../tools/automax/executivePanels.js");
const {
  fetchMeExecutives,
  openBoardroomSimulator,
} = require("../tools/automax/executiveBoardroom.js");
const { focusBoardroomSlot, renderBoardroom } = require("../tools/automax/executiveBoardroomSlots.js");
const { renderBoardroomResults } = require("../tools/automax/executiveBoardroomResults.js");

class autoMaxExecutive extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax 高管助手";
    this.describe = "保存高管培训/前任履历，提供自定义加成和 COO 管理费收益计算。";
    this.enable = false;
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

  cssText = [EXECUTIVE_STYLES]

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
        if (index < 0) realm.found.push(value);
        else realm.found[index] = value;
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
    return executivePanels.renderDetailPanel(data);
  }

  trainingTotals(trainings) {
    return trainingTotals(trainings);
  }

  refreshExecutivesPage() {
    this.injectBoardroomButtons();
    this.injectFormerExecutiveButtons();
  }

  injectBoardroomButtons() {
    return executivePanels.injectBoardroomButtons(this);
  }

  injectFormerExecutiveButtons() {
    return executivePanels.injectFormerExecutiveButtons(this);
  }

  openExecutiveModal(id) {
    return executivePanels.openExecutiveModal(this, id);
  }

  historyTable(data) {
    return executivePanels.historyTable(data);
  }

  totalAdminFee() {
    return executivePanels.totalAdminFee(this);
  }

  openCooCalculator() {
    return executivePanels.openCooCalculator(this);
  }

  buildSettings() {
    return executivePanels.buildSettings(this);
  }

  numberField(text, value) {
    return executivePanels.numberField(text, value);
  }

  money(value) {
    return executivePanels.money(value);
  }

  loadSavedBoardroom() {
    const realmId = this.realmId();
    if (realmId !== 0 && realmId !== 1) return undefined;
    this.indexDBData.boardroomState ??= {};
    this.indexDBData.boardroomState[String(realmId)] ??= createBoardroomState();
    return this.indexDBData.boardroomState[String(realmId)];
  }

  fetchMeExecutives() {
    return fetchMeExecutives();
  }

  mapExecutivesToState(executives, boardroomState) {
    return replaceBoardroomExecutives(boardroomState, executives);
  }

  openBoardroomSimulator() {
    return openBoardroomSimulator(this);
  }

  renderBoardroom(overlay, boardroomState, focusSlotId) {
    return renderBoardroom(this, overlay, boardroomState, focusSlotId);
  }

  calculateBoardroomResults(overlay, boardroomState) {
    return renderBoardroomResults(this, overlay, boardroomState);
  }
}

new autoMaxExecutive();

class autoMaxExecutiveTrainLog extends BaseComponent {
  constructor() {
    super();
    this.name = "显示高管培训记录";
    this.describe = "在高管详情页，展示高管的历史培训课程和属性加成记录。";
    this.enable = false;
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
    this.enable = false;
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

module.exports = { focusBoardroomSlot };
