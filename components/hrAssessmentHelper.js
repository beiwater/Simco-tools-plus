const BaseComponent = require("../tools/baseComponent.js");
const { tools } = require("../tools/tools.js");
const { findHrMatches, parseHrRows } = require("../tools/hrAssessment.js");

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1rFx7fbOxTN54Rgnp8zcihI2DxV5tWGzdAMBhUcJe1m4/export?format=csv&gid=0";
const PANEL_ID = "sct-hr-assessment-helper";

function getText(url) {
  if (typeof GM_xmlhttpRequest === "function") return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({ method: "GET", url, onload: (response) => response.status >= 200 && response.status < 300 ? resolve(response.responseText) : reject(new Error(`HTTP ${response.status}`)), onerror: () => reject(new Error("网络请求失败")) });
  });
  return fetch(url).then((response) => response.ok ? response.text() : Promise.reject(new Error(`HTTP ${response.status}`)));
}

function assessmentText(root) {
  const label = [...root.querySelectorAll("b,strong,div")].find((node) => /^(HR评价：|HR Evaluation:)$/i.test(node.textContent.trim()));
  const text = label?.parentElement?.textContent || "";
  return text.split(/HR评价：|HR Evaluation:/i)[1]?.trim() || "";
}

class hrAssessmentHelper extends BaseComponent {
  constructor() {
    super();
    this.name = "高管 HR 评语查询";
    this.describe = "根据猎头页面的 HR 评语查询公开统计样本；仅在你点击查询时访问外部数据。";
    this.enable = false;
    this.tagList = ["工具"];
  }

  indexDBData = { rows: [], updatedAt: 0, translations: {} }
  componentData = { observer: undefined, timer: undefined }
  startupFuncList = [this.startup]
  commonFuncList = [{ match: () => this.isPage(), func: this.scheduleSync }]
  cssText = [`.sct-hr-helper { background: var(--sct-surface-muted, rgba(0,0,0,.7)); border: 1px solid var(--sct-control-hover, #777); border-radius: 7px; color: var(--fontColor); font-size: 13px; line-height: 1.5; margin: 12px 0; padding: 10px; } .sct-hr-helper__actions { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px; } .sct-hr-helper button { background:var(--sct-control,#4c4c4c); color:var(--fontColor); min-height:32px; } .sct-hr-helper__muted { color:var(--sct-muted,#aaa); font-size:12px; }`]

  isPage() { return /\/(?:zh-cn\/)?headquarters\/executives\/[^/]+\/?$/.test(location.pathname); }
  startup() {
    if (this.componentData.observer || !document.body) return;
    this.componentData.observer = new MutationObserver(() => this.scheduleSync());
    this.componentData.observer.observe(document.body, { childList: true, subtree: true });
    this.scheduleSync();
  }
  scheduleSync() {
    window.clearTimeout(this.componentData.timer);
    this.componentData.timer = window.setTimeout(() => this.sync(), 120);
  }
  findCard() {
    return [...document.querySelectorAll("#page .col-lg-6, #page [class*='enicam']")].find((node) => /HR评价：|HR Evaluation:/i.test(node.textContent) && /(录用|hire)/i.test(node.textContent)) || null;
  }
  sync() {
    const existing = document.getElementById(PANEL_ID);
    if (!this.isPage()) { existing?.remove(); return; }
    if (existing) return;
    const card = this.findCard();
    if (!card) return;
    const panel = document.createElement("section");
    panel.id = PANEL_ID; panel.className = "sct-hr-helper";
    const actions = document.createElement("div"); actions.className = "sct-hr-helper__actions";
    const query = document.createElement("button"); query.type = "button"; query.className = "btn"; query.textContent = "查询 HR 统计";
    const refresh = document.createElement("button"); refresh.type = "button"; refresh.className = "btn"; refresh.textContent = "刷新公开数据";
    const result = document.createElement("div"); result.className = "sct-hr-helper__result";
    const note = document.createElement("div"); note.className = "sct-hr-helper__muted"; note.textContent = "数据来自公开 Wealth Tracker 表；中文评语会按需翻译匹配。";
    query.addEventListener("click", () => this.query(card, result));
    refresh.addEventListener("click", () => this.query(card, result, true));
    actions.append(query, refresh); panel.append(actions, result, note); card.append(panel);
    result.textContent = this.indexDBData.rows.length ? `已缓存 ${this.indexDBData.rows.length} 条数据。` : "点击“查询 HR 统计”开始。";
  }
  async rows(refresh) {
    if (!refresh && this.indexDBData.rows.length) return this.indexDBData.rows;
    const rows = parseHrRows(await getText(SHEET_URL));
    if (!rows.length) throw new Error("公开表格格式不正确或暂无数据");
    this.indexDBData.rows = rows; this.indexDBData.updatedAt = Date.now();
    await tools.indexDB_updateIndexDBData();
    return rows;
  }
  async translate(text) {
    if (!/[^\x00-\x7F]/.test(text)) return "";
    if (this.indexDBData.translations[text]) return this.indexDBData.translations[text];
    const data = JSON.parse(await getText(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`));
    const translated = data?.[0]?.map((part) => part[0]).join("") || "";
    if (translated) { this.indexDBData.translations[text] = translated; await tools.indexDB_updateIndexDBData(); }
    return translated;
  }
  async query(card, result, refresh = false) {
    const text = assessmentText(card);
    if (!text) { result.textContent = "未读取到 HR 评语。"; return; }
    result.textContent = refresh ? "刷新公开数据中…" : "查询中…";
    try {
      const rows = await this.rows(refresh);
      let translated = "";
      let matches = findHrMatches(rows, text);
      if (!matches[0]?.matched) { translated = await this.translate(text); if (translated) matches = findHrMatches(rows, translated); }
      result.replaceChildren(this.resultNode(matches, translated, rows.length));
    } catch (error) { result.textContent = `查询失败：${error.message || error}`; }
  }
  resultNode(matches, translated, count) {
    const root = document.createElement("div");
    const top = matches[0];
    const stat = (label, value) => `${label} ${value == null ? "-" : value}`;
    if (top?.matched) root.append(document.createTextNode(`匹配度 ${Math.round(top.score * 100)}%｜${stat("样本", top.row.samples)}｜${stat("管理", top.row.management)}｜${stat("会计", top.row.accounting)}｜${stat("沟通", top.row.communication)}｜${stat("技术", top.row.tech)}｜${stat("薪资", top.row.salary)}｜${stat("平均技能", top.row.avgSkill)}`));
    else root.append(document.createTextNode("未精确命中，以下为相似评语："));
    if (translated) { const line = document.createElement("div"); line.className = "sct-hr-helper__muted"; line.textContent = `EN: ${translated}`; root.append(line); }
    if (!top?.matched) for (const item of matches) { const line = document.createElement("div"); line.className = "sct-hr-helper__muted"; line.textContent = `${Math.round(item.score * 100)}%｜${item.row.assessment}`; root.append(line); }
    const footer = document.createElement("div"); footer.className = "sct-hr-helper__muted"; footer.textContent = `公开样本 ${count} 条`; root.append(footer);
    return root;
  }
}

new hrAssessmentHelper();
