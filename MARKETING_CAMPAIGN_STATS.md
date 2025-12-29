# 营销方案统计数据记录功能

## 功能概述

系统已实现完整的营销方案数据记录功能，记录邀请关系、注册信息、购买行为等详细数据，用于营销分析和效果评估。

## 数据库表结构

### marketing_campaign_stats 表

**字段说明**：
- `id` - 主键ID
- `inviter_id` - 邀请人ID
- `inviter_role` - 邀请人角色（member/instructor/channel）
- `invitee_id` - 被邀请人ID（注册人ID）
- `invite_code` - 邀请码
- `registered_at` - 注册时间
- `first_purchase_at` - 首次购买课券时间
- `first_purchase_quantity` - 首次购买课券数量
- `first_purchase_amount` - 首次购买课券金额（原价，不含折扣）
- `first_purchase_discount_amount` - 首次购买课券折扣金额
- `first_purchase_actual_amount` - 首次购买课券实际支付金额
- `first_purchase_campaign_id` - 首次购买使用的营销方案ID
- `first_purchase_discount_rate` - 首次购买折扣比例
- `total_purchase_quantity` - 累计购买课券数量
- `total_purchase_amount` - 累计消费金额（不含折扣，使用原价）
- `created_at` - 创建时间
- `updated_at` - 更新时间

## 数据记录流程

### 1. 注册时创建统计记录

**位置**：`backend/routes/auth.js` - 注册接口

**触发条件**：用户通过邀请码注册

**记录内容**：
- 邀请人ID和角色
- 被邀请人ID
- 邀请码
- 注册时间
- 首次购买折扣比例（如果是授课人/渠道方邀请）

### 2. 首次购买时更新统计记录

**位置**：`backend/routes/tickets.js` - 购买课券接口

**触发条件**：用户首次购买课券（通过邀请注册的用户）

**更新内容**：
- 首次购买时间
- 首次购买课券数量
- 首次购买课券金额（原价）
- 首次购买折扣金额
- 首次购买实际支付金额
- 使用的营销方案ID
- 折扣比例
- 累计购买数量和金额

### 3. 后续购买时更新累计统计

**位置**：`backend/routes/tickets.js` - 购买课券接口

**触发条件**：用户第二次及以后购买课券

**更新内容**：
- 累计购买课券数量
- 累计消费金额（不含折扣）

## API接口

### 获取营销方案统计数据

**GET** `/api/admin/marketing/campaign-stats`

**查询参数**：
- `inviter_id` - 邀请人ID（可选）
- `invitee_id` - 被邀请人ID（可选）
- `inviter_role` - 邀请人角色（可选：member/instructor/channel）
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20）

**返回数据**：
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "inviter_id": 100,
      "inviter_role": "channel",
      "invitee_id": 101,
      "invite_code": "CH40093393",
      "registered_at": "2025-01-15 10:30:00",
      "first_purchase_at": "2025-01-20 14:20:00",
      "first_purchase_quantity": 5,
      "first_purchase_amount": 500.00,
      "first_purchase_discount_amount": 100.00,
      "first_purchase_actual_amount": 400.00,
      "first_purchase_campaign_id": 10,
      "first_purchase_discount_rate": 0.20,
      "total_purchase_quantity": 8,
      "total_purchase_amount": 800.00,
      "campaign_name": "渠道方A的营销方案",
      "campaign_discount_rate": 0.20,
      "inviter_nickname": "联想",
      "inviter_real_name": "联想北京",
      "inviter_channel_id": "CH40093393",
      "invitee_nickname": "张三",
      "invitee_real_name": "张三",
      "invitee_member_id": "M12345678",
      "invitee_phone": "13800138000"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

## 使用说明

### 查看统计数据

可以通过API接口查询营销方案的统计数据：

1. **按邀请人查询**：
   ```
   GET /api/admin/marketing/campaign-stats?inviter_id=100
   ```

2. **按角色查询**：
   ```
   GET /api/admin/marketing/campaign-stats?inviter_role=channel
   ```

3. **按被邀请人查询**：
   ```
   GET /api/admin/marketing/campaign-stats?invitee_id=101
   ```

### 数据字段说明

#### 首次购买相关
- `first_purchase_amount`：首次购买的原价总金额（不含折扣）
- `first_purchase_discount_amount`：首次购买享受的折扣金额
- `first_purchase_actual_amount`：首次购买实际支付的金额（= 原价 - 折扣）
- `first_purchase_discount_rate`：折扣比例（如0.20表示20%折扣，即8折）
- `first_purchase_campaign_id`：使用的营销方案ID，可以通过关联查询获取方案详情

#### 累计统计
- `total_purchase_quantity`：累计购买的所有课券数量
- `total_purchase_amount`：累计消费的原价总金额（不含折扣），用于计算真实销售额

## 注意事项

1. **数据准确性**：
   - 所有金额字段使用原价（purchase_amount），不包括折扣
   - 累计统计在每次购买后自动更新

2. **表依赖**：
   - 统计记录在注册时创建，如果注册时没有邀请人，则不会创建记录
   - 如果营销方案统计表不存在，系统会记录警告但不会影响业务流程

3. **数据完整性**：
   - 首次购买折扣只在首次购买时记录
   - 累计统计包括所有购买记录（包括首次购买）

4. **时区处理**：
   - 所有时间字段使用东八区（Asia/Shanghai）时间

## 后续扩展

可以根据需要在管理员后台添加营销方案统计数据的展示页面，包括：
- 统计列表展示
- 按邀请人/被邀请人筛选
- 导出统计数据
- 数据可视化图表（如邀请转化率、购买转化率等）

