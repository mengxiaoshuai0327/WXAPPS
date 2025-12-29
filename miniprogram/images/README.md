# 图标说明

此目录用于存放小程序 tabBar 图标。

需要的图标文件：
- `home.png` / `home-active.png` - 首页图标
- `schedule.png` / `schedule-active.png` - 课程表图标
- `ranking.png` / `ranking-active.png` - 排行榜图标
- `profile.png` / `profile-active.png` - 我的图标

**注意**：
- 图标尺寸建议：81px × 81px
- 未选中状态：使用灰色图标
- 选中状态：使用主题色图标
- 如果暂时没有图标，可以先使用占位图片或临时注释掉 tabBar 配置

## 临时解决方案

如果暂时没有图标，可以修改 `app.json`，将 tabBar 中的图标路径改为空字符串或注释掉 iconPath 和 selectedIconPath。

