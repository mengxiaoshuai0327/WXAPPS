# 优惠券发放完整逻辑文档

## 一、三种推广方式

### 1. 会员推广
- **邀请码格式**：`member_id`（如 `M85101163`）
- **邀请人角色**：普通会员（`role='member'` 且 `channel_user_id IS NULL`）
- **优惠券发放**：
  - 邀请人：获得注册奖励优惠券（从 `coupon_schemes.member_inviter_register_amount`）
  - 被邀请人：获得注册奖励优惠券（从 `coupon_schemes.member_invitee_amount`）
- **优惠券来源**：`source='invite_register'`
- **推广方案表**：`coupon_schemes`（`scheme_type='member_invite'`）

### 2. 授课人推广
- **邀请码格式**：`instructor_id`（如 `I140866389` 或 `140866389`）
- **邀请人角色**：授课人（`role='instructor'`）
- **优惠券发放**：
  - 被邀请人：获得注册奖励优惠券（从 `coupon_schemes.instructor_invitee_amount`）
  - 邀请人：**不发放**优惠券（但被邀请人首次购买时可享受折扣）
- **优惠券来源**：`source='instructor_invite'`
- **推广方案表**：`coupon_schemes`（`scheme_type='instructor_invite'`）

### 3. 渠道销售推广
- **邀请码格式**：
  - 渠道销售的 `member_id`（如 `M96143951`）
  - 渠道方ID（如 `CH990959` 或 `channel_990959`）
- **邀请人角色**：渠道销售（`role='member'` 且 `channel_user_id IS NOT NULL`）
- **优惠券发放**：
  - 被邀请人：获得注册奖励优惠券（从 `channel_promotion_schemes.amount`）
  - 邀请人（渠道销售）：**不发放**优惠券
- **优惠券来源**：`source='channel_invite'`
- **推广方案表**：`channel_promotion_schemes`（通过 `channel_code` 匹配）
- **重要**：在后台显示时，邀请人角色应显示为"**渠道方**"（不是"渠道销售"）

## 二、注册流程

### 步骤1：邀请码匹配（优先级顺序）

1. **第一优先级**：`member_id` 匹配
   ```sql
   SELECT * FROM users WHERE member_id = ? AND role = 'member'
   ```
   - 可能是普通会员或渠道销售（通过 `channel_user_id` 区分）

2. **第二优先级**：`instructor_id` 匹配
   ```sql
   SELECT * FROM users WHERE instructor_id = ? AND role = 'instructor'
   ```
   - 支持两种格式：`I140866389` 或 `140866389`（自动添加I前缀）

3. **第三优先级**：渠道方ID匹配
   - 支持格式：`CH990959` → 转换为 `channel_990959`
   - 找到渠道方后，查找该渠道方的第一个渠道销售作为邀请人

### 步骤2：设置推广信息

根据邀请人角色设置推广信息：

- **授课人**：
  - `promotion_type = 'instructor'`
  - `instructor_id_for_promotion = inviter.instructor_id`
  - `instructor_name_for_promotion = inviter.real_name || inviter.nickname`

- **渠道销售**：
  - `promotion_type = 'channel'`
  - `channel_sales_id_for_promotion = inviter.member_id`
  - `channel_sales_name_for_promotion = inviter.real_name || inviter.nickname`
  - 查询渠道方信息：
    - `channel_name_for_promotion = channel.channel_name`
    - `channel_code_for_promotion = channel.channel_code`

- **普通会员**：
  - `promotion_type = null`（或根据业务需求设置）

### 步骤3：创建用户记录

插入用户记录，包含：
- `inviter_id`：邀请人用户ID
- `promotion_type`：推广类型
- `instructor_id_for_promotion`、`instructor_name_for_promotion`：授课人推广信息
- `channel_name_for_promotion`、`channel_sales_id_for_promotion`、`channel_sales_name_for_promotion`：渠道推广信息

### 步骤4：发放优惠券（在事务内）

#### 4.1 普通会员邀请
- 查找 `coupon_schemes`（`scheme_type='member_invite'`，`status='active'`）
- 给邀请人发放：`source='invite_register'`
- 给被邀请人发放：`source='invite_register'`

#### 4.2 授课人邀请
- 查找 `coupon_schemes`（`scheme_type='instructor_invite'`，`status='active'`）
- 给被邀请人发放：`source='instructor_invite'`
- 邀请人不发放

