const { calculateExecutiveSkills } = require("./data.js");
const { boardroomExecutives } = require("./executiveState.js");
const { componentList } = require("../tools.js");

function calculateBoardroomMetrics(boardroomState, academyLevel, region) {
  const { effective, raw } = calculateExecutiveSkills(boardroomExecutives(boardroomState), academyLevel);
  const baseAdminValue = (Number(region?.administration) || 1) - 1;
  const baseAdmin = `${(baseAdminValue * 100).toFixed(2)}%`;
  const changeAdmin = effective.coo === 0 ? "0.00%" : `-${(baseAdminValue * effective.coo).toFixed(2)}%`;
  const finalAdmin = `${(baseAdminValue * (1 - effective.coo / 100) * 100).toFixed(2)}%`;
  const bankLevel = Number(region?.bankLevel) || 0;
  const changeCfoValue = effective.cfo * 0.5 * (1 + bankLevel / 10);
  const finalCfo = `$${(3 + changeCfoValue).toFixed(2)}M`;
  const baseSalesValue = (Number(region?.salesModifier) || 0) + (Number(region?.recreationBonus) || 0);
  const baseSales = `${baseSalesValue.toFixed(1)}%`;
  const salesIncrease = Math.floor(effective.cmo / 3);
  const baseRestaurant = `+${(baseSalesValue * 0.02).toFixed(2)}`;
  const cmoRestaurant = effective.cmo * 0.01;
  const finalRestaurant = `+${((baseSalesValue * 0.02) + cmoRestaurant).toFixed(3)}`;
  const patentIncrease = effective.cto * 0.0625;
  const researchIncrease = effective.cto * 2;
  const rows = [
    { type: "admin", label: "管理费用", base: baseAdmin, change: changeAdmin, final: finalAdmin, negative: true },
    { type: "cfo", label: "会计费用起始于", base: "$3.0M", change: `+$${changeCfoValue.toFixed(2)}M`, final: finalCfo },
    { type: "salesSpeed", label: "销售速度", base: baseSales, change: `+${salesIncrease}%`, final: `${(baseSalesValue + salesIncrease).toFixed(1)}%` },
    { type: "restaurant", label: "餐馆评级", base: baseRestaurant, change: `+${cmoRestaurant.toFixed(3)}`, final: finalRestaurant },
    { type: "patent", label: "专利转化概率", base: "6.25%", change: `+${patentIncrease.toFixed(2)}%`, final: `${(6.25 + patentIncrease).toFixed(2)}%` },
    { type: "research", label: "研究类生产提升", base: "0.0%", change: `+${researchIncrease.toFixed(1)}%`, final: `${researchIncrease.toFixed(1)}%` },
  ];
  const details = {
    admin: `
      <strong>管理费用计算详情：</strong><br>
      1. <strong>基础管理费用</strong>：总建筑等级=工人/100，管理费用=(总建筑等级-1)/170。<br>
      2. <strong>高管加成</strong>：COO 有效点数 <code>${effective.coo}</code>（原始汇总点数 ${raw.coo}，衰减折算后为 ${effective.coo}）。<br>
      3. <strong>计算公式</strong>：每 1 点有效 COO 减少基础管理费用的 1%。<br>
         <code>${baseAdmin} &times; ${effective.coo}% = ${Math.abs(baseAdminValue * effective.coo).toFixed(2)}%</code> 扣减。<br>
      4. <strong>最终结果</strong>：<code>${baseAdmin} - ${Math.abs(baseAdminValue * effective.coo).toFixed(2)}% = ${finalAdmin}</code>。
    `,
    cfo: `
      <strong>会计费用起始点计算详情：</strong><br>
      1. <strong>基础限额</strong>：固定值 <code>$3.0M</code>（所有公司初始免税上限均为 $3,000,000）。<br>
      2. <strong>高管加成</strong>：CFO 有效点数 <code>${effective.cfo}</code>（原始汇总点数 ${raw.cfo}，衰减折算后为 ${effective.cfo}）。<br>
      3. <strong>银行加成</strong>：当前银行等级为 <code>${bankLevel}</code>，提供额外 <code>${(bankLevel * 10).toFixed(0)}%</code> 的 CFO 效果增幅。<br>
      4. <strong>计算公式</strong>：<code>$3.0M + CFO 有效点数 &times; $0.5M &times; (1 + 银行等级 / 10)</code>。<br>
         <code>$3.0M + ${effective.cfo} &times; $0.5M &times; (1 + ${bankLevel} / 10) = ${finalCfo}</code>。<br>
      5. <strong>最终结果</strong>：<code>${finalCfo}</code>。
    `,
    salesSpeed: `
      <strong>销售速度计算详情：</strong><br>
      1. <strong>基础销售速度</strong>：等级加成与休闲加成之和 <code>${baseSales}</code>。<br>
      2. <strong>高管加成</strong>：CMO 有效点数 <code>${effective.cmo}</code>（原始汇总点数 ${raw.cmo}，衰减折算后为 ${effective.cmo}）。<br>
      3. <strong>计算公式</strong>：每 3 点有效 CMO 增加 1% 销售速度。<br>
         <code>Math.floor(${effective.cmo} / 3) = +${salesIncrease}%</code> 速度提升。<br>
      4. <strong>最终结果</strong>：<code>${baseSales} + ${salesIncrease}% = ${(baseSalesValue + salesIncrease).toFixed(1)}%</code>。
    `,
    restaurant: `
      <strong>餐馆评级计算详情：</strong><br>
      1. <strong>基础评级</strong>：基础销售速度 * 0.02<br>
      2. <strong>高管加成</strong>：CMO 有效点数 <code>${effective.cmo}</code>（原始汇总点数 ${raw.cmo}，衰减折算后为 ${effective.cmo}）。<br>
      3. <strong>计算公式</strong>：每 1 点有效 CMO 增加 0.01 餐馆评级。<br>
         <code>${effective.cmo} &times; 0.01 = +${cmoRestaurant.toFixed(2)}</code> 评级提升。<br>
      4. <strong>最终结果</strong>：<code>${baseRestaurant} + ${cmoRestaurant.toFixed(2)} = ${finalRestaurant}</code>。
    `,
    patent: `
      <strong>专利转化概率计算详情：</strong><br>
      1. <strong>基础概率</strong>：游戏固定基础转化率 <code>6.25%</code>。<br>
      2. <strong>高管加成</strong>：CTO 有效点数 <code>${effective.cto}</code>（原始汇总点数 ${raw.cto}，衰减折算后为 ${effective.cto}）。<br>
      3. <strong>计算公式</strong>：每 1 点有效 CTO 增加 1% 的基础专利转化概率（即 6.25% 的 1% = 0.0625%）。<br>
         <code>${effective.cto} &times; 0.0625% = +${patentIncrease.toFixed(2)}%</code> 概率提升。<br>
      4. <strong>最终结果</strong>：<code>6.25% + ${patentIncrease.toFixed(2)}% = ${(6.25 + patentIncrease).toFixed(2)}%</code>。
    `,
    research: `
      <strong>研究生产速度提升计算详情：</strong><br>
      1. <strong>基础速度</strong>：固定基础值 <code>0.0%</code>。<br>
      2. <strong>高管加成</strong>：CTO 有效点数 <code>${effective.cto}</code>（原始汇总点数 ${raw.cto}，衰减折算后为 ${effective.cto}）。<br>
      3. <strong>计算公式</strong>：每 1 点有效 CTO 增加 2% 的研究类生产速度。<br>
         <code>${effective.cto} &times; 2% = +${researchIncrease.toFixed(1)}%</code> 速度提升。<br>
      4. <strong>最终结果</strong>：<code>${researchIncrease.toFixed(1)}%</code>。
    `,
  };
  return { bonuses: { adminBonus: effective.coo, saleBonus: salesIncrease }, details, rows };
}

