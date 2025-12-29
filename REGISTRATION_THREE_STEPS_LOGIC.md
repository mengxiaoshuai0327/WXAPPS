# 注册时邀请人识别和优惠券发放的三步逻辑

## 概述

根据用户需求，注册时识别邀请人和发放优惠券的逻辑应该严格按照以下三个步骤执行：

1. **步骤1：通过邀请码查找用户**（在用户列表中查找会员ID/授课人ID/渠道方ID）
2. **步骤2：识别邀请人角色和渠道方**（确定邀请人的角色，如果是渠道销售则找到对应的渠道方）
3. **步骤3：根据推广方案发放优惠券**（根据对应的推广方案发放优惠券）

## 详细步骤说明

### 步骤1：通过邀请码查找用户

**查找顺序：**

1. **查找会员ID**（包括普通会员和渠道销售）
   - 查询：`SELECT * FROM users WHERE member_id = ? AND role = 'member'`
   - 重试机制：最多重试5次，每次延迟100ms（处理时序问题）
   - 支持格式：`M31463846`、`M39124712`等

2. **查找授课人ID**（如果步骤1未找到）
   - 支持格式：`I73084993`、`73084993`（自动处理I前缀）
   - 查询：`SELECT * FROM users WHERE instructor_id = ? AND role = 'instructor'`

3. **查找渠道方**（如果步骤1和2都未找到）
   - 支持格式：`CH981189`（自动转换为`channel_981189`）
   - 查询：`SELECT * FROM channels WHERE channel_code = ?`
   - 如果找到渠道方，查找该渠道方的第一个渠道销售作为邀请人

### 步骤2：识别邀请人角色和渠道方

**角色判断逻辑：**

1. **授课人**（`role = 'instructor'`）
   - 设置：`promotion_type = 'instructor'`
   - 记录：`instructor_id_for_promotion`、`instructor_name_for_promotion`

2. **渠道销售**（`role = 'member'` 且 `channel_user_id` 不为 NULL）
   - 设置：`promotion_type = 'channel'`
   - 记录：`channel_sales_id_for_promotion`、`channel_sales_name_for_promotion`
   - **查询渠道方信息**（`channels`表）：
     - 查询：`SELECT channel_name, channel_code FROM channels WHERE id = ?`
     - 记录：`channel_name_for_promotion`、`channel_code_for_promotion`

3. **普通会员**（`role = 'member'` 且 `channel_user_id` 为 NULL）
   - 设置：`promotion_type = 'member'`

### 步骤3：根据推广方案发放优惠券

**根据邀请人类型查找对应的推广方案：**

1. **普通会员推广**
   - 查找表：`coupon_schemes`
   - 查询条件：`scheme_type = 'member_invite' AND status = 'active'`
   - 发放对象：
     - 邀请人：`member_inviter_register_amount`（注册奖励）
     - 被邀请人：`member_invitee_amount`（注册奖励）

2. **渠道销售推广**
   - 查找表：`channel_promotion_schemes`
   - 查询条件：`channel_code = ? AND status = 'active'`（使用步骤2中查询到的`channel_code`）
   - 发放对象：
     - 被邀请人：`amount`（注册奖励）
     - 邀请人：不发放优惠券

3. **授课人推广**
   - 查找表：`coupon_schemes`
   - 查询条件：`scheme_type = 'instructor_invite' AND status = 'active'`
   - 发放对象：
     - 被邀请人：`instructor_invitee_amount`（注册奖励）
     - 邀请人：不发放优惠券

## 日志输出示例

### 完整的日志流程（渠道销售邀请示例）

