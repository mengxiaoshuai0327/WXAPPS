# 授课人信息同步到用户列表

## 需求说明

在管理员后端【授课人】列表中新建授课人时，新创建的授课人信息需要同步到【用户列表】中。

## 当前实现

### 代码位置
`backend/routes/admin/instructors.js` 第61-139行（创建授课人）

### 实现逻辑

创建授课人时，使用事务同时完成以下操作：

1. **在users表中创建用户记录**（第105-109行）：
   ```sql
   INSERT INTO users (nickname, real_name, phone, password, avatar_url, role, instructor_id, openid)
   VALUES (?, ?, ?, ?, ?, 'instructor', ?, ?)
   ```
   - `role='instructor'`：设置角色为授课人
   - `instructor_id`：设置授课人ID（如 `I140866389`）
   - 其他基本信息：昵称、姓名、手机号、密码、头像等

2. **在instructors表中创建授课人信息**（第114-117行）：
   ```sql
   INSERT INTO instructors (user_id, bio, background) VALUES (?, ?, ?)
   ```
   - 存储授课人的详细信息（简介、背景介绍）

### 同步说明

**✅ 已自动同步**：
- 创建授课人时，在 `users` 表中创建了 `role='instructor'` 的用户记录
- 用户列表的查询（`backend/routes/admin/users.js`）默认包含所有角色的用户
- 除非指定 `role` 参数进行筛选，否则授课人会自动出现在用户列表中

### 用户列表查询逻辑

用户列表API（`backend/routes/admin/users.js` 第6-184行）：
```sql
SELECT u.* FROM users u WHERE 1=1
-- 如果role参数为空或'all'，返回所有角色的用户（包括授课人）
-- 如果role='instructor'，只返回授课人
-- 如果role='member'，只返回会员
```

### 数据字段说明

#### users表中的授课人记录包含：
- `id`：用户ID（主键）
- `role`：角色（'instructor'）
- `instructor_id`：授课人ID（如 `I140866389`）
- `member_id`：**NULL**（授课人不需要member_id）
- `nickname`：昵称
- `real_name`：真实姓名
- `phone`：手机号
- `password`：密码（加密）
- `avatar_url`：头像URL
- 其他字段...

#### instructors表中的记录包含：
- `user_id`：关联到users表的id
- `bio`：个人简介
- `background`：背景介绍

## 验证方法

### 1. 创建授课人后检查用户列表

```sql
-- 检查最近创建的授课人
SELECT id, nickname, real_name, role, instructor_id, member_id, created_at
FROM users 
WHERE role = 'instructor'
ORDER BY created_at DESC
LIMIT 5;

-- 检查授课人信息
SELECT i.*, u.nickname, u.real_name, u.instructor_id
FROM instructors i
LEFT JOIN users u ON i.user_id = u.id
ORDER BY i.created_at DESC
LIMIT 5;
```

### 2. 通过API验证

- **授课人列表API**：`GET /api/admin/instructors`
- **用户列表API**：`GET /api/admin/users?role=instructor` 或 `GET /api/admin/users`（查看所有角色）

## 注意事项

1. **member_id字段**：
   - 授课人不需要 `member_id`（该字段为NULL）
   - 授课人使用 `instructor_id` 作为唯一标识

2. **角色区分**：
   - 授课人：`role='instructor'`，有 `instructor_id`，`member_id` 为NULL
   - 会员：`role='member'`，有 `member_id`，`instructor_id` 为NULL
   - 渠道销售：`role='member'`，有 `member_id` 和 `channel_user_id`，`instructor_id` 为NULL

3. **唯一性约束**：
   - `instructor_id` 在users表中是UNIQUE的
   - `member_id` 在users表中是UNIQUE的（但授课人的member_id为NULL，所以不冲突）

## 已添加的功能

1. **日志记录**：
   - 创建用户记录时记录日志
   - 创建成功后记录日志

2. **事务保证**：
   - 使用数据库事务确保users表和instructors表的记录同时创建
   - 如果任何一步失败，整个操作会回滚

