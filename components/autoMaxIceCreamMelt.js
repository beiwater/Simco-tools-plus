// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { tools } = require("../tools/tools.js");

const CONTROL_ID = "sct-ice-cream-melt-panel";
const PERISHABLE_RESOURCE_IDS = [153, 154]; // 冰淇淋等易腐资源

class autoMaxIceCreamMelt extends BaseComponent {
  constructor() {
    super();
    this.name = "易腐品融化监控";
    this.describe = "在交易所页面监控易腐商品（冰淇淋等）的实际剩余量与各卖家融化损失统计。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "交易所", "融化", "易腐品"];
  }

  componentData = {
    panelNode: null,
    collapsed: false,
    lastOrders: [],
  };

  commonFuncList = [{
    match: () => /\/market\/resource\/(\d+)\/?$/.test(location.pathname),
    func: this.refresh.bind(this),
  }];

  netFuncList = [{
    urlMatch: /\/api\/v3\/market\/(\d+)\/(153|154)\/?$/,
    func: this.handleMarketResponse.bind(this),
  }];

  cssText = [
    `
      #${CONTROL_ID} {
        position: fixed;
        right: 24px;
        top: 72px;
        width: 380px;
        max-height: 75vh;
        overflow-y: auto;
        background: rgba(22, 27, 34, 0.95);
        color: #e6edf3;
        border: 1px solid rgba(240, 246, 252, 0.15);
        border-radius: 8px;
        padding: 10px 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        font-size: 12px;
        line-height: 1.4;
        z-index: 9999;
        backdrop-filter: blur(4px);
      }
      #${CONTROL_ID} table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      #${CONTROL_ID} th, #${CONTROL_ID} td { padding: 4px 6px; text-align: left; }
      #${CONTROL_ID} th { border-bottom: 1px solid rgba(255, 255, 255, 0.15); color: #8b949e; }
      #${CONTROL_ID} tr.melt-row { color: #f0883e; }
    `
  ];

  calcRemainingQuantity(initialQuantity, decayTimeStr) {
    if (!decayTimeStr) return initialQuantity;
    const decayTime = Date.parse(decayTimeStr);
    const elapsedMs = Math.abs(Date.now() - decayTime);
    // 每 4 分钟结算一次，折算等效小时数
    const elapsedHours = Math.round(elapsedMs / (1000 * 60) / 4) * 4 / 60;
    return Math.floor(initialQuantity * Math.pow(1 - 0.05, elapsedHours));
  }

  handleMarketResponse(url, method, text) {
    if (!this.enable) return;
    try {
      const orders = JSON.parse(text);
      if (Array.isArray(orders)) {
        this.componentData.lastOrders = orders;
        this.refresh();
      }
    } catch (e) {}
  }

  refresh() {
    if (!this.enable) {
      this.destroyPanel();
      return;
    }

    const match = location.pathname.match(/\/market\/resource\/(\d+)\/?$/);
    if (!match) {
      this.destroyPanel();
      return;
    }

    const resId = parseInt(match[1], 10);
    if (!PERISHABLE_RESOURCE_IDS.includes(resId)) {
      this.destroyPanel();
      return;
    }

    this.ensurePanel();
    this.updateSummary();
  }

  ensurePanel() {
    if (this.componentData.panelNode && this.componentData.panelNode.isConnected) return;

    const panel = document.createElement("div");
    panel.id = CONTROL_ID;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;cursor:move;user-select:none;">
        <strong style="font-size:13px;color:#ffa657;">🍦 交易所易腐商品融化监控</strong>
        <button id="sct-melt-toggle" style="background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px;">
          ${this.componentData.collapsed ? "展开" : "收起"}
        </button>
      </div>
      <div id="sct-melt-body" style="display:${this.componentData.collapsed ? "none" : "block"};">
        <div id="sct-melt-summary" style="margin-bottom:6px;padding:4px 6px;background:rgba(255,255,255,0.05);border-radius:4px;">
          正在获取市场订单...
        </div>
        <table>
          <thead>
            <tr>
              <th>公司</th>
              <th>品质</th>
              <th>挂单量</th>
              <th>估算剩余</th>
              <th>融化损耗</th>
            </tr>
          </thead>
          <tbody id="sct-melt-tbody"></tbody>
        </table>
      </div>
    `;

    document.body.appendChild(panel);
    this.componentData.panelNode = panel;

    const toggleBtn = panel.querySelector("#sct-melt-toggle");
    const body = panel.querySelector("#sct-melt-body");
    toggleBtn.addEventListener("click", () => {
      this.componentData.collapsed = !this.componentData.collapsed;
      body.style.display = this.componentData.collapsed ? "none" : "block";
      toggleBtn.textContent = this.componentData.collapsed ? "展开" : "收起";
    });
  }

  updateSummary() {
    const summaryDiv = document.getElementById("sct-melt-summary");
    const tbody = document.getElementById("sct-melt-tbody");
    if (!summaryDiv || !tbody) return;

    const orders = this.componentData.lastOrders || [];
    if (orders.length === 0) {
      summaryDiv.textContent = "暂未获取到订单，请刷新市场或稍候...";
      tbody.innerHTML = "";
      return;
    }

    let totalMelt = 0;
    const qualityMelt = {};
    const rows = [];

    for (const order of orders) {
      const remaining = this.calcRemainingQuantity(order.quantity, order.datetimeDecayUpdated);
      const melt = Math.max(0, order.quantity - remaining);
      if (melt > 0) {
        totalMelt += melt;
        qualityMelt[order.quality] = (qualityMelt[order.quality] || 0) + melt;
      }
      rows.push({
        company: order.seller?.company || "未知卖家",
        quality: order.quality || 0,
        price: order.price || 0,
        quantity: order.quantity || 0,
        remaining,
        melt,
      });
    }

    const qText = Object.entries(qualityMelt)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([q, count]) => `Q${q}: ${count}`)
      .join("，");

    summaryDiv.innerHTML = totalMelt > 0
      ? `<strong>当前总融化: ${totalMelt.toLocaleString()} 件</strong> (${qText})`
      : "当前挂单暂无显著融化损耗";

    tbody.innerHTML = rows.map(r => `
      <tr class="${r.melt > 0 ? "melt-row" : ""}">
        <td>${r.company}</td>
        <td>Q${r.quality}</td>
        <td>${r.quantity.toLocaleString()}</td>
        <td>${r.remaining.toLocaleString()}</td>
        <td>${r.melt > 0 ? "-" + r.melt.toLocaleString() : "0"}</td>
      </tr>
    `).join("");
  }

  destroyPanel() {
    if (this.componentData.panelNode) {
      this.componentData.panelNode.remove();
      this.componentData.panelNode = null;
    }
  }
}

new autoMaxIceCreamMelt();

if (typeof module !== "undefined") {
  module.exports = autoMaxIceCreamMelt;
}