#### 4.3 渠道销售邀请
- 通过 `inviter.channel_user_id` → `channels.id` → `channels.channel_code`
- 查找 `channel_promotion_schemes`（`channel_code=?`，`status='active'`）
- 给被邀请人发放：`source='channel_invite'`
- 邀请人不发放

### 步骤5：验证优惠券发放

在事务提交前，验证优惠券是否成功发放：
- 查询数据库中是否存在对应的优惠券记录
- 如果不存在，记录错误警告

## 三、关键代码位置

### 邀请码匹配
- `backend/routes/auth.js` 第381-476行

### 推广信息设置
- `backend/routes/auth.js` 第485-508行

### 优惠券发放
- 普通会员：第700-775行
- 授课人：第781-854行
- 渠道销售：第861-940行

### 优惠券验证
- `backend/routes/auth.js` 第953-975行（新增）

## 四、可能的问题和解决方案

### 问题1：第二个用户无法获得优惠券

**可能原因**：
1. 优惠券插入失败但错误被静默捕获
2. 重复检查逻辑误判
3. 推广方案不存在或未激活
4. 事务回滚

**排查步骤**：
1. 查看服务器日志，查找 `[授课人优惠券发放]` 相关日志
2. 查看 `[验证]` 日志，确认优惠券是否成功发放
3. 执行SQL查询，检查数据库中的实际数据

### 问题2：邀请人角色显示不正确

**需求**：渠道销售的邀请人角色应显示为"渠道方"

**实现位置**：
- `backend/routes/admin/users.js` 第124-158行：用户列表显示逻辑
- `backend/routes/admin/invitations.js` 第117-138行：邀请列表显示逻辑

**判断逻辑**：
```javascript
if (inviter_role === 'member' && inviter_channel_user_id) {
  // 显示为"渠道方"
  inviter_role_text = '渠道方';
}
```

## 五、数据库表结构

### users表相关字段
- `inviter_id`：邀请人用户ID
- `promotion_type`：推广类型（'instructor' | 'channel' | null）
- `instructor_id_for_promotion`：授课人ID（用于推广）
- `instructor_name_for_promotion`：授课人姓名（用于推广）
- `channel_name_for_promotion`：渠道方名称（用于推广）
- `channel_sales_id_for_promotion`：渠道销售member_id（用于推广）
- `channel_sales_name_for_promotion`：渠道销售姓名（用于推广）

### discount_coupons表相关字段
- `user_id`：优惠券拥有者
- `source`：优惠券来源（'invite_register' | 'instructor_invite' | 'channel_invite'）
- `source_user_id`：来源用户ID（邀请人ID）
- `promotion_type`：推广类型
- `instructor_id_for_promotion`、`instructor_name_for_promotion`：授课人推广信息
- `channel_name_for_promotion`、`channel_sales_id_for_promotion`、`channel_sales_name_for_promotion`：渠道推广信息

## 六、测试检查清单

### 测试1：通过授课人ID注册（第一个用户）
- [ ] 找到授课人作为邀请人
- [ ] 设置 `promotion_type='instructor'`
- [ ] 发放优惠券（`source='instructor_invite'`）
- [ ] 验证日志显示"优惠券发放成功"

### 测试2：通过授课人ID注册（第二个用户）
- [ ] 找到授课人作为邀请人
- [ ] 设置 `promotion_type='instructor'`
- [ ] **发放优惠券**（`source='instructor_invite'`）
- [ ] 验证日志显示"优惠券发放成功"
- [ ] 数据库中存在优惠券记录

### 测试3：通过渠道销售member_id注册
- [ ] 找到渠道销售作为邀请人
- [ ] 通过 `channel_user_id` 找到渠道方
- [ ] 设置 `promotion_type='channel'`
- [ ] 发放优惠券（`source='channel_invite'`）
- [ ] 后台显示邀请人角色为"渠道方"

### 测试4：通过渠道方ID注册
- [ ] 找到渠道方
- [ ] 找到该渠道方的第一个渠道销售作为邀请人
- [ ] 设置 `promotion_type='channel'`
- [ ] 发放优惠券（`source='channel_invite'`）
- [ ] 后台显示邀请人角色为"渠道方"

## 七、已添加的调试功能

1. **详细日志**：
   - 邀请码匹配过程的每一步
   - 优惠券发放过程的每一步
   - 重复检查的详细输出
   - 错误堆栈跟踪

2. **优惠券验证**：
   - 在事务提交前验证优惠券是否成功发放
   - 如果未找到，记录错误警告

3. **错误处理**：
   - 详细的错误日志
   - 错误详情和堆栈跟踪

