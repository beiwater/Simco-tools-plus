# ImageProcessor模块文档

## 模块概述

ImageProcessor模块是ICTS图片提取替换工具的核心组件，负责处理图片替换的核心逻辑。该模块实现了替换规则的应用、DOM变化的监听、图片元素的处理以及原始图片的恢复等关键功能，是整个工具的中枢系统。

## 模块位置

在主脚本文件中的第165-428行定义。

## 模块结构

ImageProcessor模块采用对象字面量形式定义，包含属性和多个方法，实现了完整的图片处理生命周期。

```javascript
const ImageProcessor = {
    rules: [],
    isApplying: false,
    
    init: function() { /* ... */ },
    setupObserver: function() { /* ... */ },
    applyReplacementsImmediately: function() { /* ... */ },
    applyReplacements: function() { /* ... */ },
    processAllImages: function() { /* ... */ },
    processImageElements: function() { /* ... */ },
    processBackgroundImages: function() { /* ... */ },
    processSourceElements: function() { /* ... */ },
    addRule: function(originalUrl, replacedUrl) { /* ... */ },
    removeRule: function(originalUrl) { /* ... */ },
    restoreOriginalImages: function(originalUrl) { /* ... */ }
};
```

## 属性说明

- **rules**: 存储当前页面的图片替换规则数组
- **isApplying**: 标记是否正在应用替换规则，用于防止重复处理

## 核心功能与方法详解

### 1. init()

**功能**：初始化图片处理器，加载规则并设置DOM观察者

**参数**：无

**返回值**：无

**实现流程**：
1. 从存储中加载替换规则
2. 设置DOM变化观察者
3. 立即应用已加载的替换规则

```javascript
init: function() {
    this.rules = StorageManager.getRules();
    this.setupObserver();
    this.applyReplacementsImmediately();
}
```

### 2. setupObserver()

**功能**：设置DOM变化观察者，监听页面内容变化以自动应用替换规则

**参数**：无

**返回值**：无

**实现流程**：
1. 如果已有观察者实例，先断开连接
2. 创建新的MutationObserver实例
3. 配置观察选项，监听子节点变化和特定属性变化
4. 开始观察整个文档树

```javascript
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
}
```

### 3. applyReplacementsImmediately()

**功能**：立即应用替换规则，不使用requestAnimationFrame优化

**参数**：无

**返回值**：无

**实现流程**：
1. 检查是否正在应用或没有规则需要应用
2. 设置isApplying标记为true
3. 立即处理所有图片
4. 设置一个延时再次处理，确保动态加载的图片也被处理
5. 处理完成后设置isApplying标记为false

```javascript
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
}
```

### 4. applyReplacements()

**功能**：应用替换规则，使用requestAnimationFrame优化性能

**参数**：无

**返回值**：无

**实现流程**：
1. 检查是否正在应用或没有规则需要应用
2. 设置isApplying标记为true
3. 使用requestAnimationFrame调度图片处理任务
4. 处理完成后设置isApplying标记为false

```javascript
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
}
```

### 5. processAllImages()

**功能**：处理页面上所有类型的图片

**参数**：无

**返回值**：无

**实现流程**：依次调用各种类型图片的专用处理方法

```javascript
processAllImages: function() {
    this.processImageElements();
    this.processBackgroundImages();
    this.processSourceElements();
}
```

### 6. processImageElements()

**功能**：处理页面上的所有img元素

**参数**：无

**返回值**：无

**实现流程**：
1. 选择所有未处理的img元素
2. 检查每个元素是否已在处理集合中
3. 获取原始图片URL并规范化
4. 查找匹配的替换规则
5. 应用替换并标记为已处理

```javascript
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
}
```

### 7. processBackgroundImages()

**功能**：处理页面上所有元素的背景图片

**参数**：无

**返回值**：无

**实现流程**：
1. 选择页面上的所有元素
2. 检查每个元素是否已在处理集合中
3. 获取计算样式中的background-image属性
4. 提取URL并查找匹配的替换规则
5. 应用替换并标记为已处理

```javascript
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
}
```

### 8. processSourceElements()

**功能**：处理页面上的source元素

**参数**：无

**返回值**：无

**实现流程**：
1. 选择所有带有src或srcset属性的source元素
2. 检查每个元素是否已在处理集合中
3. 分别处理src和srcset属性
4. 查找匹配的替换规则并应用
5. 标记为已处理

