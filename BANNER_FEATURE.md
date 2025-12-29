# Banner 管理功能说明

## 功能概述

Banner 图片可以由管理员在后台上传和管理，实时推送到小程序前台显示。

## 功能特点

1. **图片上传**：支持 jpg、png、gif 格式，最大 5MB
2. **多Banner支持**：可以上传多个Banner，支持轮播
3. **链接配置**：可以为Banner配置跳转链接（课程、外部链接）
4. **排序管理**：可以设置Banner的显示顺序
5. **启用/禁用**：可以控制Banner的显示状态
6. **实时更新**：上传后立即在小程序前台显示

## 使用流程

### 管理员操作

1. 登录管理后台
2. 进入"Banner管理"页面
3. 点击"上传Banner"按钮
4. 选择图片文件
5. 配置链接类型和链接值（可选）
6. 设置排序顺序
7. 点击确定，Banner立即生效

### 小程序前台

- 首页自动从API获取最新的Banner列表
- 支持多个Banner轮播显示
- 如果管理员上传了Banner，会自动显示
- 如果没有Banner，显示默认背景

## API接口

### 获取Banner列表（前台）
```
GET /api/banners/list
返回：只返回状态为 active 的Banner
```

### 获取所有Banner（管理后台）
```
GET /api/banners/admin/list
返回：所有Banner（包括未激活的）
```

### 上传Banner
```
POST /api/banners/upload
Content-Type: multipart/form-data
参数：
- image: 图片文件
- link_type: 链接类型（none/course/url）
- link_value: 链接值
- sort_order: 排序
```

### 更新Banner
```
PUT /api/banners/:id
参数：
- link_type: 链接类型
- link_value: 链接值
- sort_order: 排序
- status: 状态（active/inactive）
```

### 删除Banner
```
DELETE /api/banners/:id
```

## 文件存储

- 上传路径：`backend/uploads/banners/`
- 文件命名：`banner-{timestamp}-{random}.{ext}`
- 访问URL：`http://your-domain/uploads/banners/{filename}`

## 配置说明

在 `.env` 文件中配置：

```env
# 文件上传路径
UPLOAD_PATH=./uploads

# 基础URL（用于生成图片完整URL）
BASE_URL=http://localhost:3000
```

生产环境需要修改 `BASE_URL` 为实际域名。

## 注意事项

1. 确保 `uploads/banners/` 目录有写入权限
2. 生产环境需要配置正确的 `BASE_URL`
3. 建议定期清理未使用的Banner图片
4. 图片大小建议控制在 2MB 以内以保证加载速度

