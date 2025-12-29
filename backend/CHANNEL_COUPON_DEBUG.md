# 渠道推广优惠券发放问题排查指南

## 问题描述
用户：赵三（M87844615）
邀请码：M85101163（财销1的渠道ID码）
问题：按照管理员后台的渠道营销管理方案，赵三应该获得优惠券但没有获得

## 代码执行流程

### 1. 注册时邀请码匹配流程（auth.js 第380-450行）

当用户填写邀请码 `M85101163` 时：

1. **查找邀请人（第382-392行）**
   ```javascript
   // 先尝试匹配 member_id（会员邀请码，包括渠道销售）
   SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name 
   FROM users 
   WHERE member_id = 'M85101163' AND role = 'member'
   
   // 如果没找到，尝试匹配 instructor_id（授课人邀请码）
   ```

2. **检查渠道销售标识（第410-421行）**
   - 如果找到的用户 `role = 'member'` 且 `channel_user_id IS NOT NULL`
   - 则识别为渠道销售，设置 `promotion_type = 'channel'`

3. **发放渠道推广优惠券（第747-812行）**
   - 检查条件：`inviter_role === 'member' && inviter_channel_user_id`
   - 通过 `channel_user_id` 查找渠道方的 `channel_code`
   - 用 `channel_code` 查找 `channel_promotion_schemes` 表中的激活方案
   - 如果找到方案且金额>0，则发放优惠券

## 排查检查清单

### ✅ 检查项1：财销1（M85101163）用户信息

**SQL查询：**
```sql
SELECT id, member_id, role, channel_user_id, nickname, real_name 
FROM users 
WHERE member_id = 'M85101163';
```

**预期结果：**
- 应该找到一条记录
- `role` 应该是 `'member'`
- **关键**：`channel_user_id` 应该不为 NULL（指向对应的渠道方ID）

**如果 `channel_user_id` 为 NULL：**
- ❌ **问题**：用户没有被识别为渠道销售
- ✅ **解决方案**：需要在 users 表中为财销1设置 `channel_user_id`

---

### ✅ 检查项2：渠道方信息

**SQL查询（假设 channel_user_id = X）：**
```sql
SELECT id, channel_code, channel_name, channel_short_name 
FROM channels 
WHERE id = X;
```

**预期结果：**
- 应该找到一条渠道方记录
- **关键**：`channel_code` 字段应该有值（例如：'M85101163' 或其他标识符）

**如果 `channel_code` 为 NULL 或为空：**
- ❌ **问题**：无法查找对应的渠道推广方案
- ✅ **解决方案**：需要在 channels 表中为渠道方设置 `channel_code`

---

### ✅ 检查项3：渠道推广方案配置

**SQL查询（假设 channel_code = 'XXX'）：**
```sql
SELECT * 
FROM channel_promotion_schemes 
WHERE channel_code = 'XXX' AND status = 'active';
```

**预期结果：**
- 应该找到至少一条激活的方案
- `amount` 字段应该大于 0
- `expiry_days` 应该有值

**如果查询结果为空：**
- ❌ **问题**：没有对应的激活渠道推广方案
- ✅ **解决方案**：需要在管理员后台创建对应 `channel_code` 的渠道推广方案，并设置为 `active` 状态

---

### ✅ 检查项4：优惠券发放记录

**SQL查询：**
```sql
SELECT id, discount_code, amount, source, source_user_id, status, 
       channel_name_for_promotion, channel_sales_id_for_promotion, 
       channel_sales_name_for_promotion
FROM discount_coupons 
WHERE user_id = (SELECT id FROM users WHERE member_id = 'M87844615')
  AND source = 'channel_invite';
```

**预期结果：**
- 如果优惠券已发放，应该找到记录
- `source` 应该是 `'channel_invite'`
- `channel_sales_id_for_promotion` 应该是 `'M85101163'`

---

## 常见问题及解决方案

### 问题1：`channel_user_id` 为空

**现象：** 财销1用户存在，但 `channel_user_id` 为 NULL

