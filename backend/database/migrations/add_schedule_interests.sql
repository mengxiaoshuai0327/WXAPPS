-- 待开课意向表：记录用户对特定待开课的感兴趣操作
CREATE TABLE IF NOT EXISTS `schedule_interests` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL COMMENT '用户ID',
  `schedule_id` INT NOT NULL COMMENT '排课ID（待开课）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '感兴趣时间',
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`schedule_id`) REFERENCES `course_schedules`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_user_schedule` (`user_id`, `schedule_id`) COMMENT '每个用户对每个待开课只能点一次感兴趣',
  INDEX `idx_schedule_id` (`schedule_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='待开课意向表';

-- 在course_schedules表中添加字段记录是否已通知意向用户
ALTER TABLE `course_schedules`
ADD COLUMN IF NOT EXISTS `interest_users_notified` BOOLEAN DEFAULT FALSE COMMENT '是否已通知意向用户' AFTER `status`;
