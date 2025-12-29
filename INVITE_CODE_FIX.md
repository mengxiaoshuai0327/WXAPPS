# 邀请码查找问题修复

## 问题描述

用户注册时填写了邀请码 `M98677504`（渠道销售），但注册后：
- `inviter_id` 为 NULL
- `promotion_type` 为 NULL
- `channel_sales_id_for_promotion` 为 NULL
- 优惠券未发放

## 根本原因

在简化代码时，移除了重试机制。虽然数据库查询逻辑是正确的，但可能存在时序问题：
- 新创建的渠道销售可能还未完全同步到数据库
- 或者数据库连接池的延迟

## 修复方案

在 `member_id` 查找逻辑中添加重试机制：
- 最多重试3次
- 每次重试延迟50ms
- 如果找到邀请人，立即退出循环

## 代码变更

```javascript
// 如果没找到，尝试作为member_id查找（兼容旧格式，如M12345678）
// 添加重试机制，处理可能的时序问题（新创建的渠道销售可能还未完全同步）
if (inviters.length === 0) {
  console.log(`[注册] 步骤1（兼容）: 作为member_id查找 (member_id='${invite_code}')`);
  let retryCount = 0;
  const maxRetries = 3;
  const retryDelay = 50;
  
  while (retryCount <= maxRetries && inviters.length === 0) {
    if (retryCount > 0) {
      console.log(`[注册] 第${retryCount}次重试查询member_id（延迟${retryDelay}ms）...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    
    [inviters] = await db.query(
      'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE member_id = ? AND role = ?', 
      [invite_code, 'member']
    );
    console.log(`[注册] 查询结果: 找到 ${inviters.length} 条记录 (尝试 ${retryCount + 1}/${maxRetries + 1})`);
    
    if (inviters.length > 0) {
      break; // 找到了，退出循环
    }
    
    retryCount++;
  }
}
```

## 验证方法

1. 使用邀请码 `M98677504` 注册新用户
2. 检查用户列表中的"是否他人邀请"和"邀请人编码"
3. 检查是否发放了优惠券（¥500.00）

## 注意事项

- 重试机制只针对 `member_id` 查找，因为这是最常见的邀请码格式
- 数据库ID查找（纯数字）不需要重试，因为ID是数据库自动生成的，不存在时序问题
- `instructor_id` 查找也不需要重试，因为授课人通常不是刚创建的

