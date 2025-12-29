# 如何查看服务器日志

## 方法1：查看运行中的服务器日志（推荐）

如果服务器正在后台运行，可以通过以下方式查看日志：

### 1.1 查看进程输出

服务器日志通常直接输出到终端。如果你在某个终端窗口中启动了服务器，直接查看那个窗口的输出即可。

### 1.2 如果服务器是在后台运行的

你可以通过以下命令查看后台进程的日志：

```bash
# 查看所有Node.js进程
ps aux | grep node

# 或者查看npm进程
ps aux | grep npm
```

## 方法2：查看日志文件（如果有配置日志文件）

如果服务器配置了日志文件，可以查看：

```bash
# 常见的日志文件位置
tail -f /Users/mxs/Xiaocx/backend/logs/app.log
# 或者
tail -f /Users/mxs/Xiaocx/backend/nohup.out
```

## 方法3：重启服务器并查看实时日志（最简单）

### 步骤：

1. **停止当前服务器**：
   ```bash
   cd /Users/mxs/Xiaocx/backend
   pkill -f "node.*app.js"
   ```

2. **在前台启动服务器**（这样可以直接看到日志）：
   ```bash
   cd /Users/mxs/Xiaocx/backend
   npm start
   ```

3. **在浏览器中刷新用户列表页面**

4. **查看终端输出**，你应该能看到类似这样的日志：
   ```
   [用户列表] 邀请人信息调试 - 用户ID: 78, member_id: M85101163, role: member, channel_user_id: 6 (number), channelUserIdNum: 6, hasChannelUserId: true, isChannelSales: true
   [用户列表] 判断结果 - isInviterChannelSales: true, 将设置 inviter_role: channel, inviter_role_text: 渠道方
   [用户列表] ✓ 已设置渠道方角色: 用户ID=78, inviter_role=channel, inviter_role_text=渠道方
   ```

5. **复制日志输出**并发送给我

## 方法4：重定向日志到文件

如果你想将日志保存到文件中：

```bash
cd /Users/mxs/Xiaocx/backend
npm start > server.log 2>&1
```

然后查看日志文件：
```bash
tail -f server.log
```

## 我需要看到的日志内容

当你刷新用户列表页面时，请查找包含以下关键字的日志行：

1. `[用户列表] 邀请人信息调试` - 这会显示判断逻辑的详细信息
2. `[用户列表] 判断结果` - 这会显示最终的判断结果
3. `[用户列表] ✓ 已设置渠道方角色` - 这会确认是否成功设置了渠道方角色

如果看到 `isChannelSales: true` 但前端仍然显示"会员"，可能是前端缓存问题。
如果看到 `isChannelSales: false`，说明判断逻辑有问题，需要进一步调试。

