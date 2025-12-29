# 渠道销售注册优惠券发放问题排查

## 问题描述

在开发环境下，如果：
1. 在管理员后端添加新的渠道方信息
2. 添加了优惠券方案信息（渠道推广方案）
3. 在管理员前端添加新的渠道方销售
4. 在小程序前端注册新会员，使用新的渠道销售的ID
5. **问题**：没有按照该销售涉及的优惠券方案授予新注册会员

## 注册流程分析

### 步骤1：查找邀请人（渠道销售）

注册时会通过邀请码查找邀请人，支持两种方式：

1. **数据库ID查找**（纯数字）：
   ```javascript
   // 如果邀请码是纯数字（如 108），作为数据库ID查找
   SELECT id, member_id, channel_user_id, role FROM users 
   WHERE id = ? AND role IN ('member', 'instructor')
   ```

2. **member_id查找**（兼容旧格式，如M12345678）：
   ```javascript
   // 如果邀请码是member_id格式（如 M98677504），作为member_id查找
   SELECT id, member_id, channel_user_id, role FROM users 
   WHERE member_id = ? AND role = 'member'
   ```

**注意**：已添加重试机制（最多3次，每次延迟50ms），处理可能的时序问题。

### 步骤2：识别渠道销售并获取channel_code

如果找到的邀请人满足：
- `role = 'member'`
- `channel_user_id IS NOT NULL`

则判断为渠道销售，然后：
```javascript
// 查询渠道方信息，获取channel_code
SELECT channel_name, channel_code FROM channels 
WHERE id = ?
```

### 步骤3：查找渠道推广方案并发放优惠券

根据channel_code查找激活的渠道推广方案：
```javascript
SELECT * FROM channel_promotion_schemes 
WHERE channel_code = ? AND status = 'active'
```

如果找到方案，根据方案的`amount`和`expiry_days`发放优惠券。

## 可能的问题原因

### 1. 邀请码格式问题

**问题**：用户可能使用了错误的邀请码格式
- ❌ 使用渠道方的ID（channels表的id）
- ❌ 使用渠道方的channel_code（如channel_253480）
- ✅ 应该使用渠道销售的数据库ID或member_id

**验证方法**：
```sql
-- 查看渠道销售的ID和member_id
SELECT id, member_id, real_name, channel_user_id 
FROM users 
WHERE role = 'member' AND channel_user_id IS NOT NULL 
ORDER BY created_at DESC;
```

### 2. 渠道推广方案未激活或channel_code不匹配

**问题**：渠道推广方案的status不是'active'，或者channel_code不匹配

**验证方法**：
```sql
-- 查看渠道方和对应的推广方案
SELECT 
    c.id as channel_id,
    c.channel_code,
    c.channel_name,
    cps.id as scheme_id,
    cps.status,
    cps.amount
FROM channels c
LEFT JOIN channel_promotion_schemes cps ON c.channel_code = cps.channel_code
WHERE c.id = ?;  -- 替换为渠道方的ID
```

### 3. 时序问题（已修复）

**问题**：新创建的渠道销售可能还未完全同步到数据库

**解决方案**：已在member_id查找逻辑中添加重试机制（最多3次，每次延迟50ms）

### 4. channel_code为空或NULL

**问题**：渠道方的channel_code可能为空，导致无法查找推广方案

**验证方法**：
```sql
-- 检查渠道方的channel_code
SELECT id, channel_code, channel_name 
FROM channels 
WHERE id = ?;  -- 替换为渠道方的ID
```

## 调试步骤

### 1. 检查注册日志

查看后端服务器日志，搜索以下关键词：
- `[注册] ========== 开始匹配邀请码`
- `[注册] 步骤1: 作为数据库ID查找`
- `[注册] 步骤1（兼容）: 作为member_id查找`
- `[注册] ✓ 找到邀请人`
- `[渠道优惠券发放] ========== 步骤3`
- `[渠道优惠券发放] 步骤3.1：查找渠道推广方案`
- `[渠道优惠券发放] ✓ 步骤3完成`

### 2. 验证数据库数据

```sql
-- 1. 查看最新的渠道销售
SELECT id, member_id, real_name, phone, channel_user_id, created_at
FROM users 
WHERE role = 'member' AND channel_user_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 2. 查看对应的渠道方信息
SELECT c.id, c.channel_code, c.channel_name
FROM channels c
WHERE c.id = ?;  -- 替换为channel_user_id

-- 3. 查看对应的渠道推广方案
SELECT id, channel_code, amount, status, created_at
FROM channel_promotion_schemes
WHERE channel_code = ? AND status = 'active';  -- 替换为channel_code

-- 4. 查看最新注册的用户及其优惠券
SELECT 
    u.id,
    u.real_name,
    u.inviter_id,
    u.promotion_type,
    u.channel_sales_id_for_promotion,
    dc.id as coupon_id,
    dc.amount,
    dc.source,
    dc.status
FROM users u
LEFT JOIN discount_coupons dc ON u.id = dc.user_id
WHERE u.created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY u.created_at DESC;
```

### 3. 测试注册流程

使用正确的邀请码（渠道销售的数据库ID或member_id）进行注册，然后检查：
1. 用户记录中的`inviter_id`是否正确
2. `promotion_type`是否为'channel'
3. `channel_sales_id_for_promotion`是否填写
4. 是否成功创建了优惠券记录

## 常见错误信息

### 错误1：未找到邀请人
```
[注册] ✗ 未找到邀请人: M92810417
```
**原因**：邀请码不正确或渠道销售不存在
**解决**：确认使用的是正确的数据库ID或member_id

### 错误2：未找到渠道方信息
```
[渠道优惠券发放] 步骤2失败：未找到channel_user_id=13对应的渠道方记录或channel_code为空
```
**原因**：渠道销售关联的渠道方不存在或channel_code为空
**解决**：检查channels表中是否存在对应的记录

### 错误3：未找到渠道推广方案
```
[渠道优惠券发放] 步骤3.1失败：未找到channel_code='channel_253480'且status='active'的渠道推广方案
```
**原因**：渠道推广方案不存在、未激活或channel_code不匹配
**解决**：
1. 确认已在【渠道推广方案管理】中创建了对应的方案
2. 确认方案状态为"已激活"
3. 确认方案的channel_code与渠道方的channel_code一致

## 解决方案

### 方案1：确保使用正确的邀请码

注册时应该使用：
- ✅ 渠道销售的数据库ID（纯数字，如 `108`）
- ✅ 渠道销售的member_id（格式：`M98677504`）

不应该使用：
- ❌ 渠道方的ID
- ❌ 渠道方的channel_code

### 方案2：检查渠道推广方案配置

1. 在【渠道推广方案管理】中查看对应的方案
2. 确认方案状态为"已激活"
3. 确认方案的channel_code与渠道方的channel_code完全一致（区分大小写）

### 方案3：检查数据库一致性

确保以下数据的一致性：
- `users.channel_user_id` → `channels.id`
- `channels.channel_code` → `channel_promotion_schemes.channel_code`
- `channel_promotion_schemes.status` = 'active'

## 注意事项

1. **数据刷新**：前端和后端不需要手动刷新，数据库操作是实时的。如果注册时找不到数据，通常是数据配置问题，而不是缓存问题。

2. **时序问题**：虽然已添加重试机制，但如果创建渠道销售后立即注册，建议等待1-2秒再注册，确保数据完全写入。

3. **日志查看**：所有关键步骤都有详细的日志输出，建议查看后端日志以定位具体问题。

