-- 为课程主题表添加status字段
ALTER TABLE `course_themes` 
ADD COLUMN `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态：active=激活，inactive=未激活' AFTER `description`;

