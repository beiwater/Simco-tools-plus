const { failure, success } = require("./result.js");

function createRequestClient({ fetchImpl = globalThis.fetch, retries = 3 } = {}) {
  async function request(url, responseType, retryCount = retries) {
    let lastError;
    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        if (typeof fetchImpl !== "function") throw new Error("Fetch is unavailable.");
        const response = await fetchImpl(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!response?.ok) throw new Error(`HTTP ${response?.status ?? "unknown"}`);
        const value = responseType === "json" ? await response.json() : await response.text();
        return success(value);
      } catch (error) {
        lastError = error;
      }
    }
    return failure("REQUEST_FAILED", `Request failed for ${url}: ${lastError?.message ?? "unknown error"}`);
  }

  return {
    requestJson: (url, retryCount) => request(url, "json", retryCount),
    requestText: (url, retryCount) => request(url, "text", retryCount),
  };
}

function processBuildings(buildings) {
  const summarize = (kind) => buildings
    .filter((building) => building?.kind === kind && !building.purchasedRecently)
    .reduce((result, building) => {
      const size = Number(building.size) || 0;
      const inactive = Boolean(building.busy) || building.position?.startsWith("l");
      result.active += inactive ? 0 : size;
      result.slots += building.busy?.expanding ? Math.max(0, size - 1) : size;
      return result;
    }, { active: 0, slots: 0 });

  if (!Array.isArray(buildings)) return { active: 0, slots: 0, bankLevel: 0 };
  const academy = summarize("y");
  const bank = summarize("n");
  return { active: academy.active, slots: academy.slots, bankLevel: bank.active };
}

function selectTrackedBuildings(buildings) {
  const positions = new Set([
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13",
    "B0", "B1", "B2", "B3",
  ]);
  if (!Array.isArray(buildings)) return [];
  return buildings
    .filter((building) => positions.has(building.position))
    .map(({ id, kind, size, position, robotsSpecialization }) => ({ id, kind, size, position, robotsSpecialization }));
}

function mergeRegionData(existing = {}, incoming = {}) {
  const merged = { ...existing, ...incoming };
  if (existing.academyLevels && !incoming.academyLevels) merged.academyLevels = existing.academyLevels;
  return merged;
}

