# clickHarvest 组件挂载机制开发文档

## 1. 组件概述

**clickHarvest**（一键收菜）组件是 SimComp-Tools 插件中的一个功能组件，允许用户在游戏地图页面通过点击一个按钮快速收取所有可收获的资源。本文档详细解析该组件的挂载机制和工作原理。

## 2. 核心架构与继承关系

clickHarvest 组件基于插件框架提供的 BaseComponent 基类实现，遵循插件的组件化设计规范。

```javascript
class clickHarvest extends BaseComponent {
  constructor() {
    super()
    this.name = "一键收菜";
    this.describe = "组件包括了一键收菜的功能，在地图主页面点击收取按钮可以完成一键收菜"
    this.enable = false;
    this.tagList = ['快捷'];
  }
  // ...其他代码
}

new clickHarvest();
```
<mcfile name="clickHarvest.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/components/clickHarvest.js"></mcfile>

### 2.1 组件初始化流程

1. **组件注册**：当执行 `new clickHarvest()` 时，BaseComponent 的构造函数会被调用，将组件实例添加到全局的 `componentList` 中进行统一管理
   ```javascript
   constructor() {
     componentList[this.constructor.name] = this;
   }
   ```
   <mcfile name="baseComponent.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/tools/baseComponent.js"></mcfile>

2. **事件监听注册**：组件通过 `commonFuncList` 定义了 URL 匹配规则与对应的处理函数
   ```javascript
   commonFuncList = [{
     match: event => Boolean(location.href.match(/landscape\/$/)),
     func: this.createBtn
   }, {
     match: event => !Boolean(location.href.match(/landscape\/$/)),
     func: this.hideBtn
   }];
   ```
   <mcfile name="clickHarvest.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/components/clickHarvest.js"></mcfile>

## 3. 按钮挂载机制详解

### 3.1 条件触发机制

组件的挂载与显示由插件的事件系统驱动，主要通过以下机制触发：

1. **URL 变化检测**：当用户导航到地图页面 (`/landscape/`) 时，`tools.intervalEventBus()` 函数检测到 URL 变化并触发事件分发

2. **事件分发系统**：`tools.eventBus()` 函数遍历所有已注册的组件，并根据组件的 `commonFuncList` 中定义的匹配规则执行相应的处理函数
   ```javascript
   static eventBus(event) {
     // ...其他代码
     for (const key in componentList) {
       // ...检查组件是否启用
       // 常规函数事件分发
       for (let j = 0; j < component.commonFuncList.length; j++) {
         let funcObj = component.commonFuncList[j];
         try {
           if (!funcObj.match.call(component, event)) continue;
           setTimeout(function () {
             try {
               funcObj.func.call(component, event);
             } catch (error) {
               tools.errorLog(error);
             }
           }, 1);
         } catch (error) {
           tools.errorLog(error);
           continue;
         }
       }
     }
   }
   ```
   <mcfile name="tools.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/tools/tools.js"></mcfile>

### 3.2 按钮创建与挂载过程

当 URL 匹配到地图页面时，`createBtn` 函数会被调用，完成按钮的创建与挂载：

1. **按钮检查与创建**：首先检查按钮是否已存在，如不存在则创建新按钮
   ```javascript
   createBtn(event) {
     // 检查btn存在Script_oneClickHarvest_Btn
     let buttonNode = document.querySelector("#Script_oneClickHarvest_Btn");
     if (buttonNode) {
       buttonNode.style.display = "block";
       return;
     }
     // 检查内存中是否存在
     if (this.componentData.btnNode === undefined) {
       let newNode = document.createElement("button");
       newNode.innerText = this.indexDBData.buttonText;
       newNode.id = "Script_oneClickHarvest_Btn";
       newNode.className = "btn";
       this.componentData.btnNode = newNode;
       this.componentData.btnNode.addEventListener("click", this.btnClickHandle);
     }
     // ...挂载位置逻辑
   }
   ```
   <mcfile name="clickHarvest.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/components/clickHarvest.js"></mcfile>

2. **挂载位置选择**：根据 `indexDBData.nodePosition` 的值，按钮会被挂载到不同位置：
   - 0: 右上角（头像右边）
   - 1: 左上角（领域服务器标签左边）
   - 2: 中间悬浮（地图正下方，底栏上方）

