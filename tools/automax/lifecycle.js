const { isFresh, processBuildings, selectTrackedBuildings } = require("./data.js");
const { failure, success } = require("./result.js");

const HOUR_MS = 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * HOUR_MS;
const BUILDINGS_PATH = /^\/api\/v2\/companies\/me\/buildings\/?$/;
const WAREHOUSE_PATH = /^\/api\/v3\/resources\/?$/;
const AUTO_MAX_ROUTE_PATTERNS = Object.freeze({
  marketPage: /^https:\/\/www\.simcompanies\.com(?:\/[a-z-]+)?\/market\/resource\/(\d+)\/?$/,
  contractPage: /^https:\/\/www\.simcompanies\.com(?:\/[a-z-]+)?\/headquarters\/warehouse\/incoming-contracts\/?$/,
  outgoingContractPage: /^https:\/\/www\.simcompanies\.com(?:\/[a-z-]+)?\/headquarters\/warehouse\/[^/]+\/(?:sell|contract)\/?$/,
  executivePage: /\/executives\/([a-z0-9-]+)\/?$/,
  formerExecutivesPage: /\/headquarters\/executives\/?$/,
  buildingPage: /\/b\/\d+\/?$/,
  landscapePage: /\/landscape\/?$/,
});
const fetchInstallations = new WeakMap();
const routeMonitors = new WeakMap();

function requestUrl(input) {
  if (typeof input === "string") return input;
  if (typeof input?.url === "string") return input.url;
  if (typeof input?.href === "string") return input.href;
  return "";
}

function captureRoute(input, baseUrl = "https://www.simcompanies.com/") {
  const rawUrl = requestUrl(input);
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl, baseUrl);
    if (url.origin !== "https://www.simcompanies.com") return null;
    if (BUILDINGS_PATH.test(url.pathname)) return "buildings";
    if (WAREHOUSE_PATH.test(url.pathname)) return "warehouse";
  } catch {
    return null;
  }
  return null;
}

function isCaptureUrl(input, baseUrl) {
  return captureRoute(input, baseUrl) !== null;
}

function captureError(code, message) {
  return failure(code, message).error;
}

function normalizeRealmId(value) {
  if (value === null || value === undefined || value === "") return null;
  const realmId = Number(value);
  return realmId === 0 || realmId === 1 ? realmId : null;
}

function installFetchCapture({ target, onResponse, onError = () => {}, matchUrl = isCaptureUrl }) {
  if (!target || typeof target.fetch !== "function") throw new TypeError("A fetch-capable target is required.");
  if (typeof onResponse !== "function") throw new TypeError("A response capture handler is required.");

  let state = fetchInstallations.get(target);
  if (!state || target.fetch !== state.wrapper) {
    const original = target.fetch;
    state = { original, pending: new Set(), subscribers: new Map(), wrapper: null };
    state.wrapper = function (...args) {
      const fetchResult = Reflect.apply(original, this, args);
      return Promise.resolve(fetchResult).then((response) => {
        const subscribers = [...state.subscribers.values()].filter((subscriber) => subscriber.matchUrl(args[0]));
        if (subscribers.length === 0) return response;
        const context = { transport: "fetch", url: requestUrl(args[0]), status: response?.status };
        const task = (async () => {
          if (Number(response?.status) >= 400) {
            await Promise.all(subscribers.map(async (subscriber) => {
              try { await subscriber.onResponse(context); }
              catch (error) {
                subscriber.onError(captureError("CAPTURE_HANDLER_FAILED", error?.message ?? "Capture handler failed."), context);
              }
            }));
            return;
          }
          let data;
          try {
            data = await response.clone().json();
          } catch (error) {
            const reported = captureError("CAPTURE_JSON_INVALID", `Unable to parse captured JSON: ${error?.message ?? "unknown error"}`);
            subscribers.forEach((subscriber) => subscriber.onError(reported, context));
            return;
          }
          await Promise.all(subscribers.map(async (subscriber) => {
            try {
              await subscriber.onResponse({ ...context, data });
            } catch (error) {
              subscriber.onError(captureError("CAPTURE_HANDLER_FAILED", error?.message ?? "Capture handler failed."), context);
            }
          }));
        })();
        state.pending.add(task);
        task.then(() => state.pending.delete(task), () => state.pending.delete(task));
        return response;
      });
    };
    target.fetch = state.wrapper;
    fetchInstallations.set(target, state);
  }

  const current = state.subscribers.get(onResponse);
  if (current) current.references += 1;
  else state.subscribers.set(onResponse, { matchUrl, onError, onResponse, references: 1 });
  let cleaned = false;
  return {
    async flush() {
      while (state.pending.size > 0) await Promise.allSettled([...state.pending]);
    },
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      const subscriber = state.subscribers.get(onResponse);
      if (subscriber && --subscriber.references === 0) state.subscribers.delete(onResponse);
      if (state.subscribers.size === 0) {
        if (target.fetch === state.wrapper) target.fetch = state.original;
        fetchInstallations.delete(target);
      }
    },
  };
}

