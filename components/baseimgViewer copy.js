const BaseComponent = require("../tools/baseComponent.js");
const { tools, componentList, runtimeData, indexDBData, feature_config } = require("../tools/tools.js");

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
    images: [], // 存储的图片数据 [{name: "图片名称", url: "图片URL"}]
    positionTop: "10px", // 容器定位顶部距离
    positionLeft: "10px", // 容器定位左侧距离
    isShow: false, // 容器是否处于展示状态
    isHide: false, // 是否缩小
    windowWidth: 600, // 窗口宽度
    windowHeight: 400, // 窗口高度
  }
  startupFuncList = [
    this.buildContianer
  ]
  cssText = [
    `#script_imgViewer_root{z-index:1040;display:none;color:var(--fontColor);position:fixed;top:20px;left:20px;width:600px;height:400px;border:1px solid #ccc;padding:10px;box-sizing:border-box;cursor:move;background-color:rgba(0,0,0,0.8);box-shadow:0 0 5px 1px black;border-radius:5px;overflow:hidden;}` +
    `#script_imgViewer_root #script_imgViewer_title{text-align:center;font-weight:bold;margin-bottom:10px;}` +
    `#script_imgViewer_root #script_imgViewer_close{position:absolute;top:10px;right:10px;cursor:pointer;}` +
    `#script_imgViewer_root #script_imgViewer_hide{position:absolute;top:10px;left:10px;cursor:pointer;}` +
    `#script_imgViewer_root #script_imgViewer_prev{position:absolute;top:50%;left:10px;transform:translateY(-50%);cursor:pointer;background-color:rgba(0,0,0,0.5);padding:5px;border-radius:5px;}` +
    `#script_imgViewer_root #script_imgViewer_next{position:absolute;top:50%;right:10px;transform:translateY(-50%);cursor:pointer;background-color:rgba(0,0,0,0.5);padding:5px;border-radius:5px;}` +
    `#script_imgViewer_root #script_imgViewer_imageContainer{width:100%;height:calc(100% - 60px);position:relative;overflow:hidden;}` +
    `#script_imgViewer_root #script_imgViewer_slider{display:flex;height:100%;transition:transform 0.3s ease;}` +
    `#script_imgViewer_root .script_imgViewer_imageItem{min-width:100%;height:100%;display:flex;align-items:center;justify-content:center;}` +
    `#script_imgViewer_root .script_imgViewer_imageItem img{max-width:100%;max-height:100%;object-contain;}` +
    `#script_imgViewer_root #script_imgViewer_imageName{text-align:center;margin-top:5px;font-size:12px;}` +
    `#script_imgViewer_root #script_imgViewer_addImage{position:absolute;bottom:10px;right:60px;cursor:pointer;background-color:rgba(0,0,0,0.5);padding:5px;border-radius:5px;}` +
    `#script_imgViewer_root #script_imgViewer_removeImage{position:absolute;bottom:10px;right:110px;cursor:pointer;background-color:rgba(0,0,0,0.5);padding:5px;border-radius:5px;}` +
    `#script_imgViewer_root #script_imgViewer_indicator{display:flex;justify-content:center;gap:5px;margin-top:5px;}` +
    `#script_imgViewer_root .script_imgViewer_dot{width:8px;height:8px;border-radius:50%;background-color:rgba(255,255,255,0.5);cursor:pointer;}` +
    `#script_imgViewer_root .script_imgViewer_dot.active{background-color:white;}` 
    //`button#script_imgViewer_button{color:var(--fontColor);text-align:center;display:block;position:fixed;right:10px;bottom:10px;width:fit-content;height:fit-content;z-index:2001;border-radius:5px;border:1px solid white;}`
  ]
  frontUI = () => {
    Object.assign(this.componentData.rootNode.style, { display: "block" });
  }
  // 设置界面
  settingUI = () => {
    let newNode = document.createElement("div");
    let htmlText = `<div class=header>图片查看器设置</div><div class=container><div><button class="btn script_opt_submit">保存</button></div><table><tr style=height:60px><td>功能<td>设置<tr><td>窗口宽度<td><input class=form-control type=number value="${this.indexDBData.windowWidth}"><tr><td>窗口高度<td><input class=form-control type=number value="${this.indexDBData.windowHeight}"></table></div>`;
    newNode.id = "imgViewerSetting";
    newNode.className = "col-sm-12 setting-container";
    newNode.innerHTML = htmlText;
    // 挂载按钮
    newNode.querySelector("button.script_opt_submit").addEventListener("click", () => this.settingSubmit());
    // 返回元素
    return newNode;
  }
  // 设置提交按钮
  async settingSubmit() {
    let width = document.querySelector("div#imgViewerSetting input[type=number]:nth-of-type(1)").value;
    let height = document.querySelector("div#imgViewerSetting input[type=number]:nth-of-type(2)").value;
    
    if (width < 300 || height < 200) return tools.alert("窗口尺寸不能太小，最小宽度300px，最小高度200px");
    
    this.indexDBData.windowWidth = parseInt(width);
    this.indexDBData.windowHeight = parseInt(height);
    
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
      <div id="script_imgViewer_hide">缩小</div>
      <div id="script_imgViewer_close">关闭</div>
      <div id="script_imgViewer_imageContainer">
        <div id="script_imgViewer_slider"></div>
        <div id="script_imgViewer_prev">上一张</div>
        <div id="script_imgViewer_next">下一张</div>
      </div>
      <div id="script_imgViewer_imageName"></div>
      <div id="script_imgViewer_indicator"></div>
      <div id="script_imgViewer_removeImage">删除</div>
      <div id="script_imgViewer_addImage">添加</div>
    `;
    
    // 创建触发按钮
    //let triggerButton = document.createElement("button");
    //triggerButton.id = "script_imgViewer_button";
    //triggerButton.innerText = "图片查看器";
    
    // 绑定函数
    newNode.addEventListener("mousedown", event => this.startDragging(event));
    newNode.addEventListener("touchstart", event => this.startDragging(event));
    newNode.querySelector("div#script_imgViewer_close").addEventListener('click', () => this.closeRootDisplay());
    newNode.querySelector("div#script_imgViewer_hide").addEventListener('click', () => this.switchHide());
    newNode.querySelector("div#script_imgViewer_prev").addEventListener('click', () => this.showPrevImage());
    newNode.querySelector("div#script_imgViewer_next").addEventListener('click', () => this.showNextImage());
    newNode.querySelector("div#script_imgViewer_addImage").addEventListener('click', () => this.addImage());
    newNode.querySelector("div#script_imgViewer_removeImage").addEventListener('click', () => this.removeCurrentImage());
    
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
      display: this.indexDBData.isShow ? "block" : "none"
    });
    
    // 挂载标签
    this.componentData.rootNode = newNode;
    document.body.appendChild(newNode);
    document.body.appendChild(triggerButton);
    
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
      
      imageItem.appendChild(img);
      slider.appendChild(imageItem);
    });
    
    // 更新图片信息和指示器
    this.updateImageInfo();
  }
  // 添加图片
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
    `;
    tempContainer.innerHTML = `
      <h3>添加图片</h3>
      <div style="margin-bottom: 10px;">
        <label>图片名称:</label>
        <input type="text" id="imgNameInput" style="margin-top: 5px; width: 100%;">
      </div>
      <div style="margin-bottom: 10px;">
        <label>图片URL:</label>
        <input type="text" id="imgUrlInput" style="margin-top: 5px; width: 100%;">
      </div>
      <div style="display: flex; justify-content: space-between;">
        <button id="cancelBtn">取消</button>
        <button id="confirmBtn">确定</button>
      </div>
    `;
    
    document.body.appendChild(tempContainer);
    
    // 绑定按钮事件
    tempContainer.querySelector("#cancelBtn").addEventListener("click", () => {
      document.body.removeChild(tempContainer);
    });
    
    tempContainer.querySelector("#confirmBtn").addEventListener("click", async () => {
      const name = tempContainer.querySelector("#imgNameInput").value;
      const url = tempContainer.querySelector("#imgUrlInput").value;
      
      if (!name || !url) {
        tools.alert("请输入图片名称和URL");
        return;
      }
      
      // 验证URL是否为有效的图片URL
      if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|bmp|svg)$/i.test(url)) {
        tools.alert("请输入有效的图片URL");
        return;
      }
      
      // 添加图片到数据中
      this.indexDBData.images.push({ name, url });
      await tools.indexDB_updateIndexDBData();
      
      // 重新渲染图片
      this.renderImages();
      
      // 显示第一张图片
      this.componentData.currentImageIndex = 0;
      this.updateSliderPosition();
      this.updateImageInfo();
      
      document.body.removeChild(tempContainer);
    });
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
      tools.indexDB_updateIndexDBData();
      this.renderImages();
      this.updateSliderPosition();
      this.updateImageInfo();
    }
  }
}
new imgViewer();