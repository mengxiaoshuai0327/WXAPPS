# 优惠券使用逻辑验证文档

本文档详细说明一次性购买多张课券时，优惠券的使用逻辑和验证方法。

## 一、业务规则

### 规则说明

**当用户一次性购买多张课券且使用一张优惠券时：**

1. **优惠券标记：** 只在第一张课券（i=0）上标记 `discount_coupon_id`
2. **金额抵扣：** 优惠券金额只从第一张课券的金额中抵扣
3. **实际支付：** 每张课券的 `actual_amount` 独立计算
   - 第一张课券：`actual_amount = purchase_amount - discount_amount - first_purchase_discount_amount`
   - 其他课券：`actual_amount = purchase_amount`
4. **发票金额：** 每张课券的 `invoice_amount` 等于其 `actual_amount`

### 示例

假设：
- 购买3张课券，每张1500元
- 使用一张600元的优惠券

**结果：**
- 第1张课券：`purchase_amount=1500`, `actual_amount=900`, `discount_coupon_id=优惠券ID`
- 第2张课券：`purchase_amount=1500`, `actual_amount=1500`, `discount_coupon_id=NULL`
- 第3张课券：`purchase_amount=1500`, `actual_amount=1500`, `discount_coupon_id=NULL`
- 总实际支付：900 + 1500 + 1500 = 3900元
- 发票金额：每张课券的发票金额 = 各自的 `actual_amount`

## 二、代码实现

### 2.1 购买课券逻辑

**文件：** `backend/routes/tickets.js`

**关键代码：** 第 474-511 行

```javascript
for (let i = 0; i < quantity; i++) {
  const ticket_code = 'T' + Date.now().toString() + i.toString().padStart(3, '0');
  
  // 只有第一张课券记录优惠券ID
  const discount_coupon_id_for_ticket = (i === 0 && used_discount_coupon_id) 
    ? used_discount_coupon_id 
    : null;
  
  // 计算每张课券的实际支付金额
  let ticket_actual_amount = ticket_price; // 默认是原价
  
  if (i === 0) {
    // 第一张课券：扣除折扣券金额和首次购买折扣
    if (discount_amount > 0) {
      ticket_actual_amount -= discount_amount;
    }
    if (first_purchase_discount_amount > 0) {
      ticket_actual_amount -= first_purchase_discount_amount;
    }
  } else {
    // 其他课券：保持原价，不扣除任何折扣
  }
  
  // 确保实际支付金额不为负数
  ticket_actual_amount = Math.max(0, ticket_actual_amount);
  
  // 插入课券记录
  await db.query(
    `INSERT INTO tickets (user_id, ticket_code, source, purchase_amount, actual_amount, 
     start_date, expiry_date, purchased_at, discount_coupon_id) 
     VALUES (?, ?, 'purchase', ?, ?, ?, ?, NOW(), ?)`,
    [user_id, ticket_code, ticket_price, ticket_actual_amount, 
     start_date, expiry_date, discount_coupon_id_for_ticket]
  );
}
```

**验证点：**
- ✅ 第一张课券（i=0）：设置 `discount_coupon_id`
- ✅ 其他课券（i>0）：`discount_coupon_id` 为 `NULL`
- ✅ 第一张课券：`actual_amount = purchase_amount - discount_amount`
- ✅ 其他课券：`actual_amount = purchase_amount`

### 2.2 发票开具逻辑

**文件：** `backend/routes/tickets.js`

**关键代码：** 第 1134-1175 行（计算总金额）、第 1215-1222 行（更新发票金额）

```javascript
// 计算发票总金额（使用每张课券的actual_amount）
let total_amount = 0;
for (const ticket of tickets) {
  let ticket_amount = parseFloat(ticket.actual_amount || ticket.purchase_amount || 0);
  total_amount += ticket_amount;
}

// ... 创建发票记录 ...

// 更新每张课券的发票金额（使用各自的actual_amount）
for (const ticket of tickets) {
  const ticket_actual_amount = parseFloat(ticket.actual_amount || ticket.purchase_amount || 0);
  await connection.query(
    'UPDATE tickets SET invoice_status = ?, invoice_amount = ? WHERE id = ?',
    ['issued', ticket_actual_amount, ticket.id]
  );
}
```

**验证点：**
- ✅ 发票总额 = 所有课券的 `actual_amount` 之和
- ✅ 每张课券的 `invoice_amount` = 各自的 `actual_amount`
- ✅ 不使用平均分摊逻辑

## 三、数据库字段

### tickets 表关键字段

