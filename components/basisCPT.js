const BaseComponent = require("../tools/baseComponent.js");
const { tools, componentList, runtimeData, indexDBData, feature_config, langData } = require("../tools/tools.js");
const { closeSecondaryWindow, ensureSecondaryWindow, openSecondaryWindow } = require("../tools/secondaryWindowHost.js");

const TAG_ORDER = ["AutoMax", "交易", "仓库", "聊天", "工具", "外观"];
const TAG_GROUPS = Object.freeze({
  AutoMax: "AutoMax",
  "交易所": "交易", "询价": "交易", "合同": "交易", MP: "交易", "利润": "交易",
  "仓库": "仓库", "入库": "仓库", "出库": "仓库", "物资": "仓库", "物品": "仓库", ID: "仓库", "零售": "仓库", "建筑": "仓库",
  "聊天": "聊天", "备注": "聊天", "信息": "聊天",
  "样式": "外观", "个性化": "外观",
});

function normalizedTags(component) {
  const tags = new Set();
  for (const tag of component.tagList ?? []) tags.add(TAG_GROUPS[tag] ?? "工具");
  return TAG_ORDER.filter((tag) => tags.has(tag));
}

const RISK_ACKNOWLEDGEMENT = "我已知晓风险自担";

function requestRiskAcknowledgement(component) {
  const featureName = component.name || "该功能";
  const notice = component.riskNotice || "该功能会自动触发游戏页面操作。";
  const typed = window.prompt(
    `高风险自动化功能：${featureName}\n\n${notice}\n\n本插件与游戏开发者无关联，也不代表获得游戏开发者的许可；游戏规则、许可范围和账号处置均以游戏开发者为准。继续使用即表示你自行承担全部风险和后果。\n\n如仍要启用，请手动完整输入：${RISK_ACKNOWLEDGEMENT}`,
    ""
  );
  return typed === RISK_ACKNOWLEDGEMENT;
}

const SETTINGS_WINDOW_THEME = `
  #script_cpt_setting_container {
    background: linear-gradient(145deg, var(--sct-surface-elevated, rgba(26, 32, 29, 0.96)), var(--sct-surface, rgba(15, 19, 17, 0.96)) 58%) !important;
    border: 1px solid var(--sct-border-strong, rgba(255, 255, 255, 0.24));
    border-radius: 12px;
    box-shadow: var(--sct-panel-shadow, 0 24px 64px rgba(0, 0, 0, 0.55), 0 2px 12px rgba(0, 0, 0, 0.28));
    box-sizing: border-box;
    max-height: min(84dvh, 760px);
    max-width: calc(100vw - 16px);
    min-width: min(435px, calc(100vw - 16px));
    overflow: hidden;
    padding: 16px;
    width: min(680px, calc(100vw - 16px));
  }
  #script_setting_head {
    align-items: center;
    background: var(--sct-surface-opaque, #0f1311);
    border-bottom: 1px solid var(--sct-border, rgba(255, 255, 255, 0.14));
    cursor: grab;
    display: flex;
    font-size: 20px;
    font-weight: 700;
    justify-content: space-between;
    line-height: 1.25;
    margin: -16px -16px 16px;
    max-height: none;
    min-height: 56px;
    padding: 10px 16px;
    touch-action: none;
    user-select: none;
  }
  #script_cpt_setting_container[data-sct-dragging="true"] #script_setting_head { cursor: grabbing; }
  #script_setting_head > span { font-size: inherit !important; left: auto !important; position: static !important; }
  #script_setting_head > button {
    background: var(--sct-control, rgba(255, 255, 255, 0.08)) !important;
    border: 1px solid var(--sct-border, rgba(255, 255, 255, 0.14));
    border-radius: 8px;
    color: var(--fontColor);
    cursor: pointer;
    height: 36px !important;
    line-height: normal !important;
    min-width: 60px;
    position: static !important;
  }
  #script_setting_head > button:hover { background: var(--sct-control-hover, rgba(255, 255, 255, 0.15)) !important; }
  #script_setting_body { box-sizing: border-box; max-height: calc(min(84dvh, 760px) - 88px); overflow: auto; padding: 0; scrollbar-color: var(--sct-control-hover, rgba(255, 255, 255, 0.15)) transparent; }
  #script_setting_body .setting-container .header { background: transparent; color: var(--fontColor); font-size: 18px; text-align: left; }
  #script_setting_body .setting-container :is(button, input, select, textarea) { border: 1px solid var(--sct-border, rgba(255, 255, 255, 0.14)); border-radius: 8px; }
  @media (max-width: 576px) {
    #script_cpt_setting_container { max-height: calc(100dvh - 16px); min-width: 0; padding: 12px; width: calc(100vw - 16px); }
    #script_setting_head { margin: -12px -12px 12px; padding: 10px 12px; }
    #script_setting_body { max-height: calc(100dvh - 84px); }
  }
`;

function mountSettingsWindowTheme() {
  if (document.getElementById("script_cpt_setting_theme")) return;
  const style = document.createElement("style");
  style.id = "script_cpt_setting_theme";
  style.textContent = SETTINGS_WINDOW_THEME;
  document.head.append(style);
}

