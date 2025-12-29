# 注册邀请码处理流程完整说明

本文档详细说明二维码扫描和手动输入邀请码两种注册方式的处理流程，确保所有情况都能正确发放优惠券。

## 一、两种注册方式

### 1. 二维码扫描注册

**流程：**
1. 邀请人生成二维码（包含邀请码参数）
2. 被邀请人扫描二维码
3. 自动打开小程序注册页面：`pages/register/register?invite_code=XXX`
4. 注册页面通过 `onLoad(options)` 接收 `invite_code` 参数
5. 自动填入到邀请码输入框

**代码位置：**
- 二维码生成：`backend/routes/invitations.js` - `GET /api/invitations/qrcode/:inviteCode`
- 注册页面接收参数：`miniprogram/pages/register/register.js` - `onLoad(options)`

### 2. 手动输入邀请码注册

**流程：**
1. 用户进入注册页面
2. 在邀请码输入框手动输入邀请人ID（会员号、授课人编号或渠道销售ID）
3. 提交注册时，邀请码随表单一起提交

**代码位置：**
- 注册页面输入：`miniprogram/pages/register/register.js` - `onInviteCodeInput(e)`
- 表单提交：`miniprogram/pages/register/register.js` - `submitRegister()`

## 二、邀请码类型支持

系统支持以下三种类型的邀请码：

1. **会员号** (`member_id`) - 格式：`M` + 8位数字，如 `M12345678`
2. **授课人编号** (`instructor_id`) - 格式：`I` + 8位数字，如 `I140866389`
3. **渠道销售ID** (`member_id`，但 `channel_user_id` 不为NULL)

**重要：** 渠道销售使用会员号作为邀请码，但系统会根据 `channel_user_id` 字段识别为渠道推广。

## 三、后端处理流程

### 3.1 接收邀请码

**接口：** `POST /api/auth/register`

**参数：** `invite_code` (可选)

**代码位置：** `backend/routes/auth.js` - 第 327 行

```javascript
const { nickname, real_name, company, phone, password, invite_code, verification_code, avatar_url } = req.body;
```

### 3.2 查找邀请人

**代码位置：** `backend/routes/auth.js` - 第 380-450 行

**查找逻辑：**

1. **第一步：查找会员** (包括渠道销售)
   ```sql
   SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name 
   FROM users 
   WHERE member_id = ? AND role = 'member'
   ```

2. **第二步：如果未找到，查找授课人**
   ```sql
   SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name 
   FROM users 
   WHERE instructor_id = ? AND role = 'instructor'
   ```

3. **识别邀请人角色：**
   - `role = 'member'` 且 `channel_user_id IS NULL` → 普通会员邀请
   - `role = 'member'` 且 `channel_user_id IS NOT NULL` → 渠道销售邀请
   - `role = 'instructor'` → 授课人邀请

### 3.3 发放优惠券

根据邀请人角色，调用对应的推广方案发放优惠券：

#### 3.3.1 普通会员邀请 (`member_invite`)

**代码位置：** `backend/routes/auth.js` - 第 613-685 行

**奖励规则：**
- 邀请人：获得 100元 注册奖励优惠券
- 被邀请人：获得 500元 注册奖励优惠券

**检查条件：**
- 查找 `coupon_schemes` 表中 `scheme_type='member_invite'` 且 `status='active'` 的记录
- 确保 `member_inviter_register_amount > 0` 和 `member_invitee_amount > 0`

#### 3.3.2 授课人邀请 (`instructor_invite`)

**代码位置：** `backend/routes/auth.js` - 第 694-743 行

**奖励规则：**
- 被邀请人：获得 500元 注册奖励优惠券
- 邀请人：无（但被邀请人首次购买时可享受折扣）

**检查条件：**
- 查找 `coupon_schemes` 表中 `scheme_type='instructor_invite'` 且 `status='active'` 的记录
- 确保 `instructor_invitee_amount > 0`

**关键代码：**
```javascript
if (inviter_role === 'instructor') {
  const [schemes] = await connection.query(
    'SELECT * FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
    ['instructor_invite', 'active']
  );
  
  if (schemes.length > 0 && parseFloat(schemes[0].instructor_invitee_amount) > 0) {
    // 发放优惠券
  }
}
```

#### 3.3.3 渠道销售邀请 (`channel_invite`)

**代码位置：** `backend/routes/auth.js` - 第 733-798 行

**奖励规则：**
- 被邀请人：获得渠道推广优惠券（金额由 `channel_promotion_schemes` 表配置）
- 邀请人：无

**检查条件：**
- 邀请人必须是 `role='member'` 且 `channel_user_id IS NOT NULL`
- 查找 `channel_promotion_schemes` 表中对应 `channel_code` 且 `status='active'` 的记录

## 四、关键验证点

### 4.1 前端验证

**必须确保：**
1. ✅ 二维码生成的路径包含 `invite_code` 参数
2. ✅ 注册页面正确接收并填充 `invite_code`
3. ✅ 提交注册时，`invite_code` 正确传递到后端

**代码检查：**
- `miniprogram/pages/register/register.js` - `onLoad(options)` - 第 23-28 行
- `miniprogram/pages/register/register.js` - `submitRegister()` - 第 476 行

