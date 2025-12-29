# 渠道推广优惠券发放问题修复指南

## 问题描述

用户通过渠道销售的member_id注册时，没有获得渠道推广优惠券。

## 代码逻辑说明

注册时的渠道推广优惠券发放逻辑（`backend/routes/auth.js`）：

1. **邀请码匹配**（第380-454行）：
   - 通过 `member_id` 或 `instructor_id` 查找邀请人
   - 如果找到邀请人，检查是否有 `channel_user_id`（标识为渠道销售）

2. **渠道销售识别**（第410-426行）：
   - 如果 `inviter_role === 'member' && inviter_channel_user_id` 不为空
   - 识别为渠道销售，设置 `promotion_type = 'channel'`

3. **优惠券发放**（第752-840行）：
   - 如果邀请人是渠道销售（`inviter_role === 'member' && inviter_channel_user_id`）
   - 通过 `channel_user_id` 查找渠道方的 `channel_code`
   - 用 `channel_code` 查找 `channel_promotion_schemes` 表中状态为 `active` 的方案
   - 如果找到方案且 `amount > 0`，则发放优惠券

## 必须满足的条件

1. ✅ **邀请人（渠道销售）必须有 `channel_user_id`**
   - `users.channel_user_id` 必须指向 `channels.id`
   - 如果为 NULL，不会被识别为渠道销售

2. ✅ **渠道方必须有 `channel_code`**
   - `channels.channel_code` 必须不为空
   - 用于匹配 `channel_promotion_schemes.channel_code`

3. ✅ **必须有对应的渠道推广方案**
   - `channel_promotion_schemes.channel_code` 必须与渠道方的 `channel_code` 匹配
   - `channel_promotion_schemes.status` 必须为 `'active'`
   - `channel_promotion_schemes.amount` 必须大于 0

## 排查步骤

### 1. 使用SQL脚本排查

运行 `backend/scripts/fix-channel-coupon-issue.sql` 脚本，检查：
- 邀请人的 `channel_user_id` 是否设置
- 渠道方的 `channel_code` 是否有值
- 是否有对应的激活的渠道推广方案

### 2. 查看服务器日志

注册时会输出详细的日志，搜索以下关键词：
- `[渠道销售推广]`：渠道销售识别
- `[渠道优惠券发放]`：优惠券发放过程
- 如果有错误，会输出 `[渠道优惠券发放] 错误：...`

### 3. 常见问题及解决方案

#### 问题1：邀请人的 `channel_user_id` 为 NULL

**现象：** 邀请人存在，但 `channel_user_id` 为空

**解决方案：**
```sql
-- 1. 查找渠道方ID（根据渠道名称）
SELECT id, channel_code, channel_name FROM channels WHERE channel_name LIKE '%渠道名称%';

-- 2. 更新邀请人的channel_user_id（替换X为实际的渠道方ID）
UPDATE users SET channel_user_id = X WHERE member_id = 'M96143951';
```

#### 问题2：渠道方的 `channel_code` 为空

**现象：** 渠道方存在，但 `channel_code` 为 NULL

**解决方案：**
```sql
-- 更新渠道方的channel_code（替换<渠道方ID>和'<channel_code>'为实际值）
UPDATE channels SET channel_code = '<channel_code>' WHERE id = <渠道方ID>;
```

**注意：** `channel_code` 应该是一个唯一的标识符，通常可以是：
- 渠道名称的拼音或缩写
- 渠道方的某个业务编号
- 任何唯一的字符串

#### 问题3：没有对应的渠道推广方案

**现象：** 渠道方配置正确，但 `channel_promotion_schemes` 表中没有对应的配置

**解决方案：**
1. 登录管理员后台
2. 进入"渠道推广方案管理"
3. 创建新的渠道推广方案：
   - `channel_code`：必须与渠道方的 `channel_code` **完全一致**
   - `channel_name`：渠道名称（如"联想有限公司"）
   - `amount`：优惠券金额（如 500.00）
   - `expiry_days`：有效期天数（如 30）
   - `status`：必须设置为 `active`

**SQL方式（不推荐，建议使用管理后台）：**
```sql
INSERT INTO channel_promotion_schemes (channel_code, channel_name, amount, expiry_days, description, status)
VALUES ('<channel_code>', '<渠道名称>', 500.00, 30, '渠道推广方案', 'active');
```

#### 问题4：渠道推广方案的状态不是 `active`

**现象：** 方案存在，但 `status` 为 `inactive`

**解决方案：**
```sql
-- 激活方案
UPDATE channel_promotion_schemes SET status = 'active' WHERE channel_code = '<channel_code>';
```

#### 问题5：渠道推广方案的金额为 0

**现象：** 方案存在且激活，但 `amount` 为 0

**解决方案：**
```sql
-- 更新金额
UPDATE channel_promotion_schemes SET amount = 500.00 WHERE channel_code = '<channel_code>';
```

## 验证修复

修复后，可以通过以下方式验证：

1. **检查数据配置**：运行SQL脚本确认所有条件都满足
2. **测试注册**：使用新的用户通过渠道销售的member_id注册，查看是否获得优惠券
3. **查看日志**：检查服务器日志中是否有 `✓ 已为被邀请人发放渠道推广优惠券` 的消息

## 已注册用户的补偿

如果用户已经注册但没有获得优惠券，可以手动发放：

```sql
-- 1. 查找用户ID和邀请人ID
SELECT id FROM users WHERE member_id = 'M23201355';  -- 被邀请人
SELECT id FROM users WHERE member_id = 'M96143951';  -- 邀请人

-- 2. 查找渠道推广方案
SELECT * FROM channel_promotion_schemes WHERE channel_code = '<channel_code>' AND status = 'active';

-- 3. 手动发放优惠券（替换相应的值）
INSERT INTO discount_coupons (
    discount_code, user_id, amount, source, source_user_id, 
    start_date, expiry_date, status,
    promotion_type, channel_name_for_promotion, 
    channel_sales_id_for_promotion, channel_sales_name_for_promotion
) VALUES (
    'DC' || DATE_FORMAT(NOW(), '%Y%m%d%H%i%s') || LPAD(FLOOR(RAND() * 10000), 4, '0'),  -- 生成优惠券代码
    <被邀请人ID>,
    <优惠券金额>,
    'channel_invite',
    <邀请人ID>,
    CURDATE(),
    DATE_ADD(CURDATE(), INTERVAL <有效期天数> DAY),
    'unused',
    'channel',
    '<渠道名称>',
    'M96143951',
    '<渠道销售姓名>'
);
```

## 重要提醒

1. **channel_code 必须完全匹配**：渠道方的 `channel_code` 与 `channel_promotion_schemes.channel_code` 必须完全一致（区分大小写）

2. **注册时才会发放**：优惠券只在用户注册时发放，已注册的用户需要手动补偿

3. **查看服务器日志**：所有关键步骤都有日志输出，遇到问题时优先查看日志

