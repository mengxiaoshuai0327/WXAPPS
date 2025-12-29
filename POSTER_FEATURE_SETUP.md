# 海报功能设置说明

## 功能概述
已实现邀请海报功能，支持：
1. 管理员在后台上传海报模板并编辑文字
2. 管理员可以预览海报效果
3. 用户保存/分享二维码时，自动使用激活的海报模板生成最终海报

## 安装步骤

### 1. 安装后端依赖
后端需要使用 `sharp` 库来处理图片合成。请在 `backend` 目录下运行：

```bash
cd backend
npm install sharp
```

### 2. 执行数据库迁移
运行以下SQL脚本来添加文字相关字段：

```bash
mysql -u your_username -p your_database < backend/database/migrations/add_text_fields_to_posters.sql
```

或者手动执行SQL：
```sql
ALTER TABLE `posters`
ADD COLUMN `text_content` TEXT NULL COMMENT '海报文字内容' AFTER `qr_code_size`,
ADD COLUMN `text_position_x` INT DEFAULT 0 COMMENT '文字X坐标位置（像素）' AFTER `text_content`,
ADD COLUMN `text_position_y` INT DEFAULT 0 COMMENT '文字Y坐标位置（像素）' AFTER `text_position_x`,
ADD COLUMN `text_font_size` INT DEFAULT 32 COMMENT '文字大小（像素）' AFTER `text_position_y`,
ADD COLUMN `text_color` VARCHAR(20) DEFAULT '#000000' COMMENT '文字颜色（十六进制）' AFTER `text_font_size`,
ADD COLUMN `text_align` VARCHAR(20) DEFAULT 'left' COMMENT '文字对齐方式：left, center, right' AFTER `text_color`;
```

### 3. 创建生成海报存储目录
确保以下目录存在（如果不存在，系统会自动创建）：
- `backend/uploads/posters/generated/` - 存储生成的海报图片

## 功能使用

### 管理员端
1. **上传海报模板**：
   - 进入"邀请海报管理"页面
   - 点击"上传海报模板"
   - 上传图片，设置二维码位置、大小
   - 设置文字内容、位置、大小、颜色、对齐方式
   - 点击"确定上传"

2. **编辑海报模板**：
   - 在海报列表中点击"编辑"
   - 修改二维码位置、文字设置等
   - 点击"预览效果"可以查看海报效果
   - 点击"确定保存"

3. **预览海报**：
   - 在编辑对话框中点击"预览效果"
   - 或在海报列表中点击"预览"按钮
   - 预览会显示二维码位置（虚线框）和文字效果

### 小程序端
1. **保存海报**：
   - 用户在个人中心"邀请专区"
   - 点击"保存二维码"
   - 系统自动使用激活的海报模板生成海报并保存到相册

2. **分享海报**：
   - 点击"分享二维码"按钮
   - 系统自动生成海报并作为分享图片

## API接口

### 获取激活的海报模板
```
GET /api/posters/list
```

### 生成最终海报（小程序使用）
```
POST /api/posters/generate
Body: {
  poster_id: 1,
  qr_code_url: "https://...",
  invite_code: "xxx"
}
Response: {
  success: true,
  data: {
    image_url: "https://..."
  }
}
```

## 注意事项

1. **海报模板要求**：
   - 建议尺寸：750x1334像素（小程序常用尺寸）
   - 确保二维码位置有足够空间（建议至少300x300像素）
   - 支持格式：jpg, png, gif

2. **文字设置**：
   - 文字位置使用像素坐标（左上角为原点）
   - 建议字体大小：24-72像素
   - 颜色支持十六进制格式（如 #000000）

3. **性能优化**：
   - 生成的海报会保存到 `uploads/posters/generated/` 目录
   - 建议定期清理旧的海报文件
   - 可以添加定时任务自动清理7天前的生成海报

## 故障排查

1. **sharp库安装失败**：
   - 确保已安装node-gyp和相关编译工具
   - Mac: `xcode-select --install`
   - Linux: 安装 `build-essential`
   - Windows: 安装 Visual Studio Build Tools

2. **海报生成失败**：
   - 检查海报模板图片是否存在
   - 检查二维码URL是否可访问
   - 查看后端日志中的错误信息

3. **预览功能不显示**：
   - 检查浏览器是否支持Canvas API
   - 检查海报图片URL是否可访问

