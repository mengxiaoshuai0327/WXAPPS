# 评价管理页面修复指南

## 已修复的问题

1. **API响应处理**：添加了 `res.success` 检查
2. **错误处理**：添加了详细的错误信息和日志
3. **参数处理**：自动移除空值参数
4. **初始化**：修复了页面加载时的数据加载逻辑

## 功能说明

### 1. 课程评价跟进列表
- **路径**：`/evaluations/list` → 第一个Tab
- **功能**：显示所有排课数据，包括评价状态
- **API**：`GET /api/admin/evaluations/follow-up`

### 2. 评价明细列表
- **路径**：`/evaluations/list` → 第二个Tab
- **功能**：显示每个会员对每个课程的评价信息
- **API**：`GET /api/admin/evaluations`

## 验证步骤

### 1. 检查后端服务
```bash
# 确保后端服务正在运行
curl http://localhost:3000/health
```

### 2. 测试API
```bash
# 测试课程评价跟进列表
curl "http://localhost:3000/api/admin/evaluations/follow-up?page=1&pageSize=20"

# 测试评价明细列表
curl "http://localhost:3000/api/admin/evaluations?page=1&pageSize=20"
```

### 3. 检查前端
1. 打开管理后台：`http://localhost:8080`
2. 登录后进入"评价管理"页面
3. 应该看到两个Tab：
   - **课程评价跟进**：显示所有排课数据
   - **评价明细**：显示所有评价记录

## 常见问题

### 问题1：显示"加载评价列表失败"
**原因**：后端服务未运行或API路径错误
**解决**：
1. 检查后端服务是否运行：`cd backend && npm start`
2. 检查API路径是否正确
3. 查看浏览器控制台的错误信息

### 问题2：数据为空
**原因**：数据库中没有数据
**解决**：
1. 检查是否有排课数据：`SELECT * FROM course_schedules LIMIT 5;`
2. 检查是否有评价数据：`SELECT * FROM evaluations LIMIT 5;`

### 问题3：Tab切换不加载数据
**原因**：Tab切换事件未正确触发
**解决**：已修复，现在Tab切换时会自动加载对应数据

## 数据格式

### 课程评价跟进列表返回格式
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "course_title": "高效商务沟通技巧",
      "instructor_name": "张教授",
      "schedule_date_formatted": "2025-12-07",
      "time_slot_text": "上午",
      "evaluation_status": "已触发评价",
      "evaluation_status_code": "triggered",
      "booking_count": 5,
      "active_booking_count": 5,
      "evaluation_count": 3
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "pageSize": 20
  }
}
```

### 评价明细列表返回格式
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_name": "MXS",
      "user_member_id": "M03152922",
      "course_title": "高效商务沟通技巧",
      "schedule_date_formatted": "2025-12-07",
      "time_slot_text": "上午",
      "answers": {
        "q1": "A",
        "q2": "B",
        ...
      },
      "feedback": "课程很好",
      "submitted_at_formatted": "2025-12-08 10:00:00"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

## 调试技巧

### 查看浏览器控制台
1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签
3. 查看 Network 标签，检查API请求和响应

### 查看后端日志
```bash
# 后端服务运行时会输出日志
# 查看是否有错误信息
```

## 相关文件

- 前端页面：`admin/src/views/evaluations/List.vue`
- 后端API：`backend/routes/admin/evaluations.js`
- API工具：`admin/src/utils/api.js`

