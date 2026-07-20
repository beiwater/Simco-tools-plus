const DEFAULT_RUNTIME_PRESETS = Object.freeze(["10pm"]);

function normalizeRuntimeText(value) {
  return String(value ?? "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xFEE0))
    .replace(/[：]/g, ":")
    .replace(/[，]/g, ",")
    .replace(/[＋]/g, "+")
    .replace(/hours?|hr/gi, "h")
    .replace(/minutes?|mins?/gi, "m")
    .replace(/小时|时/g, "h")
    .replace(/分钟|分|钟/g, "m")
    .replace(/天/g, "d")
    .trim();
}

function normalizeRuntimePresets(value, fallback = DEFAULT_RUNTIME_PRESETS) {
  if (value === undefined || value === null) return [...fallback];
  const values = Array.isArray(value) ? value : String(value).replace(/，/g, ",").split(",");
  return [...new Set(values.map(normalizeRuntimeText).filter(Boolean))];
}

function validClock(hours, minutes, period) {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
  if (period) {
    if (hours < 1 || hours > 12) return null;
    if (period === "pm" && hours !== 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
  } else if (hours < 0 || hours > 23) {
    return null;
  }
  return { hours, minutes };
}

function durationMinutes(value) {
  const matcher = /(\d+(?:\.\d+)?)\s*([dhm])/gi;
  let total = 0;
  let matched = false;
  for (const match of value.matchAll(matcher)) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount < 0) continue;
    matched = true;
    total += amount * (match[2].toLowerCase() === "d" ? 1440 : match[2].toLowerCase() === "h" ? 60 : 1);
  }
  return matched ? Math.floor(total) : null;
}

function timeResult(clock, now, daysAhead, kind) {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), clock.hours, clock.minutes, 0, 0);
  let milliseconds = target.getTime() - now.getTime() + daysAhead * 24 * 60 * 60 * 1000;
  if (daysAhead === 0 && milliseconds < 0) milliseconds += 24 * 60 * 60 * 1000;
  return { ok: true, kind, value: `${Math.max(0, Math.floor(milliseconds / 60000))}m` };
}

function parseTime(value, now, prefix) {
  const body = value.slice(prefix.length);
  const clockMatch = body.match(/^(\d{1,2}):(\d{1,2})\s*(am|pm)?$/i);
  const amPmMatch = body.match(/^(\d{1,2})\s*(am|pm)$/i);
  const match = clockMatch ?? amPmMatch;
  if (!match) return null;
  const clock = validClock(Number(match[1]), clockMatch ? Number(match[2]) : 0, match[clockMatch ? 3 : 2]?.toLowerCase());
  if (!clock) return { ok: false, error: "时间格式无效。" };
  const daysAhead = prefix === "++" ? 2 : prefix === "+" ? 1 : 0;
  return timeResult(clock, now, daysAhead, prefix ? "time-offset" : "time");
}

function parseRuntimePreset(value, nowValue = new Date()) {
  const text = normalizeRuntimeText(value);
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue);
  if (!text) return { ok: false, error: "运行时长不能为空。" };
  if (Number.isNaN(now.getTime())) return { ok: false, error: "当前时间无效。" };

  const forcedDay = text.startsWith("++") ? "++" : text.startsWith("+") ? "+" : "";
  const time = parseTime(text, now, forcedDay);
  if (time) return time;

  if (forcedDay === "+") {
    const minutes = durationMinutes(text.slice(1));
    if (minutes !== null) return { ok: true, kind: "duration-offset", value: `${minutes + 1440}m` };
  }

  const minutes = durationMinutes(text);
  if (minutes !== null) return { ok: true, kind: "duration", value: `${minutes}m` };
  if (/^\d+(?:\.\d+)?$/.test(text)) return { ok: true, kind: "amount", value: text };
  return { ok: false, error: `无法识别“${text}”。` };
}

module.exports = {
  DEFAULT_RUNTIME_PRESETS,
  normalizeRuntimePresets,
  normalizeRuntimeText,
  parseRuntimePreset,
};
