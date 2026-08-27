const BaseComponent = require("../tools/baseComponent.js");
const { tools, runtimeData, indexDBData } = require("../tools/tools.js");
const { openSecondaryWindow } = require("../tools/secondaryWindowHost.js");

const PRESET_STORAGE_KEY = "scRestaurantMenuPresets";
const AUTO_HISTORY_KEY = "scRestaurantAutoMenuHistory";

const FOOD_MAP = {
  117: "牛奶",
  119: "咖啡",
  121: "面包",
  122: "芝士",
  123: "苹果派",
  124: "橙汁",
  125: "苹果汁",
  126: "姜汁啤酒",
  129: "汉堡包",
  130: "千层面",
  131: "肉丸",
  132: "鸡尾酒",
  134: "黄油",
  142: "沙拉",
  143: "咖喱角",
  149: "南瓜汤",
};

function buildingIdFromUrl(url) {
  const target = url ?? (typeof location !== "undefined" ? location.href : "");
  return String(target).match(/\/(?:b|buildings)\/(\d+)(?:\/restaurant)?\/?$/)?.[1] || "";
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function formatMoney(value) {
  if (value == null || !Number.isFinite(Number(value))) return "--";
  return `$${Math.round(Number(value)).toLocaleString()}`;
}

function formatPercent(value) {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "--";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function foodName(kind) {
  return FOOD_MAP[kind] || `资源 #${kind}`;
}

function runProfit(run) {
  if (!run) return null;
  if (run.profit != null) return run.profit;
  if (run.revenue == null) return null;
  return Number(run.revenue || 0) - Number(run.cogs || 0) - Number(run.wages || 0);
}

function profit(run) {
  return runProfit(run);
}

function mergeRuns(stored = [], incoming = [], limit = 50) {
  const map = new Map();
  for (const item of toArray(stored)) {
    if (item && item.id != null) map.set(item.id, item);
  }
  for (const item of toArray(incoming)) {
    if (item && item.id != null) map.set(item.id, item);
  }
  return Array.from(map.values())
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
    .slice(0, limit);
}

function runProfitMargin(run) {
  const p = runProfit(run);
  if (p == null || !run?.revenue) return null;
  return p / run.revenue;
}




class restaurantDashboard extends BaseComponent {
  constructor() {
    super();
    this.name = "餐厅实时看板";
    this.describe = "全功能移植 Simco-Dash：进入餐厅自动嵌入卡片、包含菜单菜谱预设保存、JSON/CSV导出、 Run 详细指标统计、全厂餐厅汇总等。";
    this.enable = false;
    this.tagList = ["工具", "AutoMax"];
    this.commonFuncList = [
      {
        match: () => this.isBuildingPage(),
        func: this.mountInlinePanel,
      },
    ];
  }

  isBuildingPage = () => {
    return /\/b\/\d+\/?$/.test(location.pathname);
  };

  isLandscapePage = () => {
    return /\/landscape\/?$/.test(location.pathname);
  };

  frontUI = this.open;
  cssText = [`
    .sct-rt-card { background: rgba(30, 35, 32, 0.85); backdrop-filter: blur(6px); border: 1px solid var(--sct-border-strong, rgba(255, 255, 255, 0.25)); border-radius: 8px; color: var(--fontColor, #fff); margin-bottom: 12px; padding: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .sct-rt-card header { align-items: center; display: flex; justify-content: space-between; margin-bottom: 10px; }
    .sct-rt-card header strong { font-size: 16px; color: #4caf50; }
    .sct-rt-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    .sct-rt-actions button { background: var(--sct-control, rgba(255, 255, 255, 0.12)); border: 1px solid var(--sct-control-hover, rgba(255, 255, 255, 0.3)); color: var(--fontColor); cursor: pointer; font-size: 12px; padding: 5px 12px; border-radius: 4px; font-weight: bold; }
    .sct-rt-actions button:hover { background: rgba(255, 255, 255, 0.25); }
    .sct-rt-status { color: var(--sct-text-secondary, #ccc); font-size: 12px; margin-bottom: 10px; }
    .sct-rt-menu-box { background: rgba(0, 0, 0, 0.25); border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; font-size: 13px; }
    .sct-rt-presets-box { background: rgba(0, 0, 0, 0.2); border: 1px dashed rgba(255, 255, 255, 0.2); border-radius: 6px; padding: 8px; margin-bottom: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .sct-rt-presets-box input { background: rgba(0,0,0,0.4); border: 1px solid #666; color: #fff; padding: 4px 8px; font-size: 12px; border-radius: 4px; }
    .sct-rt-presets-box select { background: rgba(0,0,0,0.4); border: 1px solid #666; color: #fff; padding: 4px 8px; font-size: 12px; border-radius: 4px; }
    .sct-rt-summary-pills { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 10px; font-size: 12px; }
    .sct-rt-pill { background: rgba(255,255,255,0.08); padding: 4px 8px; border-radius: 4px; }
    .sct-rt-table-wrap { overflow-x: auto; max-height: 400px; }
    .sct-rt-table-wrap table { border-collapse: collapse; width: 100%; }
    .sct-rt-table-wrap th, .sct-rt-table-wrap td { border-bottom: 1px solid var(--sct-border, rgba(255,255,255,0.15)); font-size: 12px; padding: 6px 8px; text-align: left; }
    .sct-rt-badge { border-radius: 3px; font-size: 11px; padding: 2px 6px; }
    .sct-rt-badge-success { background: #2e7d32; color: #fff; }
    .sct-rt-badge-warning { background: #ed6c02; color: #fff; }
    .sct-rt-badge-danger { background: #c62828; color: #fff; }
  `];

  async fetchJson(path) {
    if (typeof GM_xmlhttpRequest === "function") {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: path.startsWith("http") ? path : `${location.origin}${path}`,
          headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
          onload: (res) => {
            if (res.status >= 200 && res.status < 300) {
              try { resolve(JSON.parse(res.responseText)); } catch (e) { reject(e); }
            } else {
              reject(new Error(`HTTP ${res.status}`));
            }
          },
          onerror: (err) => reject(err),
        });
      });
    }
    const res = await fetch(path, { credentials: "include", headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async getBuildings() {
    try {
      return await this.fetchJson("/api/v2/companies/me/buildings/");
    } catch (e) {
      const realm = runtimeData.basisCPT?.realm ?? 0;
      const cached = indexDBData.basisCPT?.building?.[realm];
      if (Array.isArray(cached) && cached.length > 0) return cached;
      throw e;
    }
  }

  // 菜谱预设相关 API (Simco-Dash)
  getPresets() {
    try { return JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || "[]"); } catch { return []; }
  }

  savePreset(name, restaurant) {
    if (!restaurant?.menu) return;
    const preset = {
      id: String(Date.now()),
      name: name || `${restaurant.name || "餐厅"} ${new Date().toLocaleTimeString()}`,
      savedAt: new Date().toLocaleString(),
      menuPrice: restaurant.menuPrice,
      menu: JSON.parse(JSON.stringify(restaurant.menu)),
    };
    const list = [preset, ...this.getPresets()].slice(0, 50);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(list));
    return preset;
  }

  deletePreset(id) {
    const list = this.getPresets().filter((item) => item.id !== id);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(list));
  }

  // 下载 JSON 文件 (Simco-Dash)
  downloadJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `simcompanies-restaurant-${data.buildingId || "dash"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async loadSingleRestaurantData(buildingId) {
    const [buildingsRaw, runsRaw] = await Promise.all([
      this.getBuildings(),
      this.fetchJson(`/api/v2/companies/buildings/${buildingId}/restaurant-runs/`),
    ]);
    const buildings = Array.isArray(buildingsRaw) ? buildingsRaw : [];
    const target = buildings.find((b) => String(b.id) === String(buildingId));
    const runs = Array.isArray(runsRaw) ? runsRaw : [];
    return { buildingId, target, runs };
  }

  async loadAllRestaurantsData() {
    const buildingsRaw = await this.getBuildings();
    const buildings = Array.isArray(buildingsRaw) ? buildingsRaw : [];
    const restaurants = buildings.filter((b) => b.restaurantProperties || b.kind === "r" || b.kind === "R");
    
    const list = [];
    for (const r of restaurants) {
      let runs = [];
      try { runs = await this.fetchJson(`/api/v2/companies/buildings/${r.id}/restaurant-runs/`); } catch {}
      const props = r.restaurantProperties || {};
      const latestRun = Array.isArray(runs) && runs[0] ? runs[0] : null;
      const profitVal = latestRun ? runProfit(latestRun) : null;

      list.push({
        buildingId: r.id,
        name: r.name || r.kind || "餐厅",
        size: r.size ?? 1,
        isLuxury: Boolean(props.isLuxury),
        rating: props.rating ?? "-",
        menuPrice: props.menuPrice ?? "-",
        occupancy: props.occupancy != null ? formatPercent(props.occupancy) : "-",
        openState: r.busy?.restaurant_open ? "营业中" : (r.busy ? "进行中" : "未营业"),
        latestProfit: formatMoney(profitVal),
      });
    }
    return list;
  }

  mountInlinePanel = () => {
    if (!this.enable) return;
    const bId = buildingIdFromUrl();
    if (!bId) return;

    const mountTarget = document.querySelector("#page > div > div > div > div.col-md-9.col-sm-8 > div > div > div > div:nth-child(2)");
    if (!mountTarget) return;
    if (document.getElementById("sct-restaurant-inline-card")) return;

    const card = document.createElement("section");
    card.id = "sct-restaurant-inline-card";
    card.className = "sct-rt-card";
    card.innerHTML = `
      <header>
        <strong>🍽️ 餐厅数据分析看板 (Simco-Dash)</strong>
      </header>
      <div class="sct-rt-actions">
        <button type="button" class="btn-refresh">🔄 刷新数据</button>
        <button type="button" class="btn-download">📥 下载 JSON</button>
      </div>
      <div class="sct-rt-status">建筑 #${bId} · 点击刷新加载最新 Run 数据</div>
      <div class="sct-rt-body"></div>
    `;

    mountTarget.before(card);

    const refreshBtn = card.querySelector(".btn-refresh");
    const downloadBtn = card.querySelector(".btn-download");
    const statusDiv = card.querySelector(".sct-rt-status");
    const bodyDiv = card.querySelector(".sct-rt-body");

    let currentData = null;

    const doRefresh = async () => {
      refreshBtn.disabled = true;
      statusDiv.textContent = "正在加载餐厅数据与历史 Run 数据...";
      try {
        currentData = await this.loadSingleRestaurantData(bId);
        statusDiv.textContent = `更新时间: ${new Date().toLocaleTimeString()} · 获取到 ${currentData.runs.length} 条数据`;
        this.renderSinglePanel(bodyDiv, currentData, () => doRefresh());
      } catch (err) {
        statusDiv.textContent = `加载失败: ${err.message}`;
      } finally {
        refreshBtn.disabled = false;
      }
    };

    downloadBtn.addEventListener("click", () => {
      if (currentData) this.downloadJson(currentData);
      else tools.alert("请先刷新加载数据后即可下载。");
    });

    refreshBtn.addEventListener("click", doRefresh);
    doRefresh();
  };

  renderSinglePanel(bodyDiv, data, onReload) {
    const { target, runs } = data;
    const props = target?.restaurantProperties || {};
    
    // 渲染当前菜单
    const menuObj = props.menu || props.restaurantMenu || {};
    const menuItems = [];
    for (const cat of ["saladBar", "mains", "drinks"]) {
      if (Array.isArray(menuObj[cat])) {
        for (const item of menuObj[cat]) {
          const kind = typeof item === "object" ? item.kind || item.resourceId : item;
          if (kind) menuItems.push(foodName(kind));
        }
      }
    }

    const menuText = menuItems.length ? menuItems.join("、") : "未读取到菜单菜品";

    // 统计 summary
    const validRuns = runs.filter(r => r.resolved !== false);
    const profits = validRuns.map(r => runProfit(r)).filter(v => v != null);
    const avgProfit = profits.length ? profits.reduce((a,b)=>a+b,0)/profits.length : null;
    const occupancies = validRuns.map(r => r.occupancy).filter(v => typeof v === "number");
    const avgOcc = occupancies.length ? occupancies.reduce((a,b)=>a+b,0)/occupancies.length : null;

    const presets = this.getPresets();
    const presetOptions = presets.map(p => `<option value="${p.id}">${p.name}</option>`).join("");

    bodyDiv.innerHTML = `
      <div class="sct-rt-menu-box">
        <strong>📋 当前菜单：</strong> ${menuText} ${props.menuPrice ? `(单价: $${props.menuPrice})` : ""}
      </div>
      <div class="sct-rt-presets-box">
        <span>🍱 菜谱预设管理：</span>
        <input class="preset-name-input" placeholder="输入预设名称">
        <button type="button" class="btn-save-preset">保存当前菜谱</button>
        <select class="preset-select"><option value="">-- 选择已有预设 --</option>${presetOptions}</select>
        <button type="button" class="btn-del-preset">删除预设</button>
      </div>
      <div class="sct-rt-summary-pills">
        <div class="sct-rt-pill">历史 Runs: <strong>${runs.length}</strong></div>
        <div class="sct-rt-pill">平均利润: <strong>${formatMoney(avgProfit)}</strong></div>
        <div class="sct-rt-pill">平均上座率: <strong>${formatPercent(avgOcc)}</strong></div>
      </div>
      <div class="sct-rt-table-wrap">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>状态</th>
              <th>评分</th>
              <th>上座率</th>
              <th>菜单价</th>
              <th>COGS</th>
              <th>工资</th>
              <th>收入</th>
              <th>利润</th>
              <th>利润率</th>
            </tr>
          </thead>
          <tbody>
            ${
              runs.length ? runs.map(r => {
                const p = runProfit(r);
                const margin = runProfitMargin(r);
                const isLoss = p != null && p < 0;
                const badge = r.resolved === false ? `<span class="sct-rt-badge sct-rt-badge-warning">进行中</span>` : (isLoss ? `<span class="sct-rt-badge sct-rt-badge-danger">亏损</span>` : `<span class="sct-rt-badge sct-rt-badge-success">盈利</span>`);
                const dt = r.datetime ? new Date(r.datetime).toLocaleString() : "-";
                return `
                  <tr>
                    <td>${dt}</td>
                    <td>${badge}</td>
                    <td>${r.rating ?? r.newRating ?? "-"}</td>
                    <td>${formatPercent(r.occupancy)}</td>
                    <td>${formatMoney(r.menuPrice)}</td>
                    <td>${formatMoney(r.cogs)}</td>
                    <td>${formatMoney(r.wages)}</td>
                    <td>${formatMoney(r.revenue)}</td>
                    <td><strong style="color:${isLoss ? '#f44336' : '#4caf50'}">${formatMoney(p)}</strong></td>
                    <td>${formatPercent(margin)}</td>
                  </tr>
                `;
              }).join("") : `<tr><td colspan="10" style="text-align:center;">暂无 Run 记录</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;

    // 绑定预设交互
    const saveBtn = bodyDiv.querySelector(".btn-save-preset");
    const nameInput = bodyDiv.querySelector(".preset-name-input");
    const select = bodyDiv.querySelector(".preset-select");
    const delBtn = bodyDiv.querySelector(".btn-del-preset");

    saveBtn.addEventListener("click", () => {
      if (!target?.restaurantProperties) return tools.alert("未读取到餐厅菜单数据。");
      const name = nameInput.value.trim();
      this.savePreset(name, { name: target.name, menuPrice: props.menuPrice, menu: props.menu, size: target.size });
      tools.alert("已成功保存菜谱预设！");
      onReload();
    });

    delBtn.addEventListener("click", () => {
      const val = select.value;
      if (!val) return tools.alert("请先选择要删除的预设。");
      this.deletePreset(val);
      tools.alert("预设已删除。");
      onReload();
    });
  }

  open() {
    const content = document.createElement("section");
    content.className = "sct-rt-card";
    content.style.minWidth = "700px";
    content.innerHTML = `
      <header><strong>🍽️ 全厂餐厅汇总大盘 (Simco-Dash)</strong></header>
      <div class="sct-rt-actions">
        <button type="button" class="btn-refresh-all">🔄 扫描全厂餐厅数据</button>
        <button type="button" class="btn-download-all">📥 导出全厂 JSON</button>
      </div>
      <div class="sct-rt-status">点击按钮扫描公司所有餐厅状态</div>
      <div class="sct-rt-body"></div>
    `;

    openSecondaryWindow({ id: "sct-restaurant-all-dashboard", title: "全厂餐厅大盘", content });

    const btn = content.querySelector(".btn-refresh-all");
    const downloadAllBtn = content.querySelector(".btn-download-all");
    const status = content.querySelector(".sct-rt-status");
    const body = content.querySelector(".sct-rt-body");

    let allData = null;

    const doScan = async () => {
      btn.disabled = true;
      status.textContent = "正在拉取公司所有餐厅数据与 Runs 记录...";
      try {
        allData = await this.loadAllRestaurantsData();
        status.textContent = `共扫描到 ${allData.length} 家餐厅 (更新于 ${new Date().toLocaleTimeString()})`;
        body.innerHTML = `
          <div class="sct-rt-table-wrap"><table>
            <thead><tr><th>ID</th><th>名称</th><th>规模</th><th>类型</th><th>评分</th><th>菜单价</th><th>上座率</th><th>状态</th><th>上一轮利润</th></tr></thead>
            <tbody>
              ${allData.length ? allData.map(r => `
                <tr>
                  <td>${r.buildingId}</td>
                  <td><strong>${r.name}</strong></td>
                  <td>${r.size}</td>
                  <td>${r.isLuxury ? "豪华" : "经济"}</td>
                  <td>${r.rating}</td>
                  <td>${r.menuPrice}</td>
                  <td>${r.occupancy}</td>
                  <td>${r.openState}</td>
                  <td>${r.latestProfit}</td>
                </tr>
              `).join("") : `<tr><td colspan="9" style="text-align:center;">未发现餐厅建筑</td></tr>`}
            </tbody>
          </table></div>
        `;
      } catch (err) {
        status.textContent = `扫描失败: ${err.message}`;
      } finally {
        btn.disabled = false;
      }
    };

    downloadAllBtn.addEventListener("click", () => {
      if (allData) this.downloadJson({ mode: "all-restaurants", data: allData, time: new Date().toISOString() });
      else tools.alert("请先扫描后再导出。");
    });

    btn.addEventListener("click", doScan);
    doScan();
  }
}


new restaurantDashboard();

if (typeof module !== "undefined") {
  module.exports = restaurantDashboard;
  module.exports.buildingIdFromUrl = buildingIdFromUrl;
  module.exports.formatMoney = formatMoney;
  module.exports.formatPercent = formatPercent;
  module.exports.foodName = foodName;
  module.exports.runProfit = runProfit;
  module.exports.profit = profit;
  module.exports.mergeRuns = mergeRuns;
  module.exports.toArray = toArray;
}
