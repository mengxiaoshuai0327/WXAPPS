# MySQL 安装状态

## 当前状态

- ❌ MySQL 未安装完成
- ❌ MySQL 服务未运行
- ❌ 端口 3306 未被占用
- ✅ 数据库配置已填写（.env 文件中）

## 需要完成的操作

### 步骤 1: 完成 MySQL 安装

如果 MySQL 正在安装中，请等待安装完成。如果安装被取消，请重新安装：

```bash
brew install mysql
```

安装过程可能需要几分钟时间。

### 步骤 2: 启动 MySQL 服务

安装完成后，启动 MySQL 服务：

```bash
brew services start mysql
```

### 步骤 3: 验证 MySQL 运行

```bash
# 检查服务状态
brew services list | grep mysql

# 应该看到类似输出：
# mysql  started  mxs  ~/Library/LaunchAgents/homebrew.mxcl.mysql.plist
```

### 步骤 4: 测试数据库连接

```bash
cd backend
npm run test-db
```

如果连接成功，你会看到：
```
✓ 数据库连接成功！
✓ MySQL 版本: x.x.x
```

### 步骤 5: 初始化数据库

连接成功后，初始化数据库：

```bash
npm run init-db
```

这将创建数据库和所有必要的表。

## 快速检查命令

运行以下命令快速检查状态：

```bash
# 检查 MySQL 是否安装
brew list mysql

# 检查 MySQL 服务状态
brew services list | grep mysql

# 检查端口
lsof -i :3306

# 测试连接
cd backend && npm run test-db
```

## 如果遇到问题

### 问题：安装很慢
- MySQL 安装包较大（约 200MB），请耐心等待
- 确保网络连接正常

### 问题：启动失败
```bash
# 查看错误日志
tail -f /opt/homebrew/var/mysql/*.err

# 或尝试手动启动
/opt/homebrew/bin/mysqld_safe --datadir=/opt/homebrew/var/mysql &
```

### 问题：连接失败
- 确认密码正确（当前配置的密码：6255999mxs）
- 确认 MySQL 服务已启动
- 检查防火墙设置

## 安装完成后

一旦 MySQL 安装并启动成功，运行：

```bash
cd backend
npm run test-db    # 测试连接
npm run init-db    # 初始化数据库
npm start          # 启动后端服务
```

