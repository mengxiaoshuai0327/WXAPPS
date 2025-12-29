# 自动下载图标指南

## 重要说明

由于版权保护和资源限制，**无法自动从互联网下载图标文件**。但您可以按照以下步骤快速获取图标：

## 最快方法（5分钟）

### 步骤1：访问 IconFont
打开：https://www.iconfont.cn/

### 步骤2：搜索并下载图标

#### 首页图标
1. 搜索：`home` 或 `首页`
2. 选择：实心房子图标 → 下载 → PNG，81px → 保存为 `home-active.png`
3. 选择：轮廓房子图标 → 下载 → PNG，81px → 保存为 `home.png`
4. 使用在线工具调整颜色：
   - `home.png` → 改为 #999999
   - `home-active.png` → 改为 #1a1a1a

#### 课程表图标
1. 搜索：`calendar` 或 `schedule`
2. 选择：带勾选的日历图标
3. 下载轮廓和实心两种样式
4. 保存为 `schedule.png` 和 `schedule-active.png`
5. 调整颜色

#### 排行榜图标
1. 搜索：`trophy` 或 `奖杯`
2. 下载轮廓和实心样式
3. 保存为 `ranking.png` 和 `ranking-active.png`
4. 调整颜色

#### 我的图标
1. 搜索：`user` 或 `用户`
2. 下载轮廓和实心样式
3. 保存为 `profile.png` 和 `profile-active.png`
4. 调整颜色

### 步骤3：调整颜色

使用在线工具（如 https://www.iloveimg.com/resize-image）：
- 打开图片
- 调整颜色/滤镜
- 保存

### 步骤4：放入项目

将所有图标文件放入：
```
miniprogram/images/
├── home.png
├── home-active.png
├── schedule.png
├── schedule-active.png
├── ranking.png
├── ranking-active.png
├── profile.png
└── profile-active.png
```

## 替代方案

如果暂时没有图标，TabBar 会只显示文字，功能正常。等图标准备好后会自动显示。
