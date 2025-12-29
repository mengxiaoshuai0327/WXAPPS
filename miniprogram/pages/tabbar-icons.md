# TabBar 图标说明

根据设计，TabBar 需要以下图标：

## 图标要求

### 首页（Home）
- **选中状态**：蓝色实心房子图标
- **未选中状态**：灰色轮廓房子图标

### 课程表（Schedule）
- **选中状态**：蓝色实心日历图标（带勾选标记）
- **未选中状态**：灰色轮廓日历图标

### 排行榜（Ranking）
- **选中状态**：蓝色实心奖杯图标
- **未选中状态**：灰色轮廓奖杯图标

### 我的（Profile）
- **选中状态**：蓝色实心人物图标
- **未选中状态**：灰色轮廓人物图标

## 颜色规范
- **选中颜色**：#1a1a1a（深色/黑色）或蓝色主题色
- **未选中颜色**：#999999（灰色）

## 图标尺寸
- 推荐：81px × 81px
- 格式：PNG（支持透明背景）

## 获取图标的方法

### 方法1：使用 IconFont
1. 访问 https://www.iconfont.cn/
2. 搜索以下关键词：
   - `home` 或 `首页` - 房子图标
   - `calendar` 或 `日历` - 日历图标
   - `trophy` 或 `奖杯` - 奖杯图标
   - `user` 或 `用户` - 人物图标
3. 选择实心和轮廓两种样式
4. 下载 PNG 格式，81px 尺寸
5. 调整颜色后保存

### 方法2：使用图标库
- Remix Icon: https://remixicon.com/
- Heroicons: https://heroicons.com/
- Material Icons: https://fonts.google.com/icons

## 文件命名
将图标文件放入 `miniprogram/images/` 目录：

```
images/
├── home.png              # 首页未选中（灰色轮廓）
├── home-active.png       # 首页选中（蓝色实心）
├── schedule.png          # 课程表未选中（灰色轮廓）
├── schedule-active.png   # 课程表选中（蓝色实心）
├── ranking.png           # 排行榜未选中（灰色轮廓）
├── ranking-active.png    # 排行榜选中（蓝色实心）
├── profile.png           # 我的未选中（灰色轮廓）
└── profile-active.png    # 我的选中（蓝色实心）
```

