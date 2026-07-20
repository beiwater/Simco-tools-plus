const DECAY_RESOURCE_IDS = Object.freeze(new Set([153, 154]));
const DECAY_FACTOR = 0.95;
const DECAY_INTERVAL_MS = 4 * 60 * 1000;

function finite(value, fallback = undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function decayHours(timestamp, at = Date.now()) {
  const origin = Date.parse(timestamp);
  if (!Number.isFinite(origin)) return undefined;
  return Math.round(Math.abs(at - origin) / DECAY_INTERVAL_MS) * 4 / 60;
}

function predictedAmount(amount, timestamp, at = Date.now()) {
  const hours = decayHours(timestamp, at);
  const quantity = finite(amount);
  if (hours === undefined || quantity === undefined || quantity < 0) return undefined;
  return Math.max(0, Math.floor(quantity * DECAY_FACTOR ** hours));
}

function totalCost(cost) {
  if (!cost || typeof cost !== "object") return undefined;
  const values = Object.values(cost).map(Number).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : undefined;
}

function decayTimeline({ amount, timestamp, cost, now = Date.now(), maxSteps = 10_000 }) {
  const origin = Date.parse(timestamp);
  const initial = finite(amount);
  if (!Number.isFinite(origin) || initial === undefined || initial < 0) return [];
  let at = Math.floor(now / DECAY_INTERVAL_MS) * DECAY_INTERVAL_MS;
  let prior = predictedAmount(initial, timestamp, at);
  const entries = [];
  const expense = totalCost(cost);
  for (let index = 0; index < maxSteps && prior > 0; index += 1) {
    at += DECAY_INTERVAL_MS;
    const next = predictedAmount(initial, timestamp, at);
    if (next === prior) continue;
    entries.push({
      amount: next,
      at: new Date(at).toISOString(),
      unitCost: expense === undefined ? undefined : next === 0 ? Infinity : expense / next,
    });
    prior = next;
  }
  return entries;
}

function normalizeForecastEntry(entry, source, now = Date.now()) {
  const kind = finite(entry?.kind ?? entry?.resourceId);
  if (!DECAY_RESOURCE_IDS.has(kind)) return undefined;
  const quantity = finite(entry?.amount ?? entry?.quantity);
  const timestamp = entry?.datetimeDecayUpdated ?? entry?.datetime;
  const current = predictedAmount(quantity, timestamp, now);
  if (quantity === undefined || current === undefined) return undefined;
  return {
    current,
    events: decayTimeline({ amount: quantity, timestamp, cost: entry?.cost, now }),
    kind,
    owner: entry?.buyer?.company ?? entry?.seller?.company,
    price: finite(entry?.price),
    quality: finite(entry?.quality, 0),
    quantity,
    source,
    timestamp,
    unitCost: (() => {
      const expense = totalCost(entry?.cost);
      return expense === undefined ? undefined : current === 0 ? Infinity : expense / current;
    })(),
  };
}

function flattenIncomingContracts(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.incomingContracts)) return value.incomingContracts;
  return [];
}

module.exports = {
  DECAY_FACTOR,
  DECAY_INTERVAL_MS,
  DECAY_RESOURCE_IDS,
  decayHours,
  decayTimeline,
  flattenIncomingContracts,
  normalizeForecastEntry,
  predictedAmount,
  totalCost,
};
