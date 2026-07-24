const BaseComponent = require("../tools/baseComponent.js");
const { tools } = require("../tools/tools.js");

class companyAvatarZoom extends BaseComponent {
  constructor() {
    super();
    this.name = "公司详情页头像悬浮放大";
    this.describe = "在公司详情页面（/company/realm/company_name/），悬浮在公司头像上时弹出全局居中的高清放大蒙版。";
    this.enable = true;
    this.canDisable = true;
    this.tagList = ["实用", "界面"];
    this.commonFuncList = [
      {
        match: () => this.isCompanyProfilePage(),
        func: this.initAvatarZoom,
      },
    ];
  }

  isCompanyProfilePage = () => {
    return /\/company\/\d+\/[^/]+\/?$/i.test(location.pathname);
  };

  initAvatarZoom = () => {
    if (!this.enable) return;

    // 锁定页面：必须在公司详情页面
    if (!this.isCompanyProfilePage()) return;

    // 定位目标头像 (#page > div > div > div > div.col-md-4 > div:nth-child(1) > div > div > img)
    const avatar = document.querySelector("#page > div > div > div > div.col-md-4 > div:nth-child(1) > div > div > img")
      || document.querySelector("img[src*='logo']")
      || document.querySelector("img[class*='avatar']");

    if (!avatar || avatar.dataset.sctAvatarZoomBound) return;
    avatar.dataset.sctAvatarZoomBound = "true";

    // 清理旧容器
    const zoomContainerId = "global-avatar-zoom-container";
    const oldContainer = document.getElementById(zoomContainerId);
    if (oldContainer) oldContainer.remove();

    // 创建居中大图容器
    const zoomContainer = document.createElement("div");
    zoomContainer.id = zoomContainerId;
    Object.assign(zoomContainer.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%) scale(0.5)",
      opacity: "0",
      transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
      zIndex: "2147483647",
      pointerEvents: "none",
      border: "4px solid #fff",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      borderRadius: "16px",
      backgroundColor: "#fff",
      overflow: "hidden",
      visibility: "hidden",
      display: "flex",
    });

    // 创建图片对象（不设置 crossorigin 规避 CORS 报错）
    const bigImg = new Image();
    bigImg.src = avatar.src;

    const rect = avatar.getBoundingClientRect();
    const displaySize = Math.max((rect.width || 100) * 2.5, 240);

    bigImg.style.width = displaySize + "px";
    bigImg.style.height = "auto";
    bigImg.style.display = "block";

    zoomContainer.appendChild(bigImg);
    document.body.appendChild(zoomContainer);

    // 事件绑定
    const trigger = avatar.parentElement || avatar;
    const showZoom = () => {
      if (!this.isCompanyProfilePage()) return;
      bigImg.src = avatar.src;
      zoomContainer.style.visibility = "visible";
      zoomContainer.style.opacity = "1";
      zoomContainer.style.transform = "translate(-50%, -50%) scale(1)";
    };

    const hideZoom = () => {
      zoomContainer.style.opacity = "0";
      zoomContainer.style.transform = "translate(-50%, -50%) scale(0.5)";
      setTimeout(() => {
        if (zoomContainer.style.opacity === "0") zoomContainer.style.visibility = "hidden";
      }, 300);
    };

    trigger.addEventListener("mouseenter", showZoom);
    trigger.addEventListener("mouseleave", hideZoom);
  };
}

new companyAvatarZoom();

module.exports = companyAvatarZoom;
