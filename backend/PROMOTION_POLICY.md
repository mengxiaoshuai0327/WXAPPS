# 小程序推广政策完整说明

本文档详细说明所有推广政策的配置、发放逻辑和检查方法。

## 一、推广方案类型

系统支持以下推广方案类型：

1. **会员推广** (`member_invite`)
2. **授课人推广** (`instructor_invite`)
3. **渠道推广** (`channel_caifu`, `channel_other`)
4. **特殊推广** (`admin_special`)

所有推广方案配置存储在 `coupon_schemes` 表中。

## 二、各推广政策详细说明

### 1. 会员推广 (`member_invite`)

**适用场景：** 普通会员邀请新用户注册

**奖励规则：**
- **邀请人奖励（注册时）：** 被邀请人成功注册后，邀请人获得 100元 优惠券
- **邀请人奖励（首次购买）：** 被邀请人首次购买课券后，邀请人获得 500元 优惠券
- **被邀请人奖励：** 注册成功后可获得 500元 优惠券

**配置字段：**
- `member_inviter_register_amount`: 邀请人注册奖励金额（默认：100元）
- `member_inviter_purchase_amount`: 邀请人购买奖励金额（默认：500元）
- `member_invitee_amount`: 被邀请人奖励金额（默认：500元）
- `inviter_expiry_days`: 邀请人优惠券有效期（默认：90天）
- `invitee_expiry_days`: 被邀请人优惠券有效期（默认：30天）

**发放时机：**
- 邀请人注册奖励：被邀请人注册成功时
- 邀请人购买奖励：被邀请人首次购买课券时
- 被邀请人奖励：注册成功时

### 2. 授课人推广 (`instructor_invite`)

**适用场景：** 授课人（instructor）邀请新用户注册

**奖励规则：**
- **被邀请人奖励：** 注册成功后可获得 500元 优惠券
- **邀请人奖励：** 无（授课人邀请不给邀请人优惠券，但被邀请人首次购买时可享受折扣）

**配置字段：**
- `instructor_invitee_amount`: 被邀请人奖励金额（默认：500元）
- `invitee_expiry_days`: 被邀请人优惠券有效期（默认：30天）

**发放时机：**
- 被邀请人奖励：注册成功时

**重要提示：** 
- 必须确保 `coupon_schemes` 表中有 `scheme_type='instructor_invite'` 且 `status='active'` 的记录
- 必须确保 `instructor_invitee_amount > 0`，否则不会发放优惠券

### 3. 渠道推广

#### 3.1 财能渠道 (`channel_caifu`)

**适用场景：** 财能渠道销售邀请新用户注册

**奖励规则：**
- **被邀请人奖励：** 注册成功后可获得 500元 优惠券
- **邀请人奖励：** 无

**配置：** 存储在 `channel_promotion_schemes` 表中，通过 `channel_code='caifu'` 标识

#### 3.2 其他渠道 (`channel_other`)

**适用场景：** 其他渠道销售邀请新用户注册

**奖励规则：**
- **被邀请人奖励：** 注册成功后可获得 500元 优惠券
- **邀请人奖励：** 无

**配置：** 存储在 `channel_promotion_schemes` 表中，通过 `channel_code='other'` 标识

### 4. 特殊推广 (`admin_special`)

**适用场景：** 管理员手动发放的特殊优惠券

**配置字段：**
- `admin_special_amount`: 特殊推广优惠券金额（默认：500元）
- `admin_special_expiry_days`: 有效期天数

## 三、注册时优惠券发放流程

### 流程概述

1. **识别邀请人角色**
   - 通过邀请码（可以是会员号、授课人编号、渠道方编号）查找邀请人
   - 确定邀请人的角色（member/instructor/channel）

2. **根据角色选择推广方案**
   - 会员邀请 → 查找 `member_invite` 方案
   - 授课人邀请 → 查找 `instructor_invite` 方案
   - 渠道邀请 → 查找 `channel_promotion_schemes` 表中的对应渠道方案

3. **检查方案配置**
   - 方案状态必须为 `active`
   - 奖励金额必须 > 0

4. **发放优惠券**
   - 创建 `discount_coupons` 记录
   - 设置 `source` 字段标识来源（`instructor_invite`, `invite_register`, `channel_invite` 等）

### 代码逻辑位置

- **注册接口：** `backend/routes/auth.js` - `router.post('/register')`
- **授课人推广发放：** 第 694-743 行
- **会员推广发放：** 第 613-685 行
- **渠道推广发放：** 第 733-798 行