3. **样式应用**：组件通过 `cssText` 定义了按钮的基本样式和悬浮样式
   ```javascript
   cssText = [
     `#Script_oneClickHarvest_Btn {color:var(--fontColor); margin:0 5px; background-color:rgb(51,51,51); width:auto;} button#Script_oneClickHarvest_Btn.fixedDisplay {position:fixed;  left:50%; bottom:80px; transform:translateX(-50%); min-height:40px; min-width:65px; box-shadow: 0 0 20px 1px white; z-index:1040; opacity:0.4;}`
   ];
   ```
   <mcfile name="clickHarvest.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/components/clickHarvest.js"></mcfile>

## 4. 用户交互处理

### 4.1 点击事件处理

按钮创建时会绑定 `btnClickHandle` 函数作为点击事件处理器：

```javascript
btnClickHandle() {
  // 如果不在对应界面，就删除挂载的元素。
  if (!Boolean(location.href.match(/landscape\/$/))) {
    return document.querySelector("#Script_oneClickHarvest_Btn").remove();
  }
  // 获取节点并过滤
  const nodeList = Object.values(document.querySelectorAll("div > div > div > a"))
    .filter(node => !node.className.match("headquarter")) // 排除总部建筑
    .filter(node => Object.values(node.querySelectorAll("img")).length === 4) // 排除没有四个图像的节点

  // 遍历节点并点击
  for (let i = 0; i < nodeList.length; i++) {
    nodeList[i].click();
  }

  // 发送消息
  tools.msg_send("一键收取", "完成收取啦!", 1);
}
```
<mcfile name="clickHarvest.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/components/clickHarvest.js"></mcfile>

该函数执行以下操作：
1. 验证当前是否在地图页面
2. 通过 DOM 选择器获取并过滤可收获的建筑节点
3. 遍历节点并模拟点击操作
4. 通过 `tools.msg_send()` 发送操作完成的通知

### 4.2 动态显示/隐藏机制

当用户离开地图页面时，通过 `commonFuncList` 中的第二个匹配规则，组件会自动隐藏按钮：

```javascript
// 隐藏按钮标签
hideBtn() {
  let node = document.querySelector("#Script_oneClickHarvest_Btn");
  if (!node) return;
  Object.assign(node.style, {display: "none"});
}
```
<mcfile name="clickHarvest.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/components/clickHarvest.js"></mcfile>

## 5. 数据持久化与配置

组件使用 IndexedDB 存储用户配置，包括按钮文本和挂载位置：

```javascript
indexDBData = {
  buttonText: "一键收菜",
  nodePosition: 0, // 0 右上角 1 左上角 2 中间悬浮
};
```
<mcfile name="clickHarvest.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/components/clickHarvest.js"></mcfile>

配置更改通过设置界面进行，并通过 `tools.indexDB_updateIndexDBData()` 保存到数据库：

```javascript
// 设置界面提交按钮处理函数
settingSubmitHandle() {
  let valueList = [
    document.querySelector("#script_setting_clickHarvest input").value.toString(),
    parseInt(document.querySelector("#script_setting_clickHarvest select").value)
  ];
  tools.log("一键收菜设置设置更新", valueList);
  this.indexDBData.buttonText = valueList[0] === "" ? "一键收取" : valueList[0];
  this.indexDBData.nodePosition = valueList[1];
  tools.indexDB_updateIndexDBData();
  this.clearBtn();
  tools.alert("已提交更新");
  return;
}
```
<mcfile name="clickHarvest.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/components/clickHarvest.js"></mcfile>

## 6. 组件生命周期管理

### 6.1 自启动函数

组件定义了 `startupFuncList`，在组件初始化时执行安全警告提醒：

```javascript
startupFuncList = [
  this.userWarnFunc, // 用户安全警告提醒
];
```
<mcfile name="clickHarvest.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/components/clickHarvest.js"></mcfile>

### 6.2 资源清理

组件提供了 `clearBtn` 函数用于清理挂载的按钮元素，确保不会造成内存泄漏：

```javascript
// 清除按钮标签
clearBtn() {
  let node = document.querySelector("#Script_oneClickHarvest_Btn");
  if (!node) return;
  node.remove();
  this.componentData.btnNode = undefined;
}
```
<mcfile name="clickHarvest.js" path="c:/Users/Huanhai/Desktop/SimComp-Tools-master/components/clickHarvest.js"></mcfile>

## 7. 挂载流程图

以下是 clickHarvest 组件的完整挂载流程：

1. **组件实例化** → `new clickHarvest()`
2. **注册到组件列表** → `componentList[constructor.name] = this`
3. **事件系统监听 URL 变化** → `tools.intervalEventBus()`
4. **URL 匹配触发创建** → `location.href.match(/landscape\/$/)`
5. **按钮创建与样式应用** → `createBtn()`
6. **根据配置挂载到指定位置** → 右上角/左上角/悬浮
7. **绑定点击事件处理器** → `btnClickHandle()`
8. **离开页面时自动隐藏** → `hideBtn()`

## 8. 代码优化建议

1. **性能优化**：当前的 DOM 选择器 `"div > div > div > a"` 较为脆弱，若游戏页面结构变化可能导致功能失效。建议使用更健壮的选择器或添加错误处理：
   ```javascript
   const nodeList = Object.values(document.querySelectorAll(".building-item")) // 假设使用更语义化的类名
     .filter(node => {/* 过滤逻辑 */});
   ```

2. **防抖处理**：在大量建筑的场景下，连续点击可能导致性能问题，建议添加防抖或节流机制：
   ```javascript
   btnClickHandle = tools.debounce(function() {
     // 原有点击处理逻辑
   }, 300);
   ```

3. **错误处理增强**：添加更多的错误捕获和用户友好的提示信息：
   ```javascript
   try {
     // 点击节点逻辑
   } catch (error) {
     tools.errorLog("一键收菜执行失败", error);
     tools.msg_send("一键收取", "收取过程中出现错误，请刷新页面重试", 1);
   }
   ```

4. **用户反馈优化**：添加视觉反馈，如按钮点击状态变化和进度提示。