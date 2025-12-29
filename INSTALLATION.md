# 安装和部署指南

## 环境要求
- Node.js >= 14.0.0
- MySQL >= 5.7
- 微信开发者工具（小程序开发）

## MySQL 安装和启动

**重要**: 在开始之前，请确保 MySQL 已安装并运行。

### 快速检查 MySQL 状态
```bash
cd backend
./check-mysql.sh
```

### 安装 MySQL（如果未安装）

**macOS 推荐方式（使用 Homebrew）**:
```bash
# 安装 MySQL
brew install mysql

# 启动 MySQL 服务
brew services start mysql

# 设置 root 密码（首次安装）
mysql_secure_installation
```

### 验证 MySQL 运行
```bash
# 方式 1: 检查进程
ps aux | grep mysql | grep -v grep

# 方式 2: 检查端口
lsof -i :3306

# 方式 3: 尝试连接
mysql -u root -p
```

**详细说明**: 请参考 `MYSQL_SETUP.md` 文件获取完整的 MySQL 安装和配置指南。

## 后端部署

### 1. 安装依赖
```bash
cd backend
npm install
```

### 2. 配置环境变量
复制 `.env.example` 为 `.env`，并填写相关配置：
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置数据库和微信小程序信息。

### 3. 初始化数据库

**方式一：使用 Node.js 脚本（推荐）**
```bash
# 先测试数据库连接
npm run test-db

# 如果连接成功，初始化数据库
npm run init-db
```

**方式二：使用 MySQL 命令行**
```bash
mysql -u root -p < database/schema.sql
```

**注意**：执行前请确保：
- MySQL 服务已启动
- `.env` 文件中的数据库配置已正确填写
- 数据库用户有创建数据库和表的权限

### 4. 启动服务
```bash
npm start
# 或开发模式
npm run dev
```

服务将在 http://localhost:3000 启动

## 小程序部署

### 1. 配置API地址
编辑 `miniprogram/app.js`，修改 `apiBaseUrl` 为实际后端地址。

### 2. 配置小程序AppID
编辑 `miniprogram/project.config.json`，填写你的小程序AppID。

### 3. 使用微信开发者工具
1. 打开微信开发者工具
2. 导入项目，选择 `miniprogram` 目录
3. 配置AppID
4. 编译运行

## 管理后台部署

### 1. 安装依赖
```bash
cd admin
npm install
```

### 2. 配置环境变量
创建 `.env` 文件：
```
VUE_APP_API_BASE_URL=http://localhost:3000/api
```

### 3. 启动开发服务器
```bash
npm run serve
```

访问 http://localhost:8080

### 4. 构建生产版本
```bash
npm run build
```

## 定时任务配置

后端需要配置定时任务来处理：
- 自动使用课券（课程开始后）
- 处理过期课券退款
- 发送过期提醒

可以使用 `node-cron` 或 `pm2` 来管理定时任务。

## 注意事项

1. 确保数据库连接正常
2. 配置微信小程序的AppID和Secret
3. 配置文件上传路径（backend/uploads）
4. 生产环境需要配置HTTPS
5. 定期备份数据库

