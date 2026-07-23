// SPDX-License-Identifier: AGPL-3.0-or-later
const { processBuildings, selectTrackedBuildings } = require("./data.js");
const { failure, success } = require("./result.js");

const BUILDINGS_PATH = /^\/api\/v2\/companies\/me\/buildings\/?$/;
const WAREHOUSE_PATH = /^\/api\/v3\/resources\/?$/;
const fetchInstallations = new WeakMap();

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
            try { await subscriber.onResponse({ ...context, data }); }
            catch (error) {
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
    try { return await captureResponse(context); }
    catch (error) {
      return reject("CAPTURE_FAILED", error?.message ?? "Response capture failed.", context);
    }
  }
  async function captureXhr({ url, method, responseText, status = 200 }) {
    const context = { transport: "xhr", url, method, status };
    if (!isCaptureUrl(url)) return success({ captured: false });
    if (Number(status) >= 400) return capture(context);
    try { return await capture({ ...context, data: JSON.parse(responseText) }); }
    catch (error) {
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

module.exports = {
  captureRoute,
  createResponseCapture,
  createXhrCaptureRegistration,
  installFetchCapture,
  isCaptureUrl,
  normalizeRealmId,
};