function createResponseCapture({
  cache,
  getRealmId,
  persist = async () => {},
  onAcademyChange = async () => {},
  onError = () => {},
  now = () => Date.now(),
}) {
  const reportError = (error, context) => {
    try { onError(error, context); } catch { }
    return failure(error.code, error.message);
  };
  const reject = (code, message, context) => reportError(captureError(code, message), context);

  async function captureResponse(context) {
    const kind = captureRoute(context.url);
    if (!kind) return success({ captured: false });
    if (!Number.isFinite(Number(context.status)) || Number(context.status) < 200 || Number(context.status) >= 400) {
      return reject("CAPTURE_HTTP_ERROR", `Captured ${kind} request returned HTTP ${context.status ?? "unknown"}.`, context);
    }
    if (!Array.isArray(context.data)) {
      return reject("CAPTURE_PAYLOAD_INVALID", `Captured ${kind} response was not an array.`, context);
    }
    const realmResult = getRealmId();
    const realmId = normalizeRealmId(realmResult?.then ? await realmResult : realmResult);
    if (realmId === null) {
      return reject("CAPTURE_REALM_UNAVAILABLE", "Unable to associate captured data with a supported realm.", context);
    }

    const capturedAt = new Date(now()).toISOString();
    if (kind === "buildings") {
      const existing = cache.state.regions[String(realmId)] ?? {};
      const previousAcademyActive = Number.isFinite(existing.academyActive) ? existing.academyActive : 0;
      const summary = processBuildings(context.data);
      cache.writeRegion(realmId, {
        realmId,
        academyActive: summary.active,
        academySlots: summary.slots,
        bankLevel: summary.bankLevel,
        buildings: selectTrackedBuildings(context.data),
        buildingsCapturedAt: capturedAt,
      });
      await persist(cache.state);
      if (previousAcademyActive !== summary.active) {
        try { await onAcademyChange(realmId, summary.active); }
        catch (error) {
          reportError(captureError("CAPTURE_REFRESH_FAILED", error?.message ?? "Region refresh failed."), context);
        }
      }
    } else {
      cache.writeWarehouseResources(realmId, context.data);
      cache.writeRegion(realmId, { realmId, warehouseCapturedAt: capturedAt });
      await persist(cache.state);
    }
    return success({ captured: true, kind, realmId });
  }

  async function capture(context) {
    try {
      return await captureResponse(context);
    } catch (error) {
      return reject("CAPTURE_FAILED", error?.message ?? "Response capture failed.", context);
    }
  }

  async function captureXhr({ url, method, responseText, status = 200 }) {
    const context = { transport: "xhr", url, method, status };
    if (!isCaptureUrl(url)) return success({ captured: false });
    if (Number(status) >= 400) return capture(context);
    try {
      return await capture({ ...context, data: JSON.parse(responseText) });
    } catch (error) {
      return reject("CAPTURE_JSON_INVALID", `Unable to parse captured JSON: ${error?.message ?? "unknown error"}`, context);
    }
  }

  return { capture, captureXhr, reportError };
}

function createXhrCaptureRegistration(responseCapture) {
  return {
    urlMatch: (url) => isCaptureUrl(url),
    func: (url, method, responseText) => responseCapture.captureXhr({ url, method, responseText, status: 200 }),
  };
}

function routeMatches(match, url) {
  if (typeof match === "function") return Boolean(match(url));
  if (match instanceof RegExp) {
    match.lastIndex = 0;
    return match.test(url);
  }
  return match === url;
}

function createRouteRegistry(initialRoutes = [], onError = () => {}) {
  const routes = new Map();
  const register = (route) => {
    const id = route.id ?? Symbol("route");
    routes.set(id, route);
    return () => routes.delete(id);
  };
  initialRoutes.forEach(register);
  return {
    register,
    dispatch(url) {
      const outputs = [];
      for (const route of routes.values()) {
        if (!routeMatches(route.match, url)) continue;
        try {
          const output = route.handler(url);
          if (output?.then) outputs.push(output.catch((error) => onError(error, { route: route.id, url })));
          else outputs.push(output);
        } catch (error) {
          onError(error, { route: route.id, url });
        }
      }
      return outputs;
    },
  };
}

function createRouteMonitor({ target, document, router, MutationObserverCtor = target?.MutationObserver }) {
  const existing = routeMonitors.get(target);
  if (existing) return existing;
  let lastUrl;
  let timer;
  let observer;
  let active = true;
  const check = (force = false) => {
    if (!active) return [];
    const url = target.location?.href ?? "";
    if (!force && url === lastUrl) return [];
    lastUrl = url;
    return router.dispatch(url);
  };
  const onRouteEvent = () => check();
  if (MutationObserverCtor && document) {
    observer = new MutationObserverCtor(onRouteEvent);
    observer.observe(document, { childList: true, subtree: true });
  }
  target.addEventListener?.("popstate", onRouteEvent);
  target.addEventListener?.("hashchange", onRouteEvent);
  const schedule = target.setTimeout?.bind(target) ?? setTimeout;
  const cancel = target.clearTimeout?.bind(target) ?? clearTimeout;
  timer = schedule(() => check(true), 0);

  const monitor = {
    check,
    cleanup() {
      if (!active) return;
      active = false;
      cancel(timer);
      observer?.disconnect();
      target.removeEventListener?.("popstate", onRouteEvent);
      target.removeEventListener?.("hashchange", onRouteEvent);
      routeMonitors.delete(target);
    },
  };
  routeMonitors.set(target, monitor);
  return monitor;
}

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

function getRealmIdFromDocument(document) {
  const linkMatch = document?.querySelector?.('a[href*="/company/"]')?.href?.match(/\/company\/(\d+)\//);
  if (linkMatch) return Number(linkMatch[1]);
  const logo = document?.querySelector?.('img[alt$="realm logo"]')?.src ?? "";
  if (logo.includes("Magnates")) return 0;
  if (logo.includes("Entrepeneurs") || logo.includes("Entrepreneurs")) return 1;
  return null;
}

module.exports = {
  AUTO_MAX_ROUTE_PATTERNS,
  BEIJING_OFFSET_MS,
  HOUR_MS,
  captureRoute,
  createResponseCapture,
  createRouteMonitor,
  createRouteRegistry,
  createTtlRefreshScheduler,
  createXhrCaptureRegistration,
  getRealmIdFromDocument,
  hasCrossedBeijingRefreshCheckpoint,
  installFetchCapture,
  isCaptureUrl,
};
