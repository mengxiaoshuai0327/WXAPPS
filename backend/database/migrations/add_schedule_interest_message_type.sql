-- 添加待开课通知消息类型到系统消息表
ALTER TABLE `system_messages`
  MODIFY COLUMN `type` ENUM('system', 'course_cancelled', 'evaluation_reminder', 'ticket_expiring', 'invite_reward', 'ticket_gift', 'schedule_available') NOT NULL;