// 基础组件
class basisCPT extends BaseComponent {
  constructor() {
    super();
    this.name = "插件基础功能";
    this.describe = "包含了图形界面挂载，设置界面挂载等基础功能，不支持关闭";
    this.enable = true;
    this.canDisable = false; // 不允许关闭
    this.tapCount = Infinity; // 置顶
    this.tagList = ["后台", "基础"];
  }
  // css定义
  cssText = [
    `
    /* ------------------------------ 悬浮节点样式 ------------------------------ */
    /* 脚本悬浮节点基础样式 */
    div#script_hover_node {
        width: fit-content;
        height: fit-content;
        position: fixed;
        bottom: -85px;
        right: 10px;
        background: rgb(0, 0, 0, 0.5);
        z-index: 1050;
        transition: ease-in 0.25s;
        padding: 5px;
        border-radius: 5px;
        color: var(--fontColor);
    }

    /* 鼠标悬停时悬浮节点的样式 */
    div#script_hover_node:hover {
        bottom: 10px;
        right: 10px;
    }

    /* 悬浮节点内子元素的样式 */
    div#script_hover_node>div {
        margin-bottom: 5px;
    }

    /* 悬浮节点内 span 元素的样式 */
    div#script_hover_node span {
        display: block;
        height: 35px;
        line-height: 35px;
        width: 100%;
        text-align: center;
        transition: ease-in 0.25s;
        color: var(--fontColor);
        border-radius: 5px;
    }

    /* 鼠标悬停时悬浮节点内 span 元素的样式 */
    div#script_hover_node span:hover {
        background-color: rgb(255, 255, 255) !important;
        color: black !important;
    }

    /* 悬浮节点内按钮的基础样式 */
    div#script_hover_node button {
        background-color: rgb(54, 54, 54);
        color: var(--fontColor);
    }

    /* 鼠标悬停时悬浮节点内按钮的样式 */
    div#script_hover_node button:hover {
        background-color: rgb(114, 114, 114);
        font-weight: 700;
    }

    /* 水平排列的悬浮节点样式 */
    div#script_hover_node.horizontal {
        display: flex;
        width: 200px;
        justify-content: center;
        bottom: 10px;
        right: -140px;
    }

    /* 鼠标悬停时水平排列的悬浮节点样式 */
    div#script_hover_node.horizontal:hover {
        right: 10px;
    }

    /* 水平排列的悬浮节点内子元素的样式 */
    div#script_hover_node.horizontal>div {
        margin: 0 5px;
        flex: 1;
    }

    /* 固定显示的悬浮节点样式 */
    div#script_hover_node.fixedDisplay {
        bottom: 10px;
        right: 10px;
    }

    /* ------------------------------ 基础容器样式 ------------------------------ */
    /* 脚本基础容器样式 */
    div.script_base_container {
        min-width: 450px;
        overflow-y: auto;
        overflow-x: hidden;
        position: fixed;
        top: 0px;
        right: -150%;
        display: block;
        width: 35%;
        height: 100%;
        background-color: rgb(0, 0, 0, 0.7);
        padding: 10px;
        z-index: 1049;
        transition: ease-in-out 0.25s;
        color: var(--fontColor);
    }

    /* ------------------------------ 消息和组件节点表格样式 ------------------------------ */
    /* 消息节点和组件节点内表格的样式 */
    div#script_msg_node table,
    div#script_cpt_node table {
        border-collapse: separate;
        border-spacing: 10px;
    }

    /* 消息节点和组件节点内表格行的垂直对齐方式 */
    div#script_msg_node table>tbody>tr,
    div#script_cpt_node table>tbody>tr {
        vertical-align: top;
    }

    /* 组件节点内表格宽度 */
    div#script_cpt_node table {
        width: 100%
    }

    /* 消息节点内表格第一列样式 */
    div#script_msg_node table>tbody>tr>td:nth-child(1) {
        width: 70px;
        max-width: 70px;
        text-align: center;
    }

    /* 消息节点内表格表头单元格样式 */
    div#script_msg_node table>thead>tr>td {
        text-align: center;
    }

    /* 组件节点内表格第二列样式 */
    div#script_cpt_node table>tbody>tr>td:nth-child(2) {
        width: 70px;
        text-align: center;
    }

    /* 组件节点内表格单元格内按钮基础样式 */
    div#script_cpt_node table>tbody>tr>td>button {
        transition: ease-in-out 0.1s;
        max-width: 300px;
        background-color: rgb(114, 114, 114);
    }

    /* 鼠标悬停时组件节点内表格单元格内按钮的样式 */
    div#script_cpt_node table>tbody>tr>td>button:hover {
        color: black;
        background-color: #ffffff;
        box-shadow: 0 0 10px 3px wheat;
    }

    /* ------------------------------ 组件设置容器样式 ------------------------------ */
    /* 组件设置容器基础样式 */
    #script_cpt_setting_container {
        max-width: 60%;
        min-width: 435px;
        color: var(--fontColor);
        display: none;
        box-shadow: 0 0 3px 1px rgb(0, 0, 0, 0.5);
        border-radius: 10px;
        padding: 10px;
        position: fixed;
        transform: translateX(-50%) translateY(-50%);
        top: 50%;
        left: 50%;
        background-color: rgb(0, 0, 0, 0.9);
        z-index: 1051;
    }

    /* 组件设置头部样式 */
    #script_setting_head {
        width: 100%;
        margin-bottom: 10px;
        max-height: 26px;
        line-height: 26px;
        height: 26px;
    }

    /* 组件设置头部内 span 元素样式 */
    #script_setting_head>div>span {
        position: relative;
        font-size: 21px;
        left: -10px;
        display: block;
    }

    /* 组件设置头部第二个子元素样式 */
    #script_setting_head>div:nth-child(2) {
        text-align: end;
    }

    /* 组件设置头部内按钮样式 */
    #script_setting_head>div>button {
        background-color: red;
        right: 0;
        position: relative;
        text-align: center;
        height: 26px;
        line-height: 16px;
    }

    /* 组件设置主体样式 */
    #script_setting_body {
        padding: 5px;
        width: 100%;
        max-height: 400px;
        overflow-y: auto;
        overflow-x: hidden;
    }

    /* ------------------------------ 设置容器样式 ------------------------------ */
    /* 设置容器基础样式 */
    div.setting-container {
        color: var(--fontColor);
    }

    /* 设置容器内按钮、输入框和选择框基础样式 */
    div.setting-container button,
    div.setting-container input,
    div.setting-container select {
        transition: ease-in-out 0.1s;
        background-color: rgb(76, 76, 76);
        color: var(--fontColor);
    }

    /* 设置容器内头部样式 */
    div.setting-container div.header {
        background-color: rgb(0, 0, 0);
        text-align: center;
        font-size: 20px;
        font-weight: 700;
    }

    /* 设置容器内内容区域样式 */
    div.setting-container div.container {
        width: 100%;
        display: block;
        margin-top: 10px;
        margin-bottom: 10px;
    }

    /* 设置容器内表格样式 */
    div.setting-container div.container>table,
    div.setting-container div.container>div>table {
        border-collapse: separate;
        border-spacing: 10px;
        text-align: center;
        width: 100%;
        height: 100%;
    }

    /* 设置容器内提交按钮样式 */
    div.setting-container button.script_opt_submit {
        width: 80%;
        height: 49px;
        margin: auto;
        display: block;
        font-size: 20px;
        transition: ease-in-out 0.1s;
    }

    /* 设置容器内表格表头行高度 */
    div.setting-container div>table>thead>tr {
        height: 50px;
    }

    /* 鼠标悬停时设置容器内按钮的样式 */
    div.setting-container button:hover {
        color: black;
        background-color: #ffffff;
        box-shadow: 0 0 10px 3px wheat;
    }

    /* ------------------------------ 组件节点相关样式 ------------------------------ */
    /* 组件节点主体伪元素样式 */
    div#script_cpt_node>div#scriptCPT_mainBody::after {
        content: "";
        display: block;
        height: 50px;
    }

    /* 存在功能的组件按钮基础样式 */
    div#script_cpt_node table>tbody>tr>td>button.funcExist {
        background-color: green;
    }

    /* 鼠标悬停时存在功能的组件按钮样式 */
    div#script_cpt_node table>tbody>tr>td>button.funcExist:hover {
        background-color: #ffffff;
    }

    /* 鼠标悬停时组件主体表格行的样式 */
    div#scriptCPT_mainBody tbody>tr:hover {
        background-color: rgb(255, 255, 255, 0.1);
    }

    /* 组件搜索输入框样式 */
    #script_cptSearch_input {
        background: rgb(0, 0, 0, 0.8);
        color: var(--fontColor);
    }

    /* 组件标签搜索区域样式 */
    div#script_cpt_node>div#scriptCPT_tagSerach {
        padding: 10px;
        margin-top: 10px;
    }

    /* 组件标签搜索区域内标签样式 */
    div#script_cpt_node>div#scriptCPT_tagSerach>span {
        display: inline-block;
        width: max-content;
        height: fit-content;
        background-color: #000000;
        border: 2px white solid;
        padding: 2px 10px;
        border-radius: 10px;
        cursor: pointer;
        margin: 4px 5px;
    }

    /* 鼠标悬停时组件标签搜索区域内标签的样式 */
    div#script_cpt_node>div#scriptCPT_tagSerach>span:hover {
        background-color: #339841 !important;
    }

    /* 激活状态的组件标签搜索区域内标签样式 */
    div#script_cpt_node>div#scriptCPT_tagSerach>span.script_tagSearch_active {
        background-color: #14541d;
    }

    /* 组件主体表格表头第二列样式 */
    div#scriptCPT_mainBody>table>thead>tr>td:nth-of-type(2) {
        text-align: center;
    }

    /* 表格行内复选框高度 */
    tbody>tr>td>input[type='checkbox'] {
        height: 20px;
    }
    `,
    `div#script_hover_node{width:fit-content;height:fit-content;position:fixed;bottom:-95px;right:-20px;background:rgb(0,0,0,0.5);z-index:1050;transition:ease-in 0.25s;padding:5px;border-radius:5px;color:var(--fontColor);}div#script_hover_node:hover{bottom:10px;right:10px;}div#script_hover_node>div{margin-bottom:5px;}div#script_hover_node span{display:block;height:35px;line-height:35px;width:100%;text-align:center;transition:ease-in 0.25s;color:var(--fontColor);border-radius:5px;}div#script_hover_node span:hover{background-color:rgb(255,255,255) !important;color:black !important;}div#script_hover_node button{background-color:rgb(54,54,54);color:var(--fontColor);}div#script_hover_node button:hover{background-color:rgb(114,114,114);font-weight:700;}div#script_hover_node.horizontal{display:flex;width:200px;justify-content:center;bottom:10px;right:-140px;}div#script_hover_node.horizontal:hover{right:10px;}div#script_hover_node.horizontal>div{margin:0 5px;flex:1;}div#script_hover_node.fixedDisplay{bottom:10px;right:10px;}div.script_base_container{width:100%;height:100%;overflow-y:auto;overflow-x:hidden;position:fixed;top:0px;right:-150%;display:block;background-color:rgb(0,0,0,0.7);padding:10px;z-index:1049;transition:ease-in-out 0.25s;color:var(--fontColor);}div#script_msg_node table,div#script_cpt_node table{border-collapse:separate;border-spacing:10px;}div#script_msg_node table>tbody>tr,div#script_cpt_node table>tbody>tr{vertical-align:top;}div#script_msg_node table>tbody>tr>td:nth-child(1){width:70px;max-width:70px;text-align:center;}div#script_cpt_node table{width:100%}div#script_cpt_node table>thead>tr>td{text-align:center;}div#script_cpt_node table>tbody>tr>td:nth-child(2){width:70px;text-align:center;}div#script_cpt_node table>tbody>tr>td>button{transition:ease-in-out 0.1s;max-width:300px;background-color:rgb(114,114,114);}div#script_cpt_node table>tbody>tr>td>button:hover{color:black;background-color:#ffffff;box-shadow:0 0 10px 3px wheat;}#script_cpt_setting_container{width:95%;min-width:300px;color:var(--fontColor);display:none;box-shadow:0 0 3px 1px rgb(0,0,0,0.5);border-radius:10px;padding:5px;position:fixed;transform:translateX(-50%) translateY(-50%);top:50%;left:50%;background-color:rgb(0,0,0,0.9);z-index:1051;}#script_setting_head{width:100%;margin-bottom:10px;max-height:26px;line-height:26px;height:26px;}#script_setting_head>div>span{position:relative;font-size:21px;left:-10px;display:block;}#script_setting_head>div:nth-child(2){text-align:end;}#script_setting_head>div>button{background-color:red;right:0;position:relative;text-align:center;height:26px;line-height:16px;}#script_setting_body{padding:5px;width:100%;max-height:400px;overflow-y:auto;overflow-x:hidden;}div.setting-container{color:var(--fontColor);}div.setting-container button,div.setting-container input,div.setting-container select{transition:ease-in-out 0.1s;background-color:rgb(76,76,76);color:var(--fontColor);}div.setting-container div.header{background-color:rgb(0,0,0);text-align:center;font-size:20px;font-weight:700;}div.setting-container div.container{width:100%;display:block;margin-top:10px;margin-bottom:10px;}div.setting-container div.container>table,div.setting-container div.container>div>table{border-collapse:separate;border-spacing:10px;text-align:center;width:100%;height:100%;}div.setting-container button.script_opt_submit{width:80%;height:49px;margin:auto;display:block;font-size:20px;transition:ease-in-out 0.1s;}div.setting-container div>table>thead>tr{height:50px;}div.setting-container button:hover{color:black;background-color:#ffffff;box-shadow:0 0 10px 3px wheat;}div#script_cpt_node>div#scriptCPT_mainBody::after{content:"";display:block;height:50px;}div#script_cpt_node table>tbody>tr>td>button.funcExist{background-color:green;}div#script_cpt_node table>tbody>tr>td>button.funcExist:hover{background-color:#ffffff;}div#scriptCPT_mainBody tbody>tr:hover{background-color:rgb(255,255,255,0.1);}#script_cptSearch_input{background:rgb(0,0,0,0.8);color:var(--fontColor);}div#script_cpt_node>div#scriptCPT_tagSerach{padding:10px;margin-top:10px;}div#script_cpt_node>div#scriptCPT_tagSerach>span{display:inline-block;width:max-content;height:fit-content;background-color:#000000;border:2px white solid;padding:2px 10px;border-radius:10px;cursor:pointer;margin:4px 5px;}div#script_cpt_node>div#scriptCPT_tagSerach>span:hover{background-color:#339841 !important;}div#script_cpt_node>div#scriptCPT_tagSerach>span.script_tagSearch_active{background-color:#14541d;}div#scriptCPT_mainBody>table>thead>tr>td:nth-of-type(2){text-align:center;}tbody>tr>td>input[type='checkbox']{height: 20px;}`,
  ];
  // 数据定义
  indexDBData = {
    building: [[], []], // 建筑数据，0是r1 1是r2
    userInfo: [[], []], // 用户数据，
    warehouse: [[], []], // 仓库数据
    resourcePool: [[], []], // 交易所数据
    executives: [[], []], // 高管信息
    notes: [
      // 笔记信息
      { in: undefined, out: [] },
      { in: undefined, out: [] },
    ],
    SCT_divHorizontal: false, // SCT 悬浮窗横向排列
    SCT_divFixedDisplay: false, // SCT 悬浮窗固定显示
    mapMarginTop: 0, // 地图上边界
  };
  componentData = {
    settingNodeList: {}, // 设置界面
    buildingInfo: {}, // 建筑数据
    realm: undefined, // 服务器标记
    msgNodeShow: false, // 信息窗口展示标记
    cptSwitchShow: false, // 组件功能展示标记
    cptSettingContainerNode: undefined, // 组件设置的容器元素
    cptSettingBodyNode: undefined, // 组件设置挂载的目标元素
    cptSettingShow: false, // 设置元素展示标记
    avtiveTagList: [], // 被激活的tag过滤器列表
    cptSearchText: "", // 组件搜索输入的内容
    mapNode: undefined, // 临时地图div容器
  };
  // 函数挂载
  startupFuncList = [
    this.startUpMountCSS,
    this.startupUserInfo,
    this.startupSideBarMain,
    this.startupSettingContainer,
    this.startupExecutives,
    // this.startupForDonation,
    this.startupForLang,
  ];
  commonFuncList = [
    {
      match: () => /zh\/landscape\//.test(location.href),
      func: this.mapMarginTopMain,
    },
  ];
  netFuncList = [
    {
      // 用户信息拦截
      urlMatch: (url) => /companies\/me\/$/.test(url),
      func: this.userInfo,
    },
    {
      // 建筑数据拦截
      urlMatch: (url) => /me\/buildings\/$/.test(url),
      func: this.buildingInfo,
    },
    {
      // 仓库数据拦截
      urlMatch: (url) => /v2\/resources\/$/.test(url),
      func: this.warehouseInfo,
    },
    {
      // 交易所请求拦截
      urlMatch: (url) => /market\/(all\/)?\d+\/\d+\//.test(url),
      func: this.marketData,
    },
    {
      // 高管拦截
      urlMatch: (url) => /me\/executives\/$/.test(url),
      func: this.netExecutives,
    },
    {
      // 备注拦截
      urlMatch: (url) => /me\/note\/$/.test(url) || /me\/my-note\/$/.test(url) || /me\/note\/(\d+)\/$/.test(url),
      func: this.netNoteRegist,
    },
  ];
  settingUI = this.uisetting;
  // 组件开关提交按钮
  CPT_switch_button(event) {
    let valueList = [];
    document.querySelectorAll("#scriptSetting_CPT_switch input").forEach((item) => valueList.push(item.checked));
    let loadCount = 0;
    componentList.forEach((CPT) => (CPT.enable = valueList[loadCount++]));
    tools.indexDB_updateFeatureConf();
    tools.alert("提交设置成功");
  }
  // 插件基础设置提交按钮
  async BaseSet_button(event) {
    let valueList = [];
    document.querySelectorAll("#setting-container-2 input, #setting-container-2 select").forEach((node) => {
      if (node.tagName == "INPUT" && node.type == "checkbox") {
        valueList.push(node.checked);
      } else if (node.tagName == "INPUT" || node.tagName == "SELECT") {
        valueList.push(node.value);
      }
    });
    feature_config.debug = valueList[0];
    feature_config.net_gap_ms = Math.floor(valueList[1]);
    feature_config.fontColor = valueList[2];
    feature_config.notificationMode = Math.floor(valueList[3]);
    tools.log(feature_config);
    await tools.indexDB_updateFeatureConf();
    tools.alert("已提交更改");
    location.reload();
  }
  // 重置插件缓存按钮
  async clearIndexdDB(event) {
    await tools.indexDB_deleteAllData();
    tools.alert("清除插件缓存完毕");
    location.reload();
  }
  // 用户信息拦截处理
  userInfo(url, method, resp) {
    resp = JSON.parse(resp);
    this.indexDBData.userInfo[resp.authCompany.realmId] = resp;
    this.componentData.realm = resp.authCompany.realmId;
    tools.log("用户数据获取完毕：", resp);
    tools.indexDB_updateIndexDBData();
  }
  // 建筑信息拦截处理
  buildingInfo(url, method, resp) {
    resp = JSON.parse(resp);
    if (this.componentData.realm == undefined) return;
    this.indexDBData.building[this.componentData.realm] = resp;
    tools.indexDB_updateIndexDBData();
  }
  // 仓库信息拦截处理
  warehouseInfo(url, method, resp) {
    resp = JSON.parse(resp);
    if (this.componentData.realm == undefined) return;
    tools.log("Current Realm: ", this.componentData.realm);
    this.indexDBData.warehouse[this.componentData.realm] = resp;
    tools.indexDB_updateIndexDBData();
  }
  // 市场价格拦截处理
  marketData(url, method, resp) {
    resp = JSON.parse(resp);
    if (!this.componentData.realm == undefined) return;
    let mpData = tools.mpFormat(resp);
    let res_id = Math.floor(url.match(/\d+(?=\D*$)/)[0]);
    let realm = Math.floor(url.match(/\/(\d+)/)[1]);
    tools.log("Realm", realm, "物品名", tools.itemIndex2Name(res_id), "物品ID", res_id, "价格", mpData);
    if (!this.indexDBData.resourcePool[realm]) this.indexDBData.resourcePool[realm] = [];
    this.indexDBData.resourcePool[realm][res_id] = mpData;
    tools.indexDB_updateIndexDBData();
  }
  // 高管信息网络请求拦截函数
  async netExecutives(url, method, resp) {
    let data = JSON.parse(resp);
    this.indexDBData.executives[await tools.getRealm()] = data;
  }
  // 公司备注网络请求拦截函数
  async netNoteRegist(url, method, resp) {
    try {
      let realm = await tools.getRealm();
      if (/me\/note\/$/.test(url)) {
        // 给别人写的笔记
        let data = JSON.parse(resp);
        tools.log(`R${realm + 1} 给别人的笔记: `, data);
        this.indexDBData.notes[realm].out = data;
      } else if (/me\/my-note\/$/.test(url)) {
        // 给自己写的笔记
        let data = window.decodeURI(
          resp
            .replace(/(^")|("$)/g, "")
            .replace(/\\u[\dA-F]{4}/gi, (match) => String.fromCharCode(parseInt(match.substr(2), 16)))
        );
        this.indexDBData.notes[realm].in = data;
        tools.log(`R${realm + 1} 私人笔记: ${data}`);
      } else if (/me\/note\/(\d+)\/$/.test(url)) {
        // 对外笔记变更
        let data = JSON.parse(resp);
        let id = Number(url.match(/me\/note\/(\d+)\/$/)[1]);
        let targetIndex = this.indexDBData.notes[realm].out.findIndex((item) => item.about.id == id);
        this.indexDBData.notes[realm].out[targetIndex].note = data.note;
      }
    } catch (e) {
      tools.errorLog(e);
    }
  }
  // 自启动挂载css
  startUpMountCSS() {
    // :root{--fontColor:##FONTCOLOR##}
    let newCSSNode = document.createElement("style");
    newCSSNode.setAttribute("sct_id", "basisCPT_preCSS");
    newCSSNode.textContent = `:root{--fontColor:${feature_config.fontColor}}`;
    document.head.prepend(newCSSNode);
  }
  // 自启动用户信息获取
  async startupUserInfo() {
    let netData = await tools.getNetData(tools.baseURL.userBase);
    if (!netData) return;
    this.indexDBData.userInfo[netData.authCompany.realmId] = netData;
    this.componentData.realm = netData.authCompany.realmId;
    tools.log("用户数据获取完毕：", netData);
  }
  // 自启动仓库信息检索
  async startupWarehouseInfo() {
    let netData = await tools.getNetData(tools.baseURL.warehouse);
    if (!netData || this.componentData.realm == undefined) return;
    this.indexDBData.warehouse[this.componentData.realm] = netData;
    tools.log("仓库数据更新完毕：", netData);
  }
  // 侧边栏构建
  async startupSideBarMain() {
    // 创建侧边栏开启用的小窗
    let sideBarSmall = document.createElement("div");
    sideBarSmall.innerHTML = `<div><span title='SimComp-tools By:道洛LTS_Kim' id='script_bar_text'>SCT</span></div><div><button id='script_msg_switch' class="btn form-control">信息</button></div><div><button id='script_cpt_switch' class="btn form-control">组件</button></div>`;
    sideBarSmall.id = "script_hover_node";
    if (this.indexDBData.SCT_divHorizontal) sideBarSmall.className += ` horizontal`;
    if (this.indexDBData.SCT_divFixedDisplay) sideBarSmall.className += ` fixedDisplay`;
    // 创建信息窗口
    let msgMainNode = document.createElement("div");
    msgMainNode.innerHTML = `<div id=scriptMsg_innerHead style=padding:10px><h1>消息<span sct_id=msgClear style=font-size:20px> <a>清空</a></span></h1></div><div id=scriptMsg_main><table><tbody id=scriptMsg_mainBody><tr><td>时间<td>内容</table></div>`;
    msgMainNode.id = "script_msg_node";
    msgMainNode.className = "script_base_container";
    tools.msgBodyNode = msgMainNode.querySelector("tbody#scriptMsg_mainBody");
    // 创建组件窗口
    let cptSwitchNode = this.sideBarSub_componentNode();
    cptSwitchNode.id = "script_cpt_node";
    cptSwitchNode.className = "script_base_container";
    // 绑定事件
    sideBarSmall.querySelector("button#script_msg_switch").addEventListener("click", (event) => {
      // 取消背景色改变
      clearInterval(tools.msgShowFlag.timer);
      tools.msgShowFlag.timer = undefined;
      tools.msgShowFlag.flag = false;
      Object.assign(document.querySelector("div#script_hover_node>div>span").style, {
        backgroundColor: "rgb(0,0,0,0)",
      });
      // 修改当前目标
      Object.assign(document.querySelector("div#script_msg_node").style, {
        right: this.componentData.msgNodeShow ? "-150%" : "0px",
      });
      this.componentData.msgNodeShow = !this.componentData.msgNodeShow;
      // 重置原目标
      if (this.componentData.cptSwitchShow) {
        Object.assign(document.querySelector("div#script_cpt_node").style, { right: "-150%" });
        this.componentData.cptSwitchShow = !this.componentData.cptSwitchShow;
      }
    });
    sideBarSmall.querySelector("button#script_cpt_switch").addEventListener("click", (event) => {
      // 修改当前目标
      Object.assign(document.querySelector("div#script_cpt_node").style, {
        right: this.componentData.cptSwitchShow ? "-150%" : "0px",
      });
      this.componentData.cptSwitchShow = !this.componentData.cptSwitchShow;
      // 重置原目标
      if (this.componentData.msgNodeShow) {
        Object.assign(document.querySelector("div#script_msg_node").style, { right: "-150%" });
        this.componentData.msgNodeShow = !this.componentData.msgNodeShow;
      }
    });
    msgMainNode.addEventListener("click", (e) => {
      if (!e.target.closest("span[sct_id='msgClear']")) return;
      document.querySelector(
        "div#scriptMsg_main tbody#scriptMsg_mainBody"
      ).innerHTML = `<tr><td>时间</td><td>内容</td></tr>`;
    });
    // 挂载元素
    document.body.appendChild(sideBarSmall);
    document.body.appendChild(msgMainNode);
    document.body.appendChild(cptSwitchNode);
  }
  sideBarSub_componentNode() {
    let resultNode = document.createElement("div");
    // 拼接侧边栏头部
    let htmlText = `<div id="scriptCPT_innerHead"><h1 style="margin-left:10px;">组件</h1><div style="padding:0 10px;"><input type="text" id="script_cptSearch_input" class="form-control" placeholder="搜索组件名..."></div></div>`;
    let sortComponentsList = Object.values(componentList)
      .filter((component) => !component.hideSetting && (component.enable || !component.canDisable))
      .sort((cptA, cptB) => cptB.tapCount - cptA.tapCount);
    // 拼接侧边栏tag搜索
    htmlText += `<div id="scriptCPT_tagSerach">`;
    const tagList = TAG_ORDER.filter((tag) => sortComponentsList.some((component) => normalizedTags(component).includes(tag)));
    for (const tag of tagList) htmlText += `<button type="button" data-sct-tag>${tag}</button>`;
    htmlText += `</div>`;
    // 拼接侧边栏主体
    htmlText += `<div id="scriptCPT_mainBody"><table><thead><tr><td>前台功能</td><td>设置</td></tr></thead><tbody>`;
    for (let i = 0; i < sortComponentsList.length; i++) {
      let component = sortComponentsList[i];
      let name = component.constructor.name;
      let frontName = component.name;
      let frontExist = (Boolean(component.frontUI) || Boolean(component.inlineSettingUI)) ? "funcExist" : "";
      let settingExist = Boolean(component.inlineSettingUI || component.settingUI || component.settingAction) ? "funcExist" : "";
      htmlText += `<tr class="script_cpt_node" id='${name}'><td><button class="btn CPTOptionLeft ${frontExist}">${frontName}</button></td><td><button class="btn CPTOptionRight ${settingExist}">设置</button></td></tr>`;
    }
    htmlText += `</tbody></table></div>`;
    resultNode.innerHTML = htmlText;
    // 挂载交互
    let trList = resultNode.querySelectorAll("tbody > tr.script_cpt_node");
    for (let i = 0; i < trList.length; i++) {
      let element = trList[i];
      let component = componentList[element.id];
      let frontUI = component.inlineSettingUI
        ? () => this.sideBarSub_toggleInlineSetting(element, component)
        : !Boolean(component.frontUI)
          ? () => this.sideBarSub_noFront()
          : () => this.sideBarSub_showFront(component);
      let settingUI = component.inlineSettingUI
        ? () => this.sideBarSub_toggleInlineSetting(element, component)
        : component.settingAction
          ? () => component.settingAction.call(component)
        : !Boolean(component.settingUI)
          ? () => this.sideBarSub_noSetting()
          : () => this.sideBarSub_showSetting(component);
      element.querySelector("button.CPTOptionLeft").addEventListener("click", frontUI);
      element.querySelector("button.CPTOptionRight").addEventListener("click", settingUI);
    }
    // 组件搜索
    resultNode
      .querySelector("input#script_cptSearch_input")
      .addEventListener("change", (event) => this.sideBarSub_cptNameSearch(event));
    // tag搜索
    resultNode.querySelector("div#scriptCPT_tagSerach").addEventListener("click", (e) => this.sideBarSub_tagSearch(e));
    return resultNode;
  }

