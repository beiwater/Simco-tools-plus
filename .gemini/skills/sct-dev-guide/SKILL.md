---
name: sct-dev-guide
description: Complete developer guide and architecture reference for SimComps Tools (SCT / AutoMax), a modular browser userscript plugin for Sim Companies. Activate or consult this skill when developing, refactoring, adding components, or debugging the simco-pluginDLchagne codebase.
---

# SimComps Tools (SCT / AutoMax) 开发者指南 & Skill 说明

## 📌 项目概述

**SimComps Tools (SCT / AutoMax)** 是一款针对 *Sim Companies* 经营策略游戏的高性能、模块化 Browser Userscript 脚本插件系统。

- **核心语言与技术栈**：ES6+ JavaScript, Webpack 5, Babel, Userscript APIs (`GM_xmlhttpRequest`, `unsafeWindow` 等)。
- **设计范式**：高度模块化的双层组件体系（基础功能组件集 + AutoMax 商业决策助手）。
- **设计原则**：按需加载（大部分组件默认关闭）、统一二次弹窗宿主 (`secondaryWindowHost`)、强高风险安全提示确认机制、GA4 隐私阻断。

---

## 🗂️ 目录结构与架构地图

```text
simco-pluginDLchagne/
├── index.js                      # 插件入口主文件，负责系统初始化与组件注册
├── webpack.config.js             # Webpack 5 构建打包配置
├── package.json                  # 依赖配置与 build / postbuild 脚本命令
├── components/                   # 67+ 功能组件目录 (扩展 BaseComponent)
│   ├── baseComponent.js -> tools/baseComponent.js
│   └── *.js                      # 具体业务逻辑组件文件
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
│   ├── ImageProcessor模块文档.md # 图像处理与画质优化模块文档
│   └── images/                   # README 及文档插图
├── scripts/                      # 构建、校验与脚本命令行工具
│   ├── postBuild.js              # 版本自动递增与 Userscript Header 拼接
│   ├── verify-userscript.js      # 编译产物合规性与安全校验
│   ├── icts-image-extractor.user.js # 独立图像提取油猴脚本
│   └── fix_build_issues.js       # 构建脚本修复工具
└── dist/                         # 最终编译输出 (build.user.js)
```

---

## 🧩 组件开发模式 (BaseComponent Workflow)

每一个新增的功能模块都应当继承 `BaseComponent` 类并放置于 `components/` 目录下。

### 1. 组件标准结构模板

```javascript
import { BaseComponent } from '../tools/baseComponent.js';

export class MyNewComponent extends BaseComponent {
  constructor() {
    super({
      id: 'myNewComponent',            // 唯一的组件 ID
      name: '我的新功能',               // 设置面板中显示的名称
      description: '描述功能的作用',     // 组件详细说明
      category: '交易与市场',           // 分类: '仓库与生产', '交易与市场', '餐厅与日报', '聊天与资料', '外观与特效', 'AutoMax'
      defaultEnabled: false,           // 遵循默认关闭原则
      isHighRisk: false                // 若涉及高频/自动页面交互，设为 true 并触发风险自担确认
    });
  }

  /**
   * 组件初始化 Hook (插件启动时调用)
   */
  init() {
    if (!this.isEnabled()) return;
    this.bindEvents();
  }

  /**
   * 绑定事件与 DOM 注入
   */
  bindEvents() {
    // 监听 URL 变化或页面 DOM 加载
  }

  /**
   * 组件关闭时的清理 Hook
   */
  destroy() {
    // 解绑事件、移除注入的 DOM 节点
  }
}
```

### 2. 注册新组件

在 `index.js` 中引入并完成注册：

```javascript
import { MyNewComponent } from './components/MyNewComponent.js';

// 在 registerComponents() 方法中添加
componentManager.register(new MyNewComponent());
```

---

## 🛠️ 构建与测试命令

| 命令 | 作用 |
| :--- | :--- |
| `npm run build` | Webpack 生产编译打包，自动执行 `scripts/postBuild.js` 生成版本号并拼接 Userscript Header |
| `npm run dev` | Webpack 热监听编译模式 |
| `npm run verify:userscript` | 对 `dist/build.user.js` 进行元数据规范与敏感 URL 阻断校验 |

---

## 🛡️ 安全与开发规范

1. **绝对禁止硬编码敏感逻辑**：不得泄漏玩家 Session、Auth Header 或明文 Cookie。
2. **高风险自动化提示**：若组件涉及敏感自动化交互（如一键收菜/重建），必须设置 `isHighRisk: true`，强制要求用户手动输入 `我已知晓风险自担` 提示词解锁。
3. **样式隔离**：所有自定义 CSS 类名请统一加上 `sct-` 前缀（例如 `.sct-window-host`），避免样式污染游戏原生界面。
4. **单实例二次窗口**：创建自定义配置或复杂数据图表窗口时，请统一使用 `SecondaryWindowHost` 宿主，维护游戏原生的沉浸感。
