-- 创建营销方案表
CREATE TABLE IF NOT EXISTS `marketing_campaigns` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL COMMENT '营销方案名称',
  `discount_rate` DECIMAL(5,2) NOT NULL COMMENT '首次购买折扣比例（如0.10表示10%折扣，0.20表示20%折扣）',
  `description` TEXT COMMENT '方案描述',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态：激活/未激活',
  `applicable_roles` JSON COMMENT '适用角色，如["instructor", "channel"]',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销方案表';

-- 创建渠道方信息表（类似instructors表）
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
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_channel_code` (`channel_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='渠道方信息表';

-- 在users表中添加channel_id字段（类似instructor_id）
ALTER TABLE `users` 
  ADD COLUMN `channel_id` VARCHAR(50) UNIQUE COMMENT '渠道方ID' AFTER `member_id`,
  ADD INDEX `idx_channel_id` (`channel_id`);

-- 添加首次购买折扣记录表
ALTER TABLE `users` 
  ADD COLUMN `first_purchase_discount_applied` BOOLEAN DEFAULT FALSE COMMENT '是否已应用首次购买折扣' AFTER `inviter_id`,
  ADD COLUMN `first_purchase_discount_rate` DECIMAL(5,2) COMMENT '首次购买折扣比例' AFTER `first_purchase_discount_applied`;

