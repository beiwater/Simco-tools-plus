// SPDX-License-Identifier: AGPL-3.0-or-later
const DEFAULT_MARKET_PROFIT_SETTINGS = Object.freeze({
  buildingHours: 24,
  buildingLevel: 100,
  economyState: "",
  mpAdjustment: 0,
});

const MARKET_PROFIT_CSS = `
  td[data-automax-market-profit] { white-space: nowrap; }
  td[data-automax-market-profit] span { background: var(--sct-surface-muted); border: 1px solid var(--sct-border); border-radius: 6px; color: var(--fontColor); display: inline-block; font-size: 12px; font-variant-numeric: tabular-nums; padding: 4px 6px; }
  tr[data-automax-market-best] td[data-automax-market-profit] span { background: color-mix(in srgb, var(--sct-focus) 12%, transparent); border-color: var(--sct-focus); }
  .automax-market-summary { background: linear-gradient(135deg, var(--sct-surface-elevated), var(--sct-surface)); border: 1px solid var(--sct-border); border-left: 4px solid var(--sct-enabled); border-radius: 10px; box-shadow: var(--sct-strip-shadow); color: var(--fontColor); display: grid; gap: 8px; margin-top: 8px; padding: 10px 12px; }
  .automax-market-controls { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; }
  .automax-market-controls button, .automax-market-controls input, .automax-market-controls select { font-size: 12px; min-height: 32px; padding: 4px 8px; }
  .automax-market-controls input { font-variant-numeric: tabular-nums; text-align: center; width: 64px; }
  .automax-market-group { align-items: center; background: var(--sct-surface-muted); border: 1px solid var(--sct-border); border-radius: 8px; display: inline-flex; gap: 4px; padding: 3px; white-space: nowrap; }
  .automax-market-subtle[data-enabled="true"] { background: var(--sct-enabled-soft); border-color: var(--sct-enabled-hover); }
  .automax-market-summary .automax-market-subtle[data-enabled="true"]:is(:hover, :active):not(:disabled) { background: var(--sct-enabled); border-color: var(--sct-enabled-hover); }
  .automax-market-custom-data { border-color: var(--sct-border-strong) !important; }
  .automax-market-summary-output { border-top: 1px solid var(--sct-border); display: flex; flex-wrap: wrap; font-size: 12px; font-variant-numeric: tabular-nums; gap: 2px 6px; line-height: 1.5; padding-top: 8px; text-align: left; }
  .automax-market-summary-clause { white-space: nowrap; }
  .automax-market-summary-output[data-empty="true"] { color: var(--sct-warning); }
  .automax-market-summary[data-theme="light"] { background: var(--sct-light-surface); border-color: var(--sct-light-control-border); box-shadow: var(--sct-light-shadow); color: var(--sct-light-text); }
  .automax-market-summary[data-theme="light"] .automax-market-controls button, .automax-market-summary[data-theme="light"] .automax-market-controls input, .automax-market-summary[data-theme="light"] .automax-market-controls select { background: var(--sct-light-control); border-color: var(--sct-light-control-border); color: var(--sct-light-text); }
  .automax-market-summary[data-theme="light"] .automax-market-group { background: var(--sct-light-surface-muted); border-color: var(--sct-light-border); }
  .automax-market-summary[data-theme="light"] .automax-market-summary-output { border-color: var(--sct-light-border); }
  .automax-market-summary[data-theme="light"] .automax-market-summary-output[data-empty="true"] { color: var(--sct-light-warning); }
  .automax-market-summary[data-theme="light"] .automax-market-subtle[data-enabled="true"] { background: var(--sct-light-enabled-surface); border-color: var(--sct-light-enabled-border); color: var(--sct-light-enabled-text); }
  .automax-market-summary[data-theme="light"] .automax-market-subtle[data-enabled="true"]:is(:hover, :active):not(:disabled) { background: var(--sct-light-enabled-surface); border-color: var(--sct-light-enabled-border); color: var(--sct-light-enabled-text); }
  @media (max-width: 576px) { .automax-market-summary { border-left-width: 3px; margin-top: 4px; padding: 8px; } .automax-market-controls { align-items: stretch; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } .automax-market-group { grid-column: 1 / -1; justify-content: center; } .automax-market-controls > input { width: 100%; } }
`;

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMarketProfitSettings(settings = {}) {
  const economyState = ["0", "1", "2"].includes(String(settings.economyState))
    ? String(settings.economyState)
    : "";
  return {
    buildingHours: Math.max(0, finiteNumber(settings.buildingHours, 24)),
    buildingLevel: Math.max(1, Math.floor(finiteNumber(settings.buildingLevel, 100))),
    economyState,
    mpAdjustment: finiteNumber(settings.mpAdjustment, 0),
  };
}

function adjustedMarketCost(marketPrice, adjustment) {
  const price = finiteNumber(marketPrice, 0);
  const value = finiteNumber(adjustment, 0);
  const adjusted = value >= 0 ? price * (1 - value / 100) : price + value;
  return adjusted > 0 ? adjusted : undefined;
}

function isDarkPage(document, view) {
  if (!document?.body || !view?.getComputedStyle) return true;
  const color = view.getComputedStyle(document.body).backgroundColor;
  const channels = (color.match(/\d+/g) ?? []).map(Number);
  return channels.reduce((sum, channel) => sum + channel, 0) < 380;
}

