# 快速获取图标 - 5分钟方案

## 最简单的方法（推荐）

### 使用 IconFont（阿里巴巴图标库）

1. **访问网站**: https://www.iconfont.cn/

2. **搜索图标**（每个搜索词找一个图标）:
   - `home` → 选择首页图标
   - `calendar` → 选择日历/课程表图标  
   - `trophy` → 选择奖杯/排行榜图标
   - `user` → 选择用户/我的图标

3. **下载步骤**:
   - 点击图标 → 添加到购物车
   - 右上角购物车 → 下载
   - 选择 **PNG** 格式
   - 尺寸选择 **81px**
   - 颜色：未选中用灰色，选中用深色

4. **重命名文件**:
   ```
   home.png / home-active.png
   schedule.png / schedule-active.png
   ranking.png / ranking-active.png
   profile.png / profile-active.png
   ```

5. **放入项目**:
   将所有图标文件放入 `miniprogram/images/` 目录

6. **更新配置**:
   在 `app.json` 中恢复图标路径（我已经移除了，需要加回来）

## 备用方案：使用在线工具

### 方案 A: Canva（https://www.canva.com/）
- 搜索 "小程序图标" 模板
- 自定义颜色和图标
- 导出 PNG

### 方案 B: 稿定设计（https://www.gaoding.com/）
- 搜索 "小程序底部导航图标"
- 在线编辑
- 一键下载

## 如果暂时没有图标

可以先用文字模式（当前配置），等有图标后再添加。

或者我可以帮你创建简单的占位图标（使用代码生成）。

