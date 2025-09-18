const BaseComponent = require("../tools/baseComponent.js");
const { tools, componentList, runtimeData, indexDBData, feature_config } = require("../tools/tools.js");

/**
 * 示例组件 - 展示如何创建一个完整的SimComp-Tools扩展组件
 * 这个组件将添加一个简单的悬浮按钮，点击后显示/隐藏一个信息面板
 */
class exampleComponent extends BaseComponent {
  constructor() {
    super();
    this.name = "示例组件";
    this.describe = "展示如何创建一个完整的SimComp-Tools扩展组件，添加一个悬浮按钮和信息面板";
    this.enable = true;
    this.tagList = ['示例', '教程', 'UI'];
  }
  
  // 组件运行时数据
  componentData = {
    rootNode: undefined, // 根元素
    buttonNode: undefined, // 按钮元素
    infoPanel: undefined, // 信息面板元素
    isVisible: false // 信息面板是否可见
  };
  
  // 持久化存储的数据
  indexDBData = {
    showButton: true, // 是否显示按钮
    buttonPosition: {
      top: "10px",
      right: "10px"
    },
    customMessage: "欢迎使用示例组件！", // 自定义消息
    backgroundColor: "rgba(0, 0, 0, 0.7)", // 背景颜色
    textColor: "white" // 文字颜色
  };
  
  // CSS样式定义
  cssText = [
    `#script_example_button {
      position: fixed;
      z-index: 1000;
      padding: 8px 16px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s ease;
    }`,
    
    `#script_example_button:hover {
      transform: scale(1.05);
    }`,
    
    `#script_example_panel {
      position: fixed;
      width: 300px;
      max-height: 400px;
      padding: 15px;
      border-radius: 8px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 1001;
      transition: all 0.3s ease;
    }`,
    
    `#script_example_panel_header {
      font-weight: bold;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    }`,
    
    `#script_example_panel_close {
      position: absolute;
      top: 10px;
      right: 10px;
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }`,
    
    `#script_example_content {
      line-height: 1.6;
    }`
  ];
  
  // 启动时执行的功能列表
  startupFuncList = [
    this.buildUI
  ];
  
  // 根据条件触发的功能列表
  commonFuncList = [{
    // 当设置改变时更新UI
    match: () => this.componentData.needUpdateUI,
    func: () => {
      this.updateUI();
      this.componentData.needUpdateUI = false;
    }
  }];
  
  // 构建UI界面
  buildUI() {
    try {
      // 检查是否需要显示按钮
      if (!this.indexDBData.showButton) return;
      
      // 创建按钮元素
      this.componentData.buttonNode = document.createElement("button");
      this.componentData.buttonNode.id = "script_example_button";
      this.componentData.buttonNode.innerText = "示例";
      
      // 设置按钮样式
      Object.assign(this.componentData.buttonNode.style, {
        top: this.indexDBData.buttonPosition.top,
        right: this.indexDBData.buttonPosition.right,
        backgroundColor: this.indexDBData.backgroundColor,
        color: this.indexDBData.textColor
      });
      
      // 添加点击事件
      this.componentData.buttonNode.addEventListener("click", () => {
        this.togglePanel();
      });
      
      // 添加拖拽功能
      this.makeDraggable(this.componentData.buttonNode, this.updateButtonPosition.bind(this));
      
      // 添加到页面
      document.body.appendChild(this.componentData.buttonNode);
      
      // 创建信息面板
      this.componentData.infoPanel = document.createElement("div");
      this.componentData.infoPanel.id = "script_example_panel";
      this.componentData.infoPanel.style.display = "none";
      
      // 设置面板内容
      this.componentData.infoPanel.innerHTML = `
        <div id="script_example_panel_header">示例组件信息面板</div>
        <button id="script_example_panel_close">×</button>
        <div id="script_example_content">${this.indexDBData.customMessage}</div>
      `;
      
      // 设置面板样式
      Object.assign(this.componentData.infoPanel.style, {
        top: this.indexDBData.buttonPosition.top,
        right: this.indexDBData.buttonPosition.right,
        backgroundColor: this.indexDBData.backgroundColor,
        color: this.indexDBData.textColor
      });
      
      // 添加关闭按钮事件
      this.componentData.infoPanel.querySelector("#script_example_panel_close").addEventListener("click", () => {
        this.hidePanel();
      });
      
      // 添加到页面
      document.body.appendChild(this.componentData.infoPanel);
      
    } catch (error) {
      tools.errorLog("构建UI失败: " + error);
    }
  }
  
  // 切换面板显示状态
  togglePanel() {
    if (this.componentData.isVisible) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }
  
