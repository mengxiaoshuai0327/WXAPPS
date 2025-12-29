-- 添加模块ID和主题ID字段

ALTER TABLE `course_modules`
  ADD COLUMN `module_code` VARCHAR(50) UNIQUE COMMENT '模块ID（唯一标识）' AFTER `id`,
  ADD INDEX `idx_module_code` (`module_code`);

ALTER TABLE `course_themes`
  ADD COLUMN `theme_code` VARCHAR(50) UNIQUE COMMENT '主题ID（唯一标识）' AFTER `id`,
  ADD INDEX `idx_theme_code` (`theme_code`);

