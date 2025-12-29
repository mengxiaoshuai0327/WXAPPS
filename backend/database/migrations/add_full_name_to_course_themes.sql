-- 为主题表添加主题名称字段（完整名称）
ALTER TABLE `course_themes` 
ADD COLUMN `full_name` VARCHAR(200) NULL COMMENT '主题名称（完整名称）' AFTER `name`;

