# 邀请业务逻辑更新说明

## 更新概述

根据新的业务需求，更新了邀请系统的业务逻辑，区分会员邀请和授课人/渠道方邀请的不同奖励机制。

## 业务规则

### 1. 会员邀请制（保持不变）
- **注册奖励**：会员邀请游客注册 → 邀请人获得100元折扣券
- **首次购买奖励**：游客首次购买课程 → 邀请人获得500元折扣券

### 2. 授课人/渠道方邀请制（新增）
- **注册**：授课人/渠道方邀请游客注册 → 被邀请人享受首次购买折扣（不给邀请人折扣券）
- **首次购买**：被邀请人首次购买课程时，自动应用折扣比例（不给邀请人折扣券）
- **折扣比例**：可在管理员后台配置营销方案，设置不同的折扣比例

## 数据库变更

### 1. 用户表变更
```sql
-- 添加渠道方角色
ALTER TABLE `users` 
  MODIFY COLUMN `role` ENUM('visitor', 'member', 'instructor', 'channel') DEFAULT 'visitor';

-- 添加渠道方ID字段
ALTER TABLE `users` 
  ADD COLUMN `channel_id` VARCHAR(50) UNIQUE COMMENT '渠道方ID' AFTER `member_id`;

-- 添加首次购买折扣相关字段
ALTER TABLE `users` 
  ADD COLUMN `first_purchase_discount_applied` BOOLEAN DEFAULT FALSE COMMENT '是否已应用首次购买折扣',
  ADD COLUMN `first_purchase_discount_rate` DECIMAL(5,2) COMMENT '首次购买折扣比例';
```

### 2. 新建表

#### 营销方案表（marketing_campaigns）
```sql
CREATE TABLE IF NOT EXISTS `marketing_campaigns` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL COMMENT '营销方案名称',
  `discount_rate` DECIMAL(5,2) NOT NULL COMMENT '首次购买折扣比例（如0.10表示10%折扣）',
  `description` TEXT COMMENT '方案描述',
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `applicable_roles` JSON COMMENT '适用角色，如["instructor", "channel"]',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 渠道方信息表（channels）
```sql
CREATE TABLE IF NOT EXISTS `channels` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `channel_code` VARCHAR(50) UNIQUE COMMENT '渠道编码',
  `channel_name` VARCHAR(200) COMMENT '渠道名称',
  `contact_person` VARCHAR(100) COMMENT '联系人',
  `contact_phone` VARCHAR(20) COMMENT '联系电话',
  `description` TEXT COMMENT '渠道描述',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
```

## 代码变更

### 1. 注册逻辑（backend/routes/auth.js）

**变更内容**：
- 支持渠道方邀请码识别
- 如果邀请人是授课人/渠道方，查询营销方案获取折扣比例
- 将被邀请人的首次购买折扣比例保存到用户表
- 只有会员邀请才给邀请人发放100元折扣券

**关键代码**：
```javascript
// 查找邀请人时，支持 member_id, instructor_id, channel_id
// 如果邀请人是授课人/渠道方，查询营销方案
if (inviter_role === 'instructor' || inviter_role === 'channel') {
  const [campaigns] = await db.query(
    `SELECT discount_rate FROM marketing_campaigns 
     WHERE status = 'active' 
     AND JSON_CONTAINS(applicable_roles, ?)
     ORDER BY created_at DESC LIMIT 1`,
    [JSON.stringify(`"${inviter_role}"`)]
  );
  first_purchase_discount_rate = campaigns[0]?.discount_rate;
}

// 只有会员邀请才发放折扣券
if (inviter_role === 'member') {
  // 发放100元折扣券给邀请人
}
```

### 2. 购买逻辑（backend/routes/tickets.js）

**变更内容**：
- 首次购买时，检查用户是否有首次购买折扣
- 如果有折扣且未使用，自动应用折扣
- 只有会员邀请才给邀请人发放500元折扣券

**关键代码**：
```javascript
// 检查是否可以应用首次购买折扣
if (isFirstPurchase && 
    user[0].first_purchase_discount_rate && 
    !user[0].first_purchase_discount_applied) {
  const discount_rate = parseFloat(user[0].first_purchase_discount_rate);
  first_purchase_discount_amount = Math.floor(total_amount * discount_rate);
  total_amount -= first_purchase_discount_amount;
}

// 只有会员邀请才发放500元折扣券
if (inviter_role === 'member') {
  // 发放500元折扣券给邀请人
}
```

### 3. 营销方案管理API（backend/routes/admin/marketing.js）

**新功能**：
- `GET /api/admin/marketing/list` - 获取所有营销方案
- `POST /api/admin/marketing/create` - 创建营销方案
- `PUT /api/admin/marketing/:id` - 更新营销方案
- `DELETE /api/admin/marketing/:id` - 删除营销方案
- `GET /api/admin/marketing/invitation-stats` - 获取授课人/渠道方邀请统计

## 待完成工作

### 1. 数据库迁移
需要执行以下迁移文件：
```bash
cd backend
mysql -u root -p xiaocx_db < database/migrations/add_channel_role.sql
mysql -u root -p xiaocx_db < database/migrations/create_marketing_campaigns_table.sql
```

### 2. 管理员后台页面

#### 营销方案管理页面
- 位置：`admin/src/views/marketing/List.vue`
- 功能：
  - 列表展示营销方案
  - 创建/编辑营销方案
  - 设置折扣比例（0-1之间，如0.1表示10%）
  - 设置适用角色（instructor/channel）
  - 激活/停用方案

#### 授课人/渠道方邀请统计页面
- 位置：`admin/src/views/invitations/Stats.vue` 或集成到邀请管理页面
- 功能：
  - 显示授课人/渠道方列表
  - 显示每个授课人/渠道方的邀请统计：
    - 邀请人数
    - 已注册人数
    - 已购买人数

#### 创建授课人/渠道方功能
- 检查 `admin/src/views/users/Instructors.vue` 是否已存在
- 如果需要，创建渠道方创建功能

### 3. 邀请页面逻辑更新
- 小程序邀请页面需要区分角色显示不同的邀请说明
- 如果是授课人/渠道方，说明被邀请人首次购买可享受折扣

## 测试要点

### 1. 会员邀请流程
1. 会员邀请游客注册
2. 验证邀请人获得100元折扣券
3. 游客首次购买课程
4. 验证邀请人获得500元折扣券

### 2. 授课人邀请流程
1. 创建营销方案（如10%折扣）
2. 授课人邀请游客注册
3. 验证邀请人未获得折扣券
4. 验证被邀请人用户表中设置了 first_purchase_discount_rate
5. 游客首次购买课程
6. 验证自动应用了折扣
7. 验证邀请人未获得500元折扣券

### 3. 渠道方邀请流程
与授课人邀请流程相同

## 注意事项

1. **折扣比例**：营销方案中的折扣比例是小数形式（0.1 = 10%），不是百分比
2. **首次购买判断**：基于 tickets 表中 source='purchase' 的记录数量
3. **折扣应用顺序**：首次购买折扣优先于折扣券折扣
4. **营销方案优先级**：如果有多个激活的方案，取最新创建的

