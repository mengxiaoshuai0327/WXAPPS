# 部署说明

## 关于稳定性改进对生产部署的影响

### ✅ 不会影响生产部署的内容

1. **代码改进（app.js中的错误处理）**
   - ✅ 这些改进对生产环境是有益的
   - ✅ 增加了服务器稳定性
   - ✅ 不会影响部署

2. **本地开发脚本（.sh文件）**
   - ✅ 这些脚本只在本地开发时使用
   - ✅ 生产环境不会使用这些脚本
   - ✅ 不影响部署

### ⚠️ PM2相关说明

**重要：PM2实际上没有安装成功**（由于权限问题）

- `backend/package.json` 中的 `pm2` 在 `devDependencies` 中
- 但由于npm权限问题，PM2安装失败
- 生产环境部署时不会安装devDependencies（除非使用 `npm install --production` 之前）
- 即使安装了，PM2配置也是可选的，不会影响正常的 `npm start`

### 生产环境部署建议

#### 方案1：使用标准的npm start（推荐）

生产环境可以直接使用：
```bash
npm start
# 或
node app.js
```

代码中的错误处理改进会让服务器更稳定，不需要PM2也能运行。

#### 方案2：如果需要PM2（可选）

如果生产环境需要使用PM2，可以：
1. 在生产服务器上安装PM2：`npm install -g pm2`
2. 使用：`pm2 start app.js` 或 `npm run start:pm2`

但这**不是必需的**，标准启动方式即可。

### 需要部署到生产环境的内容

✅ **必须部署：**
- `backend/app.js` （包含错误处理的改进）
- `backend/config/database.js`
- `backend/routes/` 所有路由文件
- `backend/package.json` 和 `package-lock.json`
- `backend/.env` （生产环境配置）

❌ **不需要部署（本地开发用）：**
- `start-backend-stable.sh`
- `start-backend.sh`
- `start-all.sh`
- `check-backend.sh`
- `ecosystem.config.js` （除非使用PM2）
- `backend/logs/` 目录（生产环境应该有自己的日志配置）

### 腾讯云部署步骤

1. **上传代码**（不包括本地开发脚本）
2. **安装依赖**：
   ```bash
   npm install --production
   ```
   （这会跳过devDependencies，包括未安装的PM2）
3. **配置环境变量**（.env文件）
4. **启动服务**：
   ```bash
   npm start
   # 或
   node app.js
   ```

### 总结

- ✅ **代码改进对生产环境有益**，应该部署
- ✅ **本地开发脚本不影响生产环境**
- ✅ **PM2没有成功安装**，不会影响部署
- ✅ **标准的npm start即可正常运行**

所有的改进都是**增强性的**，不会破坏现有功能，反而会让服务器更稳定。

