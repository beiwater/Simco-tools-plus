---
name: sct-dev-guide
description: Complete developer guide and architecture reference for SimComps Tools (SCT / AutoMax), a modular browser userscript plugin for Sim Companies. Consult or use this skill when developing, refactoring, adding new components, or debugging the simco-pluginDLchagne codebase.
---

# SimComps Tools (SCT / AutoMax) 开发者 Skill 指南

## 📌 项目概述与架构地图

**SimComps Tools (SCT / AutoMax)** 是一款针对 *Sim Companies* 经营策略游戏的高性能、模块化 Browser Userscript 脚本插件系统。

- **核心技术栈**：ES6+ JavaScript, Webpack 5, Babel, Userscript APIs (`GM_xmlhttpRequest`, `unsafeWindow` 等)。
- **设计范式**：模块化组件体系（基础功能组件集 67+ + AutoMax 商业决策助手）。
- **设计原则**：按需加载（组件默认关闭）、统一二次弹窗宿主 (`SecondaryWindowHost`)、强高风险安全提示确认机制、GA4 隐私阻断。

```text
simco-pluginDLchagne/
├── index.js                      # 插件入口主文件，负责系统初始化与组件注册
├── webpack.config.js             # Webpack 5 构建打包配置
├── package.json                  # 依赖配置与 build / postbuild 脚本命令
├── components/                   # 67+ 功能组件目录 (扩展 BaseComponent)
├── tools/                        # 核心工具库与底层能力
│   ├── baseComponent.js          # 所有组件的抽象基类 (BaseComponent)
│   ├── secondaryWindowHost.js    # 统一浮层/窗口宿主（摒弃零散弹窗）
│   ├── hrAssessment.js           # 高管/HR 评估助手
│   ├── tools.js                  # DOM 节点辅助、数据转换、Storage 封装
│   └── automax/                  # AutoMax 商业精算与深度决策分析引擎
├── docs/                         # 项目技术文档与设计指南
│   ├── FEATURE_GUIDE.md          # 67+ 功能详细使用说明
│   ├── DESIGN.md                 # 总体架构设计与设计规范
│   ├── clickHarvest组件挂载机制.md  # 自动化/高风险组件安全机制文档
│   ├── ImageExtractor模块文档.md # 图像提取与替换模块文档
│   └── ImageProcessor模块文档.md # 图像处理与画质优化模块文档
├── scripts/                      # 构建、校验与脚本命令行工具
│   ├── postBuild.js              # 版本自动递增与 Userscript Header 拼接
│   ├── verify-userscript.js      # 编译产物合规性与安全校验
│   └── icts-image-extractor.user.js # 独立图像提取油猴脚本
└── dist/                         # 最终编译输出 (build.user.js)
```

---

## 🧩 组件开发范式 (BaseComponent Workflow)

每一个新增的功能模块都应当继承 `BaseComponent` 类并放置于 `components/` 目录下（Webpack 会通过 `require.context` 自动扫描引入）。

### 1. 组件标准结构模板

```javascript
const BaseComponent = require("../tools/baseComponent.js");
const { tools, componentList, indexDBData, runtimeData } = require("../tools/tools.js");

class MyNewComponent extends BaseComponent {
  constructor() {
    super();
    this.name = "我的新功能";             // 设置面板中显示的名称
    this.describe = "描述功能的作用";      // 组件详细说明
    this.enable = false;                  // 遵循默认关闭原则
    this.canDisable = true;               // 是否允许用户关闭
    this.tagList = ["交易", "工具"];      // 标签分类: AutoMax | 交易 | 仓库 | 聊天 | 工具 | 外观
    this.requiresRiskAcknowledgement = false; // 若为高危自动化交互设为 true
    this.riskNotice = "操作风险提示文案"; // 高危功能风险说明
  }

  // 依赖声明 (可选)
  dependence = {
    cpt: [],  // 内部组件依赖名称
    url: [],  // 外部脚本依赖
  };

  // 持久化存储数据 (IndexedDB)
  indexDBData = {
    mySetting: true,
  };

  // 运行时内存数据
  componentData = {
    activeTimer: null,
  };

  // 自启动函数列表 (插件加载完毕且组件开启时执行)
  startupFuncList = [
    this.init,
  ];

  // 通用事件响应函数列表 (URL/页面状态变化匹配)
  commonFuncList = [{
    match: (event) => Boolean(location.href.match(/\/market\//)),
    func: this.onMarketPage,
  }];

  // 网络请求拦截响应函数列表 (XHR/Fetch 拦截)
  netFuncList = [{
    urlMatch: (url) => url.includes("/api/v3/market/"),
    func: this.onMarketData,
  }];

  // 注入样式 (支持字符串数组)
  cssText = [
    `.my-custom-class { color: var(--fontColor); }`,
  ];

  init() {
    // 组件初始化逻辑
  }

  onMarketPage(event) {
    // 市场页面匹配时的 DOM 处理
  }

  onMarketData(url, method, responseText) {
    // 拦截到市场接口响应时的处理
  }
}

// 实例化即自动完成向 componentList 的注册
new MyNewComponent();

if (typeof module !== "undefined") {
  module.exports = MyNewComponent;
}
```

### 2. 组件自动加载机制

项目在 `index.js` 中使用 Webpack 的 `require.context('./components', true, /\.js$/)` 动态引入 `components/` 目录下的所有 JavaScript 文件，因此只需在 `components/` 目录下新增文件并执行 `new MyNewComponent()` 即可自动完成全局注册，无需手动修改 `index.js`。

---

## 🛠️ 常用构建与测试命令

| 命令 | 作用 |
| :--- | :--- |
| `npm run build` | Webpack 生产编译打包，自动执行 `scripts/postBuild.js` 生成版本号并拼接 Userscript Header |
| `npm run dev` | Webpack 热监听编译模式 |
| `npm run verify:userscript` | 对 `dist/build.user.js` 进行元数据规范与敏感 URL 阻断校验 |

---

## 🛡️ 开发必须遵循的约束规则

1. **绝对禁止硬编码敏感逻辑**：不得泄漏玩家 Session、Auth Header 或明文 Cookie。
2. **高风险自动化提示**：若组件涉及敏感自动化交互（如一键收菜/重建），必须设置 `isHighRisk: true`，强制要求用户手动输入 `我已知晓风险自担` 提示词解锁。
3. **样式隔离**：所有自定义 CSS 类名请统一加上 `sct-` 前缀（例如 `.sct-window-host`），避免样式污染游戏原生界面。
4. **单实例二次窗口**：创建自定义配置或复杂数据图表窗口时，请统一使用 `SecondaryWindowHost` 宿主，维护游戏原生的沉浸感。
