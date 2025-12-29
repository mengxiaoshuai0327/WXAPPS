-- 创建用户维度的优惠券推广方案表
-- 用于管理每个用户（授课人或渠道方）的优惠券推广配置
-- 每个用户可以有多个方案（不同时间段），但同一时间只能有一个激活的方案

CREATE TABLE IF NOT EXISTS `coupon_promotion_schemes` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL COMMENT '用户ID（授课人或渠道方）',
  `scheme_type` ENUM('member_invite', 'channel_caifu', 'channel_other', 'instructor_invite') NOT NULL COMMENT '推广方案类型',
  `name` VARCHAR(200) COMMENT '方案名称（可选，用于描述）',
  `description` TEXT COMMENT '方案描述',
  -- 推广金额配置（覆盖系统默认配置）
  `member_inviter_register_amount` DECIMAL(10,2) COMMENT '会员推广-邀请人注册奖励金额（覆盖系统默认，NULL表示使用系统默认）',
  `member_inviter_purchase_amount` DECIMAL(10,2) COMMENT '会员推广-邀请人购买奖励金额（覆盖系统默认，NULL表示使用系统默认）',
  `member_invitee_amount` DECIMAL(10,2) COMMENT '会员推广-被邀请人奖励金额（覆盖系统默认，NULL表示使用系统默认）',
  `channel_caifu_amount` DECIMAL(10,2) COMMENT '财能渠道推广-被邀请人奖励金额（覆盖系统默认，NULL表示使用系统默认）',
  `channel_other_amount` DECIMAL(10,2) COMMENT '其他渠道推广-被邀请人奖励金额（覆盖系统默认，NULL表示使用系统默认）',
  `instructor_invitee_amount` DECIMAL(10,2) COMMENT '授课人推广-被邀请人奖励金额（覆盖系统默认，NULL表示使用系统默认）',
  -- 有效期配置
  `start_date` DATE COMMENT '生效开始日期（NULL表示立即生效）',
  `end_date` DATE COMMENT '生效结束日期（NULL表示永久有效）',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态：激活/未激活',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_date_range` (`start_date`, `end_date`),
  INDEX `idx_user_status_date` (`user_id`, `status`, `start_date`, `end_date`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户维度优惠券推广方案表';

