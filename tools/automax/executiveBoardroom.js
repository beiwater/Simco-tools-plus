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
  const overlay = document.createElement("div");
  overlay.className = "automax-exec-modal";
  const panel = document.createElement("section");
  const header = document.createElement("header");
  header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;";
  const title = document.createElement("h2");
  title.textContent = "高管加成模拟（自定义高管数据）";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "关闭";
  close.className = "automax-exec-button";
  const dismiss = () => overlay.remove();
  close.addEventListener("click", dismiss);
  header.append(title, close);

  const layout = document.createElement("div");
  layout.className = "sc-boardroom-layout";
  const left = document.createElement("div");
  left.className = "sc-boardroom-left";
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex; gap:10px; margin-bottom:12px;";

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
    tools.alert("数据保存成功！并在后续利润计算中生效。");
  });

  const synchronize = document.createElement("button");
  synchronize.type = "button";
  synchronize.className = "automax-exec-button";
  synchronize.textContent = "同步当前最新高管";
  synchronize.addEventListener("click", async () => {
    const originalText = synchronize.textContent;
    synchronize.textContent = "获取中...";
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
      tools.alert("已成功同步当前最新高管数据！");
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
  help.style.cssText = "font-size:11px; color:var(--sct-control-hover, rgb(114, 114, 114)); margin-bottom:15px;";
  help.textContent = "* 拖拽高管卡片，或点击两张卡片可以相互调换席位。点击空席位可添加自定义高管卡片。";
  const slots = document.createElement("div");
  slots.id = "sc-slots-container";
  left.append(actions, help, slots);

  const right = document.createElement("div");
  right.className = "sc-boardroom-right";
  right.innerHTML = `
    <div style="font-size: 15px; font-weight: bold; margin-bottom: 15px; border-bottom: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding-bottom: 10px;">
      高管加成模拟计算
    </div>
    <div style="margin-bottom: 15px; font-size: 13px; background: var(--sct-surface-muted, rgba(0, 0, 0, 0.4)); padding: 10px; border-radius: 8px; border: 1px solid var(--sct-control-hover, rgb(114, 114, 114));">
      <strong style="display: block; margin-bottom: 6px; font-size: 12px;">学院总等级:</strong>
      <div style="display: flex; flex-wrap: wrap; gap: 8px 12px; font-size: 12px;">
        <label style="cursor:pointer;"><input type="radio" name="sc-aca-r" value="0" style="vertical-align:middle;"> 0-4</label>
        <label style="cursor:pointer;"><input type="radio" name="sc-aca-r" value="5" style="vertical-align:middle;"> 5-9</label>
        <label style="cursor:pointer;"><input type="radio" name="sc-aca-r" value="10" style="vertical-align:middle;"> 10-14</label>
        <label style="cursor:pointer;"><input type="radio" name="sc-aca-r" value="15" checked style="vertical-align:middle;"> 15-19</label>
        <label style="cursor:pointer;"><input type="radio" name="sc-aca-r" value="20" style="vertical-align:middle;"> 20+</label>
      </div>
    </div>
    <div id="sc-calc-table-container"></div>
    <div id="sc-detail-box" style="padding: 10px; border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); border-radius: 8px; background: var(--sct-surface-muted, rgba(0, 0, 0, 0.2)); font-size: 11px; line-height: 1.5; min-height: 120px; box-sizing: border-box; color: var(--fontColor);">
      💡 提示：点击或悬浮在上方任意行，可在此处查看详细计算公式。
    </div>
  `;

  layout.append(left, right);
  panel.append(header, layout);
  overlay.append(panel);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) dismiss(); });
  document.body.append(overlay);
  right.querySelectorAll('input[name="sc-aca-r"]').forEach((radio) => {
    radio.onchange = () => component.calculateBoardroomResults(overlay, boardroomState);
  });
  component.renderBoardroom(overlay, boardroomState);
  component.calculateBoardroomResults(overlay, boardroomState);
}

module.exports = { fetchMeExecutives, openBoardroomSimulator };
