// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");

class autoMaxPAAnswer extends BaseComponent {
  constructor() {
    super();
    this.name = "PA 任务答案";
    this.describe = "在助理（PA）答题任务中，直接高亮正确答案。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "辅助"];
  }
}

new autoMaxPAAnswer();

module.exports = autoMaxPAAnswer;
