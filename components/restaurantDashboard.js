const BaseComponent = require("../tools/baseComponent.js");
const { tools, runtimeData, indexDBData } = require("../tools/tools.js");
const { openSecondaryWindow } = require("../tools/secondaryWindowHost.js");

function buildingIdFromUrl(url = location.href) {
  return String(url).match(/\/(?:b|buildings)\/(\d+)(?:\/restaurant)?\/?$/)?.[1] || "";
}

function formatMoney(value) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return `$${Math.round(Number(value)).toLocaleString()}`;
}

function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

class restaurantDashboard extends BaseComponent {
  constructor() {
    super();
    this.name = "餐厅实时看板";
    this.describe = "进入餐厅建筑管理页自动嵌入分析卡片；在地图页使用时汇总显示全厂所有餐厅的数据列表。";
    this.enable = false;
    this.tagList = ["工具", "AutoMax"];
    this.commonFuncList = [
      {
        match: () => this.isBuildingPage(),
        func: this.mountInlinePanel,
      },
      {
        match: () => this.isLandscapePage(),
        func: this.mountLandscapePanel,
      },
    ];
  }

  frontUI = this.open;
  cssText = [`
    .sct-rt-card { background: rgba(30, 35, 32, 0.75); backdrop-filter: blur(4px); border: 1px solid var(--sct-border-strong, rgba(255, 255, 255, 0.2)); border-radius: 8px; color: var(--fontColor, #fff); margin-bottom: 12px; padding: 14px; }
    .sct-rt-card header { align-items: center; display: flex; justify-content: space-between; margin-bottom: 8px; }
    .sct-rt-card header strong { font-size: 15px; }
    .sct-rt-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
    .sct-rt-actions button { background: var(--sct-control, rgba(255, 255, 255, 0.1)); border: 1px solid var(--sct-control-hover, rgba(255, 255, 255, 0.25)); color: var(--fontColor); cursor: pointer; font-size: 12px; padding: 4px 12px; border-radius: 4px; }
    .sct-rt-actions button:hover { background: rgba(255, 255, 255, 0.2); }
    .sct-rt-status { color: var(--sct-text-secondary, #ccc); font-size: 12px; margin-bottom: 8px; }
    .sct-rt-table-wrap { overflow-x: auto; }
    .sct-rt-table-wrap table { border-collapse: collapse; width: 100%; }
    .sct-rt-table-wrap th, .sct-rt-table-wrap td { border-bottom: 1px solid var(--sct-border, rgba(255,255,255,0.15)); font-size: 12px; padding: 6px 8px; text-align: left; }
    .sct-rt-badge { border-radius: 3px; font-size: 11px; padding: 2px 6px; }
    .sct-rt-badge-success { background: #2e7d32; color: #fff; }
    .sct-rt-badge-warning { background: #ed6c02; color: #fff; }
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
    // 优先尝试从原生 API 获取，若被 403 / 防火墙拦截，则使用插件自身已有的 indexDB 缓存
    try {
      return await this.fetchJson("/api/v2/companies/me/buildings/");
    } catch (e) {
      const realm = runtimeData.basisCPT?.realm ?? 0;
      const cached = indexDBData.basisCPT?.building?.[realm];
      if (Array.isArray(cached) && cached.length > 0) return cached;
      throw e;
    }
  }

  async loadAllRestaurantsData() {
    const buildingsRaw = await this.getBuildings();
    const buildings = Array.isArray(buildingsRaw) ? buildingsRaw : [];
    const restaurants = buildings.filter((b) => b.restaurantProperties || b.kind === "r" || b.kind === "R");
    
    const list = [];
    for (const r of restaurants) {
      let runs = [];
      try {
        runs = await this.fetchJson(`/api/v2/companies/buildings/${r.id}/restaurant-runs/`);
      } catch (e) {}
      const props = r.restaurantProperties || {};
      const latestRun = Array.isArray(runs) && runs[0] ? runs[0] : null;
      const profit = latestRun ? (latestRun.profit ?? (latestRun.revenue != null ? latestRun.revenue - (latestRun.cogs || 0) - (latestRun.wages || 0) : null)) : null;

      list.push({
        buildingId: r.id,
        name: r.name || r.kind || "餐厅",
        size: r.size ?? 1,
        isLuxury: Boolean(props.isLuxury),
        rating: props.rating ?? "-",
        menuPrice: props.menuPrice ?? "-",
        occupancy: props.occupancy != null ? formatPercent(props.occupancy) : "-",
        openState: r.busy?.restaurant_open ? "营业中" : (r.busy ? "进行中" : "未营业"),
        latestProfit: formatMoney(profit),
      });
    }
    return list;
  }

  async loadSingleRestaurantData(buildingId) {
    const [buildingsRaw, runsRaw] = await Promise.all([
      this.getBuildings(),
      this.fetchJson(`/api/v2/companies/buildings/${buildingId}/restaurant-runs/`),
    ]);
    const buildings = Array.isArray(buildingsRaw) ? buildingsRaw : [];
    const target = buildings.find((b) => String(b.id) === String(buildingId));
    const runs = Array.isArray(runsRaw) ? runsRaw : [];
    return { target, runs };
  }

  mountInlinePanel() {
    if (!this.enable) return;
    const bId = buildingIdFromUrl();
    if (!bId) return;

    // 检查页面是否存在餐厅详情容器
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
        <button type="button" class="btn-refresh">刷新当前餐厅数据</button>
      </div>
      <div class="sct-rt-status">建筑 #${bId} · 点击刷新获取最新数据</div>
      <div class="sct-rt-body"></div>
    `;

    mountTarget.before(card);

    const refreshBtn = card.querySelector(".btn-refresh");
    const statusDiv = card.querySelector(".sct-rt-status");
    const bodyDiv = card.querySelector(".sct-rt-body");

    const doRefresh = async () => {
      refreshBtn.disabled = true;
      statusDiv.textContent = "正在加载餐厅数据与历史 Run...";
      try {
        const { target, runs } = await this.loadSingleRestaurantData(bId);
        statusDiv.textContent = `更新时间: ${new Date().toLocaleTimeString()} · 成功获取 ${runs.length} 条结算历史`;
        bodyDiv.innerHTML = this.renderSingleRunTable(runs);
      } catch (err) {
        statusDiv.textContent = `加载失败: ${err.message}`;
      } finally {
        refreshBtn.disabled = false;
      }
    };

    refreshBtn.addEventListener("click", doRefresh);
    doRefresh();
  }

