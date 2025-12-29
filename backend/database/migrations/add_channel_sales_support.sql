-- 添加渠道销售支持
-- 在users表中添加channel_user_id字段，用于关联渠道销售和渠道方
-- channel_user_id指向渠道方用户的ID（role='channel'的用户）

ALTER TABLE `users` 
  ADD COLUMN `channel_user_id` INT COMMENT '所属渠道方用户ID（如果当前用户是渠道销售，此字段指向渠道方）' AFTER `channel_id`,
  ADD INDEX `idx_channel_user_id` (`channel_user_id`);

-- 添加外键约束（可选，如果需要强制引用完整性）
-- ALTER TABLE `users` 
--   ADD CONSTRAINT `fk_users_channel_user` 
--   FOREIGN KEY (`channel_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL;

-- 说明：
-- 1. 当用户role='channel'时，表示这是一个渠道方，channel_user_id应该为NULL
-- 2. 当用户role='member'且channel_user_id不为NULL时，表示这是一个渠道销售（同时也是会员）
-- 3. 渠道销售可以通过自己的member_id作为邀请码邀请其他会员注册
-- 4. 注册时，系统会根据邀请人（渠道销售）的channel_user_id找到对应的渠道方
-- 5. 然后根据渠道方的channel_code查找对应的渠道推广方案