- `purchase_amount`: 课券原价（固定值，如1500）
- `actual_amount`: 实际支付金额（扣除优惠券后的金额）
- `discount_coupon_id`: 使用的优惠券ID（只有第一张课券有值）
- `invoice_amount`: 发票金额（等于 `actual_amount`）

### 数据示例

| 课券ID | ticket_code | purchase_amount | actual_amount | discount_coupon_id | invoice_amount |
|--------|-------------|-----------------|---------------|-------------------|----------------|
| 1      | T001        | 1500            | 900           | 123               | 900            |
| 2      | T002        | 1500            | 1500          | NULL              | 1500           |
| 3      | T003        | 1500            | 1500          | NULL              | 1500           |

**总实际支付：** 900 + 1500 + 1500 = 3900元  
**发票总额：** 900 + 1500 + 1500 = 3900元

## 四、验证脚本

使用验证脚本检查数据正确性：

```bash
cd backend
node scripts/verify-coupon-usage-logic.js
```

**脚本功能：**
1. 查找最近使用优惠券的购买记录
2. 检查每张课券的优惠券标记是否正确
3. 验证每张课券的实际支付金额是否正确
4. 验证总金额计算是否正确
5. 检查发票开具时的金额计算是否正确

## 五、常见问题

### Q1: 为什么优惠券只标记在第一张课券上？

**答：** 业务规则要求优惠券信息标注在那一张课券上，就在那一张上抵扣折扣。这样可以：
- 清晰记录哪张课券使用了优惠券
- 便于发票开具时准确计算金额
- 避免重复抵扣

### Q2: 发票金额是如何计算的？

**答：** 
- 每张课券的 `invoice_amount` = 各自的 `actual_amount`
- 发票总额 = 所有课券的 `actual_amount` 之和
- **不使用平均分摊逻辑**

### Q3: 如果第一张课券的优惠券金额超过原价怎么办？

**答：** 代码中有保护逻辑：
```javascript
ticket_actual_amount = Math.max(0, ticket_actual_amount);
```
确保 `actual_amount` 不会为负数。

### Q4: 首次购买折扣如何处理？

**答：** 
- 首次购买折扣也只从第一张课券扣除
- 折扣顺序：先扣首次购买折扣，再扣优惠券金额
- 两种折扣都只影响第一张课券的 `actual_amount`

## 六、测试用例

### 测试用例1：购买3张课券，使用600元优惠券

**输入：**
- 数量：3
- 优惠券：600元
- 课券原价：1500元/张

**预期结果：**
- 第1张：`actual_amount=900`, `discount_coupon_id=优惠券ID`
- 第2张：`actual_amount=1500`, `discount_coupon_id=NULL`
- 第3张：`actual_amount=1500`, `discount_coupon_id=NULL`
- 总支付：3900元
- 发票金额：900 + 1500 + 1500 = 3900元

### 测试用例2：购买2张课券，使用2000元优惠券（超过单张价格）

**输入：**
- 数量：2
- 优惠券：2000元
- 课券原价：1500元/张

**预期结果：**
- 第1张：`actual_amount=0`（不能为负）, `discount_coupon_id=优惠券ID`
- 第2张：`actual_amount=1500`, `discount_coupon_id=NULL`
- 总支付：1500元
- 发票金额：0 + 1500 = 1500元

### 测试用例3：购买5张课券，不使用优惠券

**输入：**
- 数量：5
- 优惠券：无

**预期结果：**
- 所有课券：`actual_amount=1500`, `discount_coupon_id=NULL`
- 总支付：7500元
- 发票金额：7500元

## 七、代码审查检查清单

- [x] 第一张课券（i=0）正确标记 `discount_coupon_id`
- [x] 其他课券的 `discount_coupon_id` 为 `NULL`
- [x] 第一张课券的 `actual_amount` 正确扣除优惠券金额
- [x] 其他课券的 `actual_amount` 等于原价
- [x] 总金额正确累加所有课券的 `actual_amount`
- [x] 发票开具时，每张课券的 `invoice_amount` 等于各自的 `actual_amount`
- [x] 发票总额 = 所有课券的 `actual_amount` 之和
- [x] 没有使用平均分摊逻辑

## 八、相关代码位置

1. **购买课券逻辑：** `backend/routes/tickets.js` - 第 474-511 行
2. **发票开具逻辑：** `backend/routes/tickets.js` - 第 1048-1254 行
3. **验证脚本：** `backend/scripts/verify-coupon-usage-logic.js`

---

**最后更新：** 2025-12-17

