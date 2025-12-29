-- 添加课程限制字段到 tickets 表（赠予课券时可以限定具体课程）

ALTER TABLE `tickets`
  ADD COLUMN `restrict_course_id` INT COMMENT '限定报课课程ID（赠送课券时设置）' AFTER `restrict_theme_id`,
  ADD INDEX `idx_restrict_course_id` (`restrict_course_id`),
  ADD FOREIGN KEY (`restrict_course_id`) REFERENCES `courses`(`id`) ON DELETE SET NULL;

