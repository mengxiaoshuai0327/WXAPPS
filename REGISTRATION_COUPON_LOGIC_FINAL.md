# 注册优惠券发放完整逻辑文档（最终版）

## 一、需求总结

### 注册邀请码匹配规则

用户可以通过以下方式注册：
1. **扫描二维码**：二维码中包含邀请码（member_id、instructor_id或渠道方ID）
2. **手动填写邀请码**：在注册页面填写邀请码

邀请码匹配顺序：
1. 首先在【用户列表】中查找 `member_id` 或 `instructor_id`
2. 如果未找到，在【渠道方列表】中查找渠道方ID（通过 `channel_code`）

### 三种推广方式的优惠券发放规则

#### 1. 会员推广
- **邀请码类型**：会员的 `member_id`（如 `M85101163`）
- **判断条件**：找到的用户 `role='member'` 且 `channel_user_id IS NULL`
- **优惠券方案**：从 `coupon_schemes` 表中查找 `scheme_type='member_invite'` 且 `status='active'`
- **优惠券发放**：
  - 邀请人：获得注册奖励优惠券（`source='invite_register'`）
  - 被邀请人：获得注册奖励优惠券（`source='invite_register'`）

#### 2. 授课人推广
- **邀请码类型**：授课人的 `instructor_id`（如 `I140866389` 或 `140866389`）
- **判断条件**：找到的用户 `role='instructor'`
- **优惠券方案**：从 `coupon_schemes` 表中查找 `scheme_type='instructor_invite'` 且 `status='active'`
- **优惠券发放**：
  - 被邀请人：获得注册奖励优惠券（`source='instructor_invite'`）
  - 邀请人：不发放优惠券（但被邀请人首次购买时可享受折扣）

#### 3. 渠道销售推广
- **邀请码类型**：
  - 渠道销售的 `member_id`（如 `M96143951`）
  - 渠道方ID（如 `CH990959` 或 `channel_990959`）
- **判断条件**：
  - 如果通过 `member_id` 匹配：找到的用户 `role='member'` 且 `channel_user_id IS NOT NULL`
  - 如果通过渠道方ID匹配：找到渠道方后，查找该渠道方的渠道销售（选择第一个）
- **查找渠道方**：
  - 通过渠道销售的 `channel_user_id` 字段（指向 `channels.id`）
  - 在【渠道方列表】（`channels` 表）中查找对应的渠道方
- **优惠券方案**：从 `channel_promotion_schemes` 表中查找 `channel_code=?` 且 `status='active'`
- **优惠券发放**：
  - 被邀请人：获得注册奖励优惠券（`source='channel_invite'`）
  - 邀请人（渠道销售）：不发放优惠券
- **重要**：记录邀请人角色为"**渠道方**"（不是"渠道销售"），因为优惠券是按照渠道方的推广方案发放的

## 二、当前代码实现

### 邀请码匹配逻辑（`backend/routes/auth.js` 第381-476行）

```javascript
// 1. 第一优先级：member_id匹配
SELECT * FROM users WHERE member_id = ? AND role = 'member'

// 2. 第二优先级：instructor_id匹配
SELECT * FROM users WHERE instructor_id = ? AND role = 'instructor'
// 支持两种格式：I140866389 或 140866389（自动添加I前缀）

// 3. 第三优先级：渠道方ID匹配
SELECT * FROM channels WHERE channel_code = ?
// 找到渠道方后，查找该渠道方的渠道销售
SELECT * FROM users WHERE channel_user_id = ? AND role = 'member' ORDER BY created_at ASC LIMIT 1
```

### 推广信息设置（第485-508行）

- **授课人**：`promotion_type='instructor'`
- **渠道销售**：`promotion_type='channel'`，查询渠道方信息
- **普通会员**：不设置 `promotion_type`

### 优惠券发放逻辑

#### 普通会员邀请（第701-776行）
- 查找 `coupon_schemes`（`scheme_type='member_invite'`）
- 给邀请人和被邀请人都发放优惠券

#### 授课人邀请（第781-854行）
- 查找 `coupon_schemes`（`scheme_type='instructor_invite'`）
- 只给被邀请人发放优惠券

#### 渠道销售邀请（第861-940行）
- 通过 `inviter.channel_user_id` → `channels.id` → `channels.channel_code`
- 查找 `channel_promotion_schemes`（`channel_code=?`）
- 只给被邀请人发放优惠券

### 优惠券验证（第954-978行）

在事务提交前，验证优惠券是否成功发放，如果未找到记录，会记录错误警告。

## 三、数据库表结构

