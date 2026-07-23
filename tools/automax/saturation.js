function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resourceByLetter(constantsResources = {}) {
  return Object.entries(constantsResources).reduce((result, [id, resource]) => {
    if (typeof resource?.dbLetter === "string" && resource.dbLetter) result[resource.dbLetter] = { id: Number(id), resource };
    return result;
  }, {});
}

function createSaturationRows(region, constantsResources, getResourceName = () => undefined) {
  const resources = resourceByLetter(constantsResources);
  if (!Array.isArray(region?.ResourcesRetailInfo)) return [];
  return region.ResourcesRetailInfo
    .filter((item) => item && typeof item.dbLetter === "string")
    .map((item) => {
      const match = resources[item.dbLetter];
      const resourceId = Number.isFinite(match?.id) ? match.id : null;
      const translated = resourceId === null ? undefined : getResourceName(resourceId);
      return {
        dbLetter: item.dbLetter,
        quality: finiteNumber(item.quality),
        resourceId,
        resourceName: translated || match?.resource?.name || item.dbLetter,
        saturation: finiteNumber(item.saturation),
      };
    });
}

function compareValue(left, right) {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  if (typeof left === "string" || typeof right === "string") return String(left).localeCompare(String(right), "zh-CN");
  return left - right;
}

function sortSaturationRows(rows, key = "resourceName", direction = "asc") {
  if (!Array.isArray(rows)) return [];
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const primary = compareValue(left?.[key], right?.[key]);
    if (primary !== 0) return primary * sign;
    return compareValue(left?.resourceName, right?.resourceName);
  });
}

function getWeatherMultiplier(region) {
  const value = finiteNumber(region?.sellingSpeedMultiplier?.sellingSpeedMultiplier ?? region?.sellingSpeedMultiplier);
  return value;
}

module.exports = {
  createSaturationRows,
  getWeatherMultiplier,
  resourceByLetter,
  sortSaturationRows,
};
