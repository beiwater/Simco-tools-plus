const path = require('path');
const fs = require("node:fs");
const webpack = require("webpack");
const moment = require("moment");
const TerserPlugin = require('terser-webpack-plugin');

// const timeStamp = moment().format('MMDD-HHmmss');
const fileName = `build.user.js`;
const distPath = path.join(__dirname, 'dist');
const nowVersion = [2];

// 生成版本号
const genVersion = () => {
  let cptCount = fs.readdirSync(path.join(__dirname, "components")).length;
  let oldFile = JSON.parse(fs.readFileSync(path.join(distPath, "version.json")));
  let offset = -20;
  let timeVersion = moment().format(`YYMMDDHHmmss`);
  // 原注释掉的代码，推测是旧逻辑，将组件数量加上偏移量赋值给版本号数组的第二个元素
  // nowVersion[1] = cptCount + offset;

  // 检查当前组件数量是否与版本文件中的组件数量相同
  if (cptCount == oldFile.cptCount) {
    // 若相同，则将当前组件数量加上偏移量赋值给版本号数组的第二个元素
    nowVersion[1] = cptCount + offset;
  } else {
    // 若不同，则在旧版本号的第二个元素基础上加 1 赋值给版本号数组的第二个元素
    nowVersion[1] = oldFile.version[1] + 1;
  }

  // 将当前时间戳转换为数字类型，赋值给版本号数组的第三个元素
  nowVersion[2] = Number(timeVersion);

  // 返回生成好的版本号数组
  return nowVersion;
}
// 更新版本文件
const updateVersionFile = (nowVersion) => {
  let cptCount = fs.readdirSync(path.join(__dirname, "components")).length;
  let versionFilePath = path.join(distPath, "version.json");
  fs.writeFileSync(versionFilePath, JSON.stringify({ version: nowVersion, cptCount }));
}

let sctVersion = genVersion();
updateVersionFile(sctVersion);

module.exports = {
  mode: "production",
  entry: { main: './index.js' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: fileName,
  },
  optimization: {
    splitChunks: { chunks: 'all', name: 'commons' },
    minimizer: [new TerserPlugin({ terserOptions: { keep_classnames: true } })]
  },
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      use: { loader: 'babel-loader' },
    }],
  },
  plugins: [
    new webpack.DefinePlugin({
      sctData: { version: sctVersion }
    })
  ]
};