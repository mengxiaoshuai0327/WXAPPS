# 待评价课程显示问题 - 快速修复指南

## 问题
首页没有显示【课程评价】栏，API返回空数组，但数据库中有数据。

## 原因
后端服务可能没有重启，使用了旧代码。

## 解决方案

### 步骤1: 重启后端服务

```bash
cd backend

# 如果服务正在运行，先停止（Ctrl+C）
# 然后重新启动
npm start
```

### 步骤2: 验证API

重启后，测试API是否返回数据：

```bash
curl "http://localhost:3000/api/evaluations/pending?user_id=4"
```

应该返回：
```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "title": "高效商务沟通技巧",
      "schedule_id": 41,
      ...
    },
    {
      "id": 13,
      "title": "公众演讲与表达",
      "schedule_id": 42,
      ...
    }
  ]
}
```

### 步骤3: 在小程序中查看

1. 使用会员ID **M03152922** 登录小程序
2. 进入首页
3. 应该看到【课程评价】模块，显示：
   - ⭐ 待评价课程
   - 高效商务沟通技巧
   - 公众演讲与表达
   - 去评价 >

## 当前数据状态

✅ **用户信息**
- 用户ID: 4
- 会员ID: M03152922
- 用户名: MXS

✅ **待评价课程（2个）**
1. **高效商务沟通技巧**
   - 排课ID: 41
   - 预订ID: 12
   - 日期: 2025-12-07
   - 问卷已触发: ✅

2. **公众演讲与表达**
   - 排课ID: 42
   - 预订ID: 13
   - 日期: 2025-12-06
   - 问卷已触发: ✅

## 验证命令

### 查看待评价课程数据
```bash
cd backend
npm run show-pending-evaluations
```

### 测试API
```bash
cd backend
node scripts/test-pending-evaluations-api.js
```

### 直接查询数据库
```bash
cd backend
node -e "const db = require('./config/database'); (async () => { const [result] = await db.query(\`SELECT cb.*, c.title FROM course_bookings cb JOIN course_schedules cs ON cb.schedule_id = cs.id JOIN courses c ON cs.course_id = c.id WHERE cb.user_id = 4 AND cs.questionnaire_triggered = 1 AND cb.status = 'completed'\`); console.log(JSON.stringify(result, null, 2)); process.exit(0); })();"
```

## 如果仍然不显示

1. **检查后端服务日志**
   - 查看控制台是否有 `[待评价课程]` 相关日志
   - 确认查询是否执行

2. **检查小程序控制台**
   - 打开小程序开发者工具
   - 查看 Console 日志
   - 应该看到 `[待评价课程] API返回:` 和 `[待评价课程] 待评价课程数量: 2`

3. **检查用户ID**
   - 确认 `app.globalData.userInfo.id` 是否为 4
   - 在首页的 `onLoad` 或 `onShow` 中添加日志：
     ```javascript
     console.log('用户ID:', app.globalData.userInfo.id);
     ```

## 相关文件

- API路由: `backend/routes/evaluations.js` (第7-46行)
- 首页逻辑: `miniprogram/pages/index/index.js` (第177-200行)
- 首页模板: `miniprogram/pages/index/index.wxml` (第112-124行)

