# AutoMaxPPHPL 迁移交接

日期：2026-07-20

## 当前状态

- 工作分支：`codex/dev-bench-automaxpphpl`
- 最近已推送提交：`13c60a3 feat(automax): add capture routing and refresh lifecycle`
- 当前工作区有大量未提交的 AutoMax 源码改动。
- 用户明确要求先迁移真实功能，因此最新改动尚未运行构建、自动化测试或游戏内验收。
- `dist/build.user.js` 和 `dist/version.json` 仍是旧构建产物，不能代表当前源码功能。

## 已落实的功能域

1. 基础数据、常量解析、领域缓存、fetch/XHR 捕获与 TTL 刷新：
   - `components/autoMaxFoundation.js`
   - `tools/automax/data.js`
   - `tools/automax/lifecycle.js`
   - `tools/automax/constants.js`

2. SCT 内的 AutoMax 入口、页面动作设置、运行时长和饱和度：
   - `components/autoMaxPanel.js`
   - `components/autoMaxRuntimeSaturation.js`
   - `tools/automax/settings.js`
   - `tools/automax/runtime.js`
   - `tools/automax/saturation.js`

3. 商店、交易所、入库合同、出库 MP、仓库的零售利润：
   - `components/retailDisplayProfit.js`
   - `tools/automax/retailProfit.js`
   - `components/autoMaxMarketProfit.js`
   - `components/autoMaxIncomingContractProfit.js`
   - `components/autoMaxOutgoingMP.js`
   - `components/autoMaxWarehouseProfit.js`
   - `tools/automax/retailMath.js`

4. 易腐品预测、MP 折扣利润、高管辅助、聊天/地图辅助：
   - `components/autoMaxForecast.js`
   - `tools/automax/forecast.js`
   - `components/autoMaxMPProfit.js`
   - `components/autoMaxExecutive.js`
   - `components/autoMaxAccessibility.js`
   - `tools/automax/assist.js`

## 本次面板修复

用户截图中的第二层来自 `autoMaxPanel.settingUI` 被 SCT 的通用“组件设置界面”再包了一层。

现在的行为是：

- SCT 的 AutoMax 前台按钮：打开唯一的 AutoMax 控制面板。
- SCT 的 AutoMax 设置按钮：打开同一个 AutoMax 控制面板，并直接展开“页面动作”。
- 不再生成 SCT 通用的第二层设置模态。

实现位置：

- `components/autoMaxPanel.js`：使用 `settingAction`，移除了独立的 `settingUI` 模态内容。
- `components/basisCPT.js`：支持组件可选的 `settingAction`；其余组件仍走原有 `settingUI`。

## 用户确认过的产品约束

- 不添加第二个全局 AutoMax 启动按钮。
- AutoMax 只能复用现有 SCT 组件入口。
- 先写真实功能，统一验证延后。
- 当前回合到此结束；如恢复工作，先从构建和游戏内验证开始。

## 后续建议的恢复顺序

1. 先运行构建，确保当前所有新增组件进入 `dist/build.user.js`。
2. 先检查 SCT 中 AutoMax 的前台和设置按钮是否都只打开同一个面板。
3. 在真实 SimCompanies 页面逐项验证：商店利润、交易所时利润、入库合同、出库 MP、仓库利润、预测和高管页。
4. 再处理剩余的原版细节兼容，例如原董事会拖拽交互、所有特定 DOM 选择器和历史数据展示的边缘情形。

## 已知风险

- 最新源码未构建，安装版尚未包含本轮的新功能。
- SimCompanies 是 SPA，部分 DOM 类名和 aria 文案可能因游戏更新或语言切换而变化。
- 原脚本的价格扫描边界不安全；迁移后的 Worker 使用了上限以避免页面卡住，因此极端成本数据可能显示“搜索上限”或无结果。
- 高管、合同和市场接口需在真实已登录游戏页面取得响应，离线 fixture 无法证明这些数据路径。
