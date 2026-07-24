// ==UserScript==
// @name         ICTS图片提取替换工具-最终版(nobody zero DS版)
// @namespace    http://tampermonkey.net/
// @version      0.80
// @description  快速提取所有图片并即时应用替换，无延迟
// @author       liyue
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 配置常量
    const STORAGE_KEYS = {
        IMAGE_REPLACEMENT: 'imageReplacementRules_v3',
        MATERIAL_PACKS: 'materialPacks_v3'
    };

    let isProcessing = false;
    let observer = null;
    let processedElements = new WeakSet();
    let imageCache = new Map();

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
                const allRules = GM_getValue(STORAGE_KEYS.IMAGE_REPLACEMENT, '{}');
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
                const allRules = GM_getValue(STORAGE_KEYS.IMAGE_REPLACEMENT, '{}');
                const parsed = JSON.parse(allRules);
                parsed[pageId] = rules;
                GM_setValue(STORAGE_KEYS.IMAGE_REPLACEMENT, JSON.stringify(parsed));
                return true;
            } catch (e) {
                console.error('保存规则失败:', e);
                return false;
            }
        },

        clearRules: function() {
            try {
                const pageId = getPageIdentifier();
                const allRules = GM_getValue(STORAGE_KEYS.IMAGE_REPLACEMENT, '{}');
                const parsed = JSON.parse(allRules);
                delete parsed[pageId];
                GM_setValue(STORAGE_KEYS.IMAGE_REPLACEMENT, JSON.stringify(parsed));
                return true;
            } catch (e) {
                console.error('清空规则失败:', e);
                return false;
            }
        }
    };

    // 图片提取器
    const ImageExtractor = {
        extractAllImages: function() {
            const images = new Set();

            try {
                // 1. 提取所有img标签
                const imgElements = document.querySelectorAll('img');
                imgElements.forEach(img => {
                    if (img.src && isValidImageUrl(img.src)) {
                        images.add(normalizeUrl(img.src));
                    }

                    // 处理srcset
                    if (img.srcset) {
                        img.srcset.split(',').forEach(src => {
                            const url = src.trim().split(' ')[0];
                            if (isValidImageUrl(url)) {
                                images.add(normalizeUrl(url));
                            }
                        });
                    }
                });

                // 2. 提取CSS背景图片
                this.extractBackgroundImages(images);

                // 3. 提取内联样式背景图片
                this.extractInlineBackgroundImages(images);

                // 4. 提取picture/source元素
                this.extractSourceElements(images);

                // 5. 提取canvas内容（如果有）
                this.extractCanvasImages(images);

            } catch (e) {
                console.error('提取图片时出错:', e);
            }

            return Array.from(images);
        },

        extractBackgroundImages: function(images) {
            const elements = document.querySelectorAll('*');
            for (const el of elements) {
                try {
                    const style = window.getComputedStyle(el);
                    const bgImage = style.backgroundImage;

                    if (bgImage && bgImage !== 'none') {
                        const urlMatch = bgImage.match(/url\(['"]?([^'")]+)['"]?\)/);
                        if (urlMatch && urlMatch[1] && isValidImageUrl(urlMatch[1])) {
                            images.add(normalizeUrl(urlMatch[1]));
                        }
                    }
                } catch (e) {}
            }
        },

        extractInlineBackgroundImages: function(images) {
            const elements = document.querySelectorAll('*[style*="background-image"]');
            for (const el of elements) {
                try {
                    const style = el.getAttribute('style');
                    const bgMatch = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
                    if (bgMatch && bgMatch[1] && isValidImageUrl(bgMatch[1])) {
                        images.add(normalizeUrl(bgMatch[1]));
                    }
                } catch (e) {}
            }
        },

        extractSourceElements: function(images) {
            const sources = document.querySelectorAll('source[srcset], source[src]');
            sources.forEach(source => {
                if (source.srcset) {
                    source.srcset.split(',').forEach(src => {
                        const url = src.trim().split(' ')[0];
                        if (isValidImageUrl(url)) {
                            images.add(normalizeUrl(url));
                        }
                    });
                }
                if (source.src && isValidImageUrl(source.src)) {
                    images.add(normalizeUrl(source.src));
                }
            });
        },

        extractCanvasImages: function(images) {
            const canvases = document.querySelectorAll('canvas');
            canvases.forEach(canvas => {
                try {
                    const dataUrl = canvas.toDataURL();
                    if (dataUrl) {
                        images.add(dataUrl);
                    }
                } catch (e) {}
            });
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
                    if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
                        hasRelevantChanges = true;
                        break;
                    }
                }

                if (hasRelevantChanges) {
                    setTimeout(() => this.applyReplacements(), 50);
                }
            });

            observer.observe(document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'srcset', 'style']
            });
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
        }
    };

    // UI界面
    const ImageUI = {
        show: function() {
            this.hide(); // 先隐藏现有的

            const images = ImageExtractor.extractAllImages();
            this.createUI(images);
        },

        hide: function() {
            const existingUI = document.querySelector('.icts-ui-container');
            if (existingUI) {
                existingUI.remove();
            }
        },

        createUI: function(images) {
            const container = document.createElement('div');
            container.className = 'icts-ui-container';

            GM_addStyle(`
                .icts-ui-container {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90%;
                    max-width: 800px;
                    max-height: 80vh;
                    background: #1e1e1e;
                    color: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                    z-index: 100000;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                .icts-header {
                    padding: 20px;
                    background: #2d2d30;
                    border-bottom: 1px solid #3e3e42;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }

                .icts-title {
                    font-size: 18px;
                    font-weight: 600;
                    color: #cccccc;
                }

                .icts-count {
                    font-size: 14px;
                    color: #888;
                    margin-left: 10px;
                }

                .icts-controls {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .icts-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .icts-btn:hover {
                    transform: translateY(-1px);
                }

                .icts-btn-close {
                    background: #e74c3c;
                    color: white;
                }

                .icts-btn-refresh {
                    background: #3498db;
                    color: white;
                }

                .icts-btn-clear {
                    background: #e67e22;
                    color: white;
                }

                .icts-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }

                .icts-images-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 16px;
                }

                .icts-image-card {
                    background: #252526;
                    border-radius: 8px;
                    padding: 12px;
                    transition: all 0.2s;
                    border: 1px solid #3c3c3c;
                }

                .icts-image-card:hover {
                    border-color: #007acc;
                    transform: translateY(-2px);
                }

                .icts-image-preview {
                    width: 100%;
                    height: 120px;
                    object-fit: contain;
                    background: #1a1a1a;
                    border-radius: 4px;
                    margin-bottom: 10px;
                }

                .icts-image-info {
                    font-size: 11px;
                    color: #888;
                    word-break: break-all;
                    margin-bottom: 8px;
                    line-height: 1.3;
                    max-height: 32px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .icts-image-status {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: 500;
                    margin-bottom: 8px;
                }

                .icts-status-replaced {
                    background: #27ae60;
                    color: white;
                }

                .icts-status-original {
                    background: #7f8c8d;
                    color: white;
                }

                .icts-image-actions {
                    display: flex;
                    gap: 6px;
                }

                .icts-action-btn {
                    flex: 1;
                    padding: 4px 8px;
                    border: none;
                    border-radius: 3px;
                    font-size: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .icts-action-replace {
                    background: #2ecc71;
                    color: white;
                }

                .icts-action-restore {
                    background: #e74c3c;
                    color: white;
                }

                .icts-empty-state {
                    text-align: center;
                    padding: 40px;
                    color: #666;
                    font-size: 14px;
                }

                .icts-loading {
                    text-align: center;
                    padding: 20px;
                    color: #888;
                }
            `);

            container.innerHTML = `
                <div class="icts-header">
                    <div>
                        <span class="icts-title">图片替换工具</span>
                        <span class="icts-count">(${images.length} 张图片)</span>
                    </div>
                    <div class="icts-controls">
                        <button class="icts-btn icts-btn-refresh" id="icts-refresh">刷新</button>
                        <button class="icts-btn icts-btn-clear" id="icts-clear">清空规则</button>
                        <button class="icts-btn icts-btn-close" id="icts-close">关闭</button>
                    </div>
                </div>
                <div class="icts-content">
                    <div class="icts-images-grid" id="icts-images-grid"></div>
                </div>
            `;

            document.body.appendChild(container);
            this.renderImages(images);
            this.bindEvents();
        },

        renderImages: function(images) {
            const grid = document.getElementById('icts-images-grid');
            if (!grid) return;

            if (images.length === 0) {
                grid.innerHTML = `
                    <div class="icts-empty-state">
                        <div>未找到图片</div>
                        <div style="font-size: 12px; margin-top: 8px;">尝试滚动页面或点击刷新按钮</div>
                    </div>
                `;
                return;
            }

            grid.innerHTML = '';

            images.forEach((imgUrl, index) => {
                const isReplaced = ImageProcessor.rules.some(rule => rule.originalUrl === imgUrl);

                const card = document.createElement('div');
                card.className = 'icts-image-card';
                card.innerHTML = `
                    <img src="${imgUrl}" class="icts-image-preview"
                         onerror="this.style.display='none'"
                         onload="this.style.opacity='1'"
                         style="opacity: 0; transition: opacity 0.3s">
                    <div class="icts-image-info" title="${imgUrl}">
                        ${imgUrl.length > 60 ? imgUrl.substring(0, 60) + '...' : imgUrl}
                    </div>
                    <div class="icts-image-status ${isReplaced ? 'icts-status-replaced' : 'icts-status-original'}">
                        ${isReplaced ? '已替换' : '原始'}
                    </div>
                    <div class="icts-image-actions">
                        ${!isReplaced ? `
                            <button class="icts-action-btn icts-action-replace"
                                    data-action="replace"
                                    data-src="${imgUrl}">
                                替换
                            </button>
                        ` : `
                            <button class="icts-action-btn icts-action-restore"
                                    data-action="restore"
                                    data-src="${imgUrl}">
                                还原
                            </button>
                        `}
                    </div>
                    <input type="file" accept="image/*" style="display: none;"
                           data-src="${imgUrl}" data-index="${index}">
                `;

                grid.appendChild(card);
            });
        },

        bindEvents: function() {
            const container = document.querySelector('.icts-ui-container');

            // 关闭按钮
            container.querySelector('#icts-close').addEventListener('click', () => this.hide());

            // 刷新按钮
            container.querySelector('#icts-refresh').addEventListener('click', () => {
                const images = ImageExtractor.extractAllImages();
                this.renderImages(images);
            });

            // 清空规则按钮
            container.querySelector('#icts-clear').addEventListener('click', () => {
                if (confirm('确定要清空当前页面的所有替换规则吗？')) {
                    StorageManager.clearRules();
                    ImageProcessor.rules = [];
                    location.reload();
                }
            });

            // 图片操作按钮
            this.bindImageActions();
        },

        bindImageActions: function() {
            // 替换按钮
            document.querySelectorAll('[data-action="replace"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const imgUrl = e.target.getAttribute('data-src');
                    const fileInput = e.target.closest('.icts-image-card').querySelector('input[type="file"]');
                    fileInput.click();

                    fileInput.onchange = (event) => {
                        if (event.target.files[0]) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                ImageProcessor.addRule(imgUrl, e.target.result);
                                this.show(); // 刷新UI
                            };
                            reader.readAsDataURL(event.target.files[0]);
                        }
                    };
                });
            });

            // 还原按钮
            document.querySelectorAll('[data-action="restore"]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const imgUrl = e.target.getAttribute('data-src');
                    ImageProcessor.removeRule(imgUrl);
                    this.show(); // 刷新UI
                });
            });
        }
    };

    // 初始化
    function initialize() {
        // 立即初始化处理器
        ImageProcessor.init();

        // 注册菜单命令
        GM_registerMenuCommand('打开图片替换工具', () => ImageUI.show());
        GM_registerMenuCommand('清空当前页面规则', () => {
            StorageManager.clearRules();
            location.reload();
        });

        // 添加键盘快捷键 (Ctrl+Shift+I)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'I') {
                e.preventDefault();
                ImageUI.show();
            }
        });

        // 监听页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                // DOM加载完成后再次应用替换
                setTimeout(() => ImageProcessor.applyReplacementsImmediately(), 100);
            });
        } else {
            setTimeout(() => ImageProcessor.applyReplacementsImmediately(), 100);
        }
    }

    // 立即启动
    initialize();
})();