// SPDX-License-Identifier: AGPL-3.0-or-later
const COLOR_EMOJI_LABELS = Object.freeze({
  "🟢": "绿",
  "🔴": "红",
  "🟡": "黄",
  "🔵": "蓝",
  "🟣": "紫",
  "🟠": "橙",
  "⚪": "白",
  "⚫": "黑",
  "🟤": "棕",
});

function normalizedQuestText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\$%s|%s|%\([\w]+\)\w|:re-\d+:/g, "")
    .replace(/\s+/g, "")
    .replace(/[^a-z\u4e00-\u9fff]/g, "");
}

function orderedCoverage(source, target) {
  if (!source || !target) return 0;
  let targetIndex = 0;
  for (const character of source) {
    if (character === target[targetIndex]) targetIndex += 1;
    if (targetIndex === target.length) break;
  }
  return targetIndex / target.length;
}

function questMatchScore(message, question) {
  const text = normalizedQuestText(message);
  const candidate = normalizedQuestText(question);
  if (!text || !candidate) return 0;
  const questionInMessage = orderedCoverage(text, candidate);
  const messageInQuestion = orderedCoverage(candidate, text);
  return questionInMessage >= 0.85 ? questionInMessage : Math.min(questionInMessage, messageInQuestion);
}

function findQuestMatch(message, quests, threshold = 0.7) {
  if (!Array.isArray(quests) || String(message ?? "").trim().length < 3) return null;
  let best;
  let score = 0;
  for (const quest of quests) {
    if (!quest || typeof quest !== "object") continue;
    for (const language of ["sc", "tc", "en"]) {
      const value = quest[`q_${language}`];
      const candidateScore = questMatchScore(message, value);
      if (candidateScore > score) {
        best = { quest, language, score: candidateScore };
        score = candidateScore;
      }
    }
  }
  return score >= threshold ? best : null;
}

function normalizeSnipboardUrl(input) {
  try {
    const url = new URL(String(input ?? ""), "https://snipboard.io/");
    if (url.hostname.toLowerCase() !== "snipboard.io") return null;
    url.protocol = "https:";
    if (!/\.(?:avif|bmp|gif|jpe?g|png|webp)$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/$/, "")}.jpg`;
    }
    return url.href;
  } catch {
    return null;
  }
}

function findChatContainers(documentRef) {
  const exact = documentRef.querySelectorAll("div.css-xo2rg1.e1llepen2");
  return exact.length > 0 ? [...exact] : [...documentRef.querySelectorAll('div[style*="column-reverse"][style*="overflow"]')];
}

module.exports = {
  COLOR_EMOJI_LABELS,
  findChatContainers,
  findQuestMatch,
  normalizeSnipboardUrl,
  normalizedQuestText,
  questMatchScore,
};