  sideBarSub_showFront(component) {
    component.tapCount++;
    component.frontUI.call(component);
  }
  async sideBarSub_showSetting(component) {
    component.tapCount++;
    if (this.componentData.cptSettingShow) return;
    let cptSettingNode = await component.settingUI.call(component);
    // 添加默认class
    if (!cptSettingNode.className.includes("col-sm-12 setting-container"))
      cptSettingNode.className += " col-sm-12 setting-container";
    const window = openSecondaryWindow({
      id: "component-settings",
      title: `${component.name}设置`,
      content: cptSettingNode,
      onClose: () => { this.componentData.cptSettingShow = false; },
    });
    this.componentData.cptSettingContainerNode = window.root;
    this.componentData.cptSettingBodyNode = window.body;
    this.componentData.cptSettingShow = true;
  }
  async sideBarSub_toggleInlineSetting(componentRow, component) {
    component.tapCount++;
    const existingRow = componentRow.nextElementSibling;
    if (existingRow?.dataset.sctInlineSettings === component.constructor.name) {
      existingRow.remove();
      return;
    }
    const content = await component.inlineSettingUI.call(component);
    if (!content?.nodeType) return;
    const inlineRow = document.createElement("tr");
    inlineRow.dataset.sctInlineSettings = component.constructor.name;
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.append(content);
    inlineRow.append(cell);
    componentRow.after(inlineRow);
  }
  sideBarSub_noFront() {
    tools.alert("该组件没有前台窗口设计");
  }
  sideBarSub_noSetting() {
    tools.alert("该组件没有可以设置的内容");
  }
  sideBarSub_cptNameSearch(event) {
    let value = event.target.value;
    if (value == "") value = /.+/;
    this.componentData.cptSearchText = value;
    this.sideBarSub_updateButtonList();
  }
  sideBarSub_tagSearch(event) {
    const target = event.target.closest("button[data-sct-tag]");
    if (!target) return;
    let tag = target.innerText;
    let index = this.componentData.avtiveTagList.findIndex((activeTag) => activeTag == tag);
    if (index != -1) {
      // 删除显示
      this.componentData.avtiveTagList.splice(index, 1);
      target.classList.remove("script_tagSearch_active");
    } else {
      // 增加显示
      this.componentData.avtiveTagList.push(tag);
      target.classList.add("script_tagSearch_active");
    }
    this.sideBarSub_updateButtonList();
  }
  sideBarSub_updateButtonList() {
    let nodeList = Object.values(document.querySelectorAll("div#scriptCPT_mainBody tbody>tr"));
    for (let i = 0; i < nodeList.length; i++) {
      if (nodeList[i].dataset.sctInlineSettings) {
        Object.assign(nodeList[i].style, { display: nodeList[i].previousElementSibling?.style.display === "none" ? "none" : "" });
        continue;
      }
      let tagMatch = false;
      let textMatch = false;
      let name = nodeList[i].id;
      if (this.componentData.avtiveTagList.length == 0) tagMatch = true;
      // 任一包含匹配模式
      // if (componentList[name].tagList.some(item => this.componentData.avtiveTagList.includes(item))) tagMatch = true;
      // 完全包含匹配命令
      if (this.componentData.avtiveTagList.every((item) => normalizedTags(componentList[name]).includes(item))) tagMatch = true;
      if (nodeList[i].innerText.match(this.componentData.cptSearchText)) textMatch = true;
      Object.assign(nodeList[i].style, { display: tagMatch && textMatch ? "" : "none" });
    }
  }
  // 组件设置界面构建
  async startupSettingContainer() {
    mountSettingsWindowTheme();
    let settingContainerNode = ensureSecondaryWindow();
    this.componentData.cptSettingContainerNode = settingContainerNode;
    this.componentData.cptSettingBodyNode = settingContainerNode.querySelector("div#script_setting_body");
  }
  // 基础组件设置界面
  uisetting() {
    // 组件开关和基础插件的所有设置
    tools.log(feature_config);
    let newNode = document.createElement("div");
    newNode.id = "script_setting_basisCPT";
    newNode.className = "col-sm-12 setting-container";
    let htmlText = `<div><div class="header">插件基础功能设置</div><div class="container"><div><div><button class="btn script_opt_submit">保存</button></div></div><div><table class="sct-cpt-switch-table"><thead><tr><td>组件名</td><td>开关</td></tr></thead><tbody>`;
    let tempCPTList = Object.values(componentList).filter(c => !c.hideSetting);
    for (let i = 0; i < tempCPTList.length; i++) {
      let component = tempCPTList[i];
      let name = component.name;
      let describe = component.describe;
      let enable = component.enable;
      let canDisable = component.canDisable;
      let cptKey = component.constructor.name;
      htmlText += `<tr><td><span title='${describe}'>${name}</span></td><td><input class='form-control sct-cpt-checkbox' data-cpt-key="${cptKey}" type="checkbox" ${
        enable ? "checked" : ""
      } ${canDisable ? "" : "disabled"}></td></tr>`;
    }
    htmlText += `</table></div><div><table class="sct-feature-config-table"><thead><tr><td>功能<td>设置<tbody><tr><td title=打开debug模式会有大量信息输出,可能会影响到性能,如非必要不要打开.>DEBUG模式<td><input class='form-control' data-config-key="debug" type='checkbox' #####><tr><td title="只有插件主动发起的请求会被此项目限制\n官方文档说明低于5分钟就不安全了,用户请酌情设置. \n默认[10000ms]=10s">插件主动网络请求最小间隔<td><input type=number class=form-control data-config-key="net_gap_ms" value=#####><tr><td title="允许使用hex代码 and rgb标号. \n默认 #ffffff">插件通用文字配色<td><input class=form-control data-config-key="fontColor" value=#####><tr><td title="允许使用hex代码和rgb标号. \n默认 100 ">网页缩放比例<td><input type=number class=form-control data-config-key="zoomRate" value=#####> <tr><td title='地图界面上方的间隔，注意与网页缩放比例搭配使用。'>地图上方间距<td><input type='number' class=form-control data-config-key="mapMarginTop" value=#####>  <tr><td title="首要通知模式,默认是 网页内通知">主要通知模式<td><select class=form-control data-config-key="notificationMode0"><option value=-1>无<option value=0>网页浏览器原生Notification对象(仅pc浏览器可用)<option value=1>网页内通知<option value=2>安卓通知通道</select><tr><td title="次要通知模式,默认是 无">次要通知模式<td><select class=form-control data-config-key="notificationMode1"><option value=-1>无<option value=0>网页浏览器原生Notification对象(仅pc浏览器可用)<option value=1>网页内通知<option value=2>安卓通知通道</select><tr><td title="默认不勾选,勾选后SCT悬浮窗使用横向布局">悬浮窗横向排列</td><td><input type="checkbox" class="form-control" data-config-key="SCT_divHorizontal" ${
      this.indexDBData.SCT_divHorizontal ? "checked" : ""
    } ></td></tr><tr><td title="默认不勾选,勾选后SCT悬浮窗会固定在右下角不受hover影响">悬浮窗固定位置</td><td><input type="checkbox" class="form-control" data-config-key="SCT_divFixedDisplay" ${
      this.indexDBData.SCT_divFixedDisplay ? "checked" : ""
    } ></td></tr><tr><td title="无确认,删除插件所有缓存.非必要不用点">清除插件缓存</td><td><button class="btn form-control" id="script_reset">清除</button></td></tr><tr><td>插件缓存读写</td><td><button class="btn form-control" id="script_confEdit_enter">进入读写操作</button></td></tr></table></div></div></div>`;
    // 修改input已有参数
    htmlText = htmlText.replace("#####", feature_config.debug ? "checked" : "");
    htmlText = htmlText.replace("#####", feature_config.net_gap_ms.toString());
    htmlText = htmlText.replace("#####", feature_config.fontColor.toString());
    htmlText = htmlText.replace("#####", parseFloat(feature_config.zoomRate));
    htmlText = htmlText.replace("#####", parseInt(this.indexDBData.mapMarginTop));
    newNode.innerHTML = htmlText;
    newNode.querySelectorAll("input.sct-cpt-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const component = componentList[checkbox.dataset.cptKey];
        if (!checkbox.checked || !component?.requiresRiskAcknowledgement || component.indexDBData?.riskAcknowledged) return;
        checkbox.checked = false;
        if (!requestRiskAcknowledgement(component)) {
          tools.alert(`未完成手动确认，“${component.name}”保持关闭。`);
          return;
        }
        component.indexDBData.riskAcknowledged = true;
        checkbox.checked = true;
        tools.alert(`已完成风险确认。“${component.name}”将在点击“保存”并刷新后启用。`);
      });
    });
    // 修改select的已有参数
    let select0 = newNode.querySelector('[data-config-key="notificationMode0"]');
    if (select0) select0.value = feature_config.notificationMode[0];
    let select1 = newNode.querySelector('[data-config-key="notificationMode1"]');
    if (select1) select1.value = feature_config.notificationMode[1];
    // 绑定按键
    newNode.querySelector("button#script_reset")?.addEventListener("click", async () => {
      if (!(await tools.confirm("确定清理?"))) return;
      tools.indexDB_deleteAllData();
      location.reload();
    });
    newNode.querySelector("button#script_confEdit_enter")?.addEventListener("click", () => this.scriptConfEdit_build());
    newNode.querySelector("button.script_opt_submit")?.addEventListener("click", () => this.uisettingSub());
    return newNode;
  }
  uisettingSub() {
    let container = document.querySelector("div#script_setting_basisCPT");
    if (!container) return;

    // 更新组件开关
    let visibleCPTs = Object.values(componentList).filter(c => !c.hideSetting);
    visibleCPTs.forEach((component) => {
      let cptKey = component.constructor.name;
      let checkbox = container.querySelector(`input.sct-cpt-checkbox[data-cpt-key="${cptKey}"]`);
      if (checkbox) {
        if (checkbox.checked && component.requiresRiskAcknowledgement && !component.indexDBData?.riskAcknowledged) {
          checkbox.checked = false;
          return tools.alert(`“${component.name}”需要先手动输入“${RISK_ACKNOWLEDGEMENT}”确认风险。`);
        }
        component.enable = checkbox.checked;
      }
    });

    // 读取具体 config Key 对应的节点
    const getConfigNode = (key) => container.querySelector(`[data-config-key="${key}"]`);

    const debugNode = getConfigNode("debug");
    const netGapNode = getConfigNode("net_gap_ms");
    const fontColorNode = getConfigNode("fontColor");
    const zoomRateNode = getConfigNode("zoomRate");
    const mapMarginNode = getConfigNode("mapMarginTop");
    const mode0Node = getConfigNode("notificationMode0");
    const mode1Node = getConfigNode("notificationMode1");
    const horizNode = getConfigNode("SCT_divHorizontal");
    const fixedNode = getConfigNode("SCT_divFixedDisplay");

    const netGapMs = netGapNode ? Math.floor(parseFloat(netGapNode.value)) : feature_config.net_gap_ms;
    const fontColor = fontColorNode ? fontColorNode.value : feature_config.fontColor;
    const zoomRate = zoomRateNode ? parseFloat(zoomRateNode.value) : parseFloat(feature_config.zoomRate);
    const mapMarginTop = mapMarginNode ? parseFloat(mapMarginNode.value) : this.indexDBData.mapMarginTop;
    const mode0 = mode0Node ? parseInt(mode0Node.value) : feature_config.notificationMode[0];
    const mode1 = mode1Node ? parseInt(mode1Node.value) : feature_config.notificationMode[1];

    // 检测内容
    if (netGapMs < 60000)
      return tools.alert("插件主动网络请求最小间隔 不允许设置小于1分钟，也就是不小于60000.");
    if (!tools.hexArgbCheck(fontColor)) return tools.alert("只支持HEX格式颜色和RGB格式颜色.");
    if (zoomRate > 100 || zoomRate <= 0)
      return tools.alert("网页缩放比例太离谱嗷.\n只允许 (0-100].");
    if (mapMarginTop < 0) return tools.alert("间距不允许是负数");
    if (mode0 == -1 && mode1 != -1)
      return tools.alert("如果仅设置一个通知模式请使用主要通知模式.");
    if (mode0 == mode1 && mode0 != -1)
      return tools.alert("没必要都设置一样的.");

    // 挂载内容
    if (debugNode) feature_config.debug = debugNode.checked;
    feature_config.net_gap_ms = netGapMs;
    feature_config.fontColor = fontColor;
    feature_config.zoomRate = zoomRate + "%";
    feature_config.notificationMode = [mode0, mode1];
    if (horizNode) this.indexDBData.SCT_divHorizontal = horizNode.checked;
    if (fixedNode) this.indexDBData.SCT_divFixedDisplay = fixedNode.checked;
    this.indexDBData.mapMarginTop = mapMarginTop;

    // 更新内容
    tools.indexDB_updateFeatureConf();
    tools.indexDB_updateIndexDBData();
    // 反馈并刷新
    tools.alert("已提交更新,即将刷新.");
    location.reload();
  }
  // 插件缓存读写界面构建
  async scriptConfEdit_build() {
    // 关闭设置界面
    closeSecondaryWindow(this.componentData.cptSettingContainerNode);
    // 构建节点
    let newNode = document.createElement("div");
    let cssNode = document.createElement("style");
    cssNode.setAttribute("sct_id", "scriptConfEdit_css");
    cssNode.textContent = `#scriptConfEdit_maim{width:100%;}#scriptConfEdit_maim button{height:100%;}#scriptConfEdit_maim textarea{height:5em;resize:none;width:100%;}#scriptConfEdit_maim table{border-spacing:10px;border-collapse:separate;}`;
    newNode.id = `scriptConfEdit_maim`;
    newNode.innerHTML = `<div id=scriptConfEdit_maim><table><tr><td>导出文本<td><textarea style=color:var(--fontColor)>${await tools.indexDB_genAllData2String()}</textarea><tr><td colspan=2><button class="btn form-control"script_id=download>下载json文件</button><tr><td>导入文本<td><textarea style=color:var(--fontColor) placeholder=在这里输入导入配置的文本></textarea><tr><td colspan=2><button class="btn form-control"script_id=submit>点击导入</button></table></div>`;
    // 拉起提示
    tools.alert(newNode, cssNode);
    // 添加监听
    newNode.querySelector("button[script_id='download']").addEventListener("click", (e) => {
      let fileContent = tools.getParentByIndex(e.target, 2).previousElementSibling.querySelector("textarea").value;
      let fileName = `sct_userConf_${new Date().getTime()}.json`;
      tools.downloadTextFile(fileName, fileContent);
      fileContent = null;
    });
    newNode.querySelector("button[script_id='submit']").addEventListener("click", async (event) => {
      try {
        event.target.disabled = true;
        let { feature_conf, indexDBData, tapCount } = JSON.parse(
          tools.getParentByIndex(event.target, 2).previousElementSibling.querySelector("textarea").value
        );
        await tools.indexDB_loadUserConf(feature_conf, indexDBData, tapCount);
        location.reload();
      } catch (e) {
        return tools.errorLog(e);
      } finally {
        event.target.disabled = false;
      }
    });
  }
  // 防抖动保存数据库
  async debounceSaveIndexDB() {
    tools.log("触发防抖保存IndexedDB");
    await tools.indexDB_updateFeatureConf();
    await tools.indexDB_updateIndexDBData();
  }
  // 求捐赠函数
  startupForDonation() {
    let msgBody = document.createElement("div");
    let donationSite = document.createElement("a");
    donationSite.href = "https://afdian.net/a/SCT-Editor";
    donationSite.innerText = "点我前往捐赠";
    donationSite.setAttribute("target", "_blank");
    donationSite.style.marginRight = "10px";
    let donationList = document.createElement("a");
    donationList.innerText = "捐赠者名单";
    donationList.addEventListener("click", async (event) => {
      let list = await tools.getNetData(
        `https://cdn.jsdelivr.net/gh/ShenHaiSu/SimComp-APIProxy/commonData/donors.json?${await tools.generateUUID()}`
      );
      list.sort(() => Math.random() - 0.5);
      let shoMsg =
        "作为SimCompsTools开发者道洛LTS,我非常感谢每一个用户的支持与帮助,更感谢所有支持者的慷慨捐赠.您的慷慨使我能够继续投入时间和精力来提供更好的功能/修复问题和满足更多用户的需求.非常感谢大家!";
      tools.msg_send("", shoMsg, 1);
      tools.msg_send("", "捐赠者名单(不区分先后):", 1);
      tools.msg_send("", `${list.join(", ")}`, 1);
      tools.msg_send("", `再次由衷的感谢所有支持者和用户!`, 1);
      event.preventDefault();
    });
    msgBody.appendChild(donationSite);
    msgBody.appendChild(donationList);
    tools.msg_send("肚肚饿饿", msgBody, 1);
  }
  // 主动获取语言包文件
  async startupForLang() {
    let originName = new URL(document.querySelector("script[type='module']").src).origin;
    let langData = await tools.getNetData(originName + "/static/js/lang6/zh.json?" + (await tools.generateUUID()));
    if (!langData) return;
    tools.indexDB_updateLangData(langData);
  }
  // 主动获取高管信息
  async startupExecutives() {
    let realm = await tools.getRealm();
    let netData = await tools.getNetData(tools.baseURL.executives);
    if (!netData) {
      await tools.dely(5000);
      return this.startupExecutives();
    }
    this.indexDBData.executives[realm] = netData;
    await tools.indexDB_updateIndexDBData();
  }
  // 给地图添加上边距
  mapMarginTopMain() {
    try {
      let targetNode = Object.values(document.querySelectorAll(`a[top][left][href]`)).filter((node) =>
        /\/zh\/b\//.test(node.getAttribute("href"))
      )[0];
      targetNode = tools.getParentByIndex(targetNode, 1);

      if (this.componentData.mapNode && this.componentData.mapNode === targetNode) return;

      this.componentData.mapNode = targetNode;
      this.componentData.mapNode.style.margin = this.indexDBData.mapMarginTop + "px auto";
    } catch (e) {
      tools.errorLog(e);
      return;
    }
  }
}
new basisCPT();
