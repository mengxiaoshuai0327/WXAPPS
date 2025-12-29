# 渠道销售注册时序问题修复总结

## 问题描述

在管理员页面新建渠道方和渠道销售后，在小程序前端注册会员并添加渠道销售的ID时，第一次注册无法找到渠道销售及优惠券信息，第二次注册才能找到。

**具体案例：**
- 用户"孟三期"（手机号：13451223465）使用邀请码 `M39124712` 注册
- 邀请码对应的用户是"小腾"（渠道销售，属于"腾讯有限公司"）
- 但注册后用户列表中显示"是否他人邀请：否"，"邀请人编码：-"
- 优惠券也没有发放（应该发放¥220的注册奖励）

## 问题分析

### 根本原因

1. **数据库连接池和隔离级别**
   - 数据库使用 `REPEATABLE-READ` 隔离级别
   - 虽然 `autocommit=1`，但在不同的连接中查询可能存在微小的时序问题
   - 创建渠道销售的连接和注册查询的连接可能不同，导致读取不到刚刚插入的数据

2. **时序问题**
   - 创建渠道销售后立即注册，可能存在数据库同步的微小延迟
   - 特别是在高并发情况下，查询可能早于数据完全提交

### 测试结果

- 数据库查询本身没有问题（立即查询可以找到新创建的渠道销售）
- 问题出现在创建和查询使用不同连接的时序窗口

## 解决方案

### 1. 添加重试机制

在注册代码中查找邀请人（特别是通过 `member_id` 匹配渠道销售）时，添加了重试机制：

**参数配置：**
- **最大重试次数**：5次（总共6次查询，包括首次查询）
- **重试延迟**：每次重试之间延迟100ms
- **总延迟时间**：最多500ms（5次重试 × 100ms）

**代码逻辑：**
```javascript
// 添加重试机制，处理可能的时序问题（新创建的渠道销售可能还未完全同步）
let [inviters] = [];
let retryCount = 0;
const maxRetries = 5; // 增加到5次重试（总共6次查询）
const retryDelay = 100; // 增加到100ms延迟，给数据库更多时间同步

while (retryCount <= maxRetries && (!inviters || inviters.length === 0)) {
  if (retryCount > 0) {
    console.log(`[注册] 第${retryCount}次重试查询邀请人（延迟${retryDelay}ms）...`);
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  
  console.log(`[注册] 执行查询: SELECT ... WHERE member_id = '${invite_code}' AND role = 'member'`);
  [inviters] = await db.query(
    'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE member_id = ? AND role = ?', 
    [invite_code, 'member']
  );
  console.log(`[注册] 查询结果: 找到 ${inviters.length} 条记录 (尝试 ${retryCount + 1}/${maxRetries + 1})`);
  
  if (inviters.length > 0) {
    console.log(`[注册] 通过member_id匹配成功: member_id=${inviters[0].member_id}, role=${inviters[0].role}, id=${inviters[0].id}, channel_user_id=${inviters[0].channel_user_id || 'NULL'}`);
    break; // 找到了，退出循环
  }
  
  retryCount++;
}
```

### 2. 修复历史数据

创建了修复脚本 `backend/scripts/fix-meng-sanqi-inviter.js` 来修复已存在的数据问题。

**修复内容：**
- ✅ 设置 `inviter_id`
- ✅ 设置 `promotion_type = 'channel'`
- ✅ 设置渠道相关信息（`channel_sales_id_for_promotion`, `channel_name_for_promotion`等）
- ✅ 创建邀请记录
- ✅ 发放优惠券（根据渠道推广方案）

## 修改的文件

- `backend/routes/auth.js`：在注册逻辑中添加了重试机制，并优化了重试参数

## 验证方法

### 1. 创建新的渠道销售并立即注册

1. **创建渠道销售**：在管理员后台创建新的渠道方和渠道销售
2. **立即注册**：在小程序前端立即使用该渠道销售的ID进行注册
3. **检查日志**：查看服务器日志，确认是否有重试记录：
   ```
   [注册] 执行查询: SELECT ... WHERE member_id = 'M12345678' AND role = 'member'
   [注册] 查询结果: 找到 0 条记录 (尝试 1/6)
   [注册] 第1次重试查询邀请人（延迟100ms）...
   [注册] 执行查询: SELECT ... WHERE member_id = 'M12345678' AND role = 'member'
   [注册] 查询结果: 找到 1 条记录 (尝试 2/6)
   [注册] 通过member_id匹配成功: member_id=M12345678, role=member, id=95, channel_user_id=9
   ```
4. **验证结果**：确认第一次注册就能找到渠道销售并发放优惠券

### 2. 验证用户列表显示

在管理员后台用户列表中，确认：
- **是否他人邀请**：显示为"是"（绿色标签）
- **邀请人编码**：显示渠道销售的member_id（如 `M39124712`）

### 3. 验证优惠券发放

- 在小程序前端"优惠券奖励"卡片中，应该显示正确的金额（如¥220）
- 在数据库的 `discount_coupons` 表中，应该有对应的优惠券记录

## 注意事项

- **重试机制范围**：只在查找 `member_id`（包括渠道销售）时生效
- **不影响其他逻辑**：重试机制不会影响其他类型的邀请人查找（授课人、渠道方）
- **超时处理**：如果经过5次重试仍未找到，将按原有逻辑继续尝试其他匹配方式（授课人ID、渠道方ID等）
- **性能影响**：最多500ms的延迟对用户体验影响很小，但能大大提高成功率

## 后续优化建议

1. **监控重试频率**：如果发现重试频率较高，可能需要优化数据库连接池配置或隔离级别
2. **前端优化**：考虑在前端添加提示，建议用户稍等片刻再注册
3. **数据库优化**：如果问题持续存在，可以考虑调整数据库的隔离级别或连接池配置
4. **添加告警**：如果重试次数达到最大值仍然找不到，可以添加告警日志，帮助识别潜在问题

## 已修复的历史数据

- ✅ 用户"孟三期"（ID: 99, 手机号: 13451223465）
  - 邀请人ID: 96（小腾，member_id: M39124712）
  - 推广类型: channel
  - 渠道销售ID: M39124712
  - 已发放优惠券: ¥220（有效期15天）

