// SPDX-License-Identifier: AGPL-3.0-or-later
const { isFresh } = require("./data.js");
const { failure, success } = require("./result.js");
const { normalizeRealmId } = require("./captureLifecycle.js");

const HOUR_MS = 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * HOUR_MS;

function hasCrossedBeijingRefreshCheckpoint(timestamp, now) {
  const lastTime = Date.parse(timestamp);
  if (!Number.isFinite(lastTime)) return true;
  const beijingNow = new Date(now + BEIJING_OFFSET_MS);
  const date = beijingNow.toISOString().slice(0, 10);
  const atBeijingTime = (hour, minute) => Date.parse(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`) - BEIJING_OFFSET_MS;
  const daysUntilFriday = (5 - beijingNow.getUTCDay() + 7) % 7;
  const friday = new Date(Date.parse(`${date}T00:00:00.000Z`) + daysUntilFriday * 24 * HOUR_MS);
  const fridayCheckpoint = friday.getTime() + 23 * HOUR_MS + 60 * 1000 - BEIJING_OFFSET_MS;
  return [atBeijingTime(7, 45), atBeijingTime(22, 1), fridayCheckpoint]
    .some((checkpoint) => now >= checkpoint && lastTime < checkpoint);
}

function createTtlRefreshScheduler({
  cache,
  getRealmId,
  refreshConstants,
  refreshRegion,
  persist = async () => {},
  onError = () => {},
  ttlMs = HOUR_MS,
  now = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
}) {
  const inFlight = new Map();
  let timer;
  let disposed = false;
  const report = (result, context) => {
    if (!result.ok) {
      try { onError(result.error, context); } catch { }
    }
    return result;
  };
  const runOnce = (key, refresh, apply) => {
    if (inFlight.has(key)) return inFlight.get(key);
    let finish;
    const pending = new Promise((resolve) => { finish = resolve; });
    inFlight.set(key, pending);
    (async () => {
      try {
        const raw = await refresh();
        const result = typeof raw?.ok === "boolean" ? raw : success(raw);
        if (!result.ok || disposed) return report(result, { key });
        const applied = apply(result.value);
        if (!applied.ok) return report(applied, { key });
        await persist(cache.state);
        return applied;
      } catch (error) {
        return report(failure("REFRESH_FAILED", error?.message ?? "Refresh failed."), { key });
      }
    })().then(finish).finally(() => inFlight.delete(key));
    return pending;
  };
  const refreshCurrentRegion = (realmId) => runOnce(`region:${realmId}`, () => refreshRegion(realmId), (value) => {
    if (!value || (value.realmId !== undefined && Number(value.realmId) !== realmId)) {
      return failure("REFRESH_REALM_MISMATCH", `Refresh result did not belong to realm ${realmId}.`);
    }
    return success(cache.writeRegion(realmId, { ...value, realmId }));
  });

  async function check() {
    if (disposed) return [];
    const tasks = [];
    const time = now();
    if (refreshConstants && !isFresh(cache.state.constants, ttlMs, time)) {
      tasks.push(runOnce("constants", refreshConstants, (value) => success(cache.writeConstants(value))));
    }
    const realmResult = getRealmId();
    const realmId = normalizeRealmId(realmResult?.then ? await realmResult : realmResult);
    if (realmId !== null && refreshRegion) {
      const record = cache.state.regions[String(realmId)];
      const weatherUntil = Date.parse(record?.weatherUntil ?? record?.sellingSpeedMultiplier?.weatherUntil);
      const weatherIsStale = !Number.isFinite(weatherUntil) || time > weatherUntil;
      if (!isFresh(record, ttlMs, time) || weatherIsStale || hasCrossedBeijingRefreshCheckpoint(record?.timestamp, time)) {
        tasks.push(refreshCurrentRegion(realmId));
      }
    }
    return Promise.all(tasks);
  }

  return {
    check,
    refreshRegion(realmId) {
      const normalized = normalizeRealmId(realmId);
      if (!refreshRegion || normalized === null) {
        return Promise.resolve(failure("REFRESH_REALM_UNAVAILABLE", "A supported realm is required."));
      }
      return refreshCurrentRegion(normalized);
    },
    schedule(delayMs = 0) {
      if (disposed || timer !== undefined) return;
      timer = setTimeoutFn(() => {
        timer = undefined;
        void check();
      }, delayMs);
    },
    cleanup() {
      disposed = true;
      if (timer !== undefined) clearTimeoutFn(timer);
      timer = undefined;
    },
  };
}

module.exports = {
  BEIJING_OFFSET_MS,
  HOUR_MS,
  createTtlRefreshScheduler,
  hasCrossedBeijingRefreshCheckpoint,
};