  mountLandscapePanel() {
    // 地图页可根据需求自动或通过窗口提供全厂餐厅大盘
  }

  renderSingleRunTable(runs) {
    if (!runs.length) return `<div style="padding:8px; color:#aaa;">暂无结算历史记录。</div>`;
    let html = `<div class="sct-rt-table-wrap"><table>
      <thead><tr><th>时间</th><th>状态</th><th>评分</th><th>菜单价</th><th>COGS</th><th>工资</th><th>收入</th><th>利润</th></tr></thead>
      <tbody>`;
    for (const run of runs.slice(0, 15)) {
      const dt = run.datetime ? new Date(run.datetime).toLocaleString() : "-";
      const statusBadge = run.resolved === false ? `<span class="sct-rt-badge sct-rt-badge-warning">进行中</span>` : `<span class="sct-rt-badge sct-rt-badge-success">已结算</span>`;
      const cogs = run.cogs ?? run.cost ?? 0;
      const wages = run.wages ?? run.wageCost ?? 0;
      const revenue = run.revenue ?? run.income ?? 0;
      const profitVal = run.profit ?? (revenue ? revenue - cogs - wages : 0);

      html += `<tr>
        <td>${dt}</td>
        <td>${statusBadge}</td>
        <td>${run.rating ?? "-"}</td>
        <td>${formatMoney(run.menuPrice)}</td>
        <td>${formatMoney(cogs)}</td>
        <td>${formatMoney(wages)}</td>
        <td>${formatMoney(revenue)}</td>
        <td><strong style="color:${profitVal >= 0 ? '#4caf50' : '#f44336'}">${formatMoney(profitVal)}</strong></td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
    return html;
  }

  open() {
    const content = document.createElement("section");
    content.className = "sct-rt-card";
    content.style.minWidth = "650px";
    content.innerHTML = `
      <header><strong>🍽️ 全厂餐厅汇总大盘</strong></header>
      <div class="sct-rt-actions">
        <button type="button" class="btn-refresh-all">扫描全厂餐厅数据</button>
      </div>
      <div class="sct-rt-status">点击按钮扫描公司所有餐厅状态</div>
      <div class="sct-rt-body"></div>
    `;

    openSecondaryWindow({ id: "sct-restaurant-all-dashboard", title: "全厂餐厅大盘", content });

    const btn = content.querySelector(".btn-refresh-all");
    const status = content.querySelector(".sct-rt-status");
    const body = content.querySelector(".sct-rt-body");

    const doScan = async () => {
      btn.disabled = true;
      status.textContent = "正在拉取公司建筑与各餐厅运行记录...";
      try {
        const list = await this.loadAllRestaurantsData();
        status.textContent = `共扫描到 ${list.length} 家餐厅 (更新于 ${new Date().toLocaleTimeString()})`;
        body.innerHTML = `
          <div class="sct-rt-table-wrap"><table>
            <thead><tr><th>ID</th><th>名称</th><th>规模</th><th>类型</th><th>评分</th><th>菜单价</th><th>上座率</th><th>状态</th><th>上一轮利润</th></tr></thead>
            <tbody>
              ${list.length ? list.map(r => `
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
              `).join("") : `<tr><td colspan="9">未发现餐厅建筑</td></tr>`}
            </tbody>
          </table></div>
        `;
      } catch (err) {
        status.textContent = `扫描失败: ${err.message}`;
      } finally {
        btn.disabled = false;
      }
    };

    btn.addEventListener("click", doScan);
    doScan();
  }
}

new restaurantDashboard();

module.exports = restaurantDashboard;
