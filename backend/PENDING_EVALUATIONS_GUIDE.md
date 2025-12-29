# 待评价课程显示问题排查指南

## 问题描述

首页中没有显示【课程评价】栏，也没有示例数据。

## 已创建的示例数据

已为用户 ID 4 (MXS) 创建了 2 个待评价课程：

1. **高效商务沟通技巧**
   - 排课ID: 41
   - 预订ID: 12
   - 上课日期: 2025-12-07
   - 时间段: 上午
   - 问卷已触发: 是

2. **公众演讲与表达**
   - 排课ID: 42
   - 预订ID: 13
   - 上课日期: 2025-12-06
   - 时间段: 下午
   - 问卷已触发: 是

## 查看示例数据

### 方法1: 使用脚本查看
```bash
cd backend
npm run show-pending-evaluations
```

### 方法2: 直接查询数据库
```sql
SELECT cb.*, cs.schedule_date, cs.id as schedule_id, c.id as course_id, c.title, cs.questionnaire_triggered
FROM course_bookings cb
JOIN course_schedules cs ON cb.schedule_id = cs.id
JOIN courses c ON cs.course_id = c.id
WHERE cb.user_id = 4 
AND cb.status IN ('booked', 'completed')
AND (cs.questionnaire_triggered = 1 OR cs.questionnaire_triggered = TRUE)
AND DATE(cs.schedule_date) <= DATE(NOW())
AND NOT EXISTS (
  SELECT 1 FROM evaluations e 
  WHERE e.user_id = 4 AND e.schedule_id = cs.id
)
ORDER BY cs.schedule_date DESC;
```

### 方法3: 测试API
```bash
curl "http://localhost:3000/api/evaluations/pending?user_id=4"
```

## 首页显示条件

首页的【课程评价】模块只有在以下条件都满足时才会显示：

1. ✅ 用户已登录（`userRole === 'member'`）
2. ✅ 用户ID正确（`app.globalData.userInfo.id` 存在）
3. ✅ `pendingEvaluations` 数组长度 > 0
4. ✅ API 返回数据成功

## 排查步骤

### 1. 检查后端服务是否运行
```bash
curl http://localhost:3000/health
```

### 2. 检查API是否返回数据
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
      ...
    },
    {
      "id": 13,
      "title": "公众演讲与表达",
      ...
    }
  ]
}
```

### 3. 检查小程序端
- 确保使用用户 ID 4 登录
- 打开小程序首页
- 查看控制台日志，应该看到：
  - `[待评价课程] API返回: ...`
  - `[待评价课程] 待评价课程数量: 2`

### 4. 检查首页数据
在首页的 `onLoad` 和 `onShow` 中，确保：
- `checkUserRole()` 被调用
- `loadMemberData()` 被调用
- `getPendingEvaluations()` 返回数据

## 可能的问题

### 问题1: API返回空数组
**原因**: 后端服务可能没有重启，使用了旧的代码
**解决**: 重启后端服务
```bash
cd backend
# 停止当前服务，然后重新启动
npm start
```

### 问题2: 用户ID不匹配
**原因**: 小程序登录的用户ID不是4
**解决**: 
- 检查 `app.globalData.userInfo.id` 的值
- 或者为当前登录用户创建待评价课程数据

### 问题3: 数据未正确设置
**原因**: `setData` 没有正确更新 `pendingEvaluations`
**解决**: 检查 `loadMemberData()` 方法中的 `setData` 调用

## 创建更多示例数据

如果需要为其他用户创建待评价课程：

```bash
cd backend
npm run insert-pending-evaluations
```

脚本会自动：
1. 查找或创建测试用户
2. 创建已完成的课程排课（已触发问卷）
3. 创建课程预订记录
4. 更新课券状态

## 验证首页显示

1. 使用用户 ID 4 登录小程序
2. 进入首页
3. 应该看到【课程评价】模块，显示：
   - ⭐ 待评价课程
   - 高效商务沟通技巧
   - 公众演讲与表达
   - 去评价 >

## 调试技巧

在小程序端添加调试日志：

```javascript
// 在 loadMemberData 中
console.log('待评价课程数据:', pendingEvaluations);

// 在 getPendingEvaluations 中
console.log('[待评价课程] API返回:', res);
console.log('[待评价课程] 待评价课程数量:', evaluations.length);
```

## 相关文件

- 首页模板: `miniprogram/pages/index/index.wxml` (第112-124行)
- 首页逻辑: `miniprogram/pages/index/index.js` (第177-190行)
- API路由: `backend/routes/evaluations.js` (第7-40行)
- 数据脚本: `backend/scripts/insert-pending-evaluations.js`
- 查看脚本: `backend/scripts/show-pending-evaluations.js`

