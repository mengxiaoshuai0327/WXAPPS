#!/bin/bash

# 统一的服务启动脚本
# 启动后端服务器和管理员前端

cd "$(dirname "$0")"

echo "=========================================="
echo "正在启动所有服务..."
echo "=========================================="
echo ""

# 检查后端是否已运行
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "⚠️  端口3000已被占用，正在停止旧的后端进程..."
    pkill -f "node.*app.js" 2>/dev/null || true
    sleep 2
fi

# 启动后端服务器
echo "🚀 启动后端服务器（端口3000）..."
cd backend
PORT=3000 HOST=0.0.0.0 nohup node app.js >> logs/server.log 2>> logs/error.log &
BACKEND_PID=$!
cd ..

# 等待后端启动
echo "等待后端服务器启动..."
sleep 3

# 检查后端是否启动成功
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ 后端服务器启动成功（进程ID: $BACKEND_PID）"
else
    echo "❌ 后端服务器启动失败，请查看日志: backend/logs/error.log"
    exit 1
fi

# 检查前端是否已运行
if lsof -ti:8080 > /dev/null 2>&1; then
    echo "⚠️  端口8080已被占用，正在停止旧的前端进程..."
    pkill -f "vue-cli-service serve" 2>/dev/null || true
    pkill -f "npm run serve" 2>/dev/null || true
    sleep 2
fi

# 启动管理员前端
echo ""
echo "🚀 启动管理员前端（端口8080）..."
cd admin
nohup npm run serve >> ../admin-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "等待前端编译（通常需要30-60秒）..."
sleep 5

echo ""
echo "=========================================="
echo "✅ 服务启动完成！"
echo "=========================================="
echo ""
echo "服务状态："
echo "  - 后端服务器: http://localhost:3000"
echo "    • 进程ID: $BACKEND_PID"
echo "    • 日志: backend/logs/server.log"
echo "    • 错误日志: backend/logs/error.log"
echo ""
echo "  - 管理员前端: http://localhost:8080"
echo "    • 进程ID: $FRONTEND_PID"
echo "    • 日志: admin-frontend.log"
echo ""
echo "停止服务："
echo "  bash stop-services.sh"
echo ""
echo "检查服务状态："
echo "  bash check-services.sh"
echo "=========================================="

