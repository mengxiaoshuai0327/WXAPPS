# 小程序前端和数据库逻辑复盘文档

## 一、用户角色体系

### 1.1 基础角色（users.role字段）

| 角色 | role值 | 说明 | 标识字段 |
|------|--------|------|----------|
| 游客 | `visitor` | 未注册用户 | - |
| 会员 | `member` | 普通会员 | `member_id` (M + 8位数字) |
| 授课人 | `instructor` | 授课老师 | `instructor_id` |

### 1.2 扩展角色（渠道销售）

**渠道销售（Channel Sales）**：
- **识别方式**：`role = 'member'` **且** `channel_user_id IS NOT NULL`
- **特征**：
  - 在 `users` 表中 `role` 仍然是 `'member'`
  - 通过 `channel_user_id` 字段关联到 `channels` 表（渠道方信息）
  - 可以使用自己的 `member_id` 作为邀请码邀请其他用户注册
  - 在管理后台显示时标识为"渠道销售"

**渠道方（Channel）**：
- 存储在 `channels` 表中，**不在 `users` 表中**
- 有 `channel_code` 和 `channel_name` 字段
- 渠道销售的 `channel_user_id` 指向 `channels.id`

### 1.3 关键字段说明

```sql
-- users表关键字段
role ENUM('visitor', 'member', 'instructor')  -- 基础角色
channel_user_id INT                           -- 如果用户是渠道销售，指向channels.id
inviter_id INT                                -- 邀请人ID（指向users.id）
promotion_type ENUM('instructor', 'channel')  -- 推广类型
instructor_id_for_promotion VARCHAR(50)       -- 如果是授课人推广，记录授课人ID
channel_name_for_promotion VARCHAR(200)       -- 如果是渠道推广，记录渠道名称
channel_sales_id_for_promotion VARCHAR(50)    -- 渠道销售ID（member_id）
channel_sales_name_for_promotion VARCHAR(100) -- 渠道销售姓名
```

---

## 二、邀请关系逻辑

### 2.1 邀请码匹配规则

**注册时（auth.js:380-456行）**：

1. **会员邀请码**：通过 `member_id` 匹配
   ```sql
   SELECT * FROM users WHERE member_id = ? AND role = 'member'
   ```
   - 匹配结果可能是：普通会员 或 渠道销售

2. **授课人邀请码**：通过 `instructor_id` 匹配
   ```sql
   SELECT * FROM users WHERE instructor_id = ? AND role = 'instructor'
   ```

### 2.2 邀请人类型判断

```javascript
if (inviter_role === 'instructor') {
  // 授课人推广
  promotion_type = 'instructor'
} else if (inviter_role === 'member' && inviter_channel_user_id) {
  // 渠道销售推广（关键：检查 channel_user_id）
  promotion_type = 'channel'
} else if (inviter_role === 'member' && !inviter_channel_user_id) {
  // 普通会员推广
  // 不设置 promotion_type
}
```

### 2.3 邀请记录创建（invitations表）

```sql
INSERT INTO invitations (inviter_id, invitee_id, invite_code, status, registered_at)
VALUES (?, ?, ?, 'registered', NOW())
```

**关键点**：
- `invite_code` 可以是 `member_id` 或 `instructor_id`
- `inviter_id` 指向 `users.id`
- `invitee_id` 指向 `users.id`

---

## 三、优惠券发放逻辑

### 3.1 优惠券来源类型（discount_coupons.source）

| source值 | 说明 | 发放对象 |
|----------|------|----------|
| `invite_register` | 邀请注册奖励 | 邀请人或被邀请人 |
| `invite_purchase` | 邀请购券奖励 | 邀请人（仅普通会员邀请） |
| `instructor_invite` | 授课人邀请奖励 | 被邀请人 |
| `channel_invite` | 渠道邀请奖励 | 被邀请人 |
| `admin_special` | 特殊推广（管理员发放） | 指定用户 |

### 3.2 注册时优惠券发放规则

#### 情况1：普通会员邀请（auth.js:618-693行）

**条件**：`inviter_role === 'member' && !inviter_channel_user_id`

**发放规则**：
1. **邀请人**：获得注册奖励优惠券（`source='invite_register'`）
   - 金额：从 `coupon_schemes.member_inviter_register_amount` 获取（默认100元）
   - 有效期：从 `coupon_schemes.inviter_expiry_days` 获取（默认90天）

2. **被邀请人**：获得注册奖励优惠券（`source='invite_register'`）
   - 金额：从 `coupon_schemes.member_invitee_amount` 获取（默认500元）
   - 有效期：从 `coupon_schemes.invitee_expiry_days` 获取（默认30天）

#### 情况2：授课人邀请（auth.js:699-750行）

**条件**：`inviter_role === 'instructor'`

