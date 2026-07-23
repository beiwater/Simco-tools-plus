// SPDX-License-Identifier: AGPL-3.0-or-later
const AUTO_MAX_ROUTE_PATTERNS = Object.freeze({
  marketPage: /^https:\/\/www\.simcompanies\.com(?:\/[a-z-]+)?\/market\/resource\/(\d+)\/?$/,
  contractPage: /^https:\/\/www\.simcompanies\.com(?:\/[a-z-]+)?\/headquarters\/warehouse\/incoming-contracts\/?$/,
  outgoingContractPage: /^https:\/\/www\.simcompanies\.com(?:\/[a-z-]+)?\/headquarters\/warehouse\/[^/]+\/(?:sell|contract)\/?$/,
  executivePage: /\/executives\/([a-z0-9-]+)\/?$/,
  formerExecutivesPage: /\/headquarters\/executives\/?$/,
  buildingPage: /\/b\/\d+\/?$/,
  landscapePage: /\/landscape\/?$/,
});

const routeMonitors = new WeakMap();

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

module.exports = { AUTO_MAX_ROUTE_PATTERNS, createRouteMonitor, createRouteRegistry };