### users表相关字段
- `inviter_id`：邀请人用户ID
- `promotion_type`：推广类型（'instructor' | 'channel' | null）
- `instructor_id_for_promotion`：授课人ID（用于推广）
- `instructor_name_for_promotion`：授课人姓名（用于推广）
- `channel_name_for_promotion`：渠道方名称（用于推广）
- `channel_sales_id_for_promotion`：渠道销售member_id（用于推广）
- `channel_sales_name_for_promotion`：渠道销售姓名（用于推广）
- `channel_user_id`：渠道销售所属渠道方ID（仅在渠道销售用户中存在）

### discount_coupons表相关字段
- `user_id`：优惠券拥有者
- `source`：优惠券来源（'invite_register' | 'instructor_invite' | 'channel_invite'）
- `source_user_id`：来源用户ID（邀请人ID）
- `promotion_type`：推广类型
- `instructor_id_for_promotion`、`instructor_name_for_promotion`：授课人推广信息
- `channel_name_for_promotion`、`channel_sales_id_for_promotion`、`channel_sales_name_for_promotion`：渠道推广信息

### channels表
- `id`：渠道方ID（主键）
- `channel_code`：渠道编码（如 `channel_990959`）
- `channel_name`：渠道名称（如 `联想有限公司`）

### channel_promotion_schemes表
- `channel_code`：渠道编码（关联 `channels.channel_code`）
- `amount`：优惠券金额
- `expiry_days`：有效期天数
- `status`：状态（'active' | 'inactive'）

## 四、关键逻辑确认

### ✅ 已正确实现

1. **邀请码匹配**：
   - ✅ 支持 member_id、instructor_id、渠道方ID三种匹配方式
   - ✅ 支持 instructor_id 的两种格式（I前缀和纯数字）

2. **渠道销售识别**：
   - ✅ 通过 `channel_user_id IS NOT NULL` 识别渠道销售
   - ✅ 通过 `channel_user_id` 查找对应的渠道方
   - ✅ 通过渠道方的 `channel_code` 查找推广方案

3. **优惠券发放**：
   - ✅ 三种推广方式都能正确发放优惠券
   - ✅ 使用正确的推广方案表
   - ✅ 设置正确的 `source` 字段

4. **邀请人角色记录**：
   - ✅ 渠道销售的邀请人角色在后台显示为"渠道方"（`backend/routes/admin/users.js` 和 `backend/routes/admin/invitations.js`）

### ⚠️ 需要验证

1. **优惠券发放验证**：
   - 已添加验证逻辑，在事务提交前检查优惠券是否成功发放
   - 如果未找到，会记录错误警告

2. **错误处理**：
   - 优惠券发放失败时，错误会被捕获但不影响注册流程
   - 已添加详细的错误日志

## 五、排查步骤

### 如果第二个用户无法获得优惠券，请检查：

1. **服务器日志**：
   - 查找 `[注册] 开始匹配邀请码`
   - 查找 `[注册] ✓ 找到授课人` 或 `[注册] 通过member_id匹配成功`
   - 查找 `[授课人优惠券发放]` 或 `[渠道优惠券发放]` 相关日志
   - 查找 `✓ [验证] 优惠券发放成功` 或 `❌ [验证] 优惠券发放失败`

2. **数据库查询**：
   ```sql
   -- 检查用户注册信息
   SELECT id, member_id, real_name, inviter_id, promotion_type,
          instructor_id_for_promotion, channel_name_for_promotion
   FROM users 
   WHERE real_name = '用户名'
   ORDER BY created_at DESC LIMIT 1;

   -- 检查优惠券
   SELECT * FROM discount_coupons 
   WHERE user_id = (SELECT id FROM users WHERE real_name = '用户名' ORDER BY created_at DESC LIMIT 1)
   ORDER BY created_at DESC;

   -- 检查推广方案
   SELECT * FROM coupon_schemes WHERE scheme_type = 'instructor_invite' AND status = 'active';
   SELECT * FROM channel_promotion_schemes WHERE status = 'active';
   ```

3. **可能的问题**：
   - 推广方案不存在或未激活
   - 推广方案的金额为0
   - 优惠券插入失败（数据库错误）
   - 事务回滚

## 六、代码位置总结

- **邀请码匹配**：`backend/routes/auth.js` 第381-476行
- **推广信息设置**：第485-508行
- **普通会员优惠券发放**：第701-776行
- **授课人优惠券发放**：第781-854行
- **渠道销售优惠券发放**：第861-940行
- **优惠券验证**：第954-978行
- **邀请人角色显示**：`backend/routes/admin/users.js` 第124-158行、`backend/routes/admin/invitations.js` 第117-138行

