-- 添加授课人ID字段到users表
-- 格式：I + 8位数字，例如 I12345678

ALTER TABLE `users`
  ADD COLUMN `instructor_id` VARCHAR(50) UNIQUE COMMENT '授课人ID' AFTER `member_id`,
  ADD INDEX `idx_instructor_id` (`instructor_id`);

