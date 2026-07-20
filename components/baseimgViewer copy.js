const BaseComponent = require("../tools/baseComponent.js");
const { tools, componentList, runtimeData, indexDBData, feature_config } = require("../tools/tools.js");
const { ImageProcessor, normalizeUrl, isValidImageUrl } = require('./ImageProcessor.js');

// 图片查看器组件
class imgViewer extends BaseComponent {
  constructor() {
    super();
    this.name = "图片查看器";
    this.describe = "可拖拽的图片查看窗口，支持多张图片滑动浏览";
    this.enable = true;
    this.tagList = ['实用', '图像'];
  }
  componentData = {
    rootNode: undefined, // 根元素对象
    isDragging: false, // 是否正在拖拽
    offset: { x: 0, y: 0 }, // 偏移量
    currentImageIndex: 0, // 当前显示的图片索引
    startX: 0, // 触摸开始X坐标
    isSliding: false, // 是否正在滑动
  }
  indexDBData = {
    images: [], // 存储的图片数据 [{name: "图片名称", url: "图片URL", isOriginal: true, originalUrl: null}]
    positionTop: "10px", // 容器定位顶部距离
    positionLeft: "10px", // 容器定位左侧距离
    isShow: false, // 容器是否处于展示状态
    isHide: false, // 是否缩小
    windowWidth: 600, // 窗口宽度
    windowHeight: 400, // 窗口高度
    originalImages: {}, // 存储原始图片，用于还原 {originalUrl: {element: Element, src: string}}
    replacementRules: [], // 存储预设的替换规则 [{originalUrl: "原始图片URL", replacedUrl: "替换图片URL", name: "规则名称"}]
    autoApplyRules: true, // 是否自动应用替换规则
    applyDelay: 5000, // 页面加载后等待的毫秒数
    waitForImagesLoad: true, // 是否等待目标图片加载完成后再应用替换
  }
  startupFuncList = [
    this.buildContianer
  ]
  cssText = [
    `#script_imgViewer_root{z-index:1040;display:none;color:var(--fontColor);position:fixed;top:20px;left:20px;width:600px;height:400px;border:1px solid #ccc;padding:10px;box-sizing:border-box;cursor:move;background-color:rgba(0,0,0,0.8);box-shadow:0 0 5px 1px black;border-radius:5px;overflow:hidden;}` +
    `#script_imgViewer_root #script_imgViewer_title{text-align:center;font-weight:bold;margin-bottom:10px;}` +
    `#script_imgViewer_root #script_imgViewer_close{position:absolute;top:10px;right:10px;cursor:pointer;}` +
    //`#script_imgViewer_root #script_imgViewer_hide{position:absolute;top:10px;left:10px;cursor:pointer;}` +
    `#script_imgViewer_root #script_imgViewer_prev{position:absolute;top:50%;left:10px;transform:translateY(-50%);cursor:pointer;background-color:rgba(0,0,0,0.5);padding:5px;border-radius:5px;}` +
    `#script_imgViewer_root #script_imgViewer_next{position:absolute;top:50%;right:10px;transform:translateY(-50%);cursor:pointer;background-color:rgba(0,0,0,0.5);padding:5px;border-radius:5px;}` +
    `#script_imgViewer_root #script_imgViewer_imageContainer{width:100%;height:calc(100% - 60px);position:relative;overflow:hidden;}` +
    `#script_imgViewer_root #script_imgViewer_slider{display:flex;height:100%;transition:transform 0.3s ease;}` +
    `#script_imgViewer_root .script_imgViewer_imageItem{min-width:100%;height:100%;display:flex;align-items:center;justify-content:center;}` +
    `#script_imgViewer_root .script_imgViewer_imageItem img{max-width:100%;max-height:100%;object-contain;}` +
    `#script_imgViewer_root #script_imgViewer_imageName{text-align:center;margin-top:5px;font-size:12px;}` +
    `#script_imgViewer_root #script_imgViewer_addImage{position:absolute;bottom:10px;right:60px;cursor:pointer;background-color:rgba(0,0,0,0.5);padding:5px;border-radius:5px;}` +
    `#script_imgViewer_root #script_imgViewer_removeImage{position:absolute;bottom:10px;right:110px;cursor:pointer;background-color:rgba(0,0,0,0.5);padding:5px;border-radius:5px;}` +
    `#script_imgViewer_root #script_imgViewer_replaceImage{position:absolute;bottom:10px;right:160px;cursor:pointer;background-color:rgba(0,0,0,0.5);padding:5px;border-radius:5px;}` +
    `#script_imgViewer_root #script_imgViewer_indicator{display:flex;justify-content:center;gap:5px;margin-top:5px;}` +
    `#script_imgViewer_root .script_imgViewer_dot{width:8px;height:8px;border-radius:50%;background-color:rgba(255,255,255,0.5);cursor:pointer;}` +
    `#script_imgViewer_root .script_imgViewer_dot.active{background-color:white;}` 
    //`button#script_imgViewer_button{color:var(--fontColor);text-align:center;display:block;position:fixed;right:10px;bottom:10px;width:fit-content;height:fit-content;z-index:2001;border-radius:5px;border:1px solid white;}`
  ]
  frontUI = () => {
    if (this.componentData.rootNode) {
      Object.assign(this.componentData.rootNode.style, { display: "block" });
    }
  }
  // 设置界面
  settingUI = () => {
    let newNode = document.createElement("div");
    let htmlText = `
      <div class=header>图片查看器设置</div>
      <div class=container>
        <div><button class="btn script_opt_submit">保存</button></div>
        <table><tr style=height:60px><td>功能<td>设置<tr><td>窗口宽度<td><input class=form-control type=number value="${this.indexDBData.windowWidth}"><tr><td>窗口高度<td><input class=form-control type=number value="${this.indexDBData.windowHeight}"><tr><td>自动应用替换规则<td><input type=checkbox id="script_imgViewer_autoApplyRules" ${this.indexDBData.autoApplyRules ? 'checked' : ''}><tr><td>等待时间(毫秒)<td><input class=form-control type=number value="${this.indexDBData.applyDelay}" id="script_imgViewer_applyDelay"><tr><td>等待图片加载<td><input type=checkbox id="script_imgViewer_waitForImagesLoad" ${this.indexDBData.waitForImagesLoad ? 'checked' : ''}></table>
        
        <!-- 替换规则预设管理 -->
        <div style="margin-top: 20px;">
          <h4>图片替换规则预设</h4>
          <button id="script_imgViewer_addRule" class="btn btn-sm">添加规则</button>
          <div id="script_imgViewer_rulesList" style="margin-top: 10px;">
            ${this.indexDBData.replacementRules.map((rule, index) => `
              <div class="rule-item" style="margin-bottom: 10px; padding: 10px; background-color: rgba(255,255,255,0.1); border-radius: 5px;">
                <div>名称: ${rule.name || '未命名规则'}</div>
                <div style="font-size: 12px; margin: 5px 0;">原始URL: ${this.truncateUrl(rule.originalUrl)}</div>
                <div style="font-size: 12px; margin: 5px 0;">替换URL: ${this.truncateUrl(rule.replacedUrl)}</div>
                <div style="display: flex; gap: 5px; margin-top: 5px;">
                  <button class="btn btn-xs script_imgViewer_editRule" data-index="${index}">编辑</button>
                  <button class="btn btn-xs btn-danger script_imgViewer_deleteRule" data-index="${index}">删除</button>
                  <button class="btn btn-xs btn-primary script_imgViewer_applyRule" data-index="${index}">应用</button>
                </div>
              </div>
            `).join('')}
            ${this.indexDBData.replacementRules.length === 0 ? '<div style="text-align: center; color: #999;">暂无保存的替换规则</div>' : ''}
          </div>
        </div>
      </div>`;
    newNode.id = "imgViewerSetting";
    newNode.className = "col-sm-12 setting-container";
    newNode.innerHTML = htmlText;
    // 挂载按钮
    newNode.querySelector("button.script_opt_submit").addEventListener("click", () => this.settingSubmit());
    
    // 挂载规则管理相关按钮事件
    newNode.querySelector("#script_imgViewer_addRule").addEventListener("click", () => this.settingAddRule());
    
    // 为所有编辑按钮添加事件
    newNode.querySelectorAll(".script_imgViewer_editRule").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.settingEditRule(index);
      });
    });
    
    // 为所有删除按钮添加事件
    newNode.querySelectorAll(".script_imgViewer_deleteRule").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.settingDeleteRule(index);
      });
    });
    
    // 为所有应用按钮添加事件
    newNode.querySelectorAll(".script_imgViewer_applyRule").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.settingApplyRule(index);
      });
    });
    
    // 返回元素
    return newNode;
  }
  
  // 截断URL以在UI中显示
  truncateUrl(url) {
    if (url.length <= 30) return url;
    return url.substring(0, 15) + '...' + url.substring(url.length - 10);
  }
  
  // 添加替换规则
  settingAddRule() {
    const tempContainer = this.createRuleModal('添加替换规则', null);
    document.body.appendChild(tempContainer);
  }
  
  // 编辑替换规则
  settingEditRule(index) {
    const rule = this.indexDBData.replacementRules[index];
    const tempContainer = this.createRuleModal('编辑替换规则', rule, index);
    document.body.appendChild(tempContainer);
  }
  
  // 删除替换规则
  settingDeleteRule(index) {
    if (confirm('确定要删除这个替换规则吗？')) {
      this.indexDBData.replacementRules.splice(index, 1);
      tools.indexDB_updateIndexDBData();
      this.refreshSettingUI(); // 刷新设置界面
    }
  }
  
  // 应用替换规则
  settingApplyRule(index) {
    const rule = this.indexDBData.replacementRules[index];
    
    try {
      if (ImageProcessor && typeof ImageProcessor.addRule === 'function') {
        ImageProcessor.addRule(rule.originalUrl, rule.replacedUrl);
        tools.alert(`规则"${rule.name}"已成功应用`);
      } else {
        tools.alert('无法应用规则，ImageProcessor不可用');
      }
    } catch (error) {
      console.error('应用规则失败:', error);
      tools.alert('应用规则失败，请重试');
    }
  }
  
  // 创建规则编辑模态框
  createRuleModal(title, rule = null, index = null) {
    const tempContainer = document.createElement("div");
    tempContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(0, 0, 0, 0.9);
      padding: 20px;
      border-radius: 5px;
      z-index: 2002;
      color: white;
      width: 400px;
      box-sizing: border-box;
    `;
    tempContainer.innerHTML = `
      <h3>${title}</h3>
      <div style="margin-bottom: 10px;">
        <label>规则名称:</label>
        <input type="text" id="ruleNameInput" value="${rule ? rule.name : ''}" style="margin-top: 5px; width: 100%; background-color: #333; color: white; border: 1px solid #555;">
      </div>
      <div style="margin-bottom: 10px;">
        <label>原始图片URL:</label>
        <input type="text" id="originalUrlInput" value="${rule ? rule.originalUrl : ''}" style="margin-top: 5px; width: 100%; background-color: #333; color: white; border: 1px solid #555;">
      </div>
      <div style="margin-bottom: 10px;">
        <label>替换图片URL:</label>
        <input type="text" id="replacedUrlInput" value="${rule ? rule.replacedUrl : ''}" style="margin-top: 5px; width: 100%; background-color: #333; color: white; border: 1px solid #555;">
      </div>
      <div style="display: flex; justify-content: space-between;">
        <button id="cancelBtn" style="background-color: #555; color: white; border: none; padding: 5px 10px; cursor: pointer;">取消</button>
        <button id="confirmBtn" style="background-color: #4CAF50; color: white; border: none; padding: 5px 10px; cursor: pointer;">确定</button>
      </div>
    `;
    
    // 绑定按钮事件
    tempContainer.querySelector("#cancelBtn").addEventListener("click", () => {
      document.body.removeChild(tempContainer);
    });
    
    tempContainer.querySelector("#confirmBtn").addEventListener("click", async () => {
      const name = tempContainer.querySelector("#ruleNameInput").value;
      const originalUrl = tempContainer.querySelector("#originalUrlInput").value;
      const replacedUrl = tempContainer.querySelector("#replacedUrlInput").value;
      
      if (!name || !originalUrl || !replacedUrl) {
        tools.alert("请填写所有必填字段");
        return;
      }
      
      // 验证URL
      if (!this.isValidImageUrl(originalUrl) || !this.isValidImageUrl(replacedUrl)) {
        tools.alert("请输入有效的图片URL");
        return;
      }
      
      // 规范化URL
      const normalizedOriginalUrl = this.normalizeUrl(originalUrl);
      const normalizedReplacedUrl = this.normalizeUrl(replacedUrl);
      
      if (index !== null) {
        // 编辑现有规则
        this.indexDBData.replacementRules[index] = {
          name,
          originalUrl: normalizedOriginalUrl,
          replacedUrl: normalizedReplacedUrl
        };
      } else {
        // 添加新规则
        this.indexDBData.replacementRules.push({
          name,
          originalUrl: normalizedOriginalUrl,
          replacedUrl: normalizedReplacedUrl
        });
      }
      
      // 保存数据
      await tools.indexDB_updateIndexDBData();
      
      // 刷新设置界面
      this.refreshSettingUI();
      
      document.body.removeChild(tempContainer);
      tools.alert(`${index !== null ? '编辑' : '添加'}规则成功`);
    });
    
    return tempContainer;
  }
  
  // 刷新设置界面
  refreshSettingUI() {
    // 查找设置面板并刷新内容
    const settingPanel = document.querySelector('.setting-panel');
    if (settingPanel) {
      // 这里假设存在一个刷新设置面板的方法
      // 在实际应用中，可能需要根据具体的设置面板实现来调整
      const currentSetting = settingPanel.querySelector('#imgViewerSetting');
      if (currentSetting) {
        const newSetting = this.settingUI();
        settingPanel.replaceChild(newSetting, currentSetting);
      }
    }
  }
  // 设置提交按钮
  async settingSubmit() {
    let width = document.querySelector("div#imgViewerSetting input[type=number]:nth-of-type(1)").value;
    let height = document.querySelector("div#imgViewerSetting input[type=number]:nth-of-type(2)").value;
    const autoApplyRules = document.querySelector("div#imgViewerSetting #script_imgViewer_autoApplyRules").checked;
    const applyDelay = parseInt(document.querySelector("div#imgViewerSetting #script_imgViewer_applyDelay").value);
    const waitForImagesLoad = document.querySelector("div#imgViewerSetting #script_imgViewer_waitForImagesLoad").checked;
    
    if (width < 300 || height < 200) return tools.alert("窗口尺寸不能太小，最小宽度300px，最小高度200px");
    if (applyDelay < 0) return tools.alert("等待时间不能为负数");
    
    this.indexDBData.windowWidth = parseInt(width);
    this.indexDBData.windowHeight = parseInt(height);
    this.indexDBData.autoApplyRules = autoApplyRules;
    this.indexDBData.applyDelay = applyDelay;
    this.indexDBData.waitForImagesLoad = waitForImagesLoad;
    
    await tools.indexDB_updateIndexDBData();
    
    // 更新窗口尺寸
    if (this.componentData.rootNode) {
      this.componentData.rootNode.style.width = `${this.indexDBData.windowWidth}px`;
      this.componentData.rootNode.style.height = `${this.indexDBData.windowHeight}px`;
    }
    
    tools.alert("更改已提交");
  }
  // 构建容器元素
  buildContianer(window) {
    return this.buildViewerContainer();
  }
  // 构建图片查看器容器
  buildViewerContainer() {
    // 创建主窗口元素
    let newNode = document.createElement("div");
    newNode.id = "script_imgViewer_root";
    newNode.innerHTML = `
      <div id="script_imgViewer_title">图片查看器</div>
      <!-- <div id="script_imgViewer_hide">缩小</div> -->
      <div id="script_imgViewer_close">关闭</div>
      <div id="script_imgViewer_imageContainer">
        <div id="script_imgViewer_slider"></div>
        <div id="script_imgViewer_prev">上一张</div>
        <div id="script_imgViewer_next">下一张</div>
      </div>
      <div id="script_imgViewer_imageName"></div>
      <div id="script_imgViewer_indicator"></div>
      <div id="script_imgViewer_replaceImage">替换</div>
        <!-- <div id="script_imgViewer_removeImage">删除</div> -->
        <div id="script_imgViewer_addImage">添加(刷新)</div>
    `;
    
    // 创建触发按钮
    let triggerButton = document.createElement("button");
    triggerButton.id = "script_imgViewer_button";
    triggerButton.innerText = "图片查看器";
    
    // 绑定函数
    newNode.addEventListener("mousedown", event => this.startDragging(event));
    newNode.addEventListener("touchstart", event => this.startDragging(event));
    newNode.querySelector("div#script_imgViewer_close")?.addEventListener('click', () => this.closeRootDisplay());
    newNode.querySelector("div#script_imgViewer_hide")?.addEventListener('click', () => this.switchHide());
    newNode.querySelector("div#script_imgViewer_prev")?.addEventListener('click', () => this.showPrevImage());
    newNode.querySelector("div#script_imgViewer_next")?.addEventListener('click', () => this.showNextImage());
    newNode.querySelector("div#script_imgViewer_addImage")?.addEventListener('click', () => this.crawlImages());
    newNode.querySelector("div#script_imgViewer_removeImage")?.addEventListener('click', () => this.removeCurrentImage());
    newNode.querySelector("div#script_imgViewer_replaceImage")?.addEventListener('click', () => this.replaceCurrentImage());
      
      // 添加还原按钮
      const restoreButton = document.createElement('div');
      restoreButton.id = 'script_imgViewer_restore';
      restoreButton.style.cssText = `
        position: absolute;
        bottom: 10px;
        right: 210px;
        cursor: pointer;
        background-color: rgba(0,0,0,0.5);
        padding: 5px;
        border-radius: 5px;
      `;
      restoreButton.textContent = '还原';
      restoreButton.addEventListener('click', () => this.restoreAllImages());
      newNode.appendChild(restoreButton);
    
    // 添加滑动手势支持
    const slider = newNode.querySelector("#script_imgViewer_slider");
    slider.addEventListener("mousedown", event => this.startSliding(event));
    slider.addEventListener("touchstart", event => this.startSliding(event));
    
    // 设置窗口样式
    Object.assign(newNode.style, {
      top: this.indexDBData.positionTop,
      left: this.indexDBData.positionLeft,
      width: `${this.indexDBData.windowWidth}px`,
      height: `${this.indexDBData.windowHeight}px`,
      display: this.indexDBData.isShow ? "block" : "none",
      resize: 'both',
      overflow: 'hidden'
    });
    
    // 添加窗口拉伸功能
    this.setupWindowResize = () => {
      const rootNode = this.componentData.rootNode;
      if (!rootNode) return;
      
      // 这里可以添加窗口拉伸的具体实现代码
      // 由于目前没有具体需求，可以留空或简单实现
      console.log("窗口拉伸功能已初始化");
    };
    
    this.setupWindowResize();
    
    // 应用保存的替换规则
    this.applySavedRules();
    
    // 挂载标签
  this.componentData.rootNode = newNode;
  document.body.appendChild(newNode);
  document.body.appendChild(triggerButton);
  
  // 初始化组件数据
  this.componentData.isResizing = false;
  this.componentData.resizeStartPos = { x: 0, y: 0 };
  this.componentData.resizeEdges = { top: false, right: false, bottom: false, left: false };
    
    // 绑定触发按钮事件
    triggerButton.addEventListener("click", () => this.toggleDisplay());
    
    // 初始化图片显示
    this.renderImages();
    
    return newNode;
  }
  // 切换显示状态
  toggleDisplay() {
    if (this.componentData.rootNode.style.display === "none") {
      this.frontUI();
      this.indexDBData.isShow = true;
    } else {
      this.closeRootDisplay();
    }
  }
  // 开始拖拽函数
  startDragging(event) {
    let windowElement = this.componentData.rootNode;
    let zoom = parseInt(feature_config.zoomRate) / 100;
    if (event.target.tagName === "INPUT" || event.target.closest("#script_imgViewer_imageContainer")) return;
    if (event.button === undefined || event.button === 0) {
      event.stopPropagation();
      this.componentData.isDragging = true;
      let rect = windowElement.getBoundingClientRect();
      if (event.type === 'mousedown') {
        this.componentData.offset.x = (event.clientX) / zoom - rect.left;
        this.componentData.offset.y = (event.clientY) / zoom - rect.top;
        window.addEventListener('mousemove', event => this.drag(event));
        window.addEventListener('mouseup', event => this.stopDragging(event));
      } else if (event.type === 'touchstart') {
        this.componentData.offset.x = (event.touches[0].clientX) / zoom - rect.left;
        this.componentData.offset.y = (event.touches[0].clientY) / zoom - rect.top;
        window.addEventListener('touchmove', event => this.drag(event));
        window.addEventListener('touchend', event => this.stopDragging(event));
      }
    }
  }
  // 拖拽同步函数
  drag(event) {
    let windowElement = this.componentData.rootNode;
    let zoom = parseInt(feature_config.zoomRate) / 100;
    if (this.componentData.isDragging) {
      event.stopPropagation();
      let clientX = event.type === 'mousemove' ? event.clientX : event.touches[0].clientX;
      let clientY = event.type === 'mousemove' ? event.clientY : event.touches[0].clientY;
      windowElement.style.left = clientX / zoom - this.componentData.offset.x + 'px';
      windowElement.style.top = clientY / zoom - this.componentData.offset.y + 'px';
    }
  }
  // 停止拖拽函数
  stopDragging(event) {
    event.stopPropagation();
    this.componentData.isDragging = false;
    window.removeEventListener('mousemove', event => this.drag(event));
    window.removeEventListener('mouseup', event => this.stopDragging(event));
    window.removeEventListener('touchmove', event => this.drag(event));
    window.removeEventListener('touchend', event => this.stopDragging(event));
    this.savePosition();
  }
  // 保存窗口位置
  savePosition() {
    this.indexDBData.positionLeft = this.componentData.rootNode.style.left;
    this.indexDBData.positionTop = this.componentData.rootNode.style.top;
    tools.indexDB_updateIndexDBData();
  }
  // 按钮关闭显示函数
  closeRootDisplay() {
    Object.assign(this.componentData.rootNode.style, { display: "none" });
    this.indexDBData.isShow = false;
    tools.indexDB_updateIndexDBData();
  }
  // 缩小显示
  switchHide() {
    if (this.indexDBData.isHide) {
      this.componentData.rootNode.style.width = `${this.indexDBData.windowWidth}px`;
      this.componentData.rootNode.style.height = `${this.indexDBData.windowHeight}px`;
    } else {
      // 窗口横纵 0 横 1 纵
      let width = tools.clientHorV ? "initial" : "300px";
      Object.assign(this.componentData.rootNode.style, { width, height: "40px", overflow: "hidden" });
    }
    this.indexDBData.isHide = !this.indexDBData.isHide;
  }
  // 开始滑动
  startSliding(event) {
    if (this.indexDBData.images.length <= 1) return;
    
    event.stopPropagation();
    this.componentData.isSliding = true;
    
    if (event.type === 'mousedown') {
      this.componentData.startX = event.clientX;
      window.addEventListener('mousemove', event => this.slide(event));
      window.addEventListener('mouseup', event => this.stopSliding(event));
    } else if (event.type === 'touchstart') {
      this.componentData.startX = event.touches[0].clientX;
      window.addEventListener('touchmove', event => this.slide(event));
      window.addEventListener('touchend', event => this.stopSliding(event));
    }
  }
  // 滑动处理
  slide(event) {
    if (!this.componentData.isSliding || this.indexDBData.images.length <= 1) return;
    
    event.stopPropagation();
    event.preventDefault();
    
    const slider = this.componentData.rootNode.querySelector("#script_imgViewer_slider");
    let currentX = event.type === 'mousemove' ? event.clientX : event.touches[0].clientX;
    let diff = currentX - this.componentData.startX;
    
    // 计算当前位置和最大偏移量
    let containerWidth = this.componentData.rootNode.querySelector("#script_imgViewer_imageContainer").offsetWidth;
    let maxOffset = containerWidth * (this.indexDBData.images.length - 1);
    let currentOffset = -this.componentData.currentImageIndex * containerWidth + diff;
    
    // 添加边界弹性效果
    if (currentOffset > 0) {
      currentOffset = currentOffset * 0.5; // 左侧边界弹性
    } else if (currentOffset < -maxOffset) {
      currentOffset = -maxOffset + (currentOffset + maxOffset) * 0.5; // 右侧边界弹性
    }
    
    slider.style.transform = `translateX(${currentOffset}px)`;
  }
  // 停止滑动
  stopSliding(event) {
    if (!this.componentData.isSliding) return;
    
    this.componentData.isSliding = false;
    window.removeEventListener('mousemove', event => this.slide(event));
    window.removeEventListener('mouseup', event => this.stopSliding(event));
    window.removeEventListener('touchmove', event => this.slide(event));
    window.removeEventListener('touchend', event => this.stopSliding(event));
    
    const slider = this.componentData.rootNode.querySelector("#script_imgViewer_slider");
    let containerWidth = this.componentData.rootNode.querySelector("#script_imgViewer_imageContainer").offsetWidth;
    
    // 计算滑动距离是否超过阈值
    let endX = event.type === 'mouseup' ? event.clientX : (event.changedTouches && event.changedTouches[0].clientX) || this.componentData.startX;
    let diff = endX - this.componentData.startX;
    
    // 如果滑动距离超过阈值，则切换图片
    if (Math.abs(diff) > 50) {
      if (diff > 0 && this.componentData.currentImageIndex > 0) {
        this.showPrevImage();
      } else if (diff < 0 && this.componentData.currentImageIndex < this.indexDBData.images.length - 1) {
        this.showNextImage();
      } else {
        // 回到当前图片
        this.updateSliderPosition();
      }
    } else {
      // 回到当前图片
      this.updateSliderPosition();
    }
  }
  // 显示上一张图片
  showPrevImage() {
    if (this.componentData.currentImageIndex > 0) {
      this.componentData.currentImageIndex--;
      this.updateSliderPosition();
      this.updateImageInfo();
    }
  }
  // 显示下一张图片
  showNextImage() {
    if (this.componentData.currentImageIndex < this.indexDBData.images.length - 1) {
      this.componentData.currentImageIndex++;
      this.updateSliderPosition();
      this.updateImageInfo();
    }
  }
  // 更新滑块位置
  updateSliderPosition() {
    const slider = this.componentData.rootNode.querySelector("#script_imgViewer_slider");
    let containerWidth = this.componentData.rootNode.querySelector("#script_imgViewer_imageContainer").offsetWidth;
    slider.style.transform = `translateX(${-this.componentData.currentImageIndex * containerWidth}px)`;
  }
  // 更新图片信息
  updateImageInfo() {
    if (this.indexDBData.images.length === 0) return;
    
    const currentImage = this.indexDBData.images[this.componentData.currentImageIndex];
    const imageNameElement = this.componentData.rootNode.querySelector("#script_imgViewer_imageName");
    imageNameElement.textContent = currentImage.name;
    
    // 更新指示器
    this.updateIndicator();
  }
  // 更新指示器
  updateIndicator() {
    const indicator = this.componentData.rootNode.querySelector("#script_imgViewer_indicator");
    indicator.innerHTML = '';
    
    this.indexDBData.images.forEach((_, index) => {
      const dot = document.createElement("div");
      dot.className = `script_imgViewer_dot ${index === this.componentData.currentImageIndex ? 'active' : ''}`;
      dot.addEventListener('click', () => {
        this.componentData.currentImageIndex = index;
        this.updateSliderPosition();
        this.updateImageInfo();
      });
      indicator.appendChild(dot);
    });
  }
  // 渲染图片
  renderImages() {
    const slider = this.componentData.rootNode.querySelector("#script_imgViewer_slider");
    slider.innerHTML = '';
    
    this.indexDBData.images.forEach(image => {
      const imageItem = document.createElement("div");
      imageItem.className = "script_imgViewer_imageItem";
      
      const img = document.createElement("img");
      img.src = image.url;
      img.alt = image.name;
      
      // 添加图片加载失败处理
      img.onerror = () => {
        img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
      };
      
      // 添加图片标记 - 如果不是原始图片
      if (!image.isOriginal) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: absolute;
          top: 5px;
          right: 5px;
          background-color: rgba(255, 0, 0, 0.7);
          color: white;
          padding: 3px 6px;
          border-radius: 3px;
          font-size: 12px;
          z-index: 10;
        `;
        overlay.textContent = '已替换';
        imageItem.appendChild(overlay);
      }
      
      imageItem.appendChild(img);
      slider.appendChild(imageItem);
    });
    
    // 更新图片信息和指示器
    this.updateImageInfo();
  }
  // 爬取网页图片
  crawlImages() {
    tools.alert("开始爬取网页图片，请稍候...");
    
    // 清空现有图片数据
    this.indexDBData.images = [];
    this.indexDBData.originalImages = {};
    
    // 1. 爬取页面上的所有img元素
    const imgElements = document.querySelectorAll('img');
    imgElements.forEach((element, index) => {
      try {
        const url = element.src;
        if (url && url !== '' && !url.startsWith('data:image/') && this.isValidImageUrl(url)) {
          const normalizedUrl = this.normalizeUrl(url);
          
          // 检查是否已添加过此图片
          if (!this.indexDBData.images.some(img => this.normalizeUrl(img.url) === normalizedUrl)) {
            const name = element.alt || element.title || `图片${index + 1}`;
            
            // 存储原始图片信息，但不存储DOM元素引用
            this.indexDBData.originalImages[normalizedUrl] = {
              src: url,
              xpath: this.getElementXPath(element) // 使用XPath替代DOM元素引用
            };
            
            // 添加到图片列表
            this.indexDBData.images.push({
              name: name,
              url: url,
              isOriginal: true,
              originalUrl: normalizedUrl
            });
          }
        }
      } catch (error) {
        console.warn("处理图片时出错:", error);
      }
    });
    
    // 2. 爬取CSS背景图片
    this.crawlBackgroundImages();
    
    // 3. 爬取canvas图片
    this.crawlCanvasImages();
    
    // 保存数据并更新界面
    if (this.indexDBData.images.length > 0) {
      this.cleanDataBeforeSave(); // 在保存前清理数据
      tools.indexDB_updateIndexDBData();
      this.renderImages();
      this.componentData.currentImageIndex = 0;
      this.updateSliderPosition();
      this.updateImageInfo();
      tools.alert(`已成功爬取 ${this.indexDBData.images.length} 张图片`);
    } else {
      tools.alert("未能爬取到任何图片");
    }
  }
  
  // 获取元素的XPath用于后续定位
  getElementXPath(element) {
    if (element.id) {
      return `id("${element.id}")`;
    }
    
    if (element === document.body) {
      return element.tagName.toLowerCase();
    }
    
    let ix = 0;
    const siblings = element.parentNode.childNodes;
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (sibling === element) {
        return `${this.getElementXPath(element.parentNode)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
      }
      if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
        ix++;
      }
    }
  }
  
  // 根据XPath获取元素
  getElementByXPath(xpath) {
    try {
      return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (e) {
      console.warn("根据XPath查找元素失败:", e);
      return null;
    }
  }
  
  // 在保存到IndexedDB前清理数据
  cleanDataBeforeSave() {
    // 深拷贝并移除所有不可序列化的属性
    try {
      const cleanData = JSON.parse(JSON.stringify(this.indexDBData));
      // 由于JSON序列化会自动过滤掉函数和DOM引用，我们可以重新赋值
      // 但保留原始结构，只更新需要持久化的数据
      this.indexDBData.images = cleanData.images;
      // 特别处理originalImages，只保留必要的信息
      const cleanOriginalImages = {};
      for (const url in this.indexDBData.originalImages) {
        const original = this.indexDBData.originalImages[url];
        cleanOriginalImages[url] = {
          src: original.src,
          xpath: original.xpath,
          isBackground: original.isBackground || false
        };
      }
      this.indexDBData.originalImages = cleanOriginalImages;
    } catch (error) {
      console.warn("数据清理失败:", error);
    }
  }
  
  // 爬取背景图片
  crawlBackgroundImages() {
    const elements = document.querySelectorAll('*');
    const processedUrls = new Set();
    
    elements.forEach((element, index) => {
      try {
        const computedStyle = window.getComputedStyle(element);
        const backgroundImage = computedStyle.backgroundImage;
        
        if (backgroundImage && backgroundImage !== 'none') {
          // 提取CSS中的图片URL
          const urlMatches = backgroundImage.match(/url\(['"]?([^'")]+)['"]?\)/g);
          
          if (urlMatches) {
            urlMatches.forEach(match => {
              try {
                // 提取URL内容
                let url = match.match(/url\(['"]?([^'")]+)['"]?\)/)[1];
                
                // 处理相对URL
                if (url.startsWith('/') && !url.startsWith('//')) {
                  url = window.location.origin + url;
                } else if (url.startsWith('//')) {
                  url = window.location.protocol + url;
                } else if (!url.startsWith('http')) {
                  url = new URL(url, window.location.href).href;
                }
                
                if (this.isValidImageUrl(url) && !processedUrls.has(url)) {
                  processedUrls.add(url);
                  const normalizedUrl = this.normalizeUrl(url);
                  
                  // 存储原始图片信息，不存储DOM元素引用
                  this.indexDBData.originalImages[normalizedUrl] = {
                    src: url,
                    isBackground: true,
                    xpath: this.getElementXPath(element)
                  };
                  
                  this.indexDBData.images.push({
                    name: `背景图片${index + 1}`,
                    url: url,
                    isOriginal: true,
                    originalUrl: normalizedUrl
                  });
                }
              } catch (error) {
                console.warn("处理背景图片URL时出错:", error);
              }
            });
          }
        }
      } catch (error) {
        console.warn("处理元素背景时出错:", error);
      }
    });
  }
  
  // 爬取Canvas图片
  crawlCanvasImages() {
    const canvasElements = document.querySelectorAll('canvas');
    
    canvasElements.forEach((canvas, index) => {
      try {
        // 尝试将canvas转换为图片
        const dataUrl = canvas.toDataURL('image/png');
        
        if (dataUrl && dataUrl.startsWith('data:image/')) {
          // 检查canvas是否有内容
          if (this.isCanvasNotEmpty(canvas)) {
            const name = `Canvas图片${index + 1}`;
            
            this.indexDBData.images.push({
              name: name,
              url: dataUrl,
              isOriginal: true,
              originalUrl: dataUrl // 对于canvas，直接使用dataURL作为originalUrl
            });
          }
        }
      } catch (error) {
        console.warn("处理Canvas图片时出错:", error);
      }
    });
  }
  
  // 检查Canvas是否为空
  isCanvasNotEmpty(canvas) {
    try {
      const context = canvas.getContext('2d');
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // 检查是否有非透明像素
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }
  
  // 添加图片方法（支持粘贴图片和输入URL）
  addImage() {
    // 创建一个临时的输入框用于输入图片URL和名称
    const tempContainer = document.createElement("div");
    tempContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(0, 0, 0, 0.9);
      padding: 20px;
      border-radius: 5px;
      z-index: 2002;
      color: white;
      width: 400px;
      box-sizing: border-box;
    `;
    tempContainer.innerHTML = `
      <h3>添加图片</h3>
      <div style="margin-bottom: 10px;">
        <label>图片名称:</label>
        <input type="text" id="imgNameInput" placeholder="请输入图片名称" style="margin-top: 5px; width: 100%; background-color: #333; color: white; border: 1px solid #555;">
      </div>
      <div style="margin-bottom: 10px;">
        <label>图片URL:</label>
        <input type="text" id="imgUrlInput" placeholder="请输入图片URL或粘贴图片" style="margin-top: 5px; width: 100%; background-color: #333; color: white; border: 1px solid #555;">
      </div>
      <div style="margin-bottom: 10px; text-align: center; padding: 10px; border: 2px dashed #555; border-radius: 5px;">
        <p style="margin: 5px 0; font-size: 12px;">或直接粘贴图片到此处</p>
        <div id="pastePreview" style="min-height: 100px; display: flex; align-items: center; justify-content: center;"></div>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <button id="cancelBtn" style="background-color: #555; color: white; border: none; padding: 5px 10px; cursor: pointer;">取消</button>
        <button id="confirmBtn" style="background-color: #4CAF50; color: white; border: none; padding: 5px 10px; cursor: pointer;">确定</button>
      </div>
    `;
    
    document.body.appendChild(tempContainer);
    
    // 存储粘贴的图片数据URL
    let pastedImageDataUrl = null;
    
    // 处理粘贴事件
    const handlePaste = (e) => {
      e.preventDefault();
      
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          const reader = new FileReader();
          
          reader.onload = (event) => {
            pastedImageDataUrl = event.target.result;
            
            // 显示预览
            const previewDiv = tempContainer.querySelector('#pastePreview');
            previewDiv.innerHTML = `<img src="${pastedImageDataUrl}" style="max-width: 100%; max-height: 150px;">`;
            
            // 清空URL输入框（粘贴图片后不需要URL）
            tempContainer.querySelector('#imgUrlInput').value = '';
          };
          
          reader.readAsDataURL(file);
          break;
        }
      }
    };
    
    // 为整个模态框添加粘贴事件监听
    tempContainer.addEventListener('paste', handlePaste);
    
    // 绑定按钮事件
    tempContainer.querySelector("#cancelBtn").addEventListener("click", () => {
      // 移除事件监听
      tempContainer.removeEventListener('paste', handlePaste);
      document.body.removeChild(tempContainer);
    });
    
    tempContainer.querySelector("#confirmBtn").addEventListener("click", async () => {
      const name = tempContainer.querySelector("#imgNameInput").value;
      let url = tempContainer.querySelector("#imgUrlInput").value;
      
      // 如果没有名称，使用默认名称
      if (!name) {
        tools.alert("请输入图片名称");
        return;
      }
      
      // 优先使用粘贴的图片数据URL
      if (pastedImageDataUrl) {
        url = pastedImageDataUrl;
      }
      
      if (!url) {
        tools.alert("请输入图片URL或粘贴图片");
        return;
      }
      
      // 验证URL是否为有效的图片URL
      if (!this.isValidImageUrl(url)) {
        tools.alert("请输入有效的图片URL");
        return;
      }
      
      // 保存图片到本地存储
      try {
        // 添加图片到数据中
        this.indexDBData.images.push({
          name: name,
          url: url,
          isOriginal: true,
          originalUrl: url // 对于添加的图片，原始URL就是当前URL
        });
        
        // 清理数据并保存到IndexedDB
        this.cleanDataBeforeSave();
        await tools.indexDB_updateIndexDBData();
        
        // 重新渲染图片
        this.renderImages();
        
        // 显示最新添加的图片
        this.componentData.currentImageIndex = this.indexDBData.images.length - 1;
        this.updateSliderPosition();
        this.updateImageInfo();
        
        tools.alert("图片添加成功");
      } catch (error) {
        console.error("图片添加失败:", error);
        tools.alert("图片添加失败，请重试");
      }
      
      // 移除事件监听
      tempContainer.removeEventListener('paste', handlePaste);
      document.body.removeChild(tempContainer);
    });
  }
  // 替换当前图片
  replaceCurrentImage() {
    if (this.indexDBData.images.length === 0) return;
    
    const currentImage = this.indexDBData.images[this.componentData.currentImageIndex];
    
    // 创建一个临时的输入框用于输入新的图片URL
    const tempContainer = document.createElement("div");
    tempContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(0, 0, 0, 0.9);
      padding: 20px;
      border-radius: 5px;
      z-index: 2002;
      color: white;
      width: 400px;
      box-sizing: border-box;
    `;
    tempContainer.innerHTML = `
      <h3>替换图片</h3>
      <div style="margin-bottom: 10px;">
        <label>当前图片: ${currentImage.name}</label>
      </div>
      <div style="margin-bottom: 10px;">
        <label>新图片URL:</label>
        <input type="text" id="newImgUrlInput" style="margin-top: 5px; width: 100%; background-color: #333; color: white; border: 1px solid #555;">
      </div>
      <div style="margin-bottom: 10px;">
        <label><input type="checkbox" id="applyToWebpage" checked> 同时替换网页中的相同图片</label>
      </div>
      <div style="margin-bottom: 10px;">
        <label><input type="checkbox" id="saveAsRule"> 保存为替换规则</label>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <button id="cancelBtn" style="background-color: #555; color: white; border: none; padding: 5px 10px; cursor: pointer;">取消</button>
        <button id="confirmBtn" style="background-color: #4CAF50; color: white; border: none; padding: 5px 10px; cursor: pointer;">确定</button>
      </div>
    `;
    
    document.body.appendChild(tempContainer);
    
    // 绑定按钮事件
    tempContainer.querySelector("#cancelBtn").addEventListener("click", () => {
      document.body.removeChild(tempContainer);
    });
    
    tempContainer.querySelector("#confirmBtn").addEventListener("click", async () => {
      const newUrl = tempContainer.querySelector("#newImgUrlInput").value;
      const applyToWebpage = tempContainer.querySelector("#applyToWebpage").checked;
      const saveAsRule = tempContainer.querySelector("#saveAsRule").checked;
      
      if (!newUrl) {
        tools.alert("请输入新图片URL");
        return;
      }
      
      // 验证URL是否为有效的图片URL
      if (!this.isValidImageUrl(newUrl)) {
        tools.alert("请输入有效的图片URL");
        return;
      }
      
      try {
        // 保存原始URL（如果还没有保存）
        if (!this.indexDBData.images[this.componentData.currentImageIndex].originalUrl) {
          this.indexDBData.images[this.componentData.currentImageIndex].originalUrl = this.indexDBData.images[this.componentData.currentImageIndex].url;
        }
        
        if (this.indexDBData.images[this.componentData.currentImageIndex].isOriginal) {
          this.indexDBData.images[this.componentData.currentImageIndex].isOriginal = false;
        }
        
        // 更新图片查看器中的图片URL
        this.indexDBData.images[this.componentData.currentImageIndex].url = newUrl;
        
        // 在保存前清理数据
        this.cleanDataBeforeSave();
        await tools.indexDB_updateIndexDBData();
        
        // 重新渲染图片
        this.renderImages();
        this.updateSliderPosition();
        this.updateImageInfo();
        
        // 规范化URL
        const originalUrl = this.normalizeUrl(currentImage.originalUrl || currentImage.url);
        const replacedUrl = this.normalizeUrl(newUrl);
        
        // 如果需要保存为规则
        if (saveAsRule) {
          const ruleName = prompt('请输入规则名称:', `替换 ${currentImage.name}`);
          if (ruleName) {
            this.indexDBData.replacementRules.push({
              name: ruleName,
              originalUrl: originalUrl,
              replacedUrl: replacedUrl
            });
            await tools.indexDB_updateIndexDBData();
          }
        }
        
        // 如果需要应用到网页
        if (applyToWebpage) {
          // 获取全局的ImageProcessor对象
          const ImageProcessor = window.ImageProcessor || window.parent.ImageProcessor;
          
          if (ImageProcessor && typeof ImageProcessor.addRule === 'function') {
            ImageProcessor.addRule(originalUrl, replacedUrl);
            tools.alert("图片替换成功，已同时应用到网页中");
          } else {
            // 如果没有ImageProcessor，尝试直接替换网页中的图片
            this.applyImageReplacementToWebpage(currentImage, newUrl);
          }
        } else {
          tools.alert("图片替换成功");
        }
      } catch (error) {
        console.error("图片替换失败:", error);
        tools.alert("图片替换失败，请重试");
      }
      
      document.body.removeChild(tempContainer);
    });
  }
  
  // 验证URL是否为有效的图片URL
  isValidImageUrl(url) {
    try {
      // 检查data URL
      if (url.startsWith('data:image/')) {
        return true;
      }
      
      // 检查普通图片URL
      const imgExtensions = /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i;
      const urlObj = new URL(url, window.location.origin);
      
      // 检查协议和扩展名
      return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && 
             imgExtensions.test(urlObj.pathname);
    } catch (e) {
      return false;
    }
  }
  
  // URL规范化处理 - 符合ImageProcessor模块规范
  normalizeUrl(url) {
    try {
      // 处理相对URL
      if (url.startsWith('//')) {
        url = window.location.protocol + url;
      } else if (url.startsWith('/') && !url.startsWith('//')) {
        url = window.location.origin + url;
      }
      
      // 创建URL对象以确保格式正确
      const urlObj = new URL(url, window.location.origin);
      
      // 移除URL中的hash部分以确保更好的匹配
      urlObj.hash = '';
      
      return urlObj.href;
    } catch (e) {
      console.warn("URL规范化失败:", e);
      return url;
    }
  }
  
  // 直接应用图片替换到网页（当没有ImageProcessor时的降级方案）
  applyImageReplacementToWebpage(originalImage, newUrl) {
    try {
      const normalizedOriginalUrl = this.normalizeUrl(originalImage.originalUrl || originalImage.url);
      let replacedCount = 0;
      
      // 检查是否有存储的原始图片元素信息
      if (this.indexDBData.originalImages[normalizedOriginalUrl]) {
        const originalInfo = this.indexDBData.originalImages[normalizedOriginalUrl];
        // 使用XPath获取元素
        const element = this.getElementByXPath(originalInfo.xpath);
        
        if (element) {
          if (originalInfo.isBackground) {
            // 替换背景图片
            element.style.backgroundImage = `url('${newUrl}')`;
            replacedCount++;
          } else {
            // 替换img元素
            element.src = newUrl;
            replacedCount++;
          }
        }
      }
      
      // 搜索并替换页面上所有匹配的图片
      const imgElements = document.querySelectorAll('img');
      imgElements.forEach(element => {
        if (this.normalizeUrl(element.src) === normalizedOriginalUrl) {
          element.src = newUrl;
          replacedCount++;
        }
      });
      
      if (replacedCount > 0) {
        tools.alert(`图片已更新，并成功替换了网页中的 ${replacedCount} 张图片`);
      } else {
        tools.alert("图片已更新，但未在网页中找到匹配的图片");
      }
    } catch (error) {
      console.error("直接替换网页图片失败:", error);
      tools.alert("图片已更新，但无法应用全局替换规则");
    }
  }
  
  // 还原所有图片到原始状态
  restoreAllImages() {
    if (confirm("确定要将所有图片还原到原始状态吗？")) {
      try {
        // 1. 还原图片查看器中的图片
        this.indexDBData.images.forEach(image => {
          if (!image.isOriginal && image.originalUrl) {
            // 查找原始图片信息
            const originalInfo = this.indexDBData.originalImages[normalizeUrl(image.originalUrl)];
            
            if (originalInfo) {
              image.url = originalInfo.src;
              image.isOriginal = true;
            } else {
              // 如果没有存储的原始信息，使用保存的originalUrl
              image.url = image.originalUrl;
              image.isOriginal = true;
            }
          }
        });
        
        // 2. 还原网页中的图片
        if (ImageProcessor && typeof ImageProcessor.restoreAllImages === 'function') {
          ImageProcessor.restoreAllImages();
        } else {
          // 降级方案：手动还原存储的图片
          Object.values(this.indexDBData.originalImages).forEach(originalInfo => {
            // 使用XPath获取元素
            const element = this.getElementByXPath(originalInfo.xpath);
            
            if (element) {
              if (originalInfo.isBackground) {
                element.style.backgroundImage = `url('${originalInfo.src}')`;
              } else {
                element.src = originalInfo.src;
              }
            }
          });
        }
        
        // 3. 保存数据并更新界面
        this.cleanDataBeforeSave(); // 在保存前清理数据
        tools.indexDB_updateIndexDBData();
        this.renderImages();
        this.updateSliderPosition();
        this.updateImageInfo();
        
        tools.alert("所有图片已成功还原到原始状态");
      } catch (error) {
        console.error("图片还原失败:", error);
        tools.alert("图片还原失败，请重试");
      }
    }
  }
  
  // 应用保存的替换规则
  applySavedRules() {
    try {
      if (this.indexDBData.autoApplyRules && ImageProcessor && typeof ImageProcessor.addRule === 'function' && this.indexDBData.replacementRules.length > 0) {
        // 如果设置了等待图片加载完成
        if (this.indexDBData.waitForImagesLoad) {
          // 等待页面上的图片加载完成
          this.waitForImagesToLoadAndApplyRules();
        } else {
          // 只等待指定的延迟时间
          setTimeout(() => {
            this.applyRulesImmediately();
          }, this.indexDBData.applyDelay);
        }
      }
    } catch (error) {
      console.error('应用保存的替换规则失败:', error);
    }
  }
  
  // 等待图片加载完成后应用规则
  waitForImagesToLoadAndApplyRules() {
    const images = document.querySelectorAll('img');
    const totalImages = images.length;
    let loadedImages = 0;
    
    // 如果没有图片，直接应用规则
    if (totalImages === 0) {
      setTimeout(() => {
        this.applyRulesImmediately();
      }, this.indexDBData.applyDelay);
      return;
    }
    
    // 为每张图片添加加载完成事件监听器
    images.forEach(img => {
      if (img.complete) {
        loadedImages++;
      } else {
        img.addEventListener('load', () => {
          loadedImages++;
          // 如果所有图片都已加载完成
          if (loadedImages === totalImages) {
            this.applyRulesImmediately();
          }
        });
        img.addEventListener('error', () => {
          loadedImages++;
          // 即使图片加载失败，也继续计数，确保不会卡住
          if (loadedImages === totalImages) {
            this.applyRulesImmediately();
          }
        });
      }
    });
    
    // 设置超时，以防某些图片加载时间过长
    setTimeout(() => {
      this.applyRulesImmediately();
    }, this.indexDBData.applyDelay + 5000); // 额外加5秒作为保险
  }
  
  // 立即应用替换规则
  applyRulesImmediately() {
    try {
      if (ImageProcessor && typeof ImageProcessor.addRule === 'function' && this.indexDBData.replacementRules.length > 0) {
        // 应用所有保存的替换规则
        this.indexDBData.replacementRules.forEach(rule => {
          ImageProcessor.addRule(rule.originalUrl, rule.replacedUrl);
        });
        console.log(`已应用 ${this.indexDBData.replacementRules.length} 条替换规则`);
      }
    } catch (error) {
      console.error('立即应用替换规则失败:', error);
    }
  }
  
  // 删除当前图片
  removeCurrentImage() {
    if (this.indexDBData.images.length === 0) return;
    
    if (confirm(`确定要删除图片"${this.indexDBData.images[this.componentData.currentImageIndex].name}"吗？`)) {
      this.indexDBData.images.splice(this.componentData.currentImageIndex, 1);
      
      // 如果删除的是最后一张图片，重置当前索引
      if (this.indexDBData.images.length === 0) {
        this.componentData.currentImageIndex = 0;
      } else if (this.componentData.currentImageIndex >= this.indexDBData.images.length) {
        this.componentData.currentImageIndex = this.indexDBData.images.length - 1;
      }
      
      // 更新数据和界面
      this.cleanDataBeforeSave(); // 在保存前清理数据
      tools.indexDB_updateIndexDBData();
      this.renderImages();
      this.updateSliderPosition();
      this.updateImageInfo();
    }
  }
}
new imgViewer();