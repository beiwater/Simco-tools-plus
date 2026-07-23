const LEGACY_IMPORT_VERSION = 1;
const LEGACY_PAGE_ACTIONS_KEY = "SC_PageActions_Settings";
const LEGACY_PANEL_POSITION_KEY = "SC_PanelPosition";
const PANEL_POSITION_DEFAULT = Object.freeze({ left: 10, bottom: 55 });
const PAGE_ACTIONS = Object.freeze([
  { key: "runtimeDuration", label: "自定义运行时长", defaultEnabled: true },
  { key: "marketMaxProfitToggle", label: "交易所计算时利润", defaultEnabled: false },
  { key: "contractProfit", label: "合同计算时利润", defaultEnabled: true },
  { key: "executiveHistory", label: "显示高管培训记录", defaultEnabled: true },
  { key: "formerExecEnhance", label: "前任高管更多信息", defaultEnabled: true },
  { key: "outgoingMP", label: "出库合同 MP-?%", defaultEnabled: true },
  { key: "autoSelectBestMarketRow", label: "交易所自动选中高亮行", defaultEnabled: false },
  { key: "warehouseProfit", label: "仓库时利润计算", defaultEnabled: true },
  { key: "chatAccessibility", label: "聊天室色弱辅助", defaultEnabled: false },
  { key: "landscapeHighlight", label: "地图空闲建筑高亮", defaultEnabled: true },
  { key: "paQuestAnswers", label: "PA 任务答案", defaultEnabled: true },
  { key: "snipboardPreview", label: "Snipboard 图片预览", defaultEnabled: true },
  { key: "executiveCustomToggle", label: "高管自定义加成", defaultEnabled: false },
]);
const PAGE_ACTION_ALIASES = Object.freeze({ marketProfit: "marketMaxProfitToggle" });

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeParseRecord(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    if (typeof raw !== "string") return {};
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function pageActionDefault(key) {
  return PAGE_ACTIONS.find((action) => action.key === key)?.defaultEnabled ?? true;
}

function clampPanelPosition(position, viewport = {}) {
  if (!isRecord(position)) return { ...PANEL_POSITION_DEFAULT };
  const left = finiteNumber(position.left, PANEL_POSITION_DEFAULT.left);
  const bottom = finiteNumber(position.bottom, PANEL_POSITION_DEFAULT.bottom);
  const width = finiteNumber(viewport.width, undefined);
  const height = finiteNumber(viewport.height, undefined);
  const panelWidth = Math.max(0, finiteNumber(viewport.panelWidth, 0));
  const panelHeight = Math.max(0, finiteNumber(viewport.panelHeight, 0));
  if (width === undefined || height === undefined) return { left: Math.max(0, left), bottom: Math.max(0, bottom) };
  return {
    left: Math.min(Math.max(0, left), Math.max(0, width - panelWidth)),
    bottom: Math.min(Math.max(0, bottom), Math.max(0, height - panelHeight)),
  };
}

function createAutoMaxSettings(seed = {}) {
  const source = isRecord(seed) ? seed : {};
  return {
    schemaVersion: 1,
    legacyImportVersion: finiteNumber(source.legacyImportVersion, 0),
    panelPosition: clampPanelPosition(source.panelPosition),
    pageActions: isRecord(source.pageActions) ? { ...source.pageActions } : {},
  };
}

function normalizeLegacyPageActions(actions) {
  const source = isRecord(actions) ? actions : {};
  const normalized = {};
  for (const [key, value] of Object.entries(source)) {
    if (Object.hasOwn(PAGE_ACTION_ALIASES, key) || typeof value !== "boolean") continue;
    normalized[key] = value;
  }
  for (const [key, target] of Object.entries(PAGE_ACTION_ALIASES)) {
    if (Object.hasOwn(normalized, target) || typeof source[key] !== "boolean") continue;
    normalized[target] = source[key];
  }
  return normalized;
}

function importLegacySettings(settings, storage, viewport) {
  const current = createAutoMaxSettings(settings);
  if (current.legacyImportVersion >= LEGACY_IMPORT_VERSION) return { imported: false, settings: current };
  const pageActions = normalizeLegacyPageActions(safeParseRecord(storage, LEGACY_PAGE_ACTIONS_KEY));
  const legacyPosition = safeParseRecord(storage, LEGACY_PANEL_POSITION_KEY);
  return {
    imported: true,
    settings: {
      ...current,
      legacyImportVersion: LEGACY_IMPORT_VERSION,
      panelPosition: Object.keys(legacyPosition).length > 0 ? clampPanelPosition(legacyPosition, viewport) : current.panelPosition,
      pageActions: { ...pageActions, ...current.pageActions },
    },
  };
}

function getPageActionEnabled(settings, key) {
  if (key === "chatInputExpander") return false;
  const value = settings?.pageActions?.[key];
  return typeof value === "boolean" ? value : pageActionDefault(key);
}

function togglePageAction(settings, key) {
  const current = createAutoMaxSettings(settings);
  return {
    ...current,
    pageActions: { ...current.pageActions, [key]: !getPageActionEnabled(current, key) },
  };
}

module.exports = {
  LEGACY_IMPORT_VERSION,
  LEGACY_PAGE_ACTIONS_KEY,
  LEGACY_PANEL_POSITION_KEY,
  PAGE_ACTIONS,
  PANEL_POSITION_DEFAULT,
  clampPanelPosition,
  createAutoMaxSettings,
  getPageActionEnabled,
  importLegacySettings,
  togglePageAction,
};
