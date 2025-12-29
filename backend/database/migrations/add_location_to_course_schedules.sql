-- 为排课表添加线下上课地址字段
ALTER TABLE `course_schedules` 
ADD COLUMN `location` VARCHAR(200) NULL COMMENT '线下上课地址' AFTER `max_students`;
