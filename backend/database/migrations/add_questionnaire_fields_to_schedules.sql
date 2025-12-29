-- 为course_schedules表添加调查问卷链接和ID字段
ALTER TABLE `course_schedules`
  ADD COLUMN `questionnaire_url` VARCHAR(500) NULL COMMENT '调查问卷链接' AFTER `location`,
  ADD COLUMN `questionnaire_id` VARCHAR(100) NULL COMMENT '调查问卷ID号' AFTER `questionnaire_url`;


