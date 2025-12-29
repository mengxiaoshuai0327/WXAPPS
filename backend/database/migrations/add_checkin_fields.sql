-- 添加签到相关字段到 course_schedules 表
ALTER TABLE `course_schedules` 
ADD COLUMN `checkin_triggered` BOOLEAN DEFAULT FALSE COMMENT '签到是否已触发' AFTER `questionnaire_triggered`;

-- 添加签到和问卷状态字段到 course_bookings 表
ALTER TABLE `course_bookings`
ADD COLUMN `checkin_status` ENUM('pending', 'checked_in', 'not_checked_in') DEFAULT 'pending' COMMENT '签到状态' AFTER `status`,
ADD COLUMN `checkin_time` DATETIME COMMENT '签到时间' AFTER `checkin_status`,
ADD COLUMN `evaluation_status` ENUM('pending', 'submitted', 'not_submitted') DEFAULT 'pending' COMMENT '问卷填写状态' AFTER `checkin_time`,
ADD COLUMN `evaluation_time` DATETIME COMMENT '问卷填写时间' AFTER `evaluation_status`,
ADD INDEX `idx_checkin_status` (`checkin_status`),
ADD INDEX `idx_evaluation_status` (`evaluation_status`);

-- 添加签到提醒消息类型到 system_messages 表
ALTER TABLE `system_messages`
MODIFY COLUMN `type` ENUM('system', 'course_cancelled', 'evaluation_reminder', 'ticket_expiring', 'invite_reward', 'ticket_gift', 'checkin_reminder') NOT NULL;

