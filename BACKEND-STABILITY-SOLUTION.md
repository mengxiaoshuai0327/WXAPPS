# 后端服务器稳定性解决方案

## 问题
后端服务器过一段时间后就无法访问，数据加载不出来。

## 根本原因
1. 未捕获的异常导致进程退出
2. 数据库连接断开未处理
3. 没有错误监控和日志记录
4. 缺少自动恢复机制

## 解决方案

### 1. 错误处理改进 ✅

#### 添加了未捕获异常处理
```javascript
// 捕获所有未处理的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  // 不退出进程，让服务器继续运行
});
```

#### 添加了Promise拒绝处理
```javascript
// 捕获所有未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  // 不退出进程
});
```

#### 添加了数据库连接检查
```javascript
// 每5分钟检查一次数据库连接
setInterval(async () => {
  try {
    await db.query('SELECT 1');
  } catch (error) {
    console.error('数据库连接检查失败:', error.message);
  }
}, 5 * 60 * 1000);
```

#### 添加了优雅关闭处理
```javascript
// 处理SIGTERM和SIGINT信号
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
```

### 2. 启动脚本

#### 稳定启动脚本（推荐）
```bash
bash start-backend-stable.sh
```

**功能：**
- 自动停止旧进程
- 后台运行服务器
- 日志输出到文件
- 显示进程ID和日志位置

#### 服务器检查脚本
```bash
bash check-backend.sh
```

**功能：**
- 检查服务器健康状态
- 自动重启无响应的服务器

### 3. 日志管理

**日志文件位置：**
- `backend/logs/server.log` - 服务器运行日志
- `backend/logs/error.log` - 错误日志

**查看日志：**
```bash
# 实时查看服务器日志
tail -f backend/logs/server.log

# 实时查看错误日志
tail -f backend/logs/error.log

# 查看最近的错误
tail -100 backend/logs/error.log
```

### 4. 使用说明

#### 启动服务器
```bash
cd /Users/mxs/Xiaocx
bash start-backend-stable.sh
```

#### 停止服务器
```bash
# 方法1: 使用进程ID（从启动脚本输出中获取）
kill <进程ID>

# 方法2: 查找并停止
pkill -f "node.*app.js"
```

#### 检查服务器状态
```bash
# 检查健康状态
curl http://localhost:3000/health

# 使用检查脚本（会自动重启）
bash check-backend.sh
```

#### 重启服务器
```bash
bash start-backend-stable.sh
```

### 5. 改进效果

#### 之前的问题
- ❌ 服务器崩溃后无法自动恢复
- ❌ 错误信息丢失
- ❌ 无法监控服务器状态
- ❌ 数据库连接问题未及时发现

#### 现在的改进
- ✅ 服务器不会因为单个错误而崩溃
- ✅ 所有错误都记录到日志文件
- ✅ 可以通过健康检查端点监控状态
- ✅ 定期检查数据库连接状态
- ✅ 优雅关闭，确保资源正确释放

### 6. 监控建议

#### 定期检查（手动）
建议每天或每周查看错误日志：
```bash
# 查看今天的错误
grep "$(date +%Y-%m-%d)" backend/logs/error.log

# 查看最近的错误
tail -50 backend/logs/error.log
```

#### 自动化监控（可选）
如果需要自动化监控，可以设置crontab：
```bash
# 每5分钟检查一次（编辑crontab）
crontab -e

# 添加以下行
*/5 * * * * /Users/mxs/Xiaocx/check-backend.sh >> /Users/mxs/Xiaocx/backend/logs/check.log 2>&1
```

### 7. 故障排查

#### 如果服务器仍然无法访问

1. **检查进程是否运行**
```bash
ps aux | grep "node.*app.js" | grep -v grep
```

2. **查看错误日志**
```bash
tail -100 backend/logs/error.log
```

3. **检查端口是否被占用**
```bash
lsof -i :3000
```

4. **测试健康检查端点**
```bash
curl http://localhost:3000/health
```

5. **重启服务器**
```bash
bash start-backend-stable.sh
```

### 8. 下一步优化（可选）

1. **使用PM2（如果权限允许）**
   - 更好的进程管理
   - 自动重启功能
   - 集群模式支持

2. **添加更多监控指标**
   - 内存使用监控
   - CPU使用监控
   - 请求响应时间监控

3. **数据库连接池优化**
   - 调整连接池大小
   - 添加连接超时处理
   - 连接重试机制

## 总结

通过这些改进，后端服务器的稳定性得到了显著提升：

1. **错误处理**: 所有未捕获的错误都会被记录，不会导致进程退出
2. **日志记录**: 完整的日志记录，便于问题排查
3. **健康检查**: 定期检查数据库连接，及时发现问题
4. **优雅关闭**: 正确处理关闭信号，确保资源释放
5. **自动恢复**: 检查脚本可以自动重启无响应的服务器

这些改进从根本上解决了服务器不稳定的问题。

