let fs = require('node:fs');
let path = require('node:path');
let distPath = path.join(__dirname, 'dist');

// 添加前缀
const addPreText = (nowVersion) => {
  let jsFilePath = path.join(distPath, "build.user.js");
  let jsFile = fs.readFileSync(jsFilePath);
  let preText = [
    `// ==UserScript==`,
    `// @name         SimComps Tools`,
    `// @namespace    https://github.com/beiwater/simco-pluginDLchagne`,
    `// @version      ${nowVersion.join(".")}`,
    `// @description  SimCompanies 中文辅助工具；默认关闭全部可选功能。`,
    `// @author       LIYUE`,
    `// @copyright    Copyright (C) LIYUE; incorporates code from gangbaRuby/SimCompanies-Scripts and ShenHaiSu/SimComp-Tools.`,
    `// @match        https://www.simcompanies.com/*`,
    `// @homepageURL  https://github.com/beiwater/simco-pluginDLchagne`,
    `// @license      AGPL-3.0-or-later`,
    `// @grant        GM_xmlhttpRequest`,
    `// @connect      api.simcotools.com`,
    `// @noframes`,
    `// ==/UserScript==`,
    ``,
    ``
  ].join("\n");
  fs.writeFileSync(jsFilePath, preText + jsFile, "utf-8");
}

// 获取版本号
const getVersion = () => {
  const oldFile = JSON.parse(fs.readFileSync(path.join(distPath, "version.json"), 'utf-8'));
  return oldFile.version;
}


// 入口函数
(async function () {
  try {
    let nowVersion = getVersion();
    addPreText(nowVersion);
    console.log("Add Success.  " + nowVersion.join("."));
  } catch (e) {
    console.log(e);
    console.log("Add Fail.");
  }
})()
