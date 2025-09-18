const { tools } = require('../tools/tools.js');

// 全局变量
let observer = null;
let processedElements = new WeakSet();
let imageCache = new Map();

// 配置常量
const STORAGE_KEYS = {
  IMAGE_REPLACEMENT: 'imageReplacementRules_v3',
  MATERIAL_PACKS: 'materialPacks_v3'
};

// 工具函数
function getPageIdentifier() {
  return btoa(encodeURIComponent(window.location.href)).substring(0, 32);
}

function isDataUrl(url) {
  return url && url.startsWith('data:image');
}

function isValidImageUrl(url) {
  return url && (url.startsWith('http') || url.startsWith('//') || url.startsWith('/'));
}

function normalizeUrl(url) {
  try {
    if (url.startsWith('//')) {
      return window.location.protocol + url;
    }
    if (url.startsWith('/')) {
      return window.location.origin + url;
    }
    return url;
  } catch (e) {
    return url;
  }
}

// 存储管理
const StorageManager = {
  getRules: function() {
    try {
      const pageId = getPageIdentifier();
      const allRules = GM_getValue ? GM_getValue(STORAGE_KEYS.IMAGE_REPLACEMENT, '{}') : '{"' + pageId + '":[]}';
      const parsed = JSON.parse(allRules);
      return parsed[pageId] || [];
    } catch (e) {
      console.error('获取规则失败:', e);
      return [];
    }
  },

  saveRules: function(rules) {
    try {
      const pageId = getPageIdentifier();
      const allRules = GM_getValue ? GM_getValue(STORAGE_KEYS.IMAGE_REPLACEMENT, '{}') : '{}';
      const parsed = JSON.parse(allRules);
      parsed[pageId] = rules;
      if (GM_setValue) {
        GM_setValue(STORAGE_KEYS.IMAGE_REPLACEMENT, JSON.stringify(parsed));
      }
      return true;
    } catch (e) {
      console.error('保存规则失败:', e);
      return false;
    }
  },

  clearRules: function() {
    try {
      const pageId = getPageIdentifier();
      const allRules = GM_getValue ? GM_getValue(STORAGE_KEYS.IMAGE_REPLACEMENT, '{}') : '{}';
      const parsed = JSON.parse(allRules);
      delete parsed[pageId];
      if (GM_setValue) {
        GM_setValue(STORAGE_KEYS.IMAGE_REPLACEMENT, JSON.stringify(parsed));
      }
      return true;
    } catch (e) {
      console.error('清空规则失败:', e);
      return false;
    }
  }
};

