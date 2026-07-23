// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");

class autoMaxMarketAutoHighlight extends BaseComponent {
  constructor() {
    super();
    this.name = "交易所自动选中高亮行";
    this.describe = "自动高亮并选中交易所最划算的一行。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "交易所"];
  }
}

new autoMaxMarketAutoHighlight();
