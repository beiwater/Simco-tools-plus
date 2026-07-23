const { tools, componentList, runtimeData, indexDBData, feature_config } = require("./tools/tools.js");
require("./tools/baseComponent.js");
require("./components/basisCPT.js");

// 导入components文件夹下的所有JavaScript文件
const components = require.context('./components', true, /\.js$/);
components.keys().forEach(components);

// 初始化代码
const MAX_INIT_RETRIES = 3;

async function waitForRoot(timeoutMs = 15_000) {
  const startedAt = Date.now();
  while (!document.querySelector("div#root")) {
    if (Date.now() - startedAt >= timeoutMs) throw new Error("SimCompanies root element was not found.");
    await tools.dely(100);
  }
}

async function scriptMainInit(retryCount = 0) {
  // 标记插件已加载
  if (window.SCTLoadFlag || document.querySelector("div#script_hover_node")) return;
  window.SCTLoadFlag = true;
  try {
    await waitForRoot();
    scriptEventStart();
  } catch (error) {
    tools.errorLog("[SCT:INIT]", error);
    if (retryCount >= MAX_INIT_RETRIES) {
      window.SCTLoadFlag = false;
      return;
    }
    await tools.dely(5000);
    window.SCTLoadFlag = false;
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
}


// 事件监控
function scriptEventStart() {
  window.addEventListener("beforeunload", () => {
    if (!tools.noSaveClose) tools.indexDB_updateIndexDBData();
  });
  document.addEventListener("click", (event) => tools.eventBus(event));
  document.addEventListener("keydown", (event) => tools.eventBus(event));
  let rootObserveServer = new MutationObserver((mutation) => tools.mutationHandle(mutation));
  rootObserveServer.observe(document.querySelector("div#root"), { childList: true, subtree: true });
  setInterval(tools.intervalEventBus.bind(tools), 100);
  const OriginalXHR = window.XMLHttpRequest;
  window.XMLHttpRequest = function SCTXMLHttpRequest() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    let requestMethod = "";
    let requestUrl = "";
    xhr.open = function (method, url, ...rest) {
      requestMethod = method;
      requestUrl = String(url);
      return originalOpen.call(this, method, url, ...rest);
    };
    xhr.addEventListener("loadend", () => {
      if (xhr.status < 200 || xhr.status >= 400) return;
      try { tools.netEventBus(requestUrl, requestMethod, xhr.responseText, xhr.status); }
      catch (error) { tools.errorLog(error); }
    });
    return xhr;
  };
  Object.setPrototypeOf(window.XMLHttpRequest, OriginalXHR);
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;
}

scriptMainInit();