```
[注册] ========== 开始匹配邀请码: M39124712 ==========
[注册] 邀请码类型判断: 可能是会员ID
[注册] 步骤1: 查找会员ID (member_id='M39124712', role='member')
[注册] ✓ 通过member_id匹配成功:
  - 用户ID: 96
  - 会员ID: M39124712
  - 角色: member
  - 渠道销售? channel_user_id: 10
  - 姓名: 小腾
  - 所属渠道方: 腾讯有限公司 (channel_code=channel_037977)

[注册] ========== 步骤2：识别邀请人角色和渠道方 ==========
[注册] 步骤2.1：判断邀请人类型
  - 邀请人role: member
  - 邀请人channel_user_id: 10
  - 结论：邀请人是渠道销售（role='member'且channel_user_id不为NULL）
[注册] 步骤2.2：查询渠道方信息（channels表）
  查询条件: id=10
[注册] 步骤2.2完成：找到渠道方信息
  - 渠道方ID: 10
  - 渠道方名称: 腾讯有限公司
  - channel_code: channel_037977
[注册] ✓ 步骤2完成：邀请人是渠道销售，已找到对应的渠道方

[渠道优惠券发放] ========== 步骤3：根据渠道推广方案发放优惠券 ==========
[渠道优惠券发放] 邀请人是渠道销售，inviter_id=96, inviter_channel_user_id=10, channel_code_for_promotion=channel_037977
[渠道优惠券发放] 步骤2已完成：使用之前查询到的channel_code=channel_037977
[渠道优惠券发放] 步骤3.1：查找渠道推广方案（channel_promotion_schemes表）
  查询条件: channel_code='channel_037977', status='active'
[渠道优惠券发放] 步骤3.1完成：找到渠道推广方案
  - 方案编码: CPS59233975
  - channel_code: channel_037977
  - 奖励金额: ¥220
  - 有效期: 15天
[渠道优惠券发放] 步骤3.2：检查是否已存在优惠券
  查询条件: user_id=99, source='channel_invite', source_user_id=96
[渠道优惠券发放] 步骤3.3：发放优惠券
  - 被邀请人ID: 99
  - 优惠券金额: ¥220
  - 有效期: 2025-12-19
[渠道优惠券发放] ✓ 步骤3完成：已为被邀请人 99 发放渠道推广优惠券
  总结信息:
    - 邀请人ID: 96
    - 邀请人member_id: M39124712
    - 渠道方ID: 10
    - channel_code: channel_037977
    - 优惠券金额: ¥220
    - 有效期: 15天
```

## 数据表说明

### 用户列表（users表）
- 用于查找邀请人（步骤1）
- 关键字段：
  - `member_id`：会员ID（格式：M + 8位数字）
  - `instructor_id`：授课人ID（格式：I + 数字）
  - `channel_user_id`：渠道方ID（关联到`channels`表）
  - `role`：角色（`member`、`instructor`）

### 渠道销售列表（users表，role='member' AND channel_user_id IS NOT NULL）
- 显示渠道销售信息
- 关键字段：
  - `member_id`：会员ID（用作邀请码）
  - `channel_user_id`：所属渠道方ID

### 渠道推广方案管理（channel_promotion_schemes表）
- 用于查找渠道方的推广方案（步骤3）
- 关键字段：
  - `channel_code`：渠道方编码（关联到`channels.channel_code`）
  - `amount`：奖励金额
  - `expiry_days`：有效期（天）
  - `status`：状态（`active`表示激活）

## 注意事项

1. **时序问题**：对于新创建的渠道销售，查询时可能遇到时序问题，因此添加了重试机制（最多5次，每次延迟100ms）

2. **数据一致性**：步骤2和步骤3在同一个数据库事务中执行，确保数据一致性

3. **错误处理**：
   - 如果步骤1未找到邀请人，`inviter_id`保持为`NULL`，不发放优惠券
   - 如果步骤2未找到渠道方信息，会记录警告日志，但不影响注册
   - 如果步骤3未找到推广方案，会记录错误日志，但不影响注册（优惠券不发放）

4. **重复检查**：发放优惠券前会检查是否已经存在相同的优惠券，避免重复发放

## 验证方法

1. **测试渠道销售邀请**：
   - 使用渠道销售的会员ID（如`M39124712`）注册
   - 查看日志，确认三个步骤都正确执行
   - 验证优惠券是否正确发放

2. **测试普通会员邀请**：
   - 使用普通会员的会员ID（如`M31463846`）注册
   - 验证是否按照会员推广方案发放优惠券

3. **测试授课人邀请**：
   - 使用授课人的ID（如`I73084993`）注册
   - 验证是否按照授课人推广方案发放优惠券

