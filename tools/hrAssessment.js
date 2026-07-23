function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < String(text || "").length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted && char === '"' && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function normalizeAssessment(text) {
  return String(text || "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[，。！？：；、]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function parseHrRows(csvText) {
  const rows = parseCsv(csvText);
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell.trim() === "HR Assessment"));
  if (headerIndex < 0) return [];
  const header = rows[headerIndex].map((cell) => cell.trim());
  const value = (row, name) => row[header.indexOf(name)] || "";
  const number = (input) => {
    const parsed = Number(String(input).replace(/[$,%\s,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  };
  return rows.slice(headerIndex + 1).map((row) => ({
    assessment: value(row, "HR Assessment").trim(), samples: number(value(row, "Samples")),
    management: number(value(row, "Mgmt")), accounting: number(value(row, "Acct")),
    communication: number(value(row, "Comm")), tech: number(value(row, "Tech")),
    salary: number(value(row, "Salaries")), avgSkill: number(value(row, "Avg. Skills")),
  })).filter((row) => row.assessment);
}

function score(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if ((left.length > 12 && right.includes(left)) || (right.length > 12 && left.includes(right))) return 0.92;
  const leftWords = new Set(left.match(/[a-z0-9]+/g) || []);
  const rightWords = new Set(right.match(/[a-z0-9]+/g) || []);
  let shared = 0;
  for (const word of leftWords) if (rightWords.has(word)) shared += 1;
  const wordScore = leftWords.size && rightWords.size ? (2 * shared) / (leftWords.size + rightWords.size) : 0;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) current[j] = left[i - 1] === right[j - 1] ? previous[j - 1] : Math.min(previous[j], current[j], previous[j - 1]) + 1;
    previous.splice(0, previous.length, ...current);
  }
  return Math.max(wordScore, 1 - previous[right.length] / Math.max(left.length, right.length));
}

function findHrMatches(rows, assessment, limit = 5, minScore = 0.55) {
  const target = normalizeAssessment(assessment);
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const matchScore = score(target, normalizeAssessment(row.assessment));
    return { row, score: matchScore, matched: matchScore >= minScore };
  }).sort((left, right) => right.score - left.score).slice(0, limit);
}

module.exports = { findHrMatches, normalizeAssessment, parseCsv, parseHrRows };
