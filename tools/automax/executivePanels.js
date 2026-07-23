const {
  POSITION_NAMES,
  TRAINING_NAMES,
  calculateAdminFee,
  trainingTotals,
} = require("./executiveState.js");
const { componentList, tools } = require("../tools.js");

function renderDetailPanel(data) {
  const target = document.querySelector('[class*="executive"] button[type="button"], [role="dialog"] button[type="button"]')?.parentElement;
  if (!target || document.getElementById("automax_executive_detail")) return;
  const panel = document.createElement("section");
  panel.id = "automax_executive_detail";
  panel.className = "automax-exec-panel";
  const title = document.createElement("strong");
  title.textContent = `高管记录：${data.name ?? "未知"}（ID ${data.id ?? "-"}）`;
  const totals = trainingTotals(data.trainings);
  const total = document.createElement("p");
  total.textContent = `培训累计：管理 +${totals.coo}；会计 +${totals.cfo}；沟通 +${totals.cmo}；科学 +${totals.cto}`;
  const training = document.createElement("p");
  training.textContent = data.currentTraining
    ? `进行中：${TRAINING_NAMES[data.currentTraining.training] ?? data.currentTraining.training}`
    : "当前无培训";
  panel.append(title, total, training);
  target.after(panel);
}

function injectBoardroomButtons(component) {
  const targetHeader = document.querySelector("h3");
  const container = targetHeader?.closest("[class]");
  if (!container || !targetHeader) return;
  if (!targetHeader.querySelector("#sc-custom-exec-btn")) {
    const custom = document.createElement("button");
    custom.id = "sc-custom-exec-btn";
    custom.type = "button";
    custom.className = "automax-exec-button";
    custom.textContent = "自定义高管数据";
    custom.addEventListener("click", (event) => {
      event.preventDefault();
      component.openBoardroomSimulator();
    });
    targetHeader.appendChild(custom);
  }
  if (!targetHeader.querySelector("#sc-coo-earning-btn")) {
    const calculator = document.createElement("button");
    calculator.id = "sc-coo-earning-btn";
    calculator.type = "button";
    calculator.className = "automax-exec-button automax-exec-button--primary";
    calculator.textContent = "COO收益";
    calculator.addEventListener("click", (event) => {
      event.preventDefault();
      component.openCooCalculator();
    });
    targetHeader.appendChild(calculator);
  }
}

function injectFormerExecutiveButtons(component) {
  if (!componentList.autoMaxFormerExecEnhance?.enable) return;
  const former = component.realmData()?.formerExecutives ?? [];
  if (!former.length) return;
  for (const row of document.querySelectorAll("li, tr, div")) {
    if (row.childElementCount < 2 || row.querySelector("[data-automax-former-exec]")) continue;
    const text = row.children[1]?.children[0]?.textContent;
    if (!text) continue;
    const executive = former.find((item) => item?.name === text.replace(/\s*\(.*$/, "").trim());
    if (!executive?.id) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "automax-exec-button";
    button.dataset.automaxFormerExec = "true";
    button.textContent = "详细";
    button.addEventListener("click", () => void component.openExecutiveModal(executive.id));
    row.append(button);
  }
}

function historyTable(data) {
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const top = document.createElement("tr");
  for (const label of ["公司", "职位", "天数", "状态"]) {
    const cell = document.createElement("th");
    cell.textContent = label;
    top.append(cell);
  }
  head.append(top);
  const body = document.createElement("tbody");
  for (const history of Array.isArray(data.workHistory) ? data.workHistory : []) {
    const row = document.createElement("tr");
    const values = [
      history.employer?.company ?? "-",
      POSITION_NAMES[history.position] ?? history.position ?? "-",
      history.daysActive ?? "-",
      history.end ? "已离职" : "当前任职",
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    body.append(row);
  }
  table.append(head, body);
  return table;
}

async function openExecutiveModal(component, id) {
  let data = component.realmData()?.details?.[String(id)];
  if (!data) {
    const response = await fetch(`https://www.simcompanies.com/api/v4/executives/${id}/`);
    if (!response.ok) return tools.alert("无法获取高管资料。");
    data = await response.json();
    component.captureResponse(`/api/v4/executives/${id}/`, data);
  }
  const overlay = document.createElement("div");
  overlay.className = "automax-exec-modal";
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("role", "dialog");
  const panel = document.createElement("section");
  const header = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = `${data.name ?? "高管"} 的详细资料`;
  overlay.setAttribute("aria-label", title.textContent);
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "关闭";
  const dismiss = () => overlay.remove();
  close.addEventListener("click", dismiss);
  header.append(title, close);
  panel.append(header, historyTable(data));
  overlay.append(panel);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) dismiss(); });
  document.body.append(overlay);
}

