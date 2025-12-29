-- 添加课券赠送消息类型到系统消息表

ALTER TABLE `system_messages`
  MODIFY COLUMN `type` ENUM('system', 'course_cancelled', 'evaluation_reminder', 'ticket_expiring', 'invite_reward', 'ticket_gift') NOT NULL;

