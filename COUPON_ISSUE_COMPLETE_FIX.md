# 优惠券发放完整修复文档

## 修复日期
2024-12-19

## 修复内容

### 1. 优化授课人推广优惠券发放逻辑

**问题**：
- 通过授课人ID注册时，优惠券可能没有正确发放
- 日志不够详细，难以排查问题

**修复**：
- 添加详细的日志记录，包括：
  - 授课人推广信息设置日志
  - 授课人推广方案查询日志
  - 优惠券发放过程日志
  - 错误日志和堆栈跟踪

**代码位置**：
- `backend/routes/auth.js` 第451-455行：添加授课人推广信息设置日志
- `backend/routes/auth.js` 第745-857行：优化授课人优惠券发放逻辑和日志

### 2. 优化渠道推广优惠券发放逻辑

**修复**：
- 添加 `channel_code_for_promotion` 变量保存查询到的 `channel_code`
- 在事务内优先使用已保存的 `channel_code`，避免重复查询
- 添加详细的错误日志

**代码位置**：
- `backend/routes/auth.js` 第372行：添加 `channel_code_for_promotion` 变量
- `backend/routes/auth.js` 第465行：保存查询到的 `channel_code`
- `backend/routes/auth.js` 第803-890行：优化渠道优惠券发放逻辑

### 3. 三种推广方式的优惠券发放逻辑

#### 3.1 普通会员推广

**代码位置**：`backend/routes/auth.js` 第666-740行

**发放规则**：
- 邀请人：获得注册奖励优惠券（从 `member_inviter_register_amount` 配置）
- 被邀请人：获得注册奖励优惠券（从 `member_invitee_amount` 配置）

**检查点**：
- ✅ 查找 `coupon_schemes` 表中 `scheme_type='member_invite'` 且 `status='active'` 的记录
- ✅ 确保 `member_inviter_register_amount > 0` 和 `member_invitee_amount > 0`
- ✅ 优惠券 `source='invite_register'`

#### 3.2 授课人推广

**代码位置**：`backend/routes/auth.js` 第745-857行

**发放规则**：
- 被邀请人：获得注册奖励优惠券（从 `instructor_invitee_amount` 配置）
- 邀请人：**不发放**优惠券（但被邀请人首次购买时可享受折扣）

**检查点**：
- ✅ 查找 `coupon_schemes` 表中 `scheme_type='instructor_invite'` 且 `status='active'` 的记录
- ✅ 确保 `instructor_invitee_amount > 0`
- ✅ 优惠券 `source='instructor_invite'`
- ✅ 记录 `instructor_id_for_promotion` 和 `instructor_name_for_promotion`

#### 3.3 渠道销售推广

**代码位置**：`backend/routes/auth.js` 第799-890行

**发放规则**：
- 被邀请人：获得注册奖励优惠券（从 `channel_promotion_schemes.amount` 配置）
- 邀请人（渠道销售）：**不发放**优惠券

**检查点**：
- ✅ 通过 `inviter.channel_user_id` 找到渠道方
- ✅ 通过 `channels.channel_code` 查找 `channel_promotion_schemes` 表中对应的方案
- ✅ 确保方案 `status='active'` 且 `amount > 0`
- ✅ 优惠券 `source='channel_invite'`
- ✅ 记录 `channel_name_for_promotion`、`channel_sales_id_for_promotion`、`channel_sales_name_for_promotion`

## 邀请码匹配逻辑

### 匹配优先级

1. **第一优先级：member_id**（会员ID）
   - 查询条件：`users.member_id = invite_code AND role = 'member'`
   - 可能是普通会员或渠道销售（通过 `channel_user_id` 区分）

2. **第二优先级：instructor_id**（授课人ID）
   - 查询条件：`users.instructor_id = invite_code AND role = 'instructor'`
   - 确定为授课人邀请

3. **第三优先级：渠道方ID/编码**
   - 支持格式：
     - `CH990959` → 自动转换为 `channel_990959` 进行匹配
     - `channel_990959` → 直接匹配
   - 找到渠道方后，查找该渠道方的第一个渠道销售作为邀请人

### 代码位置

- `backend/routes/auth.js` 第383-441行：邀请码匹配逻辑

## 数据库检查SQL

### 检查授课人推广方案

```sql
-- 检查是否存在激活的授课人推广方案
SELECT * FROM coupon_schemes 
WHERE scheme_type = 'instructor_invite' AND status = 'active';

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
  600.00,  -- 被邀请人奖励金额（根据实际需求调整）
  30,      -- 有效期天数（根据实际需求调整）
  'active',
  NOW(),
  NOW()
);
```

### 检查会员推广方案

```sql
-- 检查是否存在激活的会员推广方案
SELECT * FROM coupon_schemes 
WHERE scheme_type = 'member_invite' AND status = 'active';
```

### 检查渠道推广方案

```sql
-- 检查所有激活的渠道推广方案
SELECT cps.*, c.channel_name, c.channel_code as channel_table_code
FROM channel_promotion_schemes cps
LEFT JOIN channels c ON cps.channel_code = c.channel_code
WHERE cps.status = 'active';
```

### 检查用户注册信息

