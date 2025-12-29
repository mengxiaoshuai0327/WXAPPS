# 注册时优惠券发放问题排查和解决方案

## 问题描述

用户注册时填写了邀请码，但未收到优惠券。

## 原因分析

注册代码会根据邀请人的角色（会员、授课人、渠道销售）查找对应的推广方案配置。如果找不到激活的推广方案，就不会发放优惠券。

### 授课人邀请

如果邀请人是授课人（`role='instructor'`），系统会查找 `coupon_schemes` 表中：
- `scheme_type='instructor_invite'`
- `status='active'`

的记录。如果找不到，就不会发放优惠券。

### 会员邀请

如果邀请人是普通会员（`role='member'` 且不是渠道销售），系统会查找 `coupon_schemes` 表中：
- `scheme_type='member_invite'`
- `status='active'`

的记录。如果找不到，就不会发放优惠券。

## 解决方案

### 1. 检查数据库配置

首先检查 `coupon_schemes` 表中是否有对应的推广方案：

```sql
-- 检查授课人推广方案
SELECT * FROM coupon_schemes WHERE scheme_type = 'instructor_invite';

-- 检查会员推广方案
SELECT * FROM coupon_schemes WHERE scheme_type = 'member_invite';
```

### 2. 创建或激活推广方案

如果表中没有对应的方案，需要创建。如果存在但状态不是 `active`，需要激活。

#### 创建授课人推广方案

```sql
-- 检查是否已存在
SELECT * FROM coupon_schemes WHERE scheme_type = 'instructor_invite';

-- 如果不存在，创建（根据实际需求调整金额和有效期）
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
) ON DUPLICATE KEY UPDATE status = 'active';

-- 如果已存在但状态为 inactive，激活它
UPDATE coupon_schemes 
SET status = 'active' 
WHERE scheme_type = 'instructor_invite' AND status = 'inactive';
```

#### 创建会员推广方案

```sql
-- 检查是否已存在
SELECT * FROM coupon_schemes WHERE scheme_type = 'member_invite';

-- 如果不存在，创建（根据实际需求调整金额和有效期）
INSERT INTO coupon_schemes (
  scheme_type,
  member_inviter_register_amount,
  member_inviter_purchase_amount,
  member_invitee_amount,
  inviter_expiry_days,
  invitee_expiry_days,
  status,
  created_at,
  updated_at
) VALUES (
  'member_invite',
  100.00,  -- 邀请人注册奖励（根据实际需求调整）
  500.00,  -- 邀请人购买奖励（根据实际需求调整）
  500.00,  -- 被邀请人注册奖励（根据实际需求调整）
  90,      -- 邀请人优惠券有效期天数（根据实际需求调整）
  30,      -- 被邀请人优惠券有效期天数（根据实际需求调整）
  'active',
  NOW(),
  NOW()
) ON DUPLICATE KEY UPDATE status = 'active';

-- 如果已存在但状态为 inactive，激活它
UPDATE coupon_schemes 
SET status = 'active' 
WHERE scheme_type = 'member_invite' AND status = 'inactive';
```

### 3. 验证配置

注册后检查日志，应该看到类似以下的信息：

- 如果找到方案并成功发放：
  ```
  [注册] 找到授课人推广方案: ID=1, 被邀请人金额=¥600, 有效期=30天
  ✓ 已为被邀请人 123 发放授课人推广优惠券：金额¥600，有效期30天（邀请人：34）
  ```

- 如果未找到方案：
  ```
  ⚠️  未找到激活的授课人推广方案 (scheme_type='instructor_invite', status='active')，无法为被邀请人 123 发放优惠券。邀请人ID: 34
  ⚠️  请在 coupon_schemes 表中创建或激活授课人推广方案，否则被邀请人将无法获得注册奖励优惠券。
  ```

### 4. 补发优惠券（可选）

如果已经注册的用户没有收到优惠券，可以使用补发脚本：

```bash
cd backend
node scripts/fix-missing-coupons.js
```

或者手动为特定用户补发（需要修改脚本中的用户ID）。

## 注意事项

1. **推广方案金额必须大于0**：即使找到了激活的方案，如果 `instructor_invitee_amount` 或 `member_invitee_amount` 为 0 或 NULL，也不会发放优惠券。

2. **方案状态必须是 active**：只有状态为 `active` 的方案才会被使用。

3. **避免重复发放**：系统会检查用户是否已经存在相同来源的优惠券，避免重复发放。

## 代码改进

已在 `backend/routes/auth.js` 中添加了详细的日志，可以帮助排查问题：

- 记录是否找到推广方案
- 记录方案配置（金额、有效期）
- 记录发放结果
- 记录警告信息（未找到方案或金额为0）

查看后端服务器日志可以看到详细的注册和优惠券发放过程。

