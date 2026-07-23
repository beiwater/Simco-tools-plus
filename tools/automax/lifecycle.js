// SPDX-License-Identifier: AGPL-3.0-or-later
const {
  captureRoute,
  createResponseCapture,
  createXhrCaptureRegistration,
  installFetchCapture,
  isCaptureUrl,
} = require("./captureLifecycle.js");
const {
  AUTO_MAX_ROUTE_PATTERNS,
  createRouteMonitor,
  createRouteRegistry,
} = require("./routeMonitor.js");
const {
  BEIJING_OFFSET_MS,
  HOUR_MS,
  createTtlRefreshScheduler,
  hasCrossedBeijingRefreshCheckpoint,
} = require("./refreshScheduler.js");

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
