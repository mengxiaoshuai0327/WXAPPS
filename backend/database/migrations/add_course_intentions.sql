-- 课程意向表
CREATE TABLE IF NOT EXISTS `course_intentions` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL COMMENT '用户ID',
  `selected_theme_ids` JSON COMMENT '选择的主题ID列表',
  `selected_course_ids` JSON COMMENT '选择的课程ID列表',
  `other_courses` TEXT COMMENT '其他课程描述',
  `preferred_time` VARCHAR(200) COMMENT '期望上课时间',
  `preferred_instructor_id` INT COMMENT '意向老师ID',
  `preferred_instructor_name` VARCHAR(100) COMMENT '意向老师姓名（如果不在系统中）',
  `status` ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '处理状态',
  `admin_note` TEXT COMMENT '管理员备注',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`preferred_instructor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程意向表';

