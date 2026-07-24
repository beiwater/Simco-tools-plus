# ImageExtractor模块文档

## 模块概述

ImageExtractor模块是ICTS图片提取替换工具的核心组件之一，负责从网页中全面提取各种类型的图片资源。该模块能够从多种来源捕获图片URL，确保用户可以访问和操作页面上的所有视觉内容。

## 模块位置

在主脚本文件中的第79-164行定义。

## 模块结构

ImageExtractor模块采用对象字面量形式定义，包含一个主方法和多个辅助方法，分别用于提取不同来源的图片。

```javascript
const ImageExtractor = {
    extractAllImages: function() { /* ... */ },
    extractBackgroundImages: function(images) { /* ... */ },
    extractInlineBackgroundImages: function(images) { /* ... */ },
    extractSourceElements: function(images) { /* ... */ },
    extractCanvasImages: function(images) { /* ... */ }
};
```

## 核心功能与方法详解

### 1. extractAllImages()

**功能**：提取网页中所有类型的图片资源，是模块的主要入口方法。

**参数**：无

**返回值**：包含所有提取图片URL的数组

**实现流程**：
1. 创建一个空的Set集合用于存储图片URL（确保唯一性）
2. 依次调用各专用提取方法
3. 处理可能的异常情况
4. 将Set转换为数组并返回

```javascript
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

        // 2-5. 调用其他提取方法
        this.extractBackgroundImages(images);
        this.extractInlineBackgroundImages(images);
        this.extractSourceElements(images);
        this.extractCanvasImages(images);

    } catch (e) {
        console.error('提取图片时出错:', e);
    }

    return Array.from(images);
}
```

### 2. extractBackgroundImages(images)

**功能**：提取通过CSS设置的背景图片

**参数**：
- `images`: Set集合，用于存储提取到的图片URL

**实现流程**：
1. 选择页面上的所有元素
2. 获取每个元素的计算样式
3. 提取background-image属性中的URL
4. 验证URL有效性并规范化后添加到集合中

```javascript
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
}
```

### 3. extractInlineBackgroundImages(images)

**功能**：提取通过内联style属性设置的背景图片

**参数**：
- `images`: Set集合，用于存储提取到的图片URL

**实现流程**：
1. 选择所有包含内联background-image样式的元素
2. 直接从元素的style属性中提取URL
3. 验证URL有效性并规范化后添加到集合中

```javascript
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
}
```

### 4. extractSourceElements(images)

**功能**：提取picture/source元素中的图片资源

**参数**：
- `images`: Set集合，用于存储提取到的图片URL

**实现流程**：
1. 选择所有带有srcset或src属性的source元素
2. 分别处理srcset和src属性中的URL
3. 验证URL有效性并规范化后添加到集合中

```javascript
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
}
```

### 5. extractCanvasImages(images)

**功能**：提取canvas元素中的内容并转换为图片URL

**参数**：
- `images`: Set集合，用于存储提取到的图片URL

**实现流程**：
1. 选择页面上的所有canvas元素
2. 尝试将canvas内容转换为data URL
3. 将有效的data URL添加到集合中

```javascript
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
```

## 技术要点

### 1. 多来源提取策略

该模块采用多层次的提取策略，确保不会遗漏任何类型的图片资源：
- **标签级提取**：处理标准的img和source标签
- **样式级提取**：处理CSS和内联样式中的背景图片
- **内容级提取**：处理canvas等动态生成的图像内容

### 2. 重复处理防护

使用Set数据结构存储提取的图片URL，自动确保不会出现重复项，优化后续处理流程。

### 3. URL规范化处理

所有提取的URL都会经过规范化处理，确保不同形式的相同URL被识别为同一资源：
- 处理协议相对URL（如`//example.com/image.jpg`）
- 处理相对路径URL（如`/images/image.jpg`）
- 验证URL有效性

### 4. 错误处理机制

在每个提取环节都包含了异常捕获，确保单一元素处理失败不会影响整体提取流程。

## 依赖关系

该模块依赖以下外部函数和变量：

- **isValidImageUrl(url)**：用于验证URL是否为有效的图片URL
- **normalizeUrl(url)**：用于规范化各种形式的URL
- **全局异常处理**：通过try-catch机制处理可能的运行时错误

## 使用示例

在工具中，该模块主要通过以下方式被调用：

```javascript
const images = ImageExtractor.extractAllImages();
ImageUI.createUI(images);
```

这会提取当前页面的所有图片，并将结果传递给UI模块进行展示。

## 性能考量

- 使用Set数据结构进行去重，时间复杂度为O(1)
- 对每个提取环节都进行了错误捕获，保证鲁棒性
- 采用查询选择器精确定位目标元素，避免不必要的遍历
- 对于canvas元素的处理采用了尝试机制，避免因安全限制导致的整体失败

## 扩展建议

1. **懒加载图片支持**：添加对延迟加载图片的检测和提取
2. **动态内容监测**：增强对JavaScript动态生成图片的捕获能力
3. **图片分类功能**：根据图片类型、大小、用途等进行智能分类
4. **批量优化**：为大量图片的提取场景优化性能