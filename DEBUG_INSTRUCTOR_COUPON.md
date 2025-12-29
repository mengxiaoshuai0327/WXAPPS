# 授课人优惠券发放调试指南

## 问题描述

用户完整输入授课人ID（如 `I140866389`）注册，但系统没有识别邀请人信息并派发优惠券。

## 调试步骤

### 1. 检查服务器日志

注册时，查看服务器日志中的以下关键字：

#### 关键日志点1：邀请码匹配
```
[注册] 开始匹配邀请码: I140866389
[注册] 通过member_id未找到匹配: I140866389
[注册] 开始尝试匹配instructor_id，邀请码=I140866389
[注册] 第一次尝试：使用原邀请码匹配instructor_id='I140866389' AND role='instructor'
[注册] 第一次查询结果: 找到X条记录
```

**如果找到0条记录**：
- 检查数据库中是否存在 `instructor_id='I140866389'` 且 `role='instructor'` 的用户
- 检查 `instructor_id` 字段值是否完全匹配（包括大小写）

#### 关键日志点2：邀请人信息设置
```
[注册] ✓ 找到授课人: id=xxx, instructor_id=I140866389, name=张三, role=instructor
找到邀请人: ID=xxx, instructor_id=I140866389, role=instructor, 邀请码=I140866389
[授课人推广] 设置推广信息: promotion_type=instructor, instructor_id=I140866389, instructor_name=张三
```

**如果看到这些日志**：说明邀请人匹配成功，继续检查下一步。

#### 关键日志点3：优惠券发放
```
[授课人优惠券发放] 开始处理授课人邀请，inviter_id=xxx, inviter_role=instructor, promotion_type=instructor
[授课人优惠券发放] 查找授课人推广方案: scheme_type='instructor_invite', status='active'
[授课人优惠券发放] 找到授课人推广方案: ID=xxx, 被邀请人金额=¥xxx, 有效期=xxx天
✓ 已为被邀请人 xxx 发放授课人推广优惠券：金额¥xxx，有效期xxx天
```

**如果没有看到这些日志**：
- 检查 `inviter_role` 是否为 `'instructor'`
- 检查是否进入了正确的分支

### 2. 数据库检查SQL

#### 检查授课人是否存在
```sql
-- 检查是否存在instructor_id为I140866389的授课人
SELECT id, member_id, instructor_id, role, nickname, real_name 
FROM users 
WHERE instructor_id = 'I140866389' 
  AND role = 'instructor';

-- 如果没找到，检查所有授课人
SELECT id, instructor_id, real_name, role 
FROM users 
WHERE role = 'instructor' 
ORDER BY id DESC 
LIMIT 20;
```

#### 检查授课人推广方案
```sql
-- 检查是否存在激活的授课人推广方案
SELECT * 
FROM coupon_schemes 
WHERE scheme_type = 'instructor_invite' 
  AND status = 'active';

-- 如果没有，需要创建
INSERT INTO coupon_schemes (
  scheme_type,
  instructor_invitee_amount,
  invitee_expiry_days,
  status,
  created_at,
  updated_at
) VALUES (
  'instructor_invite',
  600.00,  -- 根据实际需求调整金额
  30,      -- 有效期天数
  'active',
  NOW(),
  NOW()
);
```

#### 检查用户注册信息
```sql
-- 检查孟十四的注册信息
SELECT 
  id, member_id, inviter_id, promotion_type,
  instructor_id_for_promotion, instructor_name_for_promotion,
  created_at
FROM users 
WHERE member_id = 'Mxxxxx'  -- 替换为孟十四的member_id
ORDER BY created_at DESC 
LIMIT 1;
```

#### 检查邀请记录
```sql
-- 检查是否有邀请记录
SELECT 
  i.*,
  u_inviter.instructor_id as inviter_instructor_id,
  u_inviter.role as inviter_role
FROM invitations i
LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
WHERE i.invitee_id = (SELECT id FROM users WHERE member_id = 'Mxxxxx')
ORDER BY i.created_at DESC;
```

#### 检查优惠券记录
```sql
-- 检查是否发放了优惠券
SELECT 
  dc.*,
  u_source.instructor_id as source_instructor_id
FROM discount_coupons dc
LEFT JOIN users u_source ON dc.source_user_id = u_source.id
WHERE dc.user_id = (SELECT id FROM users WHERE member_id = 'Mxxxxx')
  AND dc.source = 'instructor_invite'
ORDER BY dc.created_at DESC;
```

### 3. 可能的问题

#### 问题1：instructor_id不匹配
- **现象**：日志显示"找到0条记录"
- **原因**：
  - 数据库中 `instructor_id` 的值与用户输入的不完全一致
  - 可能有多余的空格或字符
  - 大小写不匹配
- **解决**：检查数据库中的实际值，确保完全匹配

#### 问题2：授课人推广方案不存在或未激活
- **现象**：日志显示"未找到激活的授课人推广方案"
- **原因**：
  - `coupon_schemes` 表中没有 `scheme_type='instructor_invite'` 的记录
  - 或者记录存在但 `status` 不是 `'active'`
- **解决**：创建或激活授课人推广方案

#### 问题3：优惠券发放逻辑未执行
- **现象**：找到了授课人，但没有看到优惠券发放的日志
- **原因**：
  - `inviter_role` 不是 `'instructor'`
  - 代码逻辑判断有问题
- **解决**：检查日志中的 `inviter_role` 值，确认是否为 `'instructor'`

#### 问题4：事务回滚
- **现象**：优惠券发放失败，事务被回滚
- **原因**：
  - 数据库插入错误
  - 字段不存在
  - 数据格式错误
- **解决**：查看错误堆栈，修复数据库问题

### 4. 完整的注册流程检查清单

- [ ] 邀请码匹配成功（找到授课人）
- [ ] `inviter_id` 正确设置
- [ ] `inviter_role` 正确设置为 `'instructor'`
- [ ] `promotion_type` 正确设置为 `'instructor'`
- [ ] `instructor_id_for_promotion` 正确设置
- [ ] 授课人推广方案存在且激活
- [ ] `instructor_invitee_amount > 0`
- [ ] 优惠券成功插入数据库
- [ ] 事务成功提交

## 测试用例

### 测试1：使用完整格式的instructor_id注册
- **输入邀请码**：`I140866389`
- **预期结果**：找到授课人，发放优惠券

### 测试2：使用纯数字格式注册
- **输入邀请码**：`140866389`
- **预期结果**：自动转换为 `I140866389`，找到授课人，发放优惠券

### 测试3：无效的instructor_id
- **输入邀请码**：`I99999999`
- **预期结果**：找不到授课人，不建立邀请关系

