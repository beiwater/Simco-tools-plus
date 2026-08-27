// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { tools, indexDBData } = require("../tools/tools.js");

const CONTROL_ID = "sct-restaurant-stock-panel";

class restaurantStockReminder extends BaseComponent {
  constructor() {
    super();
    this.name = "餐馆备货提醒";
    this.describe = "根据餐馆当前菜单及营业周期消耗，结合餐馆总数计算每日原料消耗与可用天数预警。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "餐馆", "库存", "预警"];
  }

  componentData = {
    panelNode: null,
    observer: null,
    collapsed: false,
  };

  indexDBData = {
    restaurantCount: 1,
    warningDaysThreshold: 2.0,
  };

  commonFuncList = [{
    match: () => /\/b\/\d+\/?$/.test(location.pathname),
    func: this.refresh.bind(this),
  }];

  cssText = [
    `
      #${CONTROL_ID} {
        position: fixed;
        left: 24px;
        top: 72px;
        width: 360px;
        max-height: 80vh;
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
      #${CONTROL_ID} tr.warning-row { background: rgba(248, 81, 73, 0.18); color: #ff7b72; font-weight: 600; }
      #${CONTROL_ID} input[type="number"] {
        width: 50px;
        background: rgba(0,0,0,0.3);
        border: 1px solid #30363d;
        color: #fff;
        border-radius: 4px;
        padding: 2px 4px;
      }
    `
  ];

  refresh() {
    if (!this.enable) {
      this.destroyPanel();
      return;
    }

    const openLabels = ["Restaurant is open", "餐馆营业中", "餐廳營業中"];
    const isOpen = Array.from(document.querySelectorAll("label")).some(l => openLabels.includes(l.textContent?.trim()));
    if (!isOpen) {
      this.destroyPanel();
      return;
    }

    const menuContainer = this.getTargetMenuContainer();
    if (!menuContainer) return;

    this.ensurePanel();
    this.updatePanel(menuContainer);
    this.observeMenu(menuContainer);
  }

  getTargetMenuContainer() {
    const containers = Array.from(document.querySelectorAll("div.css-12ocart"));
    if (containers.length >= 3) return containers[2];
    return containers.find(c => c.querySelector(".css-1v345k9, .css-1k48byk")) || null;
  }

  ensurePanel() {
    if (this.componentData.panelNode && this.componentData.panelNode.isConnected) return;

    const isCollapsed = Boolean(this.componentData.collapsed);
    const panel = document.createElement("div");
    panel.id = CONTROL_ID;
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;cursor:move;user-select:none;">
        <strong style="font-size:13px;color:#58a6ff;">🍽️ 餐馆备货与消耗预警</strong>
        <button id="sct-restk-toggle" style="background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px;">
          ${isCollapsed ? "展开" : "收起"}
        </button>
      </div>
      <div id="sct-restk-body" style="display:${isCollapsed ? "none" : "block"};">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span>自营餐馆数: <input id="sct-restk-count" type="number" min="1" step="1" value="${this.indexDBData.restaurantCount || 1}"></span>
          <span id="sct-restk-meta" style="color:#8b949e;">加载中...</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>菜品</th>
              <th>库存</th>
              <th>日消耗</th>
              <th>余天数</th>
            </tr>
          </thead>
          <tbody id="sct-restk-tbody"></tbody>
        </table>
      </div>
    `;

    document.body.appendChild(panel);
    this.componentData.panelNode = panel;

    const toggleBtn = panel.querySelector("#sct-restk-toggle");
    const body = panel.querySelector("#sct-restk-body");
    toggleBtn.addEventListener("click", () => {
      this.componentData.collapsed = !this.componentData.collapsed;
      body.style.display = this.componentData.collapsed ? "none" : "block";
      toggleBtn.textContent = this.componentData.collapsed ? "展开" : "收起";
    });

    const countInput = panel.querySelector("#sct-restk-count");
    countInput.addEventListener("change", () => {
      const val = Math.max(1, parseInt(countInput.value, 10) || 1);
      this.indexDBData.restaurantCount = val;
      this.refresh();
    });
  }

  updatePanel(menuContainer) {
    const tbody = document.getElementById("sct-restk-tbody");
    const meta = document.getElementById("sct-restk-meta");
    if (!tbody || !menuContainer) return;

    const count = Math.max(1, this.indexDBData.restaurantCount || 1);
    const threshold = this.indexDBData.warningDaysThreshold || 2.0;
    const cards = menuContainer.querySelectorAll(".css-1v345k9, .css-1k48byk");
    const rows = [];

    cards.forEach(card => {
      if (card.classList.contains("css-1k48byk")) return;
      const name = card.querySelector("b")?.textContent?.trim() || "菜品";
      const wrap = card.querySelector(".css-aqbich");
      if (!wrap) return;

      const stockText = wrap.querySelector("div:nth-child(1)")?.textContent?.replace(/,/g, "") || "0";
      const stock = parseInt(stockText.replace(/[^\d-]/g, ""), 10) || 0;

      const consumeText = wrap.querySelector("div:nth-child(2)")?.textContent?.replace(/,/g, "") || "0";
      const match = consumeText.match(/-\s*(\d+(?:\.\d+)?)/) || consumeText.match(/(\d+(?:\.\d+)?)/);
      const periodConsume = match ? parseFloat(match[1]) : 0;
      if (!periodConsume) return;

      // 每日 2 次营业周期 * 自营餐馆倍数
      const dailyConsume = periodConsume * 2 * count;
      const remainDays = dailyConsume > 0 ? stock / dailyConsume : Infinity;

      rows.push({
        name,
        stock,
        dailyConsume,
        remainDays,
        isWarning: remainDays < threshold,
      });
    });

    const warningCount = rows.filter(r => r.isWarning).length;
    if (meta) meta.textContent = `菜品: ${rows.length} | 预警: ${warningCount}`;

    if (rows.length === 0) {
      tbody.innerHTML = "<tr><td colspan=\"4\" style=\"text-align:center;color:#8b949e;padding:8px;\">等待菜单数据加载...</td></tr>";
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr class="${r.isWarning ? "warning-row" : ""}">
        <td>${r.name}</td>
        <td>${r.stock.toLocaleString()}</td>
        <td>${r.dailyConsume.toLocaleString()}</td>
        <td>${r.remainDays.toFixed(1)} 天</td>
      </tr>
    `).join("");
  }

  observeMenu(menuContainer) {
    if (this.componentData.observer) return;
    this.componentData.observer = new MutationObserver(() => this.updatePanel(menuContainer));
    this.componentData.observer.observe(menuContainer, { childList: true, subtree: true });
  }

  destroyPanel() {
    if (this.componentData.observer) {
      this.componentData.observer.disconnect();
      this.componentData.observer = null;
    }
    if (this.componentData.panelNode) {
      this.componentData.panelNode.remove();
      this.componentData.panelNode = null;
    }
  }
}

new restaurantStockReminder();

if (typeof module !== "undefined") {
  module.exports = restaurantStockReminder;
}
