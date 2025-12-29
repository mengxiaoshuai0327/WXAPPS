-- 创建用户推广方案表
-- 用于管理每个用户（授课人或渠道方）的推广方案配置
-- 每个用户可以有多个推广方案（不同时间段），但在同一时间只能有一个激活的方案

CREATE TABLE IF NOT EXISTS `user_promotion_schemes` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL COMMENT '用户ID（授课人或渠道方）',
  `scheme_type` ENUM('member_invite', 'channel_caifu', 'channel_other', 'instructor_invite') NOT NULL COMMENT '方案类型：会员推广、财能渠道推广、其他渠道推广、授课人推广',
  `name` VARCHAR(200) COMMENT '方案名称（可选，用于描述）',
  `description` TEXT COMMENT '方案描述',
  `start_date` DATE COMMENT '生效开始日期（NULL表示立即生效）',
  `end_date` DATE COMMENT '生效结束日期（NULL表示永久有效）',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态：激活/未激活',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_date_range` (`start_date`, `end_date`),
  INDEX `idx_user_status_date` (`user_id`, `status`, `start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户推广方案表（按用户维度管理）';