  // 显示面板
  showPanel() {
    if (!this.componentData.infoPanel) return;
    
    this.componentData.infoPanel.style.display = "block";
    this.componentData.isVisible = true;
  }
  
  // 隐藏面板
  hidePanel() {
    if (!this.componentData.infoPanel) return;
    
    this.componentData.infoPanel.style.display = "none";
    this.componentData.isVisible = false;
  }
  
  // 更新按钮位置
  updateButtonPosition(top, right) {
    this.indexDBData.buttonPosition = { top, right };
    tools.saveDBData();
    
    // 更新面板位置
    if (this.componentData.infoPanel) {
      Object.assign(this.componentData.infoPanel.style, { top, right });
    }
  }
  
  // 更新UI样式
  updateUI() {
    if (!this.componentData.buttonNode || !this.componentData.infoPanel) return;
    
    // 更新按钮样式
    Object.assign(this.componentData.buttonNode.style, {
      backgroundColor: this.indexDBData.backgroundColor,
      color: this.indexDBData.textColor
    });
    
    // 更新面板样式
    Object.assign(this.componentData.infoPanel.style, {
      backgroundColor: this.indexDBData.backgroundColor,
      color: this.indexDBData.textColor
    });
    
    // 更新面板内容
    this.componentData.infoPanel.querySelector("#script_example_content").innerText = this.indexDBData.customMessage;
  }
  
  // 使元素可拖拽
  makeDraggable(element, onPositionChange) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    element.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
      e = e || window.event;
      e.preventDefault();
      // 获取鼠标位置
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }
    
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // 计算新位置
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // 设置元素新位置
      const top = element.offsetTop - pos2;
      const left = element.offsetLeft - pos1;
      
      // 限制在视口内
      const maxTop = window.innerHeight - element.offsetHeight;
      const maxLeft = window.innerWidth - element.offsetWidth;
      
      element.style.top = `${Math.max(0, Math.min(top, maxTop))}px`;
      element.style.left = `${Math.max(0, Math.min(left, maxLeft))}px`;
      
      // 由于我们使用的是right定位，需要转换
      const right = window.innerWidth - (element.offsetLeft + element.offsetWidth);
      
      if (onPositionChange) {
        onPositionChange(`${element.offsetTop - pos2}px`, `${right}px`);
      }
    }
    
    function closeDragElement() {
      // 停止移动
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }
  
  // 设置界面
  settingUI = () => {
    let newNode = document.createElement("div");
    let htmlText = `
      <div class=header>示例组件设置</div>
      <div class=container>
        <div><button class="btn script_opt_submit">保存</button></div>
        <table>
          <tr>
            <td>显示按钮</td>
            <td><input type=checkbox id="script_example_showButton" ${this.indexDBData.showButton ? 'checked' : ''}></td>
          </tr>
          <tr>
            <td>自定义消息</td>
            <td><textarea id="script_example_message" style="width:100%;height:80px;">${this.indexDBData.customMessage}</textarea></td>
          </tr>
          <tr>
            <td>背景颜色</td>
            <td><input type=text id="script_example_bgColor" value="${this.indexDBData.backgroundColor}" class=form-control></td>
          </tr>
          <tr>
            <td>文字颜色</td>
            <td><input type=text id="script_example_textColor" value="${this.indexDBData.textColor}" class=form-control></td>
          </tr>
        </table>
      </div>
    `;
    
    newNode.id = "exampleComponentSetting";
    newNode.className = "col-sm-12 setting-container";
    newNode.innerHTML = htmlText;
    
    // 添加保存事件
    newNode.querySelector(".script_opt_submit").addEventListener("click", () => {
      try {
        this.indexDBData.showButton = newNode.querySelector("#script_example_showButton").checked;
        this.indexDBData.customMessage = newNode.querySelector("#script_example_message").value;
        this.indexDBData.backgroundColor = newNode.querySelector("#script_example_bgColor").value;
        this.indexDBData.textColor = newNode.querySelector("#script_example_textColor").value;
        
        // 保存数据
        tools.saveDBData();
        
        // 更新UI
        this.updateUI();
        
        // 显示/隐藏按钮
        if (this.componentData.buttonNode) {
          this.componentData.buttonNode.style.display = this.indexDBData.showButton ? "block" : "none";
        }
        
        if (this.componentData.infoPanel) {
          this.componentData.infoPanel.style.display = this.indexDBData.showButton && this.componentData.isVisible ? "block" : "none";
        }
        
        tools.log("设置已保存");
        
      } catch (error) {
        tools.errorLog("保存设置失败: " + error);
      }
    });
    
    return newNode;
  }
}

// 实例化组件
new exampleComponent();