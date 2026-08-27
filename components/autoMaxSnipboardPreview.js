// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { tools } = require("../tools/tools.js");
const { normalizeSnipboardUrl } = require("../tools/automax/assist.js");

class autoMaxSnipboardPreview extends BaseComponent {
  constructor() {
    super();
    this.name = "Snipboard 截图预览";
    this.describe = "在聊天室与消息中自动为 snipboard.io 截图链接生成可点击放大的图片预览。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "辅助", "聊天", "预览"];
  }

  commonFuncList = [{
    match: () => Boolean(document.querySelector("a[href*=\"snipboard.io\"]")),
    func: this.refresh.bind(this),
  }];

  cssText = [
    `
      .sct-snip-thumb {
        max-width: 160px;
        max-height: 100px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        cursor: pointer;
        display: block;
        margin-top: 4px;
        transition: transform 0.2s;
      }
      .sct-snip-thumb:hover {
        transform: scale(1.03);
      }
      .sct-snip-modal {
        position: fixed;
        left: 0;
        top: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.85);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: zoom-out;
      }
      .sct-snip-modal img {
        max-width: 92vw;
        max-height: 92vh;
        border-radius: 6px;
        box-shadow: 0 0 24px rgba(0, 0, 0, 0.7);
      }
    `
  ];

  refresh() {
    if (!this.enable) return;

    const links = document.querySelectorAll("a[href*=\"snipboard.io\"]:not([data-sct-snip-done])");
    links.forEach(link => {
      link.dataset.sctSnipDone = "true";
      const imageUrl = normalizeSnipboardUrl(link.href);
      if (!imageUrl) return;

      const img = document.createElement("img");
      img.src = imageUrl;
      img.className = "sct-snip-thumb";
      img.alt = "截图预览";
      img.loading = "lazy";

      img.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openModal(imageUrl);
      };

      link.parentNode?.insertBefore(img, link.nextSibling);
    });
  }

  openModal(src) {
    const modal = document.createElement("div");
    modal.className = "sct-snip-modal";
    modal.innerHTML = `<img src="${src}" alt="放大查看" />`;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
  }
}

new autoMaxSnipboardPreview();

if (typeof module !== "undefined") {
  module.exports = autoMaxSnipboardPreview;
}