function formatMoney(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function summarizeMarketOrders(results, settings) {
  const normalized = normalizeMarketProfitSettings(settings);
  if (!Array.isArray(results)) return { kind: "empty", message: "无正利润订单" };
  const profitable = results
    .filter((result) => Number.isFinite(result?.hourlyProfit) && result.hourlyProfit > 0 && result.seconds > 0)
    .sort((left, right) => right.hourlyProfit - left.hourlyProfit);
  if (!profitable.length) return { kind: "empty", message: "无正利润订单" };

  const targetSeconds = normalized.buildingLevel * normalized.buildingHours * 3600;
  let remainingSeconds = targetSeconds;
  let coveredSeconds = 0;
  let totalProfit = 0;
  for (const result of profitable) {
    if (remainingSeconds <= 0) break;
    const usedSeconds = Math.min(result.seconds, remainingSeconds);
    totalProfit += result.hourlyProfit * usedSeconds / 3600;
    coveredSeconds += usedSeconds;
    remainingSeconds -= usedSeconds;
  }
  const coveredHours = coveredSeconds / 3600;
  return {
    coveredHours,
    hourlyProfit: coveredHours > 0 ? totalProfit / coveredHours : 0,
    isFull: remainingSeconds <= 0.1,
    kind: "summary",
    title: `${normalized.buildingLevel}级建筑运行${normalized.buildingHours}H正时利`,
    totalProfit,
  };
}

function formatMarketSummary(summary, formatMoneyFn = formatMoney) {
  if (summary.kind === "empty") return summary.message;
  const shortage = summary.isFull ? "" : "（货源不足）";
  return `${summary.title}：${formatMoneyFn(summary.hourlyProfit)}/h；总利润 ${formatMoneyFn(summary.totalProfit)}；覆盖 ${summary.coveredHours.toFixed(1)}H${shortage}`;
}

function button(document, text, className) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = text;
  return element;
}

function numberInput(document, value, options) {
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  input.min = options.min;
  input.step = options.step;
  input.setAttribute("aria-label", options.label);
  return input;
}

function createMarketProfitControls(options) {
  const { document } = options;
  let settings = normalizeMarketProfitSettings(options.settings);
  const root = document.createElement("section");
  root.className = "automax-market-summary";
  root.dataset.theme = options.isDark === false ? "light" : "dark";
  root.setAttribute("aria-label", "交易所利润模拟设置");
  const controls = document.createElement("div");
  controls.className = "automax-market-controls";

  const customToggle = button(document, "", "automax-market-subtle");
  const setCustomEnabled = (enabled) => {
    customToggle.textContent = `自定义：${enabled ? "开" : "关"}`;
    customToggle.dataset.enabled = String(enabled);
  };
  setCustomEnabled(Boolean(options.customEnabled));
  customToggle.addEventListener("click", () => options.onCustomToggle?.());
  const customData = button(document, "自定义数据", "automax-market-subtle automax-market-custom-data");
  customData.addEventListener("click", () => options.onCustomData?.());

  const mpGroup = document.createElement("span");
  mpGroup.className = "automax-market-group";
  const mpLabel = document.createElement("span");
  mpLabel.textContent = "MP-";
  const mpInput = numberInput(document, settings.mpAdjustment, { label: "MP 调整", min: "", step: "0.01" });
  const mpSuffix = document.createElement("span");
  mpSuffix.textContent = "%";
  const quick = button(document, "4%", "automax-market-compact");
  const clear = button(document, "清空", "automax-market-compact");
  mpGroup.append(mpLabel, mpInput, mpSuffix, quick, clear);

  const economyLabel = document.createElement("span");
  economyLabel.textContent = "周期:";
  const economySelect = document.createElement("select");
  economySelect.setAttribute("aria-label", "经济周期");
  for (const [value, label] of [["", "当前"], ["0", "萧条"], ["1", "平缓"], ["2", "景气"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    economySelect.append(option);
  }
  economySelect.value = settings.economyState;

  const buildingLevelInput = numberInput(document, settings.buildingLevel, { label: "建筑等级", min: "1", step: "1" });
  const buildingLabel = document.createElement("span");
  buildingLabel.textContent = "级建筑运行";
  const buildingHoursInput = numberInput(document, settings.buildingHours, { label: "运行时长（小时）", min: "0", step: "0.01" });
  const hoursLabel = document.createElement("span");
  hoursLabel.textContent = "H";

  const publish = () => {
    settings = normalizeMarketProfitSettings({
      buildingHours: buildingHoursInput.value,
      buildingLevel: buildingLevelInput.value,
      economyState: economySelect.value,
      mpAdjustment: mpInput.value,
    });
    options.onSettingsChange?.(settings);
  };
  for (const input of [mpInput, buildingLevelInput, buildingHoursInput]) input.addEventListener("change", publish);
  economySelect.addEventListener("change", publish);
  quick.addEventListener("click", () => { mpInput.value = "4"; publish(); });
  clear.addEventListener("click", () => { mpInput.value = "0"; publish(); });

  controls.append(customToggle, customData, mpGroup, economyLabel, economySelect, buildingLevelInput, buildingLabel, buildingHoursInput, hoursLabel);
  const output = document.createElement("div");
  output.className = "automax-market-summary-output";
  output.setAttribute("role", "status");
  output.textContent = "等待订单计算…";
  root.append(controls, output);
  return { buildingHoursInput, buildingLevelInput, economySelect, mpInput, output, root, setCustomEnabled };
}

module.exports = {
  DEFAULT_MARKET_PROFIT_SETTINGS,
  MARKET_PROFIT_CSS,
  adjustedMarketCost,
  createMarketProfitControls,
  formatMoney,
  formatMarketSummary,
  isDarkPage,
  normalizeMarketProfitSettings,
  summarizeMarketOrders,
};
