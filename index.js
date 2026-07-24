const { tools, componentList, runtimeData, indexDBData, feature_config } = require("./tools/tools.js");
require("./tools/baseComponent.js");
require("./components/basisCPT.js");

// 导入components文件夹下的所有JavaScript文件
const components = require.context('./components', true, /\.js$/);
components.keys().forEach(components);

// 初始化代码
const MAX_INIT_RETRIES = 3;
const pageWindow = tools.getPageWindow?.() ?? window;
const pendingNetworkEvents = [];
let requestCaptureInstalled = false;

function dispatchNetworkEvent(...args) {
  if (!tools.scriptLoadAcc) {
    pendingNetworkEvents.push(args);
    return;
  }
  tools.netEventBus(...args);
}

function flushPendingNetworkEvents() {
  while (pendingNetworkEvents.length > 0) tools.netEventBus(...pendingNetworkEvents.shift());
}

function installRequestCapture() {
  if (requestCaptureInstalled) return;
  requestCaptureInstalled = true;

  const OriginalXHR = pageWindow.XMLHttpRequest;
  if (typeof OriginalXHR === "function") {
    const originalAddEventListener = OriginalXHR.prototype.addEventListener;
    const originalOpen = OriginalXHR.prototype.open;
    const xhrCaptureState = new WeakMap();
    function SCTXMLHttpRequest(...args) {
      if (!new.target) throw new TypeError("XMLHttpRequest must be constructed with new.");
      const xhr = Reflect.construct(OriginalXHR, args, new.target);
      xhrCaptureState.set(xhr, { capturedRevision: 0, method: "", revision: 0, url: "" });
      Reflect.apply(originalAddEventListener, xhr, ["readystatechange", () => {
        const state = xhrCaptureState.get(xhr);
        if (!state || xhr.readyState !== 4 || state.capturedRevision === state.revision) return;
        state.capturedRevision = state.revision;
        if (xhr.status < 200 || xhr.status >= 400) return;
        try { dispatchNetworkEvent(state.url, state.method, xhr.responseText, xhr.status); }
        catch (error) { tools.errorLog(error); }
      }]);
      return xhr;
    }
    Object.setPrototypeOf(SCTXMLHttpRequest, OriginalXHR);
    SCTXMLHttpRequest.prototype = Object.create(OriginalXHR.prototype, {
      constructor: { configurable: true, value: SCTXMLHttpRequest, writable: true },
      open: {
        configurable: true,
        value(method, url, ...rest) {
          const normalizedUrl = String(url);
          const result = Reflect.apply(originalOpen, this, [method, normalizedUrl, ...rest]);
          const state = xhrCaptureState.get(this);
          if (state) {
            state.method = method;
            state.revision += 1;
            state.url = normalizedUrl;
          }
          return result;
        },
        writable: true,
      },
    });
    pageWindow.XMLHttpRequest = SCTXMLHttpRequest;
  }

  const originalFetch = pageWindow.fetch;
  if (typeof originalFetch === "function") {
    pageWindow.fetch = function (...args) {
      const response = Reflect.apply(originalFetch, this, args);
      return Promise.resolve(response).then((result) => {
        if (Number(result?.status) >= 200 && Number(result?.status) < 400) {
          const request = args[0];
          const url = typeof request === "string" || request instanceof URL
            ? String(request)
            : request?.url;
          const method = String(args[1]?.method ?? request?.method ?? "GET").toUpperCase();
          void result.clone().text()
            .then((text) => dispatchNetworkEvent(String(url ?? ""), method, text, result.status))
            .catch((error) => tools.errorLog("[SCT:FETCH_CAPTURE]", error));
        }
        return result;
      });
    };
  }
}

async function waitForRoot(timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (!document.querySelector("div#root")) {
    if (Date.now() - startedAt >= timeoutMs) throw new Error("SimCompanies root element was not found.");
    await tools.dely(100);
  }
}