**发放规则**：
1. **邀请人**：**不发放**优惠券
2. **被邀请人**：获得授课人推广优惠券（`source='instructor_invite'`）
   - 金额：从 `coupon_schemes.instructor_invitee_amount` 获取
   - 有效期：从 `coupon_schemes.invitee_expiry_days` 获取
   - 记录 `instructor_id_for_promotion` 和 `instructor_name_for_promotion`

#### 情况3：渠道销售邀请（auth.js:758-840行）

**条件**：`inviter_role === 'member' && inviter_channel_user_id`

**发放规则**：
1. **邀请人（渠道销售）**：**不发放**优惠券
2. **被邀请人**：获得渠道推广优惠券（`source='channel_invite'`）
   - 通过 `inviter_channel_user_id` 查找 `channels.channel_code`
   - 通过 `channel_code` 查找 `channel_promotion_schemes` 表
   - 金额：从 `channel_promotion_schemes.amount` 获取
   - 有效期：从 `channel_promotion_schemes.expiry_days` 获取
   - 记录 `channel_name_for_promotion`、`channel_sales_id_for_promotion`、`channel_sales_name_for_promotion`

### 3.3 首次购买时优惠券发放规则（tickets.js:559-606行）

**条件**：被邀请人首次购买课券 且 邀请人是普通会员（非渠道销售）

**发放规则**：
- **邀请人**：获得购券奖励优惠券（`source='invite_purchase'`）
  - 金额：从 `coupon_schemes.member_inviter_purchase_amount` 获取（默认500元）
  - 有效期：从 `coupon_schemes.inviter_expiry_days` 获取（默认90天）

**注意**：
- 授课人邀请和渠道销售邀请，**不给邀请人发放购券奖励**

---

## 四、管理后台显示逻辑

### 4.1 用户列表（admin/routes/admin/users.js）

#### 用户角色显示

```javascript
// 判断是否为渠道销售
is_channel_sales = user.role === 'member' && !!user.channel_user_id

// 显示逻辑
if (is_channel_sales) {
  role_display = "渠道销售"  // 黄色标签
} else {
  role_display = role === 'member' ? '会员' : role === 'instructor' ? '授课人' : '游客'
}
```

#### 邀请人角色显示（关键问题所在）

```javascript
// 查询时获取邀请人的 channel_user_id
u_inviter.channel_user_id as inviter_channel_user_id

// 判断邀请人是否为渠道销售
const hasChannelUserId = inviter_channel_user_id != null && 
                         inviter_channel_user_id !== '' && 
                         inviter_channel_user_id !== 0 &&
                         !isNaN(inviter_channel_user_id)
const isInviterChannelSales = inviter_role === 'member' && hasChannelUserId

// 显示逻辑
if (isInviterChannelSales) {
  inviter_role = 'channel'
  inviter_role_text = '渠道方'  // ⚠️ 这里应该显示"渠道方"
} else if (inviter_role === 'instructor') {
  inviter_role = 'instructor'
  inviter_role_text = '授课人'
} else if (inviter_role === 'member') {
  inviter_role = 'member'
  inviter_role_text = '会员'
}
```

**问题分析**：
- 如果数据库中的 `inviter_channel_user_id` 为 `NULL` 或 `0`，则无法识别为渠道销售
- 需要确保"财销一"和"联想1"的 `channel_user_id` 字段已正确设置

### 4.2 邀请管理列表（admin/routes/admin/invitations.js）

#### 邀请人信息显示

```javascript
// 构建邀请人显示信息
if (inviter_role === 'instructor') {
  inviter_display_id = inviter_instructor_id
  inviter_role_text = '授课人'
} else if (inviter_role === 'member' && inviter_channel_user_id) {
  inviter_display_id = inviter_member_id + ' (' + inviter_channel_name + ')'
  inviter_role_text = '渠道销售'  // 在邀请列表中显示为"渠道销售"
} else {
  inviter_display_id = inviter_member_id
  inviter_role_text = '会员'
}
```

#### 优惠券统计

**邀请人优惠券**：
- 注册奖励：查询 `source='invite_register'` 且 `user_id=inviter_id` 且 `source_user_id=invitee_id`
- 购买奖励：查询 `source='invite_purchase'` 且 `user_id=inviter_id` 且 `source_user_id=invitee_id`

**被邀请人优惠券**：
- 查询 `user_id=invitee_id` 且 `source_user_id=inviter_id` 且 `source IN ('channel_invite', 'instructor_invite')`

---

## 五、数据流图

### 5.1 注册流程

```
用户注册（填写邀请码）
    ↓
匹配邀请人（member_id 或 instructor_id）
    ↓
判断邀请人类型
    ├─ 普通会员 (role='member' && channel_user_id IS NULL)
    │   ├─ 给邀请人发放注册奖励优惠券 (invite_register)
    │   └─ 给被邀请人发放注册奖励优惠券 (invite_register)
    │
    ├─ 渠道销售 (role='member' && channel_user_id IS NOT NULL)
    │   ├─ 不给我邀请人发放优惠券
    │   └─ 给被邀请人发放渠道推广优惠券 (channel_invite)
    │       └─ 通过 channel_user_id → channels.channel_code → channel_promotion_schemes
    │
    └─ 授课人 (role='instructor')
        ├─ 不给邀请人发放优惠券
        └─ 给被邀请人发放授课人推广优惠券 (instructor_invite)
            └─ 从 coupon_schemes 表获取配置
```

### 5.2 首次购买流程

```
被邀请人首次购买课券
    ↓
检查是否有邀请人
    ↓
判断邀请人类型
    ├─ 普通会员 (role='member' && channel_user_id IS NULL)
    │   └─ 给邀请人发放购券奖励优惠券 (invite_purchase)
    │
    ├─ 渠道销售 (role='member' && channel_user_id IS NOT NULL)
    │   └─ 不给邀请人发放优惠券
    │
    └─ 授课人 (role='instructor')
        └─ 不给邀请人发放优惠券
```

---

## 六、关键问题排查清单

### 6.1 渠道销售识别问题

**问题**：用户列表中"财销一"和"联想1"的邀请人角色显示为"会员"而不是"渠道方"

**排查步骤**：

1. **检查数据库中这两个用户的 `channel_user_id` 字段**
   ```sql
   SELECT id, member_id, role, channel_user_id, nickname, real_name 
   FROM users 
   WHERE member_id IN ('M85101163', 'M96143951');
   ```
   
   **预期结果**：
   - `role` 应该是 `'member'`
   - `channel_user_id` 应该不为 `NULL`，应该指向 `channels.id`

2. **如果 `channel_user_id` 为 `NULL`，需要设置**
   ```sql
   -- 先查找渠道方ID
   SELECT id, channel_code, channel_name FROM channels 
   WHERE channel_name LIKE '%财销%' OR channel_name LIKE '%联想%';
   
   -- 然后更新用户（假设渠道方ID为X）
   UPDATE users SET channel_user_id = X WHERE member_id = 'M85101163';
   UPDATE users SET channel_user_id = X WHERE member_id = 'M96143951';
   ```

3. **检查后端查询是否正确获取了 `inviter_channel_user_id`**
   - 查看后端日志中的调试输出
   - 确认 SQL 查询中包含了 `u_inviter.channel_user_id as inviter_channel_user_id`

4. **检查前端是否正确使用了 `inviter_role_text`**
   - 前端应该优先使用 `inviter_role_text` 字段
   - 如果 `inviter_role === 'channel'`，应该显示"渠道方"

---

## 七、数据库表关系图

```
users (用户表)
  ├─ inviter_id → users.id (邀请人)
  ├─ channel_user_id → channels.id (渠道销售关联渠道方)
  └─ role: 'member' | 'instructor' | 'visitor'

channels (渠道方表)
  ├─ id (主键)
  ├─ channel_code (渠道编码)
  └─ channel_name (渠道名称)

invitations (邀请表)
  ├─ inviter_id → users.id (邀请人)
  ├─ invitee_id → users.id (被邀请人)
  └─ invite_code (邀请码：member_id 或 instructor_id)

discount_coupons (优惠券表)
  ├─ user_id → users.id (优惠券拥有者)
  ├─ source_user_id → users.id (来源用户)
  ├─ source: 'invite_register' | 'invite_purchase' | 'instructor_invite' | 'channel_invite'
  └─ promotion_type: 'instructor' | 'channel'
```

---

## 八、前端显示映射表

| 后端字段值 | 前端显示文本 | 标签颜色 |
|-----------|-------------|----------|
| `role='member'` 且 `channel_user_id IS NULL` | 会员 | 绿色 (success) |
| `role='member'` 且 `channel_user_id IS NOT NULL` | 渠道销售 | 橙色 (warning) |
| `role='instructor'` | 授课人 | 橙色 (warning) |
| `inviter_role='member'` 且 `inviter_channel_user_id IS NULL` | 会员 | 绿色 |
| `inviter_role='member'` 且 `inviter_channel_user_id IS NOT NULL` | **渠道方** | 橙色 |
| `inviter_role='instructor'` | 授课人 | 绿色 |

---

## 九、修复建议

### 9.1 立即需要检查的数据

1. **检查"财销一"和"联想1"的 `channel_user_id`**
   - 如果为 `NULL`，需要设置正确的渠道方ID

2. **检查对应的渠道方记录是否存在**
   - 确保 `channels` 表中有对应的渠道方记录
   - 确保 `channel_code` 字段不为空

3. **检查渠道推广方案是否存在**
   - 确保 `channel_promotion_schemes` 表中有对应的激活方案

### 9.2 代码逻辑确认

代码逻辑本身是正确的，问题在于：
1. 数据库中用户的 `channel_user_id` 可能未设置
2. 或者查询时字段值传递有问题

建议添加更多日志输出，确认数据传递过程。

