# 优惠券发放完整修复方案

## 需求梳理

### 1. 通过授课人或会员的二维码/ID注册
- **授课人邀请**：按照授课人推广方案授予优惠券，记录邀请人信息
- **会员邀请**：按照会员推广方案授予优惠券，记录邀请人信息

### 2. 通过渠道销售二维码/ID注册
- 通过渠道销售ID找到渠道方
- 根据渠道方的营销推广方案授予优惠券
- **记录邀请人角色是渠道方**（不是渠道销售）

## 当前代码逻辑检查

### ✅ 已正确实现的部分

1. **邀请码匹配逻辑**（第381-476行）：
   - ✅ 支持member_id匹配（包括渠道销售）
   - ✅ 支持instructor_id匹配（支持I前缀和纯数字格式）
   - ✅ 支持渠道方ID匹配（CH格式和channel_code格式）

2. **推广信息设置**（第485-508行）：
   - ✅ 授课人推广：设置`promotion_type='instructor'`
   - ✅ 渠道销售推广：设置`promotion_type='channel'`，查询渠道方信息
   - ✅ 普通会员推广：记录为普通会员

3. **优惠券发放逻辑**：
   - ✅ 普通会员邀请（第700-775行）：给邀请人和被邀请人都发放优惠券
   - ✅ 授课人邀请（第781-854行）：给被邀请人发放优惠券
   - ✅ 渠道销售邀请（第861-940行）：给被邀请人发放优惠券

### ⚠️ 需要确认的问题

1. **错误处理**：
   - 当前错误被捕获但不影响注册流程
   - 如果优惠券插入失败，注册会成功但优惠券不会发放
   - 需要确保错误能被及时发现和处理

2. **重复检查逻辑**：
   - 当前使用`user_id + source + source_user_id`进行重复检查
   - 理论上每个用户都有不同的`user_id`，不应该出现重复
   - 但如果第二个用户注册时查询到了已存在的记录，说明可能有bug

3. **事务提交**：
   - 优惠券发放在事务内，如果事务回滚，优惠券不会保存
   - 需要确保事务正确提交

## 修复建议

### 1. 增强错误处理

**问题**：如果优惠券插入失败，错误被捕获但不影响注册，导致注册成功但优惠券未发放。

**解决方案**：
- 添加更详细的错误日志
- 考虑将错误记录到专门的错误日志表
- 在注册成功后，检查优惠券是否成功发放，如果没有，记录警告

### 2. 优化重复检查逻辑

**当前逻辑**：
```sql
SELECT id FROM discount_coupons 
WHERE user_id = ? AND source = ? AND source_user_id = ?
```

**可能的问题**：
- 如果第二个用户注册时，`newUserId`还没有正确设置，可能会查询到错误的记录
- 需要确保`newUserId`在查询时已经正确设置

### 3. 确保事务正确提交

**检查点**：
- 确保所有优惠券插入都在事务内
- 确保事务正确提交
- 如果事务回滚，需要记录原因

## 测试验证

### 测试用例1：通过授课人ID注册（第一个用户）
- **输入**：`I140866389` 或 `140866389`
- **预期**：
  - 找到授课人作为邀请人
  - 设置`promotion_type='instructor'`
  - 发放授课人推广优惠券
  - 记录邀请人信息

### 测试用例2：通过授课人ID注册（第二个用户）
- **输入**：`I140866389` 或 `140866389`
- **预期**：
  - 找到授课人作为邀请人
  - 设置`promotion_type='instructor'`
  - **发放授课人推广优惠券**（与第一个用户独立）
  - 记录邀请人信息

### 测试用例3：通过渠道销售member_id注册
- **输入**：渠道销售的`member_id`（如`M96143951`）
- **预期**：
  - 找到渠道销售作为邀请人
  - 通过`channel_user_id`找到渠道方
  - 设置`promotion_type='channel'`
  - 发放渠道推广优惠券
  - **记录邀请人角色为渠道方**（在后台显示时）

### 测试用例4：通过渠道方ID注册
- **输入**：渠道方ID（如`CH990959`）
- **预期**：
  - 找到渠道方
  - 找到该渠道方的第一个渠道销售作为邀请人
  - 通过`channel_user_id`找到渠道方
  - 设置`promotion_type='channel'`
  - 发放渠道推广优惠券
  - **记录邀请人角色为渠道方**

## 数据库检查SQL

```sql
-- 1. 检查最近注册的用户及其邀请人信息
SELECT 
  u.id, u.member_id, u.real_name, u.inviter_id, u.promotion_type,
  u.instructor_id_for_promotion, u.instructor_name_for_promotion,
  u.channel_name_for_promotion, u.channel_sales_id_for_promotion,
  u_inviter.role as inviter_role,
  u_inviter.channel_user_id as inviter_channel_user_id,
  u_inviter.member_id as inviter_member_id,
  u_inviter.instructor_id as inviter_instructor_id,
  u.created_at
FROM users u
LEFT JOIN users u_inviter ON u.inviter_id = u_inviter.id
ORDER BY u.created_at DESC
LIMIT 10;

-- 2. 检查优惠券发放情况
SELECT 
  dc.id, dc.user_id, dc.amount, dc.source, dc.source_user_id,
  dc.created_at,
  u.real_name as user_name,
  u_source.real_name as inviter_name,
  u_source.role as inviter_role
FROM discount_coupons dc
LEFT JOIN users u ON dc.user_id = u.id
LEFT JOIN users u_source ON dc.source_user_id = u_source.id
WHERE dc.source IN ('instructor_invite', 'channel_invite', 'invite_register')
ORDER BY dc.created_at DESC
LIMIT 20;

-- 3. 检查授课人推广方案
SELECT * FROM coupon_schemes 
WHERE scheme_type = 'instructor_invite' AND status = 'active';

-- 4. 检查会员推广方案
SELECT * FROM coupon_schemes 
WHERE scheme_type = 'member_invite' AND status = 'active';

-- 5. 检查渠道推广方案
SELECT * FROM channel_promotion_schemes 
WHERE status = 'active';
```

## 下一步行动

1. **查看服务器日志**：检查第二个用户注册时的详细日志
2. **执行SQL查询**：检查数据库中的实际数据
3. **根据日志和查询结果**：定位具体问题并修复

