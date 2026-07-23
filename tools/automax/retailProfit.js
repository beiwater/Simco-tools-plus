const DEFAULT_RETAIL_PROFIT_CONSTANTS = Object.freeze({
  profitPerBuildingLevel: 370,
  retailAdjustment: Object.freeze({ B: 2.28 }),
  storeWageAdjustment: 0,
  maxIterations: 50000,
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toFiniteNumber(value, fallback = undefined) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toPositiveNumber(value, fallback = undefined) {
  const number = toFiniteNumber(value);
  return number !== undefined && number > 0 ? number : fallback;
}

function getOwn(object, key) {
  if (!isRecord(object) || key === undefined || key === null) return undefined;
  return object[key] ?? object[String(key)];
}

function resolveResource(constants, resourceValue) {
  const raw = isRecord(resourceValue) ? resourceValue : {};
  const directId = toFiniteNumber(raw.id ?? raw.resourceId ?? (isRecord(resourceValue) ? undefined : resourceValue));
  const resources = constants?.constantsResources;
  const directResource = Number.isInteger(directId) ? getOwn(resources, directId) : undefined;
  const requestedDbLetter = raw.dbLetter ?? directResource?.dbLetter;
  const match = Object.entries(isRecord(resources) ? resources : {}).find(([, resource]) => (
    requestedDbLetter !== undefined && String(resource?.dbLetter) === String(requestedDbLetter)
  ));
  const resourceId = Number.isInteger(directId) ? directId : toFiniteNumber(match?.[0]);
  const fromConstants = directResource ?? match?.[1];
  const resource = isRecord(fromConstants) ? { ...fromConstants, ...raw } : raw;
  const dbLetter = resource.dbLetter ?? requestedDbLetter;
  if (dbLetter === undefined || dbLetter === null || dbLetter === "") return null;
  return { id: Number.isInteger(resourceId) ? resourceId : undefined, dbLetter, resource };
}

function resolveBuildingKind(constants, resourceId, fallback) {
  if (typeof fallback === "string" && fallback.length > 0) return fallback;
  const sales = constants?.data?.SALES;
  if (!isRecord(sales)) return undefined;
  return Object.entries(sales).find(([, resources]) => Array.isArray(resources) && resources.map(Number).includes(resourceId))?.[0];
}

function resolveSaturation(region, resourceId, dbLetter, quality) {
  const rows = Array.isArray(region?.ResourcesRetailInfo) ? region.ResourcesRetailInfo : [];
  const resourceRows = rows.filter((row) => (
    String(row?.dbLetter) === String(dbLetter)
    || (resourceId !== undefined && String(row?.dbLetter) === String(resourceId))
  ));
  if (resourceRows.length === 0) return undefined;
  const exactQuality = resourceRows.find((row) => Number(row?.quality) === quality);
  const defaultQuality = resourceRows.find((row) => Number(row?.quality) === 0);
  return toFiniteNumber((exactQuality ?? defaultQuality ?? resourceRows[0])?.saturation);
}

function administrationMultiplier(overhead, skillCOO) {
  const base = toPositiveNumber(overhead, 1);
  const skill = toFiniteNumber(skillCOO, 0);
  return base - (base - 1) * skill / 100;
}

function createRetailProfitInput({ constants, region, props, state, customUnitCost } = {}) {
  if (!isRecord(constants) || !isRecord(constants.data) || !isRecord(props) || !isRecord(state)) {
    return { ok: false, error: "AutoMax 基础数据或商店卡片数据尚未就绪。" };
  }
  const resolvedResource = resolveResource(constants, props.resource);
  if (!resolvedResource) return { ok: false, error: "无法识别当前商店物品。" };

  const quantity = toPositiveNumber(state.quantity);
  const originalCogs = toFiniteNumber(state.cogs);
  if (quantity === undefined || originalCogs === undefined || originalCogs < 0) {
    return { ok: false, error: "商品数量或成本无效。" };
  }

  const quality = toFiniteNumber(state.quality, 0);
  const forceQuality = props.forceQuality === undefined || props.forceQuality === null
    ? null
    : toFiniteNumber(props.forceQuality);
  if (forceQuality === undefined) return { ok: false, error: "强制品质数据无效。" };

  const resourceId = resolvedResource.id;
  const buildingKind = resolveBuildingKind(constants, resourceId, props.buildingKind);
  if (!buildingKind) return { ok: false, error: "该物品没有可用的零售模型。" };

  const acceleration = toPositiveNumber(props.acceleration, toPositiveNumber(region?.acceleration));
  const size = toPositiveNumber(props.size, 1);
  const economyState = toFiniteNumber(props.economyState, toFiniteNumber(region?.economyState));
  if (acceleration === undefined || economyState === undefined) {
    return { ok: false, error: "经济周期或加速倍率尚未就绪。" };
  }

  const propsSalesModifier = toFiniteNumber(props.salesModifierWithRecreationBonus);
  const salesModifier = propsSalesModifier === undefined
    ? toFiniteNumber(region?.salesModifier, 0) + toFiniteNumber(region?.recreationBonus, 0) + toFiniteNumber(region?.saleBonus, 0)
    : propsSalesModifier + Math.floor(toFiniteNumber(props.skillCMO, 0) / 3);
  const saturation = toFiniteNumber(props.saturation, resolveSaturation(region, resourceId, resolvedResource.dbLetter, quality));
  if (saturation === undefined) return { ok: false, error: "当前物品的零售饱和度尚未就绪。" };

  const salaryModifier = toPositiveNumber(constants.buildingsSalaryModifier?.[buildingKind], 1);
  const wages = toFiniteNumber(props.wages, toFiniteNumber(constants.data.AVERAGE_SALARY, 0) * salaryModifier);
  if (wages === undefined || wages < 0) return { ok: false, error: "商店工资数据无效。" };

  const overhead = toPositiveNumber(props.administrationOverhead, toPositiveNumber(region?.administration, 1));
  const administration = administrationMultiplier(overhead, toFiniteNumber(props.skillCOO, toFiniteNumber(region?.adminBonus, 0)));
  if (!Number.isFinite(administration) || administration < 0) return { ok: false, error: "行政加成数据无效。" };

  const retailSeason = resolvedResource.resource?.retailSeason;
  const propsWeatherMultiplier = toPositiveNumber(props.weather?.sellingSpeedMultiplier, toPositiveNumber(props.weather));
  const weatherMultiplier = retailSeason === "Summer" ? toPositiveNumber(
    propsWeatherMultiplier,
    toPositiveNumber(region?.sellingSpeedMultiplier),
  ) : null;
  if (retailSeason === "Summer" && weatherMultiplier === undefined) {
    return { ok: false, error: "夏季商品需要最新的天气销售速度数据。" };
  }

  const customCost = toFiniteNumber(customUnitCost, 0);
  return {
    ok: true,
    value: {
      retailInfo: constants.retailInfo,
      economyState,
      resourceId,
      retailDbLetter: resolvedResource.dbLetter,
      forceQuality,
      quality,
      quantity,
      cogs: customCost > 0 ? customCost * quantity : originalCogs,
      saturation,
      acceleration,
      size,
      salesModifier,
      wages,
      administration,
      buildingKind,
      weatherMultiplier: weatherMultiplier ?? null,
      retailModelingQualityWeight: toFiniteNumber(constants.data.RETAIL_MODELING_QUALITY_WEIGHT),
      profitPerBuildingLevel: DEFAULT_RETAIL_PROFIT_CONSTANTS.profitPerBuildingLevel,
      storeWageAdjustment: DEFAULT_RETAIL_PROFIT_CONSTANTS.storeWageAdjustment,
      retailAdjustment: DEFAULT_RETAIL_PROFIT_CONSTANTS.retailAdjustment,
      maxIterations: DEFAULT_RETAIL_PROFIT_CONSTANTS.maxIterations,
    },
  };
}

function retailPriceStep(price) {
  if (price < 8) return 0.01;
  if (price < 2001) return 0.1;
  return 1;
}

const RETAIL_PROFIT_WORKER_SOURCE = `
self.onmessage = function(event) {
  const input = event.data || {};
  const isObject = function(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); };
  const isLookup = function(value) { return Boolean(value) && typeof value === "object"; };
  const number = function(value) {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const getOwn = function(object, key) {
    if (!isLookup(object) || key === undefined || key === null) return undefined;
    return object[key] === undefined ? object[String(key)] : object[key];
  };
  const fail = function(error) { self.postMessage({ ok: false, error: error }); };

  try {
    const quantity = number(input.quantity);
    const cogs = number(input.cogs);
    const acceleration = number(input.acceleration);
    const size = number(input.size);
    const saturation = number(input.saturation);
    const salesModifier = number(input.salesModifier);
    const wages = number(input.wages);
    const administration = number(input.administration);
    const quality = number(input.quality);
    const qualityWeight = number(input.retailModelingQualityWeight);
    const profitPerBuildingLevel = number(input.profitPerBuildingLevel);
    const storeWageAdjustment = number(input.storeWageAdjustment);
    if (!(quantity > 0) || cogs === undefined || cogs < 0 || !(acceleration > 0) || !(size > 0) || saturation === undefined || salesModifier === undefined || wages === undefined || wages < 0 || administration === undefined || administration < 0 || quality === undefined || qualityWeight === undefined || profitPerBuildingLevel === undefined || storeWageAdjustment === undefined) {
      fail("零售计算参数不完整。");
      return;
    }

    const economy = getOwn(input.retailInfo, input.economyState);
    const resource = getOwn(economy, input.retailDbLetter);
    const forcedQuality = input.forceQuality === null || input.forceQuality === undefined ? null : number(input.forceQuality);
    const modeledData = forcedQuality === null
      ? resource
      : getOwn(resource && resource.quality, forcedQuality);
    if (!isObject(modeledData)) {
      fail("未找到当前经济周期和物品品质的零售模型。");
      return;
    }

    const buildingLevelsNeededPerUnitPerHour = number(modeledData.buildingLevelsNeededPerUnitPerHour);
    const modeledUnitsSoldAnHour = number(modeledData.modeledUnitsSoldAnHour);
    const modeledProductionCostPerUnit = number(modeledData.modeledProductionCostPerUnit);
    const modeledStoreWages = number(modeledData.modeledStoreWages) || 0;
    if (buildingLevelsNeededPerUnitPerHour === undefined || !(modeledUnitsSoldAnHour > 0) || modeledProductionCostPerUnit === undefined) {
      fail("零售模型字段不完整。");
      return;
    }

    const retailAdjustment = isObject(input.retailAdjustment) ? input.retailAdjustment : {};
    const buildingAdjustment = number(retailAdjustment[input.buildingKind]);
    const adjustment = buildingAdjustment === undefined ? 1 : buildingAdjustment;
    const weatherMultiplier = input.weatherMultiplier === null || input.weatherMultiplier === undefined ? null : number(input.weatherMultiplier);
    if (weatherMultiplier !== null && !(weatherMultiplier > 0)) {
      fail("天气销售速度数据无效。");
      return;
    }

    const calculateSeconds = function(price) {
      const saturationRoom = Math.min(Math.max(2 - saturation, 0), 2);
      const salesRate = Math.max(0.9, saturationRoom / 2 + 0.5);
      const qualityFactor = (forcedQuality === null ? quality : 0) / 12;
      const fixedCost = profitPerBuildingLevel
        * (buildingLevelsNeededPerUnitPerHour * modeledUnitsSoldAnHour + 1)
        * adjustment
        * (saturationRoom / 2 * (1 + qualityFactor * qualityWeight))
        + modeledStoreWages * storeWageAdjustment;
      const unitsSold = modeledUnitsSoldAnHour * salesRate;
      if (!(unitsSold > 0)) return NaN;
      const breakEvenPrice = modeledProductionCostPerUnit + (fixedCost + modeledStoreWages) / unitsSold;
      const denominator = (breakEvenPrice - modeledProductionCostPerUnit) * (breakEvenPrice - modeledProductionCostPerUnit);
      if (!(denominator > 0)) return NaN;
      const curveValue = fixedCost - (price - breakEvenPrice) * (price - breakEvenPrice) * ((modeledStoreWages + fixedCost) / denominator);
      const rate = (quantity * ((price - modeledProductionCostPerUnit) * 3600) - modeledStoreWages) / (curveValue + modeledStoreWages);
      if (!(rate > 0) || !Number.isFinite(rate)) return NaN;
      let seconds = rate / acceleration / size;
      seconds = seconds - seconds * salesModifier / 100;
      if (weatherMultiplier !== null) seconds /= weatherMultiplier;
      return Number.isFinite(seconds) ? seconds : NaN;
    };

    let currentPrice = Math.floor(cogs / quantity) || 1;
    let bestPrice = currentPrice;
    let maxProfit = -Infinity;
    const maxIterations = Math.max(1, Math.floor(number(input.maxIterations) || 50000));
    let iterations = 0;
    while (currentPrice > 0 && iterations < maxIterations) {
      const secondsToFinish = calculateSeconds(currentPrice);
      if (!(secondsToFinish > 0)) break;
      const wagesTotal = Math.ceil(secondsToFinish * wages * acceleration * administration / 3600);
      const totalProfit = currentPrice * quantity - cogs - wagesTotal;
      const profit = input.calcMode === "total" ? totalProfit : totalProfit / secondsToFinish;
      if (Number.isFinite(profit) && profit > maxProfit) {
        maxProfit = profit;
        bestPrice = currentPrice;
      }
      if (currentPrice < 8) currentPrice = Math.round((currentPrice + 0.01) * 100) / 100;
      else if (currentPrice < 2001) currentPrice = Math.round((currentPrice + 0.1) * 10) / 10;
      else currentPrice = Math.round(currentPrice + 1);
      iterations += 1;
    }

    if (!Number.isFinite(maxProfit)) {
      fail("未找到可售的价格区间。");
      return;
    }
    if (iterations >= maxIterations && !Number.isFinite(maxProfit)) {
      fail("价格扫描超过安全上限，请减少成本或手动设定价格。");
      return;
    }

    const finalW = calculateSeconds(bestPrice);
    if (!(finalW > 0)) {
      fail("最优价格的销售时间无效。");
      return;
    }
    const calculatedWages = Math.ceil(finalW * wages * acceleration * administration / 3600);
    self.postMessage({
      ok: true,
      bestPrice: bestPrice,
      maxProfit: maxProfit,
      calculatedWages: calculatedWages,
      finalTotalProfit: bestPrice * quantity - cogs - calculatedWages,
      finalW: finalW,
      size: size,
      iterations: iterations,
    });
  } catch (error) {
    fail(error && error.message ? error.message : "零售计算失败。");
  }
};
`;

module.exports = {
  DEFAULT_RETAIL_PROFIT_CONSTANTS,
  RETAIL_PROFIT_WORKER_SOURCE,
  administrationMultiplier,
  createRetailProfitInput,
  resolveBuildingKind,
  resolveResource,
  resolveSaturation,
  retailPriceStep,
};