async function scriptMainInit(retryCount = 0) {
  // 标记插件已加载
  if (pageWindow.SCTLoadFlag || document.querySelector("div#script_hover_node")) return;
  pageWindow.SCTLoadFlag = true;
  installRequestCapture();
  try {
    await waitForRoot();
    scriptEventStart();
  } catch (error) {
    tools.errorLog("[SCT:INIT]", error);
    if (retryCount >= MAX_INIT_RETRIES) {
      pageWindow.SCTLoadFlag = false;
      return;
    }
    await tools.dely(5000);
    pageWindow.SCTLoadFlag = false;
    return scriptMainInit(retryCount + 1);
  }
  // 版本显示
  console.log(sctData.version ? `当前Sim Companies little Tools插件版本：${sctData.version.join(".")}` : "未获取到版本号。");
  // 获取基础信息
  tools.checkWindowHorV(); // 窗口横纵
  tools.checkBrowser(); // 浏览器类型
  tools.checkIPArea(); // 获取用户网络地区
  // 格式化组件信息，形成函数列表
  for (const key in componentList) {
    let component = componentList[key];
    runtimeData[key] = component.componentData;
    indexDBData[key] = component.indexDBData;
    feature_config.componentSwitchList[key] = component.enable;
  }
  // 数据库操作
  await tools.indexDB_openDB();
  await tools.indexDB_updateUUID();
  await tools.indexDB_updateLoadCount();
  await tools.indexDB_loadFeatureConf();
  await tools.indexDB_loadIndexDBData();
  // Infrastructure components must remain active even when an older saved
  // configuration recorded their former default-disabled state.
  for (const key in componentList) {
    const component = componentList[key];
    if (!component.canDisable) {
      component.enable = true;
      feature_config.componentSwitchList[key] = true;
    }
  }
  // Legacy settings may have enabled an automated action before typed risk acknowledgement existed.
  // Keep those actions disabled until the user explicitly confirms in the component settings.
  for (const key in componentList) {
    const component = componentList[key];
    if (component.requiresRiskAcknowledgement && component.enable && !component.indexDBData?.riskAcknowledged) {
      component.enable = false;
      feature_config.componentSwitchList[key] = false;
    }
  }
  await tools.indexDB_loadLangData();
  await tools.indexDB_loadTapCount();
  // 组建依赖检查
  await tools.dependenceCheck();
  // 构建消息提示强显示
  tools.buildAlert();
  tools.buildConfirm();
  // 执行缩放比例
  tools.zoomRateApply();
  // 检查通知模式
  tools.msg_check();
  // 执行自启动函数 以及 挂载css
  for (const key in componentList) {
    if (!Object.hasOwnProperty.call(componentList, key) || (!componentList[key].enable && componentList[key].canDisable)) continue;
    let component = componentList[key];
    for (const func of component.startupFuncList) {
      try {
        await func.call(component, this);
      } catch (error) {
        tools.errorLog(`[${component.constructor.name}] 启动函数失败`, error);
      }
    }
    try {
      if (component.cssText) tools.CSSMount(component.constructor.name, component.cssText[tools.clientHorV] || component.cssText[0]);
    } catch (error) {
      tools.errorLog(`[${component.constructor.name}] CSS 挂载失败`, error);
    }
  }
  // 更新标记
  tools.scriptLoadAcc = true;
  flushPendingNetworkEvents();
}


// 事件监控
function scriptEventStart() {
  pageWindow.addEventListener("beforeunload", () => {
    if (!tools.noSaveClose) tools.indexDB_updateIndexDBData();
  });
  document.addEventListener("click", (event) => tools.eventBus(event));
  document.addEventListener("keydown", (event) => tools.eventBus(event));
  let rootObserveServer = new MutationObserver((mutation) => tools.mutationHandle(mutation));
  rootObserveServer.observe(document.querySelector("div#root"), { childList: true, subtree: true });
  setInterval(tools.intervalEventBus.bind(tools), 100);
}

scriptMainInit();