```sql
-- 检查用户孟十二（M16311094）的注册信息
SELECT 
  u.id, u.member_id, u.inviter_id, u.promotion_type,
  u.instructor_id_for_promotion, u.instructor_name_for_promotion,
  u.channel_name_for_promotion, u.channel_sales_id_for_promotion,
  u_inviter.instructor_id as inviter_instructor_id,
  u_inviter.member_id as inviter_member_id,
  u_inviter.role as inviter_role
FROM users u
LEFT JOIN users u_inviter ON u.inviter_id = u_inviter.id
WHERE u.member_id = 'M16311094';
```

### 检查优惠券发放情况

```sql
-- 检查用户的所有优惠券
SELECT 
  dc.*, 
  u_source.member_id as source_member_id,
  u_source.instructor_id as source_instructor_id
FROM discount_coupons dc
LEFT JOIN users u_source ON dc.source_user_id = u_source.id
WHERE dc.user_id = (SELECT id FROM users WHERE member_id = 'M16311094')
ORDER BY dc.created_at DESC;
```

### 检查邀请记录

```sql
-- 检查邀请记录
SELECT 
  i.*,
  u_inviter.instructor_id as inviter_instructor_id,
  u_inviter.member_id as inviter_member_id,
  u_inviter.role as inviter_role
FROM invitations i
LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
WHERE i.invitee_id = (SELECT id FROM users WHERE member_id = 'M16311094');
```

## 测试步骤

### 测试1：通过授课人ID注册

1. **准备测试数据**：
   - 确保有一个授课人用户（`role='instructor'` 且有 `instructor_id`）
   - 确保 `coupon_schemes` 表中有 `scheme_type='instructor_invite'` 且 `status='active'` 的记录

2. **测试注册**：
   - 使用授课人的 `instructor_id` 作为邀请码注册新用户
   - 检查服务器日志，确认：
     - 找到了授课人作为邀请人
     - 找到了授课人推广方案
     - 成功发放了优惠券

3. **验证结果**：
   - 检查数据库中是否创建了优惠券记录
   - 检查 `discount_coupons.source='instructor_invite'`
   - 检查前端是否显示优惠券

### 测试2：通过渠道销售member_id注册

1. **准备测试数据**：
   - 确保有一个渠道销售用户（`role='member'` 且 `channel_user_id IS NOT NULL`）
   - 确保对应的渠道方有激活的推广方案

2. **测试注册**：
   - 使用渠道销售的 `member_id` 作为邀请码注册新用户
   - 检查服务器日志

3. **验证结果**：
   - 检查数据库中是否创建了优惠券记录
   - 检查 `discount_coupons.source='channel_invite'`

### 测试3：通过渠道方ID注册

1. **准备测试数据**：
   - 确保有一个渠道方（`channels` 表中有记录）
   - 确保该渠道方至少有一个渠道销售
   - 确保该渠道方有激活的推广方案

2. **测试注册**：
   - 使用渠道方ID（如 `CH990959`）作为邀请码注册新用户
   - 检查服务器日志

3. **验证结果**：
   - 检查数据库中是否创建了优惠券记录
   - 检查邀请人是否正确设置为渠道销售

### 测试4：通过普通会员member_id注册

1. **准备测试数据**：
   - 确保有一个普通会员（`role='member'` 且 `channel_user_id IS NULL`）
   - 确保 `coupon_schemes` 表中有 `scheme_type='member_invite'` 且 `status='active'` 的记录

2. **测试注册**：
   - 使用普通会员的 `member_id` 作为邀请码注册新用户
   - 检查服务器日志

3. **验证结果**：
   - 检查邀请人和被邀请人都获得了优惠券
   - 检查 `discount_coupons.source='invite_register'`

## 常见问题排查

### 问题1：授课人推广优惠券未发放

**可能原因**：
1. 授课人推广方案不存在或未激活
2. `instructor_invitee_amount` 为0或负数
3. 邀请码匹配失败（`instructor_id` 不匹配）

**排查步骤**：
1. 检查服务器日志，查找 `[授课人优惠券发放]` 相关日志
2. 检查 `coupon_schemes` 表中是否有激活的授课人推广方案
3. 检查用户注册时的邀请码是否正确匹配到授课人

### 问题2：渠道推广优惠券未发放

**可能原因**：
1. 渠道推广方案不存在或未激活
2. `channel_code` 不匹配
3. 渠道方没有渠道销售

**排查步骤**：
1. 检查服务器日志，查找 `[渠道优惠券发放]` 相关日志
2. 检查 `channel_promotion_schemes` 表中是否有对应 `channel_code` 的激活方案
3. 检查 `channels` 表中渠道方的 `channel_code` 是否正确

### 问题3：普通会员推广优惠券未发放

**可能原因**：
1. 会员推广方案不存在或未激活
2. 邀请人被识别为渠道销售（`channel_user_id IS NOT NULL`）

**排查步骤**：
1. 检查服务器日志
2. 检查 `coupon_schemes` 表中是否有激活的会员推广方案
3. 检查邀请人的 `channel_user_id` 是否为 `NULL`

## 日志关键字

在服务器日志中查找以下关键字来排查问题：

- `[授课人推广]` - 授课人推广信息设置
- `[授课人优惠券发放]` - 授课人优惠券发放流程
- `[渠道销售推广]` - 渠道销售推广信息设置
- `[渠道优惠券发放]` - 渠道优惠券发放流程
- `[注册] 找到会员推广方案` - 会员推广方案查找
- `✓ 已为被邀请人` - 成功发放优惠券
- `⚠️` - 警告信息
- `错误` - 错误信息