## 四、常见问题排查

### 问题1：注册时未收到优惠券

**排查步骤：**

1. **检查推广方案是否存在且激活**
   ```sql
   SELECT * FROM coupon_schemes WHERE scheme_type = 'instructor_invite' AND status = 'active';
   ```

2. **检查推广方案金额是否大于0**
   ```sql
   SELECT instructor_invitee_amount FROM coupon_schemes WHERE scheme_type = 'instructor_invite';
   -- 确保返回的值 > 0
   ```

3. **检查用户注册信息**
   ```sql
   SELECT id, inviter_id, promotion_type FROM users WHERE nickname = '刘一' OR real_name = '刘一';
   -- 确保 inviter_id 不为 NULL
   -- 确保 promotion_type 正确（授课人邀请应为 'instructor'）
   ```

4. **检查邀请人角色**
   ```sql
   SELECT role FROM users WHERE id = (SELECT inviter_id FROM users WHERE nickname = '刘一');
   -- 确保角色为 'instructor'
   ```

5. **查看后端日志**
   - 查看注册时的日志输出
   - 查找类似 `[注册] 找到授课人推广方案` 或 `⚠️ 未找到激活的授课人推广方案` 的日志

### 问题2：优惠券重复发放

系统已经实现了防重复发放机制：
- 发放前会检查是否已存在相同 `user_id`、`source` 和 `source_user_id` 的优惠券
- 如果已存在，会跳过发放并记录日志

### 问题3：推广方案配置错误

**修复脚本：**
```bash
cd backend
node scripts/fix-instructor-promotion-scheme.js
```

## 五、检查和维护工具

### 1. 检查所有推广方案配置

```bash
cd backend
node scripts/check-all-promotion-schemes.js
```

### 2. 检查特定用户的优惠券

```bash
cd backend
node scripts/check-liuyi-coupon.js
```

### 3. 修复授课人推广方案

```bash
cd backend
node scripts/fix-instructor-promotion-scheme.js
```

### 4. 补发缺失的优惠券

如果需要为已经注册但未收到优惠券的用户补发，可以使用：

```bash
cd backend
node scripts/fix-missing-coupons.js
```

（需要根据实际情况修改脚本中的用户ID和邀请人信息）

## 六、数据库表结构

### coupon_schemes 表

存储系统级别的推广方案配置，所有推广方案共用此表。

**关键字段：**
- `scheme_type`: 方案类型（member_invite, instructor_invite, channel_caifu, channel_other, admin_special）
- `status`: 状态（active, inactive）
- `*_amount`: 各类奖励金额
- `*_expiry_days`: 各类优惠券有效期

### channel_promotion_schemes 表

存储渠道推广方案配置。

**关键字段：**
- `channel_code`: 渠道编码（caifu, other）
- `amount`: 被邀请人奖励金额
- `expiry_days`: 有效期天数
- `status`: 状态（active, inactive）

### discount_coupons 表

存储所有优惠券记录。

**关键字段：**
- `user_id`: 优惠券拥有者用户ID
- `source`: 来源（instructor_invite, invite_register, channel_invite 等）
- `source_user_id`: 来源用户ID（邀请人ID）
- `amount`: 金额
- `status`: 状态（unused, used, expired）

## 七、最佳实践

1. **定期检查推广方案配置**
   - 确保所有需要的推广方案都已创建且状态为 `active`
   - 定期检查金额配置是否符合业务需求

2. **监控注册日志**
   - 关注注册时的警告和错误日志
   - 及时发现配置问题

3. **测试新用户注册**
   - 测试各种角色邀请的注册流程
   - 验证优惠券是否正确发放

4. **数据一致性**
   - 确保 `users.inviter_id` 正确设置
   - 确保 `users.promotion_type` 正确设置
   - 确保 `invitations` 表中有正确的邀请记录

## 八、当前配置状态

**授课人推广方案：**
- 状态：✅ active
- 被邀请人奖励：¥500.00
- 有效期：30 天

**会员推广方案：**
- 状态：✅ active
- 邀请人注册奖励：¥100.00
- 邀请人购买奖励：¥500.00
- 被邀请人奖励：¥500.00

**渠道推广方案：**
- 财能渠道：✅ active
- 其他渠道：✅ active

## 九、联系方式

如遇问题，请检查：
1. 后端日志：查看服务器控制台输出
2. 数据库配置：确认 `coupon_schemes` 表中的配置
3. 用户数据：确认用户和邀请人信息正确

---

**最后更新：** 2025-12-17

