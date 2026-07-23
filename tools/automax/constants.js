const { failure, success } = require("./result.js");

function findBalancedObject(text, start) {
  if (text[start] !== "{") return null;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "\"" || character === "'") quote = character;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return text.slice(start, index + 1);
  }
  return null;
}

function parseLiteral(value) {
  const trimmed = value.trim();
  if (/^(['"]).*\1$/.test(trimmed)) return trimmed.slice(1, -1);
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return Number(trimmed);
  if (trimmed === "true" || trimmed === "false") return trimmed === "true";
  if (trimmed === "null") return null;
  if (/^\[[^\[\]]*\]$/.test(trimmed)) {
    return trimmed.slice(1, -1).split(",").filter(Boolean).map((item) => parseLiteral(item));
  }
  return undefined;
}

function findAssignment(text, variableName) {
  const match = new RegExp(`(?:^|[,;\\s])${variableName.replace(/[$]/g, "\\$")}\\s*=\\s*`, "m").exec(text);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  if (text[start] === "{") return findBalancedObject(text, start);
  const end = text.slice(start).search(/[,;\n\r]/);
  return text.slice(start, end === -1 ? undefined : start + end);
}

function readObjectFields(objectText) {
  const fields = {};
  const pattern = /([A-Za-z_$][\w$]*)\s*:\s*("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|-?(?:\d+\.?\d*|\.\d+)|true|false|null|\[[^\[\]]*\])/g;
  for (const match of objectText.matchAll(pattern)) {
    const value = parseLiteral(match[2]);
    if (value !== undefined) fields[match[1]] = value;
  }
  return fields;
}

function extractCoreValue(text, property) {
  const reference = new RegExp(`\\b${property}\\s*:\\s*([\\w$]+)`, "m").exec(text)?.[1];
  if (!reference) return undefined;
  const assignment = findAssignment(text, reference);
  if (!assignment) return undefined;
  if (assignment.startsWith("{")) return readObjectFields(assignment);
  return parseLiteral(assignment);
}

function extractResourceObjects(text) {
  const resources = {};
  const pattern = /(\d+)\s*:\s*{/g;
  for (const match of text.matchAll(pattern)) {
    const objectText = findBalancedObject(text, match.index + match[0].length - 1);
    if (!objectText) continue;
    const fields = readObjectFields(objectText);
    if (!fields.dbLetter) continue;
    resources[Number(match[1])] = fields;
  }
  return resources;
}

function extractRetailInfo(text) {
  const retailInfo = {};
  const pattern = /(\d+)\s*:\s*JSON\.parse\((['"])(.*?)\2\)/g;
  for (const match of text.matchAll(pattern)) {
    try {
      retailInfo[match[1]] = JSON.parse(match[3]);
    } catch {
    }
  }
  return retailInfo;
}

function parseConstantsBundle(text, now = () => new Date().toISOString()) {
  if (typeof text !== "string" || text.length === 0) {
    return failure("CONSTANTS_PARSE_FAILED", "Constants bundle is empty.");
  }
  const data = {
    AVERAGE_SALARY: extractCoreValue(text, "AVERAGE_SALARY"),
    RETAIL_MODELING_QUALITY_WEIGHT: extractCoreValue(text, "RETAIL_MODELING_QUALITY_WEIGHT"),
    SALES: extractCoreValue(text, "SALES"),
  };
  if (!Number.isFinite(data.AVERAGE_SALARY) || !Number.isFinite(data.RETAIL_MODELING_QUALITY_WEIGHT) || !data.SALES || typeof data.SALES !== "object") {
    return failure("CONSTANTS_PARSE_FAILED", "Required constants were not found in the bundle.");
  }
  delete data.SALES.B;
  delete data.SALES.r;
  const constantsResources = extractResourceObjects(text);
  const buildingsSalaryModifier = Object.fromEntries(
    Object.values(constantsResources)
      .filter(({ dbLetter, salaryModifier }) => dbLetter && Number.isFinite(salaryModifier))
      .map(({ dbLetter, salaryModifier }) => [dbLetter, salaryModifier]),
  );
  return success({
    buildingsSalaryModifier,
    constantsResources,
    data,
    retailInfo: extractRetailInfo(text),
    timestamp: now(),
  });
}

module.exports = { parseConstantsBundle };
