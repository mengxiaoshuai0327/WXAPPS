# 渠道优惠券发放逻辑调试文档

## 问题描述

用户反馈：优惠券逻辑没有处理好。

## 可能的问题场景

### 场景1：通过渠道销售member_id注册（如M96143951）

**预期流程**：
1. 用户输入邀请码：`M96143951`（渠道销售"联想1"的member_id）
2. 系统找到渠道销售作为邀请人
3. 系统通过 `inviter.channel_user_id` 找到渠道方（联想有限公司，CH990959）
4. 系统通过 `channel_code` 查找渠道推广方案（应该找到注册奖励¥400的方案）
5. 系统给被邀请人发放优惠券

**代码位置**：
- `backend/routes/auth.js` 第382行：匹配member_id
- `backend/routes/auth.js` 第455行：判断为渠道销售推广
- `backend/routes/auth.js` 第803行：开始渠道优惠券发放流程

**检查点**：
- [ ] `inviter_channel_user_id` 是否正确设置？
- [ ] `channel_code_for_promotion` 是否正确获取？
- [ ] 渠道推广方案是否存在且状态为 `active`？
- [ ] 优惠券是否成功插入数据库？

### 场景2：通过渠道方ID注册（如CH990959）

**预期流程**：
1. 用户输入邀请码：`CH990959` 或 `channel_990959`
2. 系统通过 `channel_code` 找到渠道方
3. 系统找到该渠道方的第一个渠道销售作为邀请人
4. 系统给被邀请人发放优惠券

**代码位置**：
- `backend/routes/auth.js` 第395-441行：渠道方匹配逻辑
- `backend/routes/auth.js` 第803行：渠道优惠券发放流程

**检查点**：
- [ ] 渠道方是否成功找到？
- [ ] 渠道销售是否成功找到？
- [ ] `inviter_channel_user_id` 是否正确设置？

## 数据库检查SQL

### 检查渠道销售信息

```sql
-- 检查渠道销售M96143951的channel_user_id
SELECT id, member_id, role, channel_user_id, nickname, real_name 
FROM users 
WHERE member_id = 'M96143951';

-- 检查对应的渠道方信息
SELECT c.id, c.channel_code, c.channel_name 
FROM channels c
INNER JOIN users u ON c.id = u.channel_user_id
WHERE u.member_id = 'M96143951';
```

### 检查渠道推广方案

```sql
-- 检查联想有限公司（CH990959）的推广方案
SELECT * 
FROM channel_promotion_schemes 
WHERE channel_code = 'channel_990959' AND status = 'active';

-- 检查所有激活的渠道推广方案
SELECT cps.*, c.channel_name, c.id as channel_id
FROM channel_promotion_schemes cps
LEFT JOIN channels c ON cps.channel_code = c.channel_code
WHERE cps.status = 'active';
```

### 检查已发放的优惠券

```sql
-- 检查某个用户的渠道推广优惠券
SELECT dc.*, u.nickname as user_name, u.member_id
FROM discount_coupons dc
INNER JOIN users u ON dc.user_id = u.id
WHERE dc.source = 'channel_invite'
ORDER BY dc.created_at DESC
LIMIT 20;

-- 检查特定用户的所有优惠券
SELECT dc.*, u_source.member_id as source_member_id
FROM discount_coupons dc
LEFT JOIN users u_source ON dc.source_user_id = u_source.id
WHERE dc.user_id = ? -- 替换为用户ID
ORDER BY dc.created_at DESC;
```

## 日志检查

查看服务器日志，查找以下关键词：
- `[渠道销售推广]` - 渠道销售推广信息
- `[渠道优惠券发放]` - 优惠券发放流程
- `✓ 已为被邀请人` - 成功发放优惠券
- `错误：未找到` - 错误信息

## 修复内容

### 1. 优化channel_code查询逻辑

**问题**：之前代码在设置 `promotion_type` 时查询了一次 `channel_code`，在事务内发放优惠券时又查询了一次，可能导致数据不一致。

**修复**：
- 添加 `channel_code_for_promotion` 变量保存查询到的 `channel_code`
- 在事务内优先使用保存的 `channel_code`，如果为空才重新查询

### 2. 改进错误日志

- 添加更详细的日志输出
- 确保所有关键步骤都有日志记录

## 测试步骤

1. **测试通过渠道销售member_id注册**：
   - 使用 `M96143951` 注册新用户
   - 检查服务器日志
   - 检查数据库中是否创建了优惠券记录
   - 检查前端是否显示优惠券

2. **测试通过渠道方ID注册**：
   - 使用 `CH990959` 注册新用户
   - 检查服务器日志
   - 检查数据库中是否创建了优惠券记录
   - 检查前端是否显示优惠券

3. **验证优惠券统计API**：
   - 调用 `/api/discounts/stats?user_id=xxx`
   - 检查返回的数据是否正确

## 可能的问题

1. **渠道推广方案不存在或未激活**：
   - 检查 `channel_promotion_schemes` 表中是否存在对应 `channel_code` 的记录
   - 检查记录的状态是否为 `active`

2. **channel_code不匹配**：
   - 检查 `channels.channel_code` 是否与 `channel_promotion_schemes.channel_code` 完全匹配
   - 注意大小写和格式（如 `channel_990959` vs `CH990959`）

3. **事务提交问题**：
   - 检查事务是否成功提交
   - 检查是否有错误被捕获但没有抛出

4. **优惠券查询问题**：
   - 检查优惠券查询API是否正确查询所有来源的优惠券
   - 检查日期条件是否正确（start_date, expiry_date）

