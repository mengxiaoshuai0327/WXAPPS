#!/bin/bash

# 停止所有服务

echo "正在停止所有服务..."

# 停止后端
echo "停止后端服务器..."
pkill -f "node.*app.js" 2>/dev/null && echo "✅ 后端服务器已停止" || echo "⚠️  后端服务器未运行"

# 停止前端
echo "停止管理员前端..."
pkill -f "vue-cli-service serve" 2>/dev/null && echo "✅ 管理员前端已停止" || echo "⚠️  管理员前端未运行"
pkill -f "npm run serve" 2>/dev/null

sleep 1

# 确认端口释放
if ! lsof -ti:3000 > /dev/null 2>&1 && ! lsof -ti:8080 > /dev/null 2>&1; then
    echo ""
    echo "✅ 所有服务已停止"
else
    echo ""
    echo "⚠️  部分端口可能仍被占用："
    lsof -ti:3000 > /dev/null 2>&1 && echo "  - 端口3000仍被占用"
    lsof -ti:8080 > /dev/null 2>&1 && echo "  - 端口8080仍被占用"
fi

