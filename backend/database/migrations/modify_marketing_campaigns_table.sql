-- 修改营销方案表结构，改为用户维度
-- 注意：如果表已存在且有数据，需要先备份数据

-- 如果表不存在，创建新表
CREATE TABLE IF NOT EXISTS `marketing_campaigns_new` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL COMMENT '用户ID（授课人或渠道方）',
  `discount_rate` DECIMAL(5,2) NOT NULL COMMENT '首次购买折扣比例（如0.20表示20%折扣，即8折）',
  `name` VARCHAR(200) COMMENT '方案名称（可选，用于描述）',
  `description` TEXT COMMENT '方案描述',
  `start_date` DATE COMMENT '生效开始日期（NULL表示立即生效）',
  `end_date` DATE COMMENT '生效结束日期（NULL表示永久有效）',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态：激活/未激活',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_date_range` (`start_date`, `end_date`),
  INDEX `idx_user_status_date` (`user_id`, `status`, `start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销方案表（用户维度）';

-- 如果旧表存在，重命名并替换
DROP TABLE IF EXISTS `marketing_campaigns_old`;
RENAME TABLE `marketing_campaigns` TO `marketing_campaigns_old`;
RENAME TABLE `marketing_campaigns_new` TO `marketing_campaigns`;

-- 添加外键约束（如果users表存在）
-- ALTER TABLE `marketing_campaigns` ADD CONSTRAINT `fk_marketing_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;

