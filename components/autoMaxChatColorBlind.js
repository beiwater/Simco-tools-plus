// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { tools } = require("../tools/tools.js");
const { COLOR_EMOJI_LABELS, findChatContainers } = require("../tools/automax/assist.js");

const ALLOWED_ROOMS = ["Sales", "Aerospace sales", "[ZH] 交易", "Trading"];

class autoMaxChatColorBlind extends BaseComponent {
  constructor() {
    super();
    this.name = "聊天室色弱辅助";
    this.describe = "在交易与销售频道中将颜色圆圈 Emoji 标注为中文单字，方便色弱与小屏用户快速识别。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "辅助", "聊天", "色弱"];
  }

  componentData = {
    observer: null,
  };

  commonFuncList = [{
    match: () => /\/messages\//.test(location.pathname) || document.querySelector("div.css-xo2rg1"),
    func: this.refresh.bind(this),
  }];

  cssText = [
    `
      .sct-color-blind-tag {
        display: inline-block;
        font-size: 11px;
        margin-left: 2px;
        margin-right: 2px;
        padding: 0 3px;
        border-radius: 3px;
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
        font-weight: bold;
        vertical-align: middle;
      }
    `
  ];

  refresh() {
    if (!this.enable) {
      this.clear();
      return;
    }

    const containers = findChatContainers(document);
    if (containers.length === 0) return;

    containers.forEach(container => {
      this.processContainer(container);
    });
  }

  processContainer(container) {
    const images = container.querySelectorAll("img.emoji:not([data-sct-cb-done])");
    images.forEach(img => {
      const alt = img.getAttribute("alt") || "";
      const text = COLOR_EMOJI_LABELS[alt];
      if (text) {
        img.dataset.sctCbDone = "true";
        const tag = document.createElement("span");
        tag.className = "sct-color-blind-tag";
        tag.textContent = "[" + text + "]";
        img.parentNode?.insertBefore(tag, img.nextSibling);
      }
    });
  }

  clear() {
    document.querySelectorAll(".sct-color-blind-tag").forEach(el => el.remove());
    document.querySelectorAll("[data-sct-cb-done]").forEach(el => delete el.dataset.sctCbDone);
  }
}

new autoMaxChatColorBlind();

if (typeof module !== "undefined") {
  module.exports = autoMaxChatColorBlind;
}