// 核心图片处理器
const ImageProcessor = {
  rules: [],
  isApplying: false,

  init: function() {
    this.rules = StorageManager.getRules();
    this.setupObserver();
    this.applyReplacementsImmediately();
  },

  setupObserver: function() {
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver((mutations) => {
      if (this.isApplying) return;

      let hasRelevantChanges = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          hasRelevantChanges = true;
          break;
        }
        if (mutation.type === 'attributes' && (mutation.attributeName === 'src' || mutation.attributeName === 'srcset' || mutation.attributeName === 'style')) {
          hasRelevantChanges = true;
          break;
        }
      }

      if (hasRelevantChanges) {
        setTimeout(() => this.applyReplacements(), 50);
      }
    });

    if (document.documentElement) {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'style']
      });
    }
  },

  applyReplacementsImmediately: function() {
    if (this.isApplying || this.rules.length === 0) return;

    this.isApplying = true;

    try {
      // 立即处理现有图片
      this.processAllImages();

      // 设置一个微任务来处理可能动态加载的图片
      setTimeout(() => {
        this.processAllImages();
        this.isApplying = false;
      }, 100);
    } catch (e) {
      console.error('立即应用替换时出错:', e);
      this.isApplying = false;
    }
  },

  applyReplacements: function() {
    if (this.isApplying || this.rules.length === 0) return;

    this.isApplying = true;

    requestAnimationFrame(() => {
      try {
        this.processAllImages();
      } catch (e) {
        console.error('应用替换时出错:', e);
      } finally {
        this.isApplying = false;
      }
    });
  },

  processAllImages: function() {
    this.processImageElements();
    this.processBackgroundImages();
    this.processSourceElements();
  },

  processImageElements: function() {
    const images = document.querySelectorAll('img:not([data-icts-processed])');

    for (const img of images) {
      if (processedElements.has(img)) continue;

      const originalSrc = img.src;
      if (!originalSrc || isDataUrl(originalSrc)) continue;

      const normalizedSrc = normalizeUrl(originalSrc);
      const rule = this.rules.find(r => r.originalUrl === normalizedSrc);

      if (rule) {
        img.setAttribute('data-icts-original', originalSrc);
        img.src = rule.replacedUrl;
      }

      img.setAttribute('data-icts-processed', 'true');
      processedElements.add(img);
    }
  },

  processBackgroundImages: function() {
    const elements = document.querySelectorAll('*');

    for (const el of elements) {
      if (processedElements.has(el)) continue;

      try {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;

        if (bgImage && bgImage !== 'none') {
          const urlMatch = bgImage.match(/url\(['"]?([^'")]+)['"]?\)/);
          if (urlMatch && urlMatch[1]) {
            const originalUrl = normalizeUrl(urlMatch[1]);
            const rule = this.rules.find(r => r.originalUrl === originalUrl);

            if (rule && !isDataUrl(originalUrl)) {
              el.style.backgroundImage = `url('${rule.replacedUrl}')`;
              el.setAttribute('data-icts-bg-processed', 'true');
            }
          }
        }
      } catch (e) {}

      processedElements.add(el);
    }
  },

  processSourceElements: function() {
    const sources = document.querySelectorAll('source[src], source[srcset]');

    for (const source of sources) {
      if (processedElements.has(source)) continue;

      if (source.src) {
        const originalSrc = normalizeUrl(source.src);
        const rule = this.rules.find(r => r.originalUrl === originalSrc);

        if (rule) {
          source.setAttribute('data-icts-original', source.src);
          source.src = rule.replacedUrl;
        }
      }

      if (source.srcset) {
        let newSrcset = source.srcset;
        this.rules.forEach(rule => {
          if (newSrcset.includes(rule.originalUrl)) {
            newSrcset = newSrcset.replace(
              new RegExp(rule.originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
              rule.replacedUrl
            );
          }
        });

        if (newSrcset !== source.srcset) {
          source.setAttribute('data-icts-original-srcset', source.srcset);
          source.srcset = newSrcset;
        }
      }

      processedElements.add(source);
    }
  },

  addRule: function(originalUrl, replacedUrl) {
    // 规范化URL
    const normalizedUrl = normalizeUrl(originalUrl);

    // 移除现有规则
    this.rules = this.rules.filter(rule => rule.originalUrl !== normalizedUrl);

    // 添加新规则
    this.rules.push({
      originalUrl: normalizedUrl,
      replacedUrl: replacedUrl,
      timestamp: Date.now()
    });

    // 保存并立即应用
    StorageManager.saveRules(this.rules);
    this.applyReplacementsImmediately();
  },

  removeRule: function(originalUrl) {
    const normalizedUrl = normalizeUrl(originalUrl);
    this.rules = this.rules.filter(rule => rule.originalUrl !== normalizedUrl);
    StorageManager.saveRules(this.rules);

    // 恢复原始图片
    this.restoreOriginalImages(normalizedUrl);
  },

  restoreOriginalImages: function(originalUrl) {
    // 恢复img元素
    const images = document.querySelectorAll(`img[data-icts-original]`);
    images.forEach(img => {
      if (normalizeUrl(img.getAttribute('data-icts-original')) === originalUrl) {
        img.src = img.getAttribute('data-icts-original');
        img.removeAttribute('data-icts-original');
      }
    });

    // 恢复背景图片
    const bgElements = document.querySelectorAll('[data-icts-bg-processed]');
    bgElements.forEach(el => {
      el.style.backgroundImage = '';
      el.removeAttribute('data-icts-bg-processed');
    });

    // 重新加载页面以确保完全恢复
    setTimeout(() => location.reload(), 100);
  },

  restoreAllImages: function() {
    // 清除所有规则
    StorageManager.clearRules();
    this.rules = [];
    
    // 恢复所有img元素
    const images = document.querySelectorAll(`img[data-icts-original]`);
    images.forEach(img => {
      img.src = img.getAttribute('data-icts-original');
      img.removeAttribute('data-icts-original');
      img.removeAttribute('data-icts-processed');
    });

    // 恢复所有背景图片
    const bgElements = document.querySelectorAll('[data-icts-bg-processed]');
    bgElements.forEach(el => {
      el.style.backgroundImage = '';
      el.removeAttribute('data-icts-bg-processed');
    });

    // 清空已处理元素集合
    processedElements = new WeakSet();
    
    // 重新加载页面以确保完全恢复
    setTimeout(() => location.reload(), 100);
  }
};

// 暴露到全局作用域
window.ImageProcessor = ImageProcessor;

// 导出模块
exports.ImageProcessor = ImageProcessor;

exports.isDataUrl = isDataUrl;
exports.isValidImageUrl = isValidImageUrl;
exports.normalizeUrl = normalizeUrl;

exports.StorageManager = StorageManager;