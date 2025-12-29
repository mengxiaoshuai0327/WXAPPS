-- 添加赠送课券的限制字段（模块和主题限制）

ALTER TABLE `tickets`
  ADD COLUMN `restrict_module_id` INT COMMENT '限定报课模块ID（赠送课券时设置）' AFTER `gifted_at`,
  ADD COLUMN `restrict_theme_id` INT COMMENT '限定报课主题ID（赠送课券时设置）' AFTER `restrict_module_id`,
  ADD INDEX `idx_restrict_module_id` (`restrict_module_id`),
  ADD INDEX `idx_restrict_theme_id` (`restrict_theme_id`),
  ADD FOREIGN KEY (`restrict_module_id`) REFERENCES `course_modules`(`id`) ON DELETE SET NULL,
  ADD FOREIGN KEY (`restrict_theme_id`) REFERENCES `course_themes`(`id`) ON DELETE SET NULL;

