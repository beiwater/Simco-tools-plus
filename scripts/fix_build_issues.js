const fs = require('node:fs');
const path = require('node:path');

// 修复 webpack.config.js
function fixWebpackConfig() {
  const configPath = path.join(__dirname, '..', 'webpack.config.js');
  let configContent = fs.readFileSync(configPath, 'utf-8');
  
  // 检查是否已经导入了path模块
  if (!configContent.includes('const path = require("node:path");')) {
    // 在文件开头添加path导入
    configContent = configContent.replace(
      'const fs = require("node:fs");',
      'const fs = require("node:fs");\nconst path = require("node:path");'
    );
    
    fs.writeFileSync(configPath, configContent, 'utf-8');
    console.log('✅ 已修复 webpack.config.js - 添加了 path 模块导入');
  } else {
    console.log('✅ webpack.config.js 已经包含 path 模块导入');
  }
}

// 修复 postBuild.js
function fixPostBuild() {
  const postBuildPath = path.join(__dirname, 'postBuild.js');
  let postBuildContent = fs.readFileSync(postBuildPath, 'utf-8');
  
  // 检查是否已经导入了fs模块
  if (!postBuildContent.includes('let fs = require("node:fs");')) {
    // 在文件开头添加fs导入
    postBuildContent = postBuildContent.replace(
      'let path = require("node:path");',
      'let path = require("node:path");\nlet fs = require("node:fs");'
    );
    
    fs.writeFileSync(postBuildPath, postBuildContent, 'utf-8');
    console.log('✅ 已修复 postBuild.js - 添加了 fs 模块导入');
  } else {
    console.log('✅ postBuild.js 已经包含 fs 模块导入');
  }
}

// 执行修复
console.log('开始修复构建问题...');
fixWebpackConfig();
fixPostBuild();
console.log('\n构建问题修复完成！现在您可以使用 npm run build 或 yarn build 重新构建项目了。');