// SPDX-License-Identifier: AGPL-3.0-or-later
const { tools } = require("../tools.js");

async function fetchMeExecutives() {
  try {
    const response = await fetch("/api/v3/companies/me/executives/");
    if (!response.ok) throw new Error(`API responded with status ${response.status}`);
    const data = await response.json();
    return data?.executives ?? [];
  } catch (error) {
    tools.errorLog("[AutoMax:FETCH_ME_EXECS]", error);
    return [];
  }
}

function openBoardroomSimulator(component) {
  const realmId = component.realmId();
  if (realmId !== 0 && realmId !== 1) return tools.alert("当前领域尚未识别。");
  const boardroomState = component.loadSavedBoardroom();
  const returnFocus = document.activeElement;
  const overlay = document.createElement("div");
  overlay.className = "automax-exec-modal";
  overlay.setAttribute("aria-label", "高管加成模拟");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("role", "dialog");
  const panel = document.createElement("section");
  const header = document.createElement("header");
  header.className = "automax-panel-header";
  const title = document.createElement("h2");
  title.textContent = "高管加成模拟（自定义高管数据）";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "关闭";
  close.className = "automax-exec-button";
  const dismiss = () => {
    overlay.remove();
    if (returnFocus?.isConnected && typeof returnFocus.focus === "function") returnFocus.focus();
  };
  close.addEventListener("click", dismiss);
  header.append(title, close);

  const layout = document.createElement("div");
  layout.className = "sc-boardroom-layout";
  const left = document.createElement("div");
  left.className = "sc-boardroom-left";
  const actions = document.createElement("div");
  actions.className = "automax-action-row";

  const save = document.createElement("button");
  save.type = "button";
  save.className = "automax-exec-button";
  save.textContent = "保存";
  save.addEventListener("click", () => {
    const result = component.calculateBoardroomResults(overlay, boardroomState);
    component.indexDBData.customBonuses[String(realmId)] = {
      adminBonus: result.adminBonus,
      saleBonus: result.saleBonus,
    };
    tools.indexDB_updateIndexDBData();
    window.dispatchEvent(new CustomEvent("automax-settings-changed"));
    tools.alert("数据已保存，并将用于后续利润计算。");
  });

  const synchronize = document.createElement("button");
  synchronize.type = "button";
  synchronize.className = "automax-exec-button";
  synchronize.textContent = "同步当前最新高管";
  synchronize.addEventListener("click", async () => {
    const originalText = synchronize.textContent;
    synchronize.textContent = "获取中…";
    synchronize.disabled = true;
    try {
      const executives = await component.fetchMeExecutives();
      if (executives.length === 0) {
        tools.alert("未获取到当前高管数据，请确认是否处于已登录状态。");
        return;
      }
      component.mapExecutivesToState(executives, boardroomState);
      component.renderBoardroom(overlay, boardroomState);
      component.calculateBoardroomResults(overlay, boardroomState);
      tools.alert("已同步当前最新高管数据。");
    } catch {
      tools.alert("网络请求失败，请稍后重试");
    } finally {
      synchronize.textContent = originalText;
      synchronize.disabled = false;
    }
  });

  const calculator = document.createElement("button");
  calculator.type = "button";
  calculator.className = "automax-exec-button";
  calculator.textContent = "COO收益计算器";
  calculator.addEventListener("click", () => component.openCooCalculator());
  actions.append(save, synchronize, calculator);

  const help = document.createElement("div");
  help.className = "automax-helper-text";
  const swapHint = document.createElement("span");
  swapHint.className = "automax-nowrap";
  swapHint.textContent = "两张卡片换位";
  const addHint = document.createElement("span");
  addHint.className = "automax-nowrap";
  addHint.textContent = "选择空位";
  help.append("拖拽卡片，或用点击、Enter、空格键选择", swapHint, "。", addHint, "可添加自定义高管。");
  const slots = document.createElement("div");
  slots.id = "sc-slots-container";
  left.append(actions, help, slots);

  const right = document.createElement("div");
  right.className = "sc-boardroom-right";
  right.innerHTML = `
    <div class="sc-boardroom-summary-title">高管加成模拟计算</div>
    <fieldset class="sc-academy-level">
      <legend>学院总等级</legend>
      <div>
        <label><input type="radio" name="sc-aca-r" value="0"> 0-4</label>
        <label><input type="radio" name="sc-aca-r" value="5"> 5-9</label>
        <label><input type="radio" name="sc-aca-r" value="10"> 10-14</label>
        <label><input type="radio" name="sc-aca-r" value="15" checked> 15-19</label>
        <label><input type="radio" name="sc-aca-r" value="20"> 20+</label>
      </div>
    </fieldset>
    <div id="sc-calc-table-container"></div>
    <div id="sc-detail-box" class="sc-detail-box">提示：点击或悬浮在上方任意行，可在此处查看详细计算公式。</div>
  `;

  layout.append(left, right);
  panel.append(header, layout);
  overlay.append(panel);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) dismiss(); });
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...overlay.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.body.append(overlay);
  right.querySelectorAll('input[name="sc-aca-r"]').forEach((radio) => {
    radio.onchange = () => component.calculateBoardroomResults(overlay, boardroomState);
  });
  component.renderBoardroom(overlay, boardroomState);
  component.calculateBoardroomResults(overlay, boardroomState);
  close.focus();
}

module.exports = { fetchMeExecutives, openBoardroomSimulator };
