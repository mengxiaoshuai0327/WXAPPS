# 环境变量配置说明

## .env 文件配置

请编辑 `backend/.env` 文件，填写以下配置信息：

### 数据库配置
```env
DB_HOST=localhost          # 数据库主机地址
DB_PORT=3306              # 数据库端口
DB_USER=root              # 数据库用户名
DB_PASSWORD=your_password # 数据库密码（请修改）
DB_NAME=xiaocx_db         # 数据库名称
```

### 微信小程序配置
```env
WX_APPID=your_wechat_appid    # 微信小程序AppID（请修改）
WX_SECRET=your_wechat_secret  # 微信小程序Secret（请修改）
```

### 其他配置
```env
PORT=3000                    # 服务器端口
NODE_ENV=development         # 运行环境
JWT_SECRET=your_secret_key  # JWT密钥（请修改为随机字符串）
UPLOAD_PATH=./uploads       # 文件上传路径
```

## 配置步骤

1. 确保 MySQL 数据库已安装并运行
2. 创建数据库：
   ```sql
   CREATE DATABASE xiaocx_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. 修改 `.env` 文件中的数据库连接信息
4. 在微信公众平台获取小程序 AppID 和 Secret，填入 `.env` 文件
5. 生成一个随机的 JWT_SECRET（可以使用 `openssl rand -base64 32` 生成）

## 注意事项

- `.env` 文件包含敏感信息，不要提交到版本控制系统
- 生产环境请使用强密码和安全的密钥
- 确保数据库用户有足够的权限创建表和插入数据

