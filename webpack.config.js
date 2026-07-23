const path = require('path');
const fs = require("node:fs");
const webpack = require("webpack");
const moment = require("moment");
const TerserPlugin = require('terser-webpack-plugin');

// const timeStamp = moment().format('MMDD-HHmmss');
const fileName = `build.user.js`;
const distPath = path.join(__dirname, 'dist');
const nowVersion = [3, 0];

// 生成版本号
const genVersion = () => {
  let cptCount = fs.readdirSync(path.join(__dirname, "components")).length;
  let timeVersion = moment().format(`YYMMDDHHmmss`);
  // 发布版本固定使用：主版本.次版本.构建时间（YYMMDDHHmmss）。
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
