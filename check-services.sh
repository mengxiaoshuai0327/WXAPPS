#!/bin/bash

# 检查服务状态

echo "=========================================="
echo "服务状态检查"
echo "=========================================="
echo ""

# 检查后端
echo "后端服务器（端口3000）："
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    BACKEND_PID=$(lsof -ti:3000 | head -1)
    echo "  ✅ 运行中（进程ID: $BACKEND_PID）"
    echo "  ✅ 健康检查: 通过"
else
    echo "  ❌ 未运行或无法访问"
    if lsof -ti:3000 > /dev/null 2>&1; then
        echo "  ⚠️  端口被占用但无法响应，可能需要重启"
    fi
fi

echo ""

# 检查前端
echo "管理员前端（端口8080）："
if curl -s http://localhost:8080 > /dev/null 2>&1; then
    FRONTEND_PID=$(lsof -ti:8080 | head -1)
    echo "  ✅ 运行中（进程ID: $FRONTEND_PID）"
else
    if lsof -ti:8080 > /dev/null 2>&1; then
        echo "  ⏳ 编译中或启动中..."
    else
        echo "  ❌ 未运行"
    fi
fi

echo ""
echo "=========================================="

