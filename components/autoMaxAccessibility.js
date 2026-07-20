const BaseComponent = require("../tools/baseComponent.js");
const { componentList, runtimeData, tools } = require("../tools/tools.js");
const {
  COLOR_EMOJI_LABELS,
  findChatContainers,
  findQuestMatch,
  normalizeSnipboardUrl,
} = require("../tools/automax/assist.js");
const { getPageActionEnabled } = require("../tools/automax/settings.js");
const { getRealmIdFromDocument } = require("../tools/automax/lifecycle.js");

const QUEST_CACHE_KEY = "automax-pa-quest-cache";
const QUEST_CACHE_TTL = 60 * 60 * 1000;
const QUEST_DATA_URL = "https://sc.22-7.top/scripts/PA-Quests.json";
const CHAT_ROOMS = new Set(["Sales", "Aerospace sales", "[ZH] 交易"]);

class autoMaxAccessibility extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax 聊天与地图辅助";
    this.describe = "提供色弱文字标识、空闲建筑高亮、PA 答案、Snipboard 预览和聊天输入框扩大。";
    this.enable = true;
    this.tagList = ["AutoMax", "聊天", "地图", "辅助"];
  }

  componentData = {
    chatObserver: undefined,
    questObserver: undefined,
    questData: undefined,
    questLoad: undefined,
    initialized: false,
  }

  startupFuncList = [this.startup]

  commonFuncList = [{
    match: () => true,
    func: this.refresh,
  }]

  cssText = [
    `
      .automax-chat-color-text { display: none; font-size: inherit; font-style: normal; vertical-align: middle; }
      .automax-chat-color-assist .automax-chat-color-text { display: inline; }
      .automax-chat-color-assist .automax-chat-color-wrapper img.emoji { display: none; }
      [data-automax-idle-highlight] { background: var(--sct-focus, wheat) !important; color: var(--sct-control, rgb(76, 76, 76)) !important; border-radius: 4px; font-weight: 700; padding: 1px 4px; }
      .automax-pa-answer { background: var(--sct-surface-muted, rgba(0, 0, 0, 0.7)); border: 1px solid var(--sct-enabled, #14541d); border-radius: 4px; display: grid; gap: 4px; margin-top: 8px; padding: 8px; }
      .automax-pa-answer p { margin: 0; overflow-wrap: anywhere; }
      .automax-pa-answer button { align-self: start; background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); min-height: 28px; }
      .automax-snipboard-preview { cursor: zoom-in; display: block; height: auto; margin-top: 4px; max-height: 320px; max-width: 100%; }
      .automax-snipboard-lightbox { align-items: center; background: var(--sct-surface, rgba(0, 0, 0, 0.9)); display: flex; inset: 0; justify-content: center; position: fixed; z-index: 10000; }
      .automax-snipboard-lightbox img { cursor: default; max-height: 90vh; max-width: 90vw; }
      .automax-chat-expanded { height: min(130px, 35vh) !important; }
      .automax-chat-expanded-wrap > div, .automax-chat-expanded-group, .automax-chat-expanded-buttons { height: min(130px, 35vh) !important; }
      @media (max-width: 767px) { .automax-chat-expanded, .automax-chat-expanded-wrap > div, .automax-chat-expanded-group, .automax-chat-expanded-buttons { height: min(90px, 30vh) !important; } }
      @media (prefers-reduced-motion: reduce) { .automax-snipboard-lightbox { transition: none; } }
    `,
  ]

  startup() {
    if (this.componentData.initialized) return;
    this.componentData.initialized = true;
    document.addEventListener("focusin", (event) => this.expandChatInput(event.target));
    document.addEventListener("focusout", (event) => {
      if (!this.isActionEnabled("chatInputExpander")) return;
      const target = event.target;
      window.setTimeout(() => {
        if (document.activeElement !== target && !target.closest(".input-group")?.contains(document.activeElement)) this.collapseChatInput(target);
      }, 120);
    });
    window.addEventListener("automax-settings-changed", () => this.refresh());
    this.refresh();
  }

  settings() {
    return componentList.autoMaxPanel?.indexDBData?.settings;
  }

  isActionEnabled(key) {
    return getPageActionEnabled(this.settings(), key);
  }

  refresh() {
    this.refreshChatAccessibility();
    this.refreshIdleHighlights();
    this.refreshSnipboardPreviews();
    this.refreshQuestAnswers();
    if (!this.isActionEnabled("chatInputExpander")) this.collapseAllChatInputs();
  }

  isAllowedChatRoom() {
    const headers = [...document.querySelectorAll("div.well-header.text-uppercase.css-12ztnbp")];
    return headers.some((header) => CHAT_ROOMS.has(header.textContent?.trim()));
  }

  refreshChatAccessibility() {
    const enabled = this.isActionEnabled("chatAccessibility") && this.isAllowedChatRoom();
    for (const container of findChatContainers(document)) {
      container.classList.toggle("automax-chat-color-assist", enabled);
      for (const image of container.querySelectorAll('img.emoji:not([data-automax-color-emoji])')) this.annotateColorEmoji(image);
    }
    if (!enabled) return this.stopChatObserver();
    if (this.componentData.chatObserver) return;
    this.componentData.chatObserver = new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.("img.emoji")) this.annotateColorEmoji(node);
        for (const image of node.querySelectorAll?.("img.emoji") ?? []) this.annotateColorEmoji(image);
      }
    });
    for (const container of findChatContainers(document)) this.componentData.chatObserver.observe(container, { childList: true, subtree: true });
  }

  stopChatObserver() {
    this.componentData.chatObserver?.disconnect();
    this.componentData.chatObserver = undefined;
  }

  annotateColorEmoji(image) {
    if (image.dataset.automaxColorEmoji) return;
    const label = COLOR_EMOJI_LABELS[image.alt ?? ""];
    if (!label || !image.parentNode) return;
    image.dataset.automaxColorEmoji = "true";
    const wrapper = document.createElement("span");
    wrapper.className = "automax-chat-color-wrapper";
    const text = document.createElement("span");
    text.className = "automax-chat-color-text";
    text.textContent = `[${label}]`;
    image.parentNode.insertBefore(wrapper, image);
    wrapper.append(image, text);
  }

  currentRealm() {
    const fromFoundation = componentList.autoMaxFoundation?.indexDBData?.cache?.regions ?? {};
    const realmId = getRealmIdFromDocument(document) ?? runtimeData.basisCPT?.realm;
    if ((realmId === 0 || realmId === 1) && fromFoundation[String(realmId)]) return fromFoundation[String(realmId)];
    const keyed = Object.keys(fromFoundation);
    if (keyed.length === 1) return fromFoundation[keyed[0]];
    return undefined;
  }

  refreshIdleHighlights() {
    if (!/\/landscape\/?$/.test(location.pathname) || !this.isActionEnabled("landscapeHighlight")) return this.clearIdleHighlights();
    const buildings = this.currentRealm()?.buildings;
    if (!Array.isArray(buildings)) return;
    const byId = new Map(buildings.map((item) => [String(item.id), item]));
    for (const link of document.querySelectorAll("a[href*='/b/']")) {
      const id = link.href.match(/\/b\/(\d+)/)?.[1];
      const kind = link.className.match(/test-building-([A-Za-z0-9])/i)?.[1] ?? byId.get(id)?.kind;
      if (!kind || ["n", "y", "3", "4", "5"].includes(String(kind))) continue;
      const level = [...link.querySelectorAll("span")].find((node) => /lvl\s+\d+/i.test(node.textContent));
      for (const span of level?.parentElement?.querySelectorAll(":scope > span") ?? []) span.dataset.automaxIdleHighlight = "true";
    }
  }

  clearIdleHighlights() {
    for (const node of document.querySelectorAll("[data-automax-idle-highlight]")) delete node.dataset.automaxIdleHighlight;
  }

  async refreshQuestAnswers() {
    if (!/\/messages(?:\/|$)/.test(location.pathname) || !this.isActionEnabled("paQuestAnswers")) return this.stopQuestObserver();
    const quests = await this.loadQuestData();
    if (!quests?.length) return;
    for (const container of this.questMessageContainers()) this.annotateQuestMessages(container, quests);
    if (this.componentData.questObserver) return;
    this.componentData.questObserver = new MutationObserver((records) => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) this.annotateQuestMessages(node, this.componentData.questData ?? []);
      }
    });
    this.componentData.questObserver.observe(document.body, { childList: true, subtree: true });
  }

  stopQuestObserver() {
    this.componentData.questObserver?.disconnect();
    this.componentData.questObserver = undefined;
  }

  async loadQuestData() {
    if (Array.isArray(this.componentData.questData)) return this.componentData.questData;
    if (this.componentData.questLoad) return this.componentData.questLoad;
    this.componentData.questLoad = (async () => {
      let cached;
      try { cached = JSON.parse(localStorage.getItem(QUEST_CACHE_KEY)); } catch { }
      if (Array.isArray(cached?.data) && Date.now() - Number(cached.timestamp) < QUEST_CACHE_TTL) return cached.data;
      try {
        const response = await fetch(QUEST_DATA_URL, { cache: "no-cache" });
        const data = response.ok ? await response.json() : undefined;
        if (Array.isArray(data)) {
          localStorage.setItem(QUEST_CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
          return data;
        }
      } catch (error) {
        tools.errorLog("[AutoMax:PA_QUEST_DATA]", error);
      }
      return Array.isArray(cached?.data) ? cached.data : [];
    })();
    this.componentData.questData = await this.componentData.questLoad;
    return this.componentData.questData;
  }

  questMessageContainers() {
    const containers = findChatContainers(document);
    const messages = containers.flatMap((container) => [...container.children]);
    return [...new Set([...messages, ...[...document.querySelectorAll("a.pa-reply")].map((link) => link.parentElement).filter(Boolean)])];
  }

  annotateQuestMessages(element, quests) {
    if (!(element instanceof Element) || element.querySelector?.(".automax-pa-answer")) return;
    const text = this.messageText(element);
    const match = findQuestMatch(text, quests);
    if (!match) return;
    const answer = match.quest[`a_${match.language}`] ?? match.quest.a_sc ?? match.quest.a_tc ?? match.quest.a_en;
    if (!answer) return;
    const panel = document.createElement("section");
    panel.className = "automax-pa-answer";
    const answerLine = document.createElement("p");
    answerLine.textContent = `答案：${answer}`;
    panel.append(answerLine);
    if (match.quest.effect) {
      const effectLine = document.createElement("p");
      effectLine.textContent = `效果：${match.quest.effect}`;
      panel.append(effectLine);
    }
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "复制答案";
    copy.addEventListener("click", () => this.copyAnswer(`${answer}${match.quest.effect ? `\n效果：${match.quest.effect}` : ""}`, copy));
    panel.append(copy);
    element.append(panel);
  }

  messageText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("a, script, style, .automax-pa-answer").forEach((node) => node.remove());
    return clone.textContent?.trim() ?? "";
  }

  async copyAnswer(value, button) {
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "已复制";
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = value;
      fallback.style.position = "fixed";
      fallback.style.left = "-9999px";
      document.body.append(fallback);
      fallback.select();
      document.execCommand("copy");
      fallback.remove();
      button.textContent = "已复制";
    }
    window.setTimeout(() => { button.textContent = "复制答案"; }, 1500);
  }

  refreshSnipboardPreviews() {
    if (!this.isActionEnabled("snipboardPreview")) return;
    for (const link of document.querySelectorAll('a[href*="snipboard.io"]:not([data-automax-snipboard])')) this.mountSnipboardPreview(link);
  }

  mountSnipboardPreview(link) {
    const url = normalizeSnipboardUrl(link.getAttribute("href"));
    if (!url || !link.parentNode) return;
    link.dataset.automaxSnipboard = "true";
    const image = document.createElement("img");
    image.className = "automax-snipboard-preview";
    image.alt = "Snipboard 图片预览";
    image.src = url;
    image.addEventListener("click", () => this.openImageLightbox(url));
    link.after(image);
  }

  openImageLightbox(url) {
    const overlay = document.createElement("div");
    overlay.className = "automax-snipboard-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "图片预览，点击关闭");
    const image = document.createElement("img");
    image.src = url;
    image.alt = "Snipboard 放大预览";
    overlay.append(image);
    const close = () => {
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
    };
    const onKeyDown = (event) => { if (event.key === "Escape") close(); };
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    document.addEventListener("keydown", onKeyDown);
    document.body.append(overlay);
  }

  isChatInput(target) {
    return target?.tagName === "TEXTAREA" && Boolean(target.closest(".input-group"))
      && Boolean(target.closest(".e1llepen1") ?? target.parentElement?.closest("div")?.querySelector(".e1llepen2, div[style*='column-reverse']"));
  }

  expandChatInput(target) {
    if (!this.isActionEnabled("chatInputExpander") || !this.isChatInput(target)) return;
    const inputGroup = target.closest(".input-group");
    target.classList.add("automax-chat-expanded");
    target.parentElement?.classList.add("automax-chat-expanded-wrap");
    inputGroup?.classList.add("automax-chat-expanded-group");
    inputGroup?.querySelector(".input-group-btn")?.classList.add("automax-chat-expanded-buttons");
  }

  collapseChatInput(target) {
    if (!this.isChatInput(target)) return;
    const inputGroup = target.closest(".input-group");
    target.classList.remove("automax-chat-expanded");
    target.parentElement?.classList.remove("automax-chat-expanded-wrap");
    inputGroup?.classList.remove("automax-chat-expanded-group");
    inputGroup?.querySelector(".input-group-btn")?.classList.remove("automax-chat-expanded-buttons");
  }

  collapseAllChatInputs() {
    for (const target of document.querySelectorAll("textarea.automax-chat-expanded")) this.collapseChatInput(target);
  }
}

new autoMaxAccessibility();
