// SPDX-License-Identifier: AGPL-3.0-or-later
const DEFAULT_RETAIL_CONFIGURATION = Object.freeze({
  profitPerBuildingLevel: 370,
  retailAdjustment: Object.freeze({ B: 2.28 }),
  storeWageAdjustment: 0,
});

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function administrationMultiplier(overhead, cooSkill) {
  const baseline = number(overhead, 1) || 1;
  return baseline - (baseline - 1) * number(cooSkill) / 100;
}

function modeledRetailData(retailInfo, economyState, dbLetter, quality) {
  const economy = retailInfo?.[economyState];
  const resource = economy?.[dbLetter];
  if (!resource) return undefined;
  if (quality === undefined || quality === null) return resource;
  return resource.quality?.[quality];
}

function retailProductionSeconds({
  buildingKind,
  constants,
  modeledData,
  quality,
  saturation,
  quantity,
  price,
  salesModifier,
  acceleration,
  size,
  weatherMultiplier,
  configuration = DEFAULT_RETAIL_CONFIGURATION,
}) {
  const modeled = modeledData;
  const modeledUnits = number(modeled?.modeledUnitsSoldAnHour);
  const productionCost = number(modeled?.modeledProductionCostPerUnit);
  if (!modeled || modeledUnits <= 0 || quantity <= 0 || price <= 0 || acceleration <= 0 || size <= 0) return null;
  const shortage = Math.min(Math.max(2 - number(saturation), 0), 2);
  const demandMultiplier = Math.max(0.9, shortage / 2 + 0.5);
  const qualityScale = number(quality) / 12;
  const adjustment = number(configuration.retailAdjustment?.[buildingKind], 1) || 1;
  const storeWages = number(modeled.modeledStoreWages);
  const growth = number(configuration.profitPerBuildingLevel, 370)
    * (number(modeled.buildingLevelsNeededPerUnitPerHour) * modeledUnits + 1)
    * adjustment
    * (shortage / 2 * (1 + qualityScale * number(constants?.RETAIL_MODELING_QUALITY_WEIGHT)))
    + storeWages * number(configuration.storeWageAdjustment);
  const modeledSales = modeledUnits * demandMultiplier;
  if (modeledSales <= 0 || price === productionCost) return null;
  const pricePoint = productionCost + (growth + storeWages) / modeledSales;
  const curve = (growth + pricePoint) / ((productionCost - pricePoint) ** 2);
  const adjusted = growth - ((price - pricePoint) ** 2) * curve;
  const rate = (quantity * ((price - productionCost) * 3600) - storeWages) / (adjusted + storeWages);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  let seconds = rate / acceleration / size;
  seconds -= seconds * number(salesModifier) / 100;
  if (number(weatherMultiplier) > 0) seconds /= number(weatherMultiplier);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function retailProfitAtPrice(input) {
  const quantity = number(input.quantity);
  const price = number(input.price);
  const cogs = number(input.cogs);
  const seconds = retailProductionSeconds({ ...input, quantity, price });
  if (!seconds || quantity <= 0 || price <= 0) return null;
  const wages = Math.ceil(seconds * number(input.wages) * number(input.acceleration, 1) * number(input.administration, 1) / 3600);
  const total = price * quantity - cogs - wages;
  return {
    price,
    seconds,
    wages,
    totalProfit: total,
    hourlyProfit: total / seconds * 3600 / Math.max(1, number(input.size, 1)),
  };
}

function priceStep(price) {
  if (price < 8) return 0.01;
  if (price < 2001) return 0.1;
  return 1;
}

function nextPrice(price) {
  const step = priceStep(price);
  const precision = step < 1 ? (step < 0.1 ? 100 : 10) : 1;
  return Math.round((price + step) * precision) / precision;
}

function boundedPriceSearch(input, { mode = "hourly", maxPrice, maxIterations = 50_000 } = {}) {
  const quantity = number(input.quantity);
  const cogs = number(input.cogs);
  if (quantity <= 0) return null;
  let price = Math.max(0.01, Math.floor(cogs / quantity) || 1);
  const ceiling = Math.max(price, number(maxPrice, Math.max(price * 4, price + 2000)));
  let best = null;
  let iterations = 0;
  while (price <= ceiling && iterations < maxIterations) {
    const result = retailProfitAtPrice({ ...input, price });
    const candidate = mode === "total" ? result?.totalProfit : result?.hourlyProfit;
    if (Number.isFinite(candidate) && (!best || candidate > best.value)) best = { ...result, value: candidate };
    price = nextPrice(price);
    iterations += 1;
  }
  return best ? { ...best, iterations, truncated: iterations >= maxIterations } : null;
}

function retailSearchWorkerSource() {
  return `self.onmessage = ({ data }) => {
    const number = (value, fallback = 0) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; };
    const nextPrice = (price) => {
      const step = price < 8 ? 0.01 : price < 2001 ? 0.1 : 1;
      const precision = step < 0.1 ? 100 : step < 1 ? 10 : 1;
      return Math.round((price + step) * precision) / precision;
    };
    const input = data.input || {};
    const settings = data.settings || {};
    const modeled = input.modeledData;
    const quantity = number(input.quantity);
    const cogs = number(input.cogs);
    const acceleration = number(input.acceleration, 1);
    const size = Math.max(1, number(input.size, 1));
    const modeledUnits = number(modeled?.modeledUnitsSoldAnHour);
    const productionCost = number(modeled?.modeledProductionCostPerUnit);
    if (!modeled || quantity <= 0 || modeledUnits <= 0 || acceleration <= 0) return self.postMessage(null);
    const shortage = Math.min(Math.max(2 - number(input.saturation), 0), 2);
    const demandMultiplier = Math.max(0.9, shortage / 2 + 0.5);
    const storeWages = number(modeled.modeledStoreWages);
    const adjustment = number(settings.retailAdjustment?.[input.buildingKind], 1) || 1;
    const growth = number(settings.profitPerBuildingLevel, 370)
      * (number(modeled.buildingLevelsNeededPerUnitPerHour) * modeledUnits + 1)
      * adjustment
      * (shortage / 2 * (1 + number(input.calculationQuality) / 12 * number(input.constants?.RETAIL_MODELING_QUALITY_WEIGHT)))
      + storeWages * number(settings.storeWageAdjustment);
    const modeledSales = modeledUnits * demandMultiplier;
    if (modeledSales <= 0) return self.postMessage(null);
    const pricePoint = productionCost + (growth + storeWages) / modeledSales;
    if (pricePoint === productionCost) return self.postMessage(null);
    const curve = (growth + pricePoint) / ((productionCost - pricePoint) ** 2);
    let price = Math.max(0.01, Math.floor(cogs / quantity) || 1);
    const ceiling = Math.max(price, number(data.maxPrice, Math.max(price * 4, price + 2000)));
    const maxIterations = Math.max(1, Math.min(50000, number(data.maxIterations, 50000)));
    let best = null;
    let iterations = 0;
    while (price <= ceiling && iterations < maxIterations) {
      const adjusted = growth - ((price - pricePoint) ** 2) * curve;
      const rate = (quantity * ((price - productionCost) * 3600) - storeWages) / (adjusted + storeWages);
      let seconds = rate / acceleration / size;
      seconds -= seconds * number(input.salesModifier) / 100;
      if (number(input.weatherMultiplier) > 0) seconds /= number(input.weatherMultiplier);
      if (Number.isFinite(seconds) && seconds > 0) {
        const wages = Math.ceil(seconds * number(input.wages) * acceleration * number(input.administration, 1) / 3600);
        const totalProfit = price * quantity - cogs - wages;
        const hourlyProfit = totalProfit / seconds * 3600 / size;
        const value = data.mode === "total" ? totalProfit : hourlyProfit;
        if (Number.isFinite(value) && (!best || value > best.value)) best = { price, seconds, wages, totalProfit, hourlyProfit, value };
      }
      price = nextPrice(price);
      iterations += 1;
    }
    self.postMessage(best ? { ...best, iterations, truncated: iterations >= maxIterations } : null);
  };`;
}

module.exports = {
  DEFAULT_RETAIL_CONFIGURATION,
  administrationMultiplier,
  boundedPriceSearch,
  modeledRetailData,
  nextPrice,
  priceStep,
  retailProductionSeconds,
  retailProfitAtPrice,
  retailSearchWorkerSource,
};
