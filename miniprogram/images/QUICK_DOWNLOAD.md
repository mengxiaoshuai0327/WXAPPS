# 快速下载 TabBar 图标

## 最简单的方法（推荐）

### 使用 IconFont 批量下载

1. **打开 IconFont**：https://www.iconfont.cn/
2. **搜索以下关键词，每个找2个图标（轮廓+实心）**：
   - `home` → 选择轮廓和实心版本
   - `calendar` → 选择轮廓和实心版本  
   - `trophy` → 选择轮廓和实心版本
   - `user` → 选择轮廓和实心版本
3. **添加到购物车** → **批量下载** → **PNG格式，81px**
4. **调整颜色**（使用在线工具或PS）
5. **重命名并放入** `miniprogram/images/` 目录

## 使用脚本下载（SVG格式）

我已经创建了下载脚本，可以下载 SVG 格式的图标：

```bash
cd miniprogram/images
node download-icons.js
```

下载后需要将 SVG 转换为 PNG（81px × 81px）。

## 使用在线工具转换

1. 访问：https://cloudconvert.com/svg-to-png
2. 上传 SVG 文件
3. 设置尺寸：81px × 81px
4. 下载 PNG 文件

## 图标生成器

我还创建了一个 HTML 图标生成器（`create-placeholder-icons.html`），可以在浏览器中打开，生成简单的占位图标。

## 重要提示

由于版权和资源限制，我无法直接为您下载并保存图标文件。请按照上述方法手动获取图标，或使用我提供的脚本和工具。

