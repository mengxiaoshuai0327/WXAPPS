# 重启后端服务指南

## 问题
API返回404错误：`Cannot GET /api/admin/evaluations/follow-up`

## 原因
后端服务可能没有重启，还在使用旧的路由代码。

## 解决方案

### 方法1：重启后端服务

```bash
cd backend

# 停止当前服务（如果正在运行）
# 按 Ctrl+C 或找到进程并杀死
ps aux | grep "node.*app.js" | grep -v grep
kill <进程ID>

# 重新启动
npm start
```

### 方法2：使用PM2（如果已安装）

```bash
cd backend
pm2 restart app.js
# 或
pm2 restart all
```

### 方法3：检查并重启

```bash
# 检查后端服务是否运行
curl http://localhost:3000/health

# 如果没有响应，启动服务
cd backend
npm start
```

## 验证

重启后，测试API：

```bash
# 测试课程评价跟进列表
curl "http://localhost:3000/api/admin/evaluations/follow-up?page=1&pageSize=20"

# 应该返回JSON数据，而不是404错误
```

## 注意事项

1. 确保后端服务在 `http://localhost:3000` 运行
2. 确保路由文件 `backend/routes/admin/evaluations.js` 包含 `/follow-up` 路由
3. 路由顺序很重要：`/follow-up` 必须在 `/:id` 之前

