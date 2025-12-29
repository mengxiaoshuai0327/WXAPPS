#!/bin/bash
echo "=== MySQL 状态检查 ==="
echo ""

# 检查是否安装
if command -v mysql &> /dev/null; then
    echo "✓ MySQL 已安装"
    mysql --version
else
    echo "✗ MySQL 未安装或未在 PATH 中"
    echo "  安装方法：brew install mysql"
fi
echo ""

# 检查进程
if ps aux | grep -i mysql | grep -v grep > /dev/null; then
    echo "✓ MySQL 进程正在运行"
else
    echo "✗ MySQL 进程未运行"
    echo "  启动方法：brew services start mysql"
fi
echo ""

# 检查端口
if lsof -i :3306 > /dev/null 2>&1; then
    echo "✓ 端口 3306 已被占用（MySQL 可能正在运行）"
    lsof -i :3306 | head -2
else
    echo "✗ 端口 3306 未被占用"
fi
echo ""

# 尝试连接
echo "尝试连接 MySQL..."
if mysql -u root -e "SELECT 1" 2>/dev/null; then
    echo "✓ MySQL 连接成功（无需密码）"
elif mysql -u root -p -e "SELECT 1" 2>/dev/null <<< ""; then
    echo "⚠ MySQL 需要密码，请手动测试：mysql -u root -p"
else
    echo "✗ MySQL 连接失败"
    echo "  请检查："
    echo "  1. MySQL 服务是否启动"
    echo "  2. 用户名和密码是否正确"
fi
