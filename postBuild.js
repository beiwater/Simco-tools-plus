let fs = require('node:fs');
let path = require('node:path');
let { execSync } = require('node:child_process');
let distPath = path.join(__dirname, 'dist');
let componentsDir = path.join(__dirname, 'components');

// 统计组件总数 (BaseComponent 类实例)
const countComponents = () => {
  let count = 0;
  const files = fs.readdirSync(componentsDir).filter((file) => file.endsWith('.js'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
    const matches = content.match(/class\s+\w+\s+extends\s+BaseComponent/g);
    if (matches) count += matches.length;
  }
  return count;
};

// 格式化当前时间 YYMMDDHHmmss
const getFormattedTimestamp = () => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd}${hh}${min}${ss}`;
};

// 计算本次修改的行数变动，决定小版本累加值 (小更新+1, 大更新>100行+2, 超大更新>300行+5)
const calculateBump = () => {
  try {
    const diff = execSync('git diff HEAD~1 --stat', { encoding: 'utf-8' });
    const match = diff.match(/(\d+)\s+insertions?\(\+\),\s*(\d+)\s+deletions?\(-\)/) || diff.match(/(\d+)\s+insertions?\(\+\)/) || diff.match(/(\d+)\s+deletions?\(-\)/);
    if (match) {
      const insertions = parseInt(match[1] || 0, 10);
      const deletions = parseInt(match[2] || 0, 10);
      const totalLines = insertions + deletions;
      if (totalLines >= 300) return 5;
      if (totalLines >= 100) return 2;
    }
  } catch (e) {}
  return 1;
};

// 获取与更新版本号
const getAndUpdateVersion = () => {
  const versionFile = path.join(distPath, "version.json");
  let versionData = { version: [3, 0, 1], cptCount: 66 };
  if (fs.existsSync(versionFile)) {
    try { versionData = JSON.parse(fs.readFileSync(versionFile, 'utf-8')); } catch (e) {}
  }

  let [major, minor, patch] = versionData.version || [3, 0, 1];
  const bump = calculateBump();
  minor = Number(minor || 0) + bump;
  const timestamp = getFormattedTimestamp();
  const cptCount = countComponents();

  // nowVersion: [主版本, 自动增加的小版本, 时间戳, 组件数量]
  const fullVersion = [major, minor, `${timestamp}_cpt${cptCount}`];
  
  // 更新保存 version.json
  fs.writeFileSync(versionFile, JSON.stringify({ version: [major, minor, Number(timestamp)], cptCount, patch: timestamp }, null, 2), 'utf-8');
  return { displayVersion: fullVersion.join('.'), major, minor, timestamp, cptCount };
};

// 添加 Userscript Header 前缀
const addPreText = ({ displayVersion }) => {
  let jsFilePath = path.join(distPath, "build.user.js");
  let jsFile = fs.readFileSync(jsFilePath);
  let preText = [
    `// ==UserScript==`,
    `// @name         SimComps Tools`,
    `// @namespace    https://github.com/beiwater/simco-pluginDLchagne`,
    `// @version      ${displayVersion}`,
    `// @description  SimCompanies 中文辅助工具；内置 66+ 组件，默认关闭全部可选功能。`,
    `// @author       LIYUE`,
    `// @copyright    Copyright (C) 2026 LIYUE. Framework and LIYUE components: MIT; AutoMax components: AGPL-3.0-or-later.`,
    `// @match        https://www.simcompanies.com/*`,
    `// @run-at       document-start`,
    `// @homepageURL  https://github.com/beiwater/simco-pluginDLchagne`,
    `// @license      AGPL-3.0-or-later`,
    `// @grant        GM_xmlhttpRequest`,
    `// @grant        unsafeWindow`,
    `// @connect      api.simcotools.com`,
    `// @connect      docs.google.com`,
    `// @connect      translate.googleapis.com`,
    `// @noframes`,
    `// ==/UserScript==`,
    ``,
    ``
  ].join("\n");
  fs.writeFileSync(jsFilePath, preText + jsFile, "utf-8");
};

// 入口函数
(async function () {
  try {
    let versionInfo = getAndUpdateVersion();
    addPreText(versionInfo);
    console.log(`Add Success. Version: ${versionInfo.displayVersion} (Components: ${versionInfo.cptCount})`);
  } catch (e) {
    console.log(e);
    console.log("Add Fail.");
  }
})();
