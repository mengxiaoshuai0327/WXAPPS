# MySQL 安装和启动指南

## 检查 MySQL 状态

### 方法 1: 检查进程
```bash
ps aux | grep -i mysql | grep -v grep
```
如果有输出，说明 MySQL 正在运行。

### 方法 2: 检查端口
```bash
lsof -i :3306
```
如果端口 3306 被占用，说明 MySQL 可能正在运行。

### 方法 3: 尝试连接
```bash
mysql -u root -p
```
如果能连接，说明 MySQL 已启动。

## macOS 安装 MySQL

### 方式一：使用 Homebrew（推荐）

#### 1. 安装 MySQL
```bash
brew install mysql
```

#### 2. 启动 MySQL 服务
```bash
brew services start mysql
```

#### 3. 设置 root 密码（首次安装）
```bash
mysql_secure_installation
```
按照提示设置 root 密码。

#### 4. 验证安装
```bash
mysql -u root -p
```
输入密码，如果成功进入 MySQL 命令行，说明安装成功。

### 方式二：使用 MySQL 官方安装包

1. 访问 [MySQL 官网](https://dev.mysql.com/downloads/mysql/)
2. 下载 macOS 安装包（.dmg 文件）
3. 运行安装程序
4. 安装完成后，在"系统偏好设置"中找到 MySQL，点击"Start MySQL Server"

### 方式三：使用 Docker（适合开发环境）

#### 1. 安装 Docker Desktop
从 [Docker 官网](https://www.docker.com/products/docker-desktop) 下载安装

#### 2. 运行 MySQL 容器
```bash
docker run --name mysql-xiaocx \
  -e MYSQL_ROOT_PASSWORD=your_password \
  -e MYSQL_DATABASE=xiaocx_db \
  -p 3306:3306 \
  -d mysql:8.0
```

#### 3. 验证运行
```bash
docker ps | grep mysql
```

## 启动 MySQL 服务

### 使用 Homebrew
```bash
# 启动
brew services start mysql

# 停止
brew services stop mysql

# 重启
brew services restart mysql

# 查看状态
brew services list | grep mysql
```

### 使用系统服务（如果通过官方安装包安装）
```bash
# 启动
sudo /usr/local/mysql/support-files/mysql.server start

# 停止
sudo /usr/local/mysql/support-files/mysql.server stop

# 重启
sudo /usr/local/mysql/support-files/mysql.server restart

# 查看状态
sudo /usr/local/mysql/support-files/mysql.server status
```

### 使用 Docker
```bash
# 启动
docker start mysql-xiaocx

# 停止
docker stop mysql-xiaocx

# 查看状态
docker ps -a | grep mysql
```

## 配置 MySQL

### 1. 创建数据库用户（可选）
```sql
CREATE USER 'xiaocx_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON xiaocx_db.* TO 'xiaocx_user'@'localhost';
FLUSH PRIVILEGES;
```

### 2. 创建数据库
```sql
CREATE DATABASE xiaocx_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 测试连接

### 使用命令行
```bash
mysql -u root -p
# 或使用项目脚本
cd backend
npm run test-db
```

### 使用 Node.js 脚本
```bash
cd backend
npm run test-db
```

## 常见问题

### 问题 1: "command not found: mysql"
**原因**: MySQL 未安装或未添加到 PATH

**解决**:
```bash
# 如果使用 Homebrew 安装
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 或使用完整路径
/opt/homebrew/bin/mysql -u root -p
```

### 问题 2: "Can't connect to MySQL server"
**原因**: MySQL 服务未启动

**解决**:
```bash
# 使用 Homebrew
brew services start mysql

# 或使用系统服务
sudo /usr/local/mysql/support-files/mysql.server start
```

### 问题 3: "Access denied for user"
**原因**: 密码错误或用户权限不足

**解决**:
- 确认密码正确
- 检查用户是否有足够权限
- 重置 root 密码（如果忘记）

### 问题 4: 端口 3306 被占用
**原因**: 其他程序占用了端口

**解决**:
```bash
# 查看占用端口的进程
lsof -i :3306

# 停止占用端口的进程，或修改 MySQL 端口
```

## 快速检查脚本

运行以下命令快速检查 MySQL 状态：

```bash
# 检查是否安装
which mysql && echo "✓ MySQL 已安装" || echo "✗ MySQL 未安装"

# 检查是否运行
ps aux | grep -i mysql | grep -v grep && echo "✓ MySQL 正在运行" || echo "✗ MySQL 未运行"

# 检查端口
lsof -i :3306 && echo "✓ 端口 3306 已占用（MySQL 可能正在运行）" || echo "✗ 端口 3306 未被占用"
```

## 推荐配置

对于开发环境，推荐使用 **Homebrew** 安装 MySQL，因为：
- 安装简单
- 管理方便（`brew services`）
- 更新容易
- 卸载干净

安装命令：
```bash
brew install mysql
brew services start mysql
mysql_secure_installation
```