function renderBoardroomResults(component, overlay, boardroomState) {
  const selected = overlay.querySelector('input[name="sc-aca-r"]:checked');
  const academyLevel = selected ? parseInt(selected.value) : 15;
  const region = componentList.autoMaxFoundation?.indexDBData?.cache?.regions?.[String(component.realmId())];
  const metrics = calculateBoardroomMetrics(boardroomState, academyLevel, region);
  const table = overlay.querySelector("#sc-calc-table-container");
  if (table) {
    table.innerHTML = `
      <table class="sc-calc-table">
        <thead><tr><th>项目</th><th class="sc-calc-number">基础</th><th class="sc-calc-number">高管加成</th><th class="sc-calc-number">最终</th></tr></thead>
        <tbody>${metrics.rows.map((row) => `
          <tr class="sc-calc-row" data-type="${row.type}" tabindex="0">
            <td class="sc-calc-label">${row.label}</td>
            <td class="sc-calc-number">${row.base}</td>
            <td class="sc-calc-number ${row.negative ? "sc-calc-negative" : "sc-calc-positive"}">${row.change}</td>
            <td class="sc-calc-number sc-calc-positive">${row.final}</td>
          </tr>`).join("")}</tbody>
      </table>`;
    const rows = table.querySelectorAll(".sc-calc-row");
    const detail = overlay.querySelector("#sc-detail-box");
    rows.forEach((row) => {
      const updateDetail = () => {
        if (!metrics.details[row.dataset.type]) return;
        detail.innerHTML = metrics.details[row.dataset.type];
        rows.forEach((candidate) => candidate.classList.remove("is-active"));
        row.classList.add("is-active");
      };
      row.onmouseenter = updateDetail;
      row.onfocus = updateDetail;
      row.onclick = updateDetail;
      row.onkeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        updateDetail();
      };
    });
  }
  return metrics.bonuses;
}

module.exports = { calculateBoardroomMetrics, renderBoardroomResults };
