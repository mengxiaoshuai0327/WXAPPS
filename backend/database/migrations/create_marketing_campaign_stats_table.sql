-- 创建营销方案统计数据表
CREATE TABLE IF NOT EXISTS `marketing_campaign_stats` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `inviter_id` INT NOT NULL COMMENT '邀请人ID',
  `inviter_role` ENUM('member', 'instructor', 'channel') NOT NULL COMMENT '邀请人角色',
  `invitee_id` INT NOT NULL COMMENT '被邀请人ID（注册人ID）',
  `invite_code` VARCHAR(50) COMMENT '邀请码',
  `registered_at` DATETIME COMMENT '注册时间',
  `first_purchase_at` DATETIME COMMENT '首次购买课券时间',
  `first_purchase_quantity` INT DEFAULT 0 COMMENT '首次购买课券数量',
  `first_purchase_amount` DECIMAL(10,2) DEFAULT 0 COMMENT '首次购买课券金额（原价）',
  `first_purchase_discount_amount` DECIMAL(10,2) DEFAULT 0 COMMENT '首次购买课券折扣金额',
  `first_purchase_actual_amount` DECIMAL(10,2) DEFAULT 0 COMMENT '首次购买课券实际支付金额',
  `first_purchase_campaign_id` INT COMMENT '首次购买使用的营销方案ID',
  `first_purchase_discount_rate` DECIMAL(5,2) COMMENT '首次购买折扣比例',
  `total_purchase_quantity` INT DEFAULT 0 COMMENT '累计购买课券数量',
  `total_purchase_amount` DECIMAL(10,2) DEFAULT 0 COMMENT '累计消费金额（不含折扣）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`invitee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`first_purchase_campaign_id`) REFERENCES `marketing_campaigns`(`id`) ON DELETE SET NULL,
  INDEX `idx_inviter_id` (`inviter_id`),
  INDEX `idx_invitee_id` (`invitee_id`),
  INDEX `idx_inviter_role` (`inviter_role`),
  INDEX `idx_registered_at` (`registered_at`),
  INDEX `idx_first_purchase_at` (`first_purchase_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销方案统计数据表';

