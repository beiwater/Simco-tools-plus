// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { tools } = require("../tools/tools.js");
const { findQuestMatch } = require("../tools/automax/assist.js");

const QUESTS_DATA_URL = "https://sc.22-7.top/scripts/PA-Quests.json";
const CACHE_KEY = "SCT_PA_Quests_Cache";

class autoMaxPAAnswer extends BaseComponent {
  constructor() {
    super();
    this.name = "PA 任务智能答题";
    this.describe = "在助理（PA）答题任务中，自动匹配题库并高亮推荐的正确答案。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "辅助", "PA", "答题"];
  }

  componentData = {
    questData: null,
    observer: null,
  };

  commonFuncList = [{
    match: () => /\/messages\//.test(location.pathname) || document.querySelector("a[href*=\"pa-reply\"]"),
    func: this.refresh.bind(this),
  }];

  startupFuncList = [
    this.loadQuestData.bind(this),
  ];

  async loadQuestData() {
    if (this.componentData.questData) return this.componentData.questData;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - (parsed.time || 0) < 3600 * 1000 * 24) {
          this.componentData.questData = parsed.data;
          return parsed.data;
        }
      }
    } catch (e) {}

    try {
      const resp = await fetch(QUESTS_DATA_URL);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          this.componentData.questData = data;
          localStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), data }));
          return data;
        }
      }
    } catch (e) {}

    return null;
  }

  async refresh() {
    if (!this.enable) return;
    const quests = await this.loadQuestData();
    if (!quests) return;

    this.scanAndHighlightAnswers(quests);
  }

  scanAndHighlightAnswers(quests) {
    const replyLinks = document.querySelectorAll("a[href*=\"pa-reply\"]");
    if (replyLinks.length === 0) return;

    // 提取聊天文本
    const chatContainer = document.querySelector("div.css-13udsys, div.well");
    const fullText = chatContainer ? chatContainer.textContent : document.body.textContent;

    const match = findQuestMatch(fullText, quests);
    if (!match || !match.quest) return;

    const correctAnswers = [
      match.quest.a_sc,
      match.quest.a_tc,
      match.quest.a_en
    ].filter(Boolean).map(a => a.toLowerCase().trim());

    replyLinks.forEach(link => {
      const text = link.textContent?.trim().toLowerCase();
      if (!text) return;

      const isCorrect = correctAnswers.some(ans => text.includes(ans) || ans.includes(text));
      if (isCorrect) {
        link.style.border = "2px solid #2ea043";
        link.style.backgroundColor = "rgba(46, 160, 67, 0.25)";
        link.style.color = "#3fb950";
        link.style.fontWeight = "bold";
        if (!link.querySelector(".sct-pa-badge")) {
          const badge = document.createElement("span");
          badge.className = "sct-pa-badge";
          badge.textContent = " [推荐答案]";
          badge.style.fontSize = "11px";
          badge.style.color = "#7ee787";
          link.appendChild(badge);
        }
      }
    });
  }
}

new autoMaxPAAnswer();

if (typeof module !== "undefined") {
  module.exports = autoMaxPAAnswer;
}