```javascript
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
}
```

### 9. addRule(originalUrl, replacedUrl)

**功能**：添加或更新图片替换规则

**参数**：
- `originalUrl`: 原始图片URL
- `replacedUrl`: 替换后的图片URL

**返回值**：无

**实现流程**：
1. 规范化原始URL
2. 移除已存在的相同URL的规则
3. 添加新规则并记录时间戳
4. 保存规则到存储
5. 立即应用更新后的规则

```javascript
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
}
```

### 10. removeRule(originalUrl)

**功能**：移除指定的图片替换规则

**参数**：
- `originalUrl`: 要移除规则的原始图片URL

**返回值**：无

**实现流程**：
1. 规范化原始URL
2. 从规则数组中过滤掉匹配的规则
3. 保存更新后的规则到存储
4. 调用方法恢复受影响的原始图片

```javascript
removeRule: function(originalUrl) {
    const normalizedUrl = normalizeUrl(originalUrl);
    this.rules = this.rules.filter(rule => rule.originalUrl !== normalizedUrl);
    StorageManager.saveRules(this.rules);

    // 恢复原始图片
    this.restoreOriginalImages(normalizedUrl);
}
```

### 11. restoreOriginalImages(originalUrl)

**功能**：恢复被替换的原始图片

**参数**：
- `originalUrl`: 要恢复的原始图片URL

**返回值**：无

**实现流程**：
1. 恢复所有匹配的img元素到原始状态
2. 清除背景图片的替换效果
3. 重新加载页面以确保完全恢复

```javascript
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
```

## 技术要点

### 1. 动态DOM监听机制

使用MutationObserver实时监听DOM变化，确保新添加的图片元素也能被及时处理。通过过滤只处理相关变化，提高了性能效率。

### 2. 性能优化策略

- **批处理机制**：使用requestAnimationFrame和setTimeout进行任务调度，避免频繁操作DOM
- **状态标记**：使用isApplying标记防止重复处理
- **WeakSet存储**：使用WeakSet存储已处理元素，避免内存泄漏
- **防抖处理**：对DOM变化采用50ms的防抖延迟，减少处理频率

### 3. 替换规则管理

实现了完整的规则CRUD操作，包括规则的加载、添加、更新和删除，并与StorageManager模块紧密集成，实现规则的持久化存储。

### 4. 多类型图片处理

支持处理多种类型的图片元素，包括标准img标签、CSS背景图片、内联样式背景图片和source元素，确保全面覆盖网页中的各种图片形式。

### 5. 错误处理机制

在关键操作环节都实现了异常捕获，确保单一元素处理失败不会影响整体功能。

## 依赖关系

该模块依赖以下外部组件和函数：

- **StorageManager**：用于规则的存储和读取
- **isValidImageUrl(url)**：用于验证URL有效性
- **normalizeUrl(url)**：用于URL规范化处理
- **processedElements**：全局WeakSet对象，用于跟踪已处理元素
- **observer**：全局MutationObserver对象，用于监听DOM变化

## 使用示例

该模块在工具中的主要使用方式包括：

1. **初始化**：在脚本启动时调用
   ```javascript
   ImageProcessor.init();
   ```

2. **添加替换规则**：当用户选择替换图片时调用
   ```javascript
   ImageProcessor.addRule(originalUrl, replacedDataUrl);
   ```

3. **移除替换规则**：当用户选择还原图片时调用
   ```javascript
   ImageProcessor.removeRule(originalUrl);
   ```

## 性能考量

- 使用WeakSet存储已处理元素，避免内存泄漏
- 采用任务调度机制，优化DOM操作时机
- 实现防抖处理，减少不必要的重复处理
- 在处理背景图片时使用try-catch，避免因单个元素错误影响整体处理

## 扩展建议

1. **规则优先级系统**：添加规则优先级机制，处理多个规则匹配同一图片的情况
2. **条件替换功能**：支持基于URL模式、域名或其他条件的批量替换
3. **性能监控**：添加处理性能监控和优化建议功能
4. **异步处理**：对大型页面实现分段异步处理，避免页面卡顿
5. **智能缓存**：实现图片资源的智能缓存机制，提高重复访问时的替换速度