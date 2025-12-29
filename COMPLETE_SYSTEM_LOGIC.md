# 完整系统逻辑梳理文档

## 一、核心概念

### 1.1 用户角色体系

| 角色类型 | users.role | 标识字段 | 说明 |
|---------|-----------|---------|------|
| 游客 | `visitor` | - | 未注册用户 |
| 会员 | `member` | `member_id` (M + 8位数字) | 普通会员 |
| 渠道销售 | `member` + `channel_user_id IS NOT NULL` | `member_id` + `channel_user_id` | 渠道销售（同时是会员） |
| 授课人 | `instructor` | `instructor_id` (I + 8位数字) | 授课老师 |

**注意**：
- 渠道销售在users表中`role='member'`，通过`channel_user_id`字段关联到`channels`表
- 渠道方（公司）存储在`channels`表中，不在users表中

### 1.2 数据库表关系

```
users (用户表)
  ├─ inviter_id → users.id (邀请人用户ID)
  ├─ channel_user_id → channels.id (渠道销售关联渠道方)
  └─ role: 'visitor' | 'member' | 'instructor'

channels (渠道方表)
  ├─ id (主键，渠道方ID)
  ├─ channel_code (渠道编码，如 channel_981189)
  └─ channel_name (渠道名称，如 "财能有限公司")

invitations (邀请表)
  ├─ inviter_id → users.id (邀请人用户ID)
  ├─ invitee_id → users.id (被邀请人用户ID)
  └─ invite_code (邀请码：member_id 或 instructor_id 或 channel_code)

discount_coupons (优惠券表)
  ├─ user_id → users.id (优惠券拥有者)
  ├─ source_user_id → users.id (来源用户ID)
  ├─ source: 'invite_register' | 'invite_purchase' | 'instructor_invite' | 'channel_invite'
  └─ channel_sales_id_for_promotion (渠道销售member_id)
```

---

## 二、注册流程逻辑（需要重新设计）

### 2.1 邀请码匹配策略

**当前问题**：只支持通过member_id和instructor_id注册，不支持通过渠道方ID注册

**需要支持的邀请码类型**：
1. **会员ID** (`member_id`)：格式如 `M85101163`
   - 可能是普通会员，也可能是渠道销售
2. **授课人ID** (`instructor_id`)：格式如 `I12345678`
   - 授课人的唯一标识
3. **渠道方ID/编码** (`channel_code` 或渠道方显示ID)：
   - 如 `channel_981189` 或 `CH981189`
   - 需要查找该渠道方的渠道销售，选择其中一个作为邀请人

### 2.2 新的注册流程设计

```
用户注册（填写邀请码）
    ↓
邀请码匹配（按优先级）
    ├─ 1. 尝试匹配 member_id (users.member_id = invite_code AND role='member')
    │   └─ 找到 → 邀请人 = 该用户
    │
    ├─ 2. 尝试匹配 instructor_id (users.instructor_id = invite_code AND role='instructor')
    │   └─ 找到 → 邀请人 = 该用户
    │
    └─ 3. 尝试匹配渠道方 (channels.channel_code = invite_code 或 channels.id = invite_code)
        └─ 找到 → 
            ├─ 查找该渠道方的渠道销售 (users.channel_user_id = channels.id AND role='member')
            ├─ 选择第一个渠道销售作为邀请人（或按策略选择）
            └─ 邀请人 = 选择的渠道销售用户
    ↓
判断邀请人类型
    ├─ 普通会员 (role='member' && channel_user_id IS NULL)
    │   └─ 按会员推广方案发放优惠券
    │
    ├─ 渠道销售 (role='member' && channel_user_id IS NOT NULL)
    │   └─ 按渠道推广方案发放优惠券（使用渠道销售的channel_user_id找到渠道方）
    │
    └─ 授课人 (role='instructor')
        └─ 按授课人推广方案发放优惠券
```

---

## 三、优惠券发放逻辑

### 3.1 普通会员邀请

**注册时**：
- 邀请人：获得注册奖励优惠券（`source='invite_register'`）
- 被邀请人：获得注册奖励优惠券（`source='invite_register'`）

**首次购买时**：
- 邀请人：获得购券奖励优惠券（`source='invite_purchase'`）

### 3.2 渠道销售邀请

**注册时**：
- 邀请人（渠道销售）：**不发放**优惠券
- 被邀请人：获得渠道推广优惠券（`source='channel_invite'`）
  - 通过 `inviter.channel_user_id` → `channels.id` → `channels.channel_code` → `channel_promotion_schemes.channel_code`

**首次购买时**：
- 邀请人（渠道销售）：**不发放**优惠券

### 3.3 授课人邀请

**注册时**：
- 邀请人（授课人）：**不发放**优惠券
- 被邀请人：获得授课人推广优惠券（`source='instructor_invite'`）

**首次购买时**：
- 邀请人（授课人）：**不发放**优惠券

---

## 四、用户列表显示逻辑

### 4.1 应该显示的角色

用户列表API应该返回**所有角色**的用户：
- 会员 (`role='member'`)
- 授课人 (`role='instructor'`)
- 渠道销售（`role='member'` 且 `channel_user_id IS NOT NULL`）应该单独标识

### 4.2 邀请人角色显示规则

| 邀请人实际身份 | 显示角色 | 显示文本 |
|--------------|---------|---------|
| 普通会员 (role='member' && channel_user_id IS NULL) | `member` | 会员 |
| 渠道销售 (role='member' && channel_user_id IS NOT NULL) | `channel` | **渠道方** |
| 授课人 (role='instructor') | `instructor` | 授课人 |

**关键点**：渠道销售的邀请人角色应该显示为"渠道方"，因为虽然邀请人是渠道销售，但代表的是渠道方进行推广。

---

## 五、需要修复的问题

### 5.1 注册逻辑问题

**问题1**：不支持通过渠道方ID注册
- **解决方案**：在注册时，如果member_id和instructor_id都匹配不到，尝试匹配渠道方
- **逻辑**：通过channels表的channel_code或id查找渠道方，然后查找该渠道方的渠道销售，选择其中一个作为邀请人

**问题2**：通过渠道方ID注册时，优惠券发放可能不正确
- **原因**：如果直接通过渠道方ID注册，没有找到对应的渠道销售作为邀请人，就无法正确发放优惠券
- **解决方案**：必须找到渠道销售作为邀请人，才能正确发放优惠券

### 5.2 用户列表显示问题

**问题1**：可能只显示了部分角色
- **解决方案**：确保查询包含所有角色，不进行角色筛选（除非用户明确指定）

**问题2**：邀请人角色显示不正确
- **原因**：判断逻辑可能有问题，或者数据传递有问题
- **解决方案**：确保查询中包含`inviter_channel_user_id`，并且判断逻辑正确

### 5.3 数据关联问题

**问题1**：通过渠道方ID注册的用户，inviter_id可能不正确
- **解决方案**：必须找到对应的渠道销售用户，设置inviter_id为该渠道销售的用户ID

---

## 六、修复计划

### 步骤1：修复注册逻辑（auth.js）

1. 添加渠道方匹配逻辑
2. 查找渠道方的渠道销售
3. 选择渠道销售作为邀请人
4. 确保优惠券正确发放

### 步骤2：修复用户列表API（admin/users.js）

1. 确保返回所有角色
2. 修复邀请人角色显示逻辑
3. 确保inviter_channel_user_id正确传递

### 步骤3：测试验证

1. 测试通过member_id注册
2. 测试通过instructor_id注册
3. 测试通过channel_code注册
4. 验证优惠券发放
5. 验证用户列表显示

