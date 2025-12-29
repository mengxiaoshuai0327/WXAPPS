-- 添加渠道方（channel）角色到users表
ALTER TABLE `users` 
  MODIFY COLUMN `role` ENUM('visitor', 'member', 'instructor', 'channel') DEFAULT 'visitor' COMMENT '角色：游客/会员/授课人/渠道方';