**原因：** 用户没有被正确关联到渠道方

**解决方案：**
```sql
-- 1. 先查找渠道方ID（假设渠道方名称是"财销1"）
SELECT id, channel_code, channel_name FROM channels WHERE channel_name LIKE '%财销1%';

-- 2. 更新用户的channel_user_id
UPDATE users 
SET channel_user_id = <渠道方ID> 
WHERE member_id = 'M85101163';
```

---

### 问题2：渠道方 `channel_code` 为空

**现象：** 渠道方记录存在，但 `channel_code` 为 NULL

**原因：** 渠道方缺少标识码

**解决方案：**
```sql
-- 更新渠道方的channel_code（根据实际情况设置）
UPDATE channels 
SET channel_code = 'M85101163'  -- 或使用其他合适的标识符
WHERE id = <渠道方ID>;
```

---

### 问题3：没有对应的渠道推广方案

**现象：** 渠道方和用户都配置正确，但查询 `channel_promotion_schemes` 没有结果

**原因：** 管理员后台没有创建对应的渠道推广方案，或方案状态不是 `active`

**解决方案：**
1. 登录管理员后台
2. 进入"渠道推广方案管理"
3. 创建新的渠道推广方案：
   - `channel_code`：与渠道方的 `channel_code` 保持一致
   - `channel_name`：渠道名称（如"财销1"）
   - `amount`：优惠券金额（如 500.00）
   - `expiry_days`：有效期天数（如 30）
   - `status`：设置为 `active`

---

### 问题4：渠道推广方案的 `channel_code` 不匹配

**现象：** 渠道方的 `channel_code` 与 `channel_promotion_schemes` 表中的 `channel_code` 不一致

**原因：** 数据不一致

**解决方案：**
1. 确认渠道方的 `channel_code`：
   ```sql
   SELECT channel_code FROM channels WHERE id = <渠道方ID>;
   ```

2. 检查推广方案的 `channel_code`：
   ```sql
   SELECT channel_code FROM channel_promotion_schemes WHERE status = 'active';
   ```

3. 确保两者一致，如果不一致：
   - 要么更新渠道方的 `channel_code`
   - 要么更新推广方案的 `channel_code`
   - 或者创建新的推广方案使用正确的 `channel_code`

---

## 完整排查SQL脚本

```sql
-- ============================================
-- 完整排查SQL脚本
-- ============================================

-- 1. 检查被邀请人
SELECT '被邀请人信息' as step, id, member_id, nickname, real_name, inviter_id 
FROM users WHERE member_id = 'M87844615';

-- 2. 检查邀请人（财销1）
SELECT '邀请人信息' as step, id, member_id, role, channel_user_id, nickname, real_name 
FROM users WHERE member_id = 'M85101163';

-- 3. 检查渠道方（假设channel_user_id存在）
-- 先获取channel_user_id，然后替换下面的X
SELECT '渠道方信息' as step, id, channel_code, channel_name 
FROM channels WHERE id = (SELECT channel_user_id FROM users WHERE member_id = 'M85101163');

-- 4. 检查渠道推广方案
SELECT '渠道推广方案' as step, * 
FROM channel_promotion_schemes 
WHERE channel_code = (
    SELECT channel_code FROM channels WHERE id = (
        SELECT channel_user_id FROM users WHERE member_id = 'M85101163'
    )
) AND status = 'active';

-- 5. 检查已发放的优惠券
SELECT '已发放优惠券' as step, id, discount_code, amount, source, status, 
       channel_name_for_promotion, channel_sales_id_for_promotion
FROM discount_coupons 
WHERE user_id = (SELECT id FROM users WHERE member_id = 'M87844615')
  AND source = 'channel_invite';
```

---

## 修复后的代码改进

我已经在 `backend/routes/auth.js` 中添加了详细的日志输出，注册时会输出：
- 渠道销售的识别信息
- 渠道方信息的查找结果
- 渠道推广方案的查找结果
- 优惠券发放的详细过程

查看服务器日志可以帮助快速定位问题。

