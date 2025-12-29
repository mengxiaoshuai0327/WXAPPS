# 第二个用户无法获得优惠券问题排查

## 问题描述

两个游客注册会员时都输入了授课人张三的ID，第一个用户能获得优惠券，但第二个用户不能。

## 可能的原因

### 1. 重复检查逻辑问题（已排查）

**代码位置**：`backend/routes/auth.js` 第803-806行

```javascript
const [existingCoupons] = await connection.query(
  'SELECT id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
  [newUserId, 'instructor_invite', inviter_id]
);
```

**分析**：
- 这个查询条件应该是正确的，因为每个新用户都有不同的 `user_id`
- 理论上不应该出现第二个用户查询到第一个用户优惠券的情况

### 2. 错误被静默捕获

**代码位置**：`backend/routes/auth.js` 第832-835行

```javascript
} catch (instructorCouponError) {
  console.error('[授课人优惠券发放] 发放授课人推广优惠券失败:', instructorCouponError);
  console.error('[授课人优惠券发放] 错误堆栈:', instructorCouponError.stack);
  // 不影响注册流程，只记录错误
}
```

**可能的问题**：
- 如果优惠券插入失败（如数据库错误、字段不存在等），错误会被捕获但不影响注册
- 注册会成功，但优惠券不会发放

### 3. 事务问题

如果两个用户几乎同时注册，可能存在事务隔离级别的问题，但这种情况很少见。

### 4. 数据库约束问题

如果 `discount_coupons` 表有唯一约束（如 `(user_id, source, source_user_id)` 的复合唯一索引），第二个用户插入时可能会因为某种原因失败。

## 排查步骤

### 1. 检查服务器日志

查看第二个用户注册时的日志，关注以下关键字：

```
[授课人优惠券发放] 检查是否已存在优惠券
[授课人优惠券发放] 重复检查结果
[授课人优惠券发放] 准备插入优惠券
[授课人优惠券发放] 插入优惠券失败
✓ 已为被邀请人 xxx 发放授课人推广优惠券
```

### 2. 数据库检查

```sql
-- 检查两个用户的注册信息
SELECT 
  id, member_id, real_name, inviter_id, promotion_type,
  instructor_id_for_promotion, instructor_name_for_promotion,
  created_at
FROM users 
WHERE real_name IN ('第一个用户名', '第二个用户名')
  AND inviter_id = (SELECT id FROM users WHERE real_name = '张三' AND role = 'instructor')
ORDER BY created_at DESC;

-- 检查优惠券发放情况
SELECT 
  dc.id, dc.user_id, dc.amount, dc.source, dc.source_user_id,
  u.real_name as user_name,
  u_source.real_name as inviter_name
FROM discount_coupons dc
LEFT JOIN users u ON dc.user_id = u.id
LEFT JOIN users u_source ON dc.source_user_id = u_source.id
WHERE dc.source = 'instructor_invite'
  AND dc.source_user_id = (SELECT id FROM users WHERE real_name = '张三' AND role = 'instructor')
ORDER BY dc.created_at DESC;

-- 检查邀请记录
SELECT 
  i.*,
  u_inviter.real_name as inviter_name,
  u_invitee.real_name as invitee_name
FROM invitations i
LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
LEFT JOIN users u_invitee ON i.invitee_id = u_invitee.id
WHERE i.inviter_id = (SELECT id FROM users WHERE real_name = '张三' AND role = 'instructor')
ORDER BY i.created_at DESC;
```

### 3. 检查数据库约束

```sql
-- 检查discount_coupons表的索引和约束
SHOW CREATE TABLE discount_coupons;

-- 检查是否有唯一约束可能阻止插入
SHOW INDEX FROM discount_coupons;
```

## 已添加的调试日志

现在代码会输出以下详细日志：

1. **重复检查日志**：
   - 显示查询条件
   - 显示查询结果数量
   - 如果找到已存在的记录，显示详情

2. **插入过程日志**：
   - 显示准备插入的数据
   - 如果插入失败，显示详细错误信息

3. **成功日志**：
   - 显示成功发放的优惠券信息

## 建议的修复方案

如果问题是错误被静默捕获，可以考虑：

1. **记录更详细的错误信息**：已添加
2. **检查数据库约束**：确认是否有唯一约束导致插入失败
3. **检查数据库字段**：确认所有必需字段都存在且正确

## 下一步

1. 请查看服务器日志，特别是第二个用户注册时的日志
2. 执行上述SQL查询，检查数据库中的实际数据
3. 如果发现错误信息，请提供完整的错误堆栈