### 4.2 后端验证

**必须确保：**
1. ✅ 邀请码查找逻辑正确（先查会员，再查授课人）
2. ✅ 邀请人角色识别正确（会员/渠道销售/授课人）
3. ✅ 推广方案查找正确（根据角色查找对应的方案）
4. ✅ 优惠券发放逻辑正确（检查方案存在、激活、金额>0）

**代码检查：**
- `backend/routes/auth.js` - 第 380-450 行（查找邀请人）
- `backend/routes/auth.js` - 第 613-685 行（会员推广）
- `backend/routes/auth.js` - 第 694-743 行（授课人推广）
- `backend/routes/auth.js` - 第 733-798 行（渠道推广）

## 五、日志和调试

### 5.1 关键日志输出

后端代码已添加详细日志，包括：

1. **邀请人查找：**
   ```
   找到邀请人: ID=X, member_id=XXX, instructor_id=XXX, role=XXX, 邀请码=XXX
   ```

2. **推广方案查找：**
   ```
   [注册] 找到授课人推广方案: ID=X, 被邀请人金额=¥500, 有效期=30天
   ```

3. **优惠券发放：**
   ```
   ✓ 已为被邀请人 X 发放授课人推广优惠券：金额¥500，有效期30天（邀请人：Y）
   ```

4. **警告信息：**
   ```
   ⚠️  未找到激活的授课人推广方案，无法为被邀请人 X 发放优惠券
   ⚠️  授课人推广方案的被邀请人金额为 0，必须大于0才会发放优惠券
   ```

### 5.2 问题排查步骤

1. **检查注册时是否传递了邀请码**
   - 查看前端提交的数据：`invite_code` 字段
   - 查看后端日志：是否有"找到邀请人"的日志

2. **检查邀请人是否正确识别**
   - 查看后端日志：邀请人ID、角色是否正确
   - 验证数据库中邀请人的 `role` 和相关信息

3. **检查推广方案配置**
   - 运行验证脚本：`node scripts/verify-all-promotion-policies.js`
   - 检查 `coupon_schemes` 表：确保对应方案存在且激活

4. **检查优惠券是否发放**
   - 查询 `discount_coupons` 表：检查是否有对应记录
   - 查看后端日志：是否有发放成功的日志

## 六、测试用例

### 测试用例1：二维码扫描注册（授课人邀请）

1. **准备：**
   - 授课人ID：`I140866389`
   - 生成二维码：`/api/invitations/qrcode/I140866389`

2. **操作：**
   - 扫描二维码
   - 填写注册信息
   - 提交注册

3. **验证：**
   - ✅ 邀请码自动填入
   - ✅ 后端识别为授课人邀请
   - ✅ 被邀请人收到 500元 优惠券

### 测试用例2：手动输入邀请码注册（会员邀请）

1. **准备：**
   - 会员号：`M12345678`

2. **操作：**
   - 进入注册页面
   - 手动输入邀请码：`M12345678`
   - 填写注册信息
   - 提交注册

3. **验证：**
   - ✅ 邀请码正确提交
   - ✅ 后端识别为会员邀请
   - ✅ 邀请人和被邀请人都收到优惠券

### 测试用例3：手动输入邀请码注册（渠道销售邀请）

1. **准备：**
   - 渠道销售会员号：`M87654321`（且 `channel_user_id` 不为NULL）

2. **操作：**
   - 进入注册页面
   - 手动输入邀请码：`M87654321`
   - 填写注册信息
   - 提交注册

3. **验证：**
   - ✅ 邀请码正确提交
   - ✅ 后端识别为渠道销售邀请
   - ✅ 被邀请人收到渠道推广优惠券

## 七、常见问题

### Q1: 扫描二维码后邀请码没有自动填入？

**排查：**
1. 检查二维码生成是否正确包含 `invite_code` 参数
2. 检查注册页面 `onLoad` 方法是否正确接收参数
3. 检查页面跳转时参数是否正确传递

### Q2: 输入邀请码后没有发放优惠券？

**排查：**
1. 检查后端日志，查看是否找到邀请人
2. 检查邀请人角色识别是否正确
3. 检查对应的推广方案是否配置且激活
4. 检查推广方案金额是否大于0

### Q3: 授课人邀请码输入后识别为会员邀请？

**排查：**
- 检查邀请码查找逻辑：先查 `member_id`，如果找到就返回，不会继续查找 `instructor_id`
- **注意：** 如果授课人同时有 `member_id` 且与 `instructor_id` 相同，会优先识别为会员
- **解决方案：** 确保 `member_id` 和 `instructor_id` 不重复，或者调整查找逻辑顺序

## 八、当前配置状态

**所有推广方案已配置且激活：**
- ✅ 授课人推广方案：500元，30天
- ✅ 会员推广方案：邀请人100元+500元，被邀请人500元
- ✅ 渠道推广方案：500元，30天

**代码逻辑已验证：**
- ✅ 二维码扫描注册流程正确
- ✅ 手动输入邀请码注册流程正确
- ✅ 邀请人识别逻辑正确
- ✅ 优惠券发放逻辑正确

---

**最后更新：** 2025-12-17

