#!/bin/bash
# MySQL 快速安装和启动脚本（macOS）

echo "=== MySQL 快速安装和启动 ==="
echo ""

# 检查 Homebrew
if ! command -v brew &> /dev/null; then
    echo "✗ Homebrew 未安装"
    echo "请先安装 Homebrew:"
    echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    exit 1
fi

echo "✓ Homebrew 已安装"
echo ""

# 检查 MySQL 是否已安装
if brew list mysql &> /dev/null; then
    echo "✓ MySQL 已通过 Homebrew 安装"
else
    echo "⚠ MySQL 未通过 Homebrew 安装"
    read -p "是否现在安装 MySQL? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "正在安装 MySQL..."
        brew install mysql
        echo "✓ MySQL 安装完成"
    else
        echo "跳过安装，请手动安装 MySQL"
        exit 1
    fi
fi

echo ""

# 检查 MySQL 服务状态
if brew services list | grep mysql | grep -q started; then
    echo "✓ MySQL 服务正在运行"
else
    echo "⚠ MySQL 服务未运行"
    read -p "是否现在启动 MySQL? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "正在启动 MySQL..."
        brew services start mysql
        sleep 2
        if brew services list | grep mysql | grep -q started; then
            echo "✓ MySQL 服务启动成功"
        else
            echo "✗ MySQL 服务启动失败，请检查错误信息"
            exit 1
        fi
    else
        echo "跳过启动，请手动启动: brew services start mysql"
        exit 1
    fi
fi

echo ""

# 测试连接
echo "测试 MySQL 连接..."
if mysql -u root -e "SELECT 1" 2>/dev/null; then
    echo "✓ MySQL 连接成功（无需密码）"
    echo ""
    echo "⚠ 建议设置 root 密码以提高安全性："
    echo "  mysql_secure_installation"
elif mysql -u root -p -e "SELECT 1" 2>/dev/null <<< ""; then
    echo "✓ MySQL 连接成功（需要密码）"
else
    echo "⚠ MySQL 连接失败"
    echo "请手动测试: mysql -u root -p"
fi

echo ""
echo "=== 下一步 ==="
echo "1. 如果还未设置 root 密码，运行: mysql_secure_installation"
echo "2. 编辑 backend/.env 文件，配置数据库密码"
echo "3. 运行: cd backend && npm run test-db"
echo "4. 如果连接成功，运行: npm run init-db"

