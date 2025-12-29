-- 在system_messages表中添加schedule_id字段，用于存储关联的排课ID
ALTER TABLE `system_messages`
ADD COLUMN IF NOT EXISTS `schedule_id` INT NULL COMMENT '关联的排课ID（用于schedule_available类型消息）' AFTER `type`,
ADD INDEX `idx_schedule_id` (`schedule_id`),
ADD FOREIGN KEY (`schedule_id`) REFERENCES `course_schedules`(`id`) ON DELETE CASCADE;


