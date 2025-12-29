# 首次购买折扣逻辑说明

## 业务规则

被授课人和渠道方邀请的会员，首次购买课券享受的折扣规则：

1. **仅限首次购买**：只有在用户第一次购买课券时才能享受折扣
2. **不限制购买数量**：首次购买时，无论购买多少张课券（1张、5张、10张等），都享受折扣
3. **折扣计算方式**：基于首次购买的总金额（单价 × 数量）按营销方案的折扣比例计算

## 实现逻辑

### 1. 判断是否首次购买

```javascript
// 检查用户是否之前购买过课券
const [existingPurchases] = await db.query(
  `SELECT COUNT(*) as count FROM tickets 
   WHERE user_id = ? AND source = 'purchase'`,
  [user_id]
);
isFirstPurchase = existingPurchases[0].count === 0;
```

### 2. 应用折扣条件

- 必须是首次购买（`isFirstPurchase === true`）
- 邀请人必须是授课人或渠道方（`inviter_role === 'instructor' || inviter_role === 'channel'`）
- 用户尚未使用过首次购买折扣（`first_purchase_discount_applied === false`）
- 邀请人当前有有效的营销方案

### 3. 折扣计算

```javascript
// 计算总金额（单价 × 数量）
let total_amount = ticket_price * quantity;

// 如果满足首次购买折扣条件，基于总金额计算折扣
if (isFirstPurchaseDiscountApplicable && first_purchase_discount_rate) {
  first_purchase_discount_amount = Math.floor(total_amount * first_purchase_discount_rate);
  total_amount -= first_purchase_discount_amount;
}
```

**示例**：
- 课券单价：1500元
- 首次购买数量：5张
- 总金额：1500 × 5 = 7500元
- 营销方案折扣：20%
- 折扣金额：7500 × 20% = 1500元
- 实际支付：7500 - 1500 = 6000元

### 4. 标记已使用

首次购买折扣使用后，会标记 `first_purchase_discount_applied = TRUE`，确保后续购买不再享受此折扣。

## 关键点

1. **不限制数量**：首次购买时，无论购买多少张课券，都享受折扣
2. **基于总金额**：折扣是基于首次购买的总金额计算的，不是单张课券
3. **仅限首次**：只有第一次购买时享受，后续购买不再享受此折扣
4. **动态查询**：购买时重新查询邀请人当前有效的营销方案，确保使用最新的折扣比例

## 数据记录

首次购买的相关数据会记录到 `marketing_campaign_stats` 表中：
- `first_purchase_quantity`：首次购买课券数量
- `first_purchase_amount`：首次购买总金额（原价）
- `first_purchase_discount_amount`：首次购买折扣金额
- `first_purchase_actual_amount`：首次购买实际支付金额
- `first_purchase_discount_rate`：使用的折扣比例
- `first_purchase_campaign_id`：使用的营销方案ID

