// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");

class autoMaxChatColorBlind extends BaseComponent {
  constructor() {
    super();
    this.name = "聊天室色弱辅助";
    this.describe = "在销售频道消息中的各产品色彩图示旁，添加直观的文字辅助。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "辅助"];
  }
}

new autoMaxChatColorBlind();

module.exports = autoMaxChatColorBlind;