function mergeWarehouseResources(existing = {}, warehouseResources) {
  return { ...existing, warehouseResources: Array.isArray(warehouseResources) ? warehouseResources : [] };
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isFresh(record, maxAgeMs, now) {
  const timestamp = parseTimestamp(record?.timestamp);
  return timestamp !== null && now - timestamp <= maxAgeMs;
}

function createAutoMaxCache(seed = {}, nowProvider = () => Date.now()) {
  const state = seed;
  state.regions ??= {};

  function writeRegion(realmId, incoming) {
    const key = String(realmId);
    state.regions[key] = mergeRegionData(state.regions[key], incoming);
    return state.regions[key];
  }

  return {
    state,
    readConstants(maxAgeMs) {
      return isFresh(state.constants, maxAgeMs, nowProvider()) ? state.constants : null;
    },
    readRegion(realmId, maxAgeMs) {
      const record = state.regions[String(realmId)];
      return isFresh(record, maxAgeMs, nowProvider()) ? record : null;
    },
    writeConstants(constants) {
      state.constants = { ...constants, timestamp: constants.timestamp ?? new Date(nowProvider()).toISOString() };
      return state.constants;
    },
    writeRegion,
    writeWarehouseResources(realmId, resources) {
      const existing = state.regions[String(realmId)] ?? {};
      state.regions[String(realmId)] = mergeWarehouseResources(existing, resources);
      return state.regions[String(realmId)];
    },
  };
}

function calculateExecutiveBonus(executives, academyActive = 15) {
  const skills = (Array.isArray(executives) ? executives : []).reduce((result, executive) => {
    const position = executive?.currentWorkHistory?.position;
    if (position) result[position] = executive.skills ?? {};
    return result;
  }, {});
  const skill = (position, name) => Number(skills[position]?.[name]) || 0;
  const cooApprentice = academyActive >= 5 ? skill("v", "coo") / 2 : 0;
  const cmoApprentice = academyActive >= 15 ? skill("y", "cmo") / 2 : 0;
  const taper = (value) => {
    let result = Math.floor(value);
    if (result > 80) result = 80 + Math.floor((result - 80) / 2);
    if (result > 60) result = 60 + Math.floor((result - 60) / 2);
    return result;
  };
  const adminBonus = taper(skill("o", "coo") + cooApprentice + (skill("f", "coo") + skill("m", "coo") + skill("t", "coo")) / 4);
  const saleBonus = Math.floor(taper(skill("m", "cmo") + cmoApprentice + (skill("o", "cmo") + skill("f", "cmo") + skill("t", "cmo")) / 4) / 3);
  return { adminBonus, saleBonus };
}

function createRegionService({ requestJson, now = () => new Date().toISOString() }) {
  async function getAuthInfo() {
    const result = await requestJson("https://www.simcompanies.com/api/v3/companies/auth-data/");
    if (!result.ok) return result;
    const data = result.value;
    return success({
      realmId: data.authCompany?.realmId,
      companyId: data.authCompany?.companyId,
      company: data.authCompany?.company,
      salesModifier: data.authCompany?.salesModifier,
      economyState: data.temporals?.economyState,
      acceleration: data.levelInfo?.acceleration?.multiplier,
    });
  }

  async function fetchFullRegionData(academyActive = 15) {
    const auth = await getAuthInfo();
    if (!auth.ok || auth.value.realmId === undefined || !auth.value.company) {
      return failure("REGION_AUTH_UNAVAILABLE", "Unable to determine the active region.");
    }
    const company = encodeURIComponent(auth.value.company.replace(/ /g, "-"));
    const [companyResult, executiveResult, retailResult, weatherResult] = await Promise.all([
      requestJson(`https://www.simcompanies.com/api/v3/companies-by-company/${auth.value.realmId}/${company}/`),
      requestJson("https://www.simcompanies.com/api/v3/companies/me/executives/"),
      requestJson(`https://www.simcompanies.com/api/v4/${auth.value.realmId}/resources-retail-info/`),
      requestJson(`https://www.simcompanies.com/api/v2/weather/${auth.value.realmId}/`),
    ]);
    if (![companyResult, executiveResult, retailResult].every((result) => result.ok)) {
      return failure("REGION_DATA_UNAVAILABLE", "Unable to load complete region data.");
    }
    const activeExecutives = (executiveResult.value.executives ?? []).filter((executive) => {
      const started = Date.parse(executive?.currentWorkHistory?.start);
      return executive?.currentWorkHistory && ["o", "f", "m", "t", "v", "y"].includes(executive.currentWorkHistory.position)
        && (!executive.strikeUntil || Date.parse(executive.strikeUntil) < Date.now())
        && started < Date.now() - 3 * 60 * 60 * 1000
        && !executive.currentTraining;
    });
    const weather = weatherResult.ok ? weatherResult.value : {};
    return success({
      ...auth.value,
      recreationBonus: companyResult.value.infrastructure?.recreationBonus,
      administration: companyResult.value.infrastructure?.administrationOverhead,
      ...calculateExecutiveBonus(activeExecutives, academyActive),
      ResourcesRetailInfo: (retailResult.value ?? []).map(({ quality, dbLetter, averagePrice, saturation }) => ({ quality, dbLetter, averagePrice, saturation })),
      sellingSpeedMultiplier: weather.sellingSpeedMultiplier ?? null,
      weatherUntil: weather.until ?? null,
      timestamp: now(),
    });
  }

  return { fetchFullRegionData, getAuthInfo };
}

module.exports = {
  calculateExecutiveBonus,
  createAutoMaxCache,
  createRegionService,
  createRequestClient,
  isFresh,
  mergeRegionData,
  mergeWarehouseResources,
  processBuildings,
  selectTrackedBuildings,
};
