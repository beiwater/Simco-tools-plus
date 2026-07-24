// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");

class autoMaxSnipboardPreview extends BaseComponent {
  constructor() {
    super();
    this.name = "Snipboard 图片预览";
    this.describe = "在聊天消息中直接渲染 Snipboard 链接图片的悬浮或内联预览图。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "辅助"];
  }
}

new autoMaxSnipboardPreview();

module.exports = autoMaxSnipboardPreview;
