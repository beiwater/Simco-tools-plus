// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { tools } = require("../tools/tools.js");

const TRAINING_NAMES = {
  o: "管理培训",
  f: "会计课程",
  m: "沟通工作室",
  t: "科学界研讨会",
  g: "各领域课程",
};

const POSITION_NAMES = {
  o: "COO", f: "CFO", m: "CMO", t: "CTO",
  v: "COO学徒", x: "CFO学徒", y: "CMO学徒", z: "CTO学徒",
  "1": "职员1", "2": "职员2", "3": "职员3", "4": "职员4", "5": "职员5",
};

class autoMaxFormerExecutive extends BaseComponent {
  constructor() {
    super();
    this.name = "前任高管与挖人追踪";
    this.describe = "查看已离职或被挖角高管的完整培训履历、历史技能与挖角去向。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["AutoMax", "高管", "人事", "历史"];
  }

  componentData = {
    formerExecs: [],
  };

  netFuncList = [{
    urlMatch: /\/api\/v2\/companies\/\d+\/former-executives\/?/,
    func: this.handleFormerExecsResponse.bind(this),
  }];

  commonFuncList = [{
    match: () => /\/companies\/\d+\/former-executives\/?/.test(location.pathname),
    func: this.injectDetailButtons.bind(this),
  }];

  handleFormerExecsResponse(url, method, text) {
    if (!this.enable) return;
    try {
      const data = JSON.parse(text);
      if (data && Array.isArray(data.executives)) {
        this.componentData.formerExecs = data.executives;
        setTimeout(() => this.injectDetailButtons(), 300);
      }
    } catch (e) {}
  }

  injectDetailButtons() {
    if (!this.enable) return;
    const cards = document.querySelectorAll("div.css-12ocart, div.card, div.well");
    if (cards.length === 0) return;

    this.componentData.formerExecs.forEach(exec => {
      const name = exec.name;
      if (!name) return;

      cards.forEach(card => {
        if (card.dataset.sctFormerInjected) return;
        if (card.textContent.includes(name)) {
          card.dataset.sctFormerInjected = "true";
          const btn = document.createElement("button");
          btn.textContent = "📜 查看培训履历";
          btn.style.cssText = "margin-top:6px;padding:3px 8px;font-size:12px;background:#238636;color:#fff;border:none;border-radius:4px;cursor:pointer;";
          btn.onclick = () => this.showDetailModal(exec);
          card.appendChild(btn);
        }
      });
    });
  }

  showDetailModal(exec) {
    const existing = document.getElementById("sct-former-modal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "sct-former-modal";
    overlay.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;";

    const modal = document.createElement("div");
    modal.style.cssText = "background:#1e1e1e;color:#eee;border-radius:8px;padding:16px;width:480px;max-width:90vw;max-height:85vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.5);font-size:13px;";

    const trainings = (exec.trainings || []).map(t => {
      const tName = TRAINING_NAMES[t.training] || t.training || "未知课程";
      const date = t.datetimeCompleted ? new Date(t.datetimeCompleted).toLocaleDateString() : "--";
      return `<li><strong>${tName}</strong> (+${t.skill || 0}) - ${date}</li>`;
    }).join("") || "<li>暂无培训记录</li>";

    const lastPos = POSITION_NAMES[exec.currentWorkHistory?.position] || exec.currentWorkHistory?.position || "职员";

    modal.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #333;padding-bottom:8px;margin-bottom:12px;">
        <h3 style="margin:0;font-size:16px;color:#58a6ff;">${exec.name} - 详细履历</h3>
        <button id="sct-former-close" style="background:transparent;border:none;color:#aaa;font-size:18px;cursor:pointer;">&times;</button>
      </div>
      <p><strong>离职前职位:</strong> ${lastPos}</p>
      <p><strong>基本薪资:</strong> $${(exec.salary || 0).toLocaleString()}</p>
      <p><strong>技能点:</strong> COO ${exec.skills?.coo || 0} | CFO ${exec.skills?.cfo || 0} | CMO ${exec.skills?.cmo || 0} | CTO ${exec.skills?.cto || 0}</p>
      ${exec.poachedBy ? `<p style="color:#f0883e;"><strong>被挖角至:</strong> ${exec.poachedBy.name} (ID: ${exec.poachedBy.id})</p>` : ""}
      <h4 style="margin-top:12px;margin-bottom:6px;color:#7ee787;">培训课程历史 (${exec.trainings?.length || 0} 次):</h4>
      <ul style="padding-left:20px;line-height:1.6;">${trainings}</ul>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector("#sct-former-close").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }
}

new autoMaxFormerExecutive();

if (typeof module !== "undefined") {
  module.exports = autoMaxFormerExecutive;
}
