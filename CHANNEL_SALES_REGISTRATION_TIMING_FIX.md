# 渠道销售注册时序问题修复

## 问题描述

在管理员页面新建渠道方和渠道销售后，在小程序前端注册会员并添加渠道销售的ID时，第一次注册无法找到渠道销售及优惠券信息，第二次注册才能找到。

## 问题分析

### 可能的原因

1. **数据库连接池和隔离级别**
   - 数据库使用 `REPEATABLE-READ` 隔离级别
   - 虽然 `autocommit=1`，但在不同的连接中查询可能存在微小的时序问题
   - 创建渠道销售的连接和注册查询的连接可能不同，导致读取不到刚刚插入的数据

2. **时序问题**
   - 创建渠道销售后立即注册，可能存在数据库同步的微小延迟
   - 特别是在高并发情况下，查询可能早于数据完全提交

3. **前端缓存问题**
   - 前端可能使用了缓存的邀请码列表，导致第一次注册时找不到新创建的渠道销售

## 解决方案

### 添加重试机制

在注册代码中查找邀请人（特别是通过 `member_id` 匹配渠道销售）时，添加了重试机制：

```javascript
// 添加重试机制，处理可能的时序问题（新创建的渠道销售可能还未完全同步）
let [inviters] = [];
let retryCount = 0;
const maxRetries = 3;
const retryDelay = 50; // 50ms延迟

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

### 重试机制说明

- **最大重试次数**：3次（总共4次查询，包括首次查询）
- **重试延迟**：每次重试之间延迟50ms
- **总延迟时间**：最多150ms（3次重试 × 50ms）
- **适用场景**：只在通过 `member_id` 查找渠道销售时重试，不影响其他查询逻辑

## 修改的文件

- `backend/routes/auth.js`：在注册逻辑中添加了重试机制

## 验证方法

1. **创建新的渠道销售**：在管理员后台创建新的渠道方和渠道销售
2. **立即注册**：在小程序前端立即使用该渠道销售的ID进行注册
3. **检查日志**：查看服务器日志，确认是否有重试记录：
   ```
   [注册] 执行查询: SELECT ... WHERE member_id = 'M12345678' AND role = 'member'
   [注册] 查询结果: 找到 0 条记录 (尝试 1/4)
   [注册] 第1次重试查询邀请人（延迟50ms）...
   [注册] 执行查询: SELECT ... WHERE member_id = 'M12345678' AND role = 'member'
   [注册] 查询结果: 找到 1 条记录 (尝试 2/4)
   [注册] 通过member_id匹配成功: member_id=M12345678, role=member, id=95, channel_user_id=9
   ```
4. **验证结果**：确认第一次注册就能找到渠道销售并发放优惠券

## 注意事项

- 重试机制只在查找 `member_id`（包括渠道销售）时生效
- 重试机制不会影响其他类型的邀请人查找（授课人、渠道方）
- 如果经过3次重试仍未找到，将按原有逻辑继续尝试其他匹配方式（授课人ID、渠道方ID等）

## 后续优化建议

1. **监控重试频率**：如果发现重试频率较高，可能需要优化数据库连接池配置或隔离级别
2. **前端优化**：考虑在前端添加重试机制或延迟注册，确保渠道销售创建完成后再注册
3. **数据库优化**：如果问题持续存在，可以考虑调整数据库的隔离级别或连接池配置