function totalAdminFee(component) {
  const realms = componentList.autoMaxFoundation?.indexDBData?.cache?.regions ?? {};
  const realmId = component.realmId();
  const region = realmId === 0 || realmId === 1 ? realms[String(realmId)] : Object.values(realms)[0];
  return { region, total: calculateAdminFee(region) };
}

function money(value) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function openCooCalculator(component) {
  const { total, region } = totalAdminFee(component);
  const overlay = document.createElement("div");
  overlay.className = "automax-exec-modal";
  overlay.setAttribute("aria-label", "COO 收益计算");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("role", "dialog");
  const panel = document.createElement("section");
  const title = document.createElement("h2");
  title.textContent = "COO 收益计算";
  const base = document.createElement("p");
  base.textContent = `当前建筑 24 小时管理费：$${money(total)}（管理费 ${(Math.max(0, (Number(region?.administration) || 1) - 1) * 100).toFixed(1)}%）`;
  const label = document.createElement("label");
  label.textContent = "COO 有效点数";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.value = String(Number(region?.adminBonus) || 0);
  const result = document.createElement("p");
  const update = () => {
    const points = Math.max(0, Number(input.value) || 0);
    result.textContent = `节省管理费：$${money(total * points / 100)}；每日实际管理费：$${money(total * (1 - points / 100))}`;
  };
  input.addEventListener("input", update);
  label.append(input);
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "关闭";
  close.addEventListener("click", () => overlay.remove());
  panel.append(title, base, label, result, close);
  overlay.append(panel);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
  document.body.append(overlay);
  update();
}

function numberField(text, value) {
  const label = document.createElement("label");
  label.textContent = text;
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "0.01";
  input.value = String(value);
  label.append(input);
  return { input, label };
}

function buildSettings(component) {
  const realmId = component.realmId();
  const values = component.customBonuses(realmId);
  const root = document.createElement("section");
  root.className = "automax-exec-settings";
  const title = document.createElement("h2");
  title.textContent = "自定义高管加成";
  const note = document.createElement("p");
  note.textContent = "开启 SCT 组件列表中的“高管自定义加成”后，利润计算会使用这里的管理/销售加成。";
  const admin = numberField("管理（COO）加成", values.adminBonus);
  const sales = numberField("销售（CMO）加成", values.saleBonus);
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = "保存";
  save.addEventListener("click", () => {
    if (realmId !== 0 && realmId !== 1) return tools.alert("当前领域尚未识别。");
    component.indexDBData.customBonuses[String(realmId)] = {
      adminBonus: Math.max(0, Number(admin.input.value) || 0),
      saleBonus: Math.max(0, Number(sales.input.value) || 0),
    };
    tools.indexDB_updateIndexDBData();
    window.dispatchEvent(new CustomEvent("automax-settings-changed"));
  });
  root.append(title, note, admin.label, sales.label, save);
  return root;
}

module.exports = {
  buildSettings,
  historyTable,
  injectBoardroomButtons,
  injectFormerExecutiveButtons,
  money,
  numberField,
  openCooCalculator,
  openExecutiveModal,
  renderDetailPanel,
  totalAdminFee,
};
