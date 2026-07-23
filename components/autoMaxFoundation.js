// SPDX-License-Identifier: AGPL-3.0-or-later
const BaseComponent = require("../tools/baseComponent.js");
const { tools } = require("../tools/tools.js");
const {
  createAutoMaxCache,
  createRegionService,
  createRequestClient,
  createResponseCapture,
  createRouteMonitor,
  createRouteRegistry,
  createTtlRefreshScheduler,
  getRealmIdFromDocument,
  isCaptureUrl,
  installFetchCapture,
  parseConstantsBundle,
  failure,
} = require("../tools/automax/index.js");

class autoMaxFoundation extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax 数据基础服务";
    this.describe = "为 AutoMax 功能提供安全的数据捕获、页面路由与缓存刷新。";
    this.enable = false;
    this.canDisable = true;
    this.tagList = ["AutoMax", "基础"];
  }

  componentData = {
    lifecycle: undefined,
    responseCapture: undefined,
    router: undefined,
  }

  indexDBData = {
    cache: { regions: {} },
  }

  startupFuncList = [this.startLifecycle]

  netFuncList = [{
    urlMatch: (url) => isCaptureUrl(url),
    func: this.captureXhr,
  }]

  async refreshConstants(requestClient) {
    const source = document.querySelector(
      'script[type="module"][crossorigin][src^="https://www.simcompanies.com/static/bundle/assets/index-"][src$=".js"]'
    )?.src;
    if (!source) return failure("CONSTANTS_SOURCE_UNAVAILABLE", "The SimCompanies constants bundle was not found.");
    const response = await requestClient.requestText(source);
    return response.ok ? parseConstantsBundle(response.value) : response;
  }

  startLifecycle() {
    if (this.componentData.lifecycle) return this.componentData.lifecycle;
    const cacheSeed = this.indexDBData.cache && typeof this.indexDBData.cache === "object" && !Array.isArray(this.indexDBData.cache)
      ? this.indexDBData.cache
      : {};
    const cache = createAutoMaxCache(cacheSeed);
    this.indexDBData.cache = cache.state;
    const requestClient = createRequestClient({ fetchImpl: (...args) => window.fetch(...args) });
    const regionService = createRegionService({ requestJson: requestClient.requestJson });
    const persist = async () => {
      this.indexDBData.cache = cache.state;
      await tools.indexDB_updateIndexDBData();
    };
    const reportError = (error, context) => {
      tools.errorLog(`[AutoMax:${error?.code ?? "LIFECYCLE_ERROR"}] ${error?.message ?? String(error)}`, context?.url ?? context?.key ?? "");
    };
    const scheduler = createTtlRefreshScheduler({
      cache,
      getRealmId: () => getRealmIdFromDocument(document),
      refreshConstants: () => this.refreshConstants(requestClient),
      refreshRegion: (realmId) => regionService.fetchFullRegionData(
        cache.state.regions[String(realmId)]?.academyActive ?? 15
      ),
      persist,
      onError: reportError,
    });
    const responseCapture = createResponseCapture({
      cache,
      getRealmId: () => getRealmIdFromDocument(document),
      persist,
      onAcademyChange: (realmId) => scheduler.refreshRegion(realmId),
      onError: reportError,
    });
    const router = createRouteRegistry([], reportError);
    router.register({ id: "automax-refresh", match: () => true, handler: () => scheduler.check() });
    const fetchCapture = installFetchCapture({
      target: window,
      onResponse: responseCapture.capture,
      onError: responseCapture.reportError,
    });
    const routeMonitor = createRouteMonitor({ target: window, document, router });
    const cleanup = () => {
      fetchCapture.cleanup();
      routeMonitor.cleanup();
      scheduler.cleanup();
      window.removeEventListener("beforeunload", cleanup);
      this.componentData.responseCapture = undefined;
      this.componentData.router = undefined;
      this.componentData.lifecycle = undefined;
    };
    window.addEventListener("beforeunload", cleanup);

    this.componentData.responseCapture = responseCapture;
    this.componentData.router = router;
    this.componentData.lifecycle = { cache, cleanup, fetchCapture, routeMonitor, scheduler };
    return this.componentData.lifecycle;
  }

  captureXhr(url, method, responseText) {
    const capture = this.componentData.responseCapture;
    if (!capture) return;
    return capture.captureXhr({ url, method, responseText });
  }
}

new autoMaxFoundation();
