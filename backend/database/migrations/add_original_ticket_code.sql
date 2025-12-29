-- 添加原课券编号字段（用于记录赠券时的原课券编号）

ALTER TABLE `tickets`
  ADD COLUMN `original_ticket_code` VARCHAR(50) COMMENT '原课券编号（赠送课券时记录）' AFTER `restrict_theme_id`,
  ADD INDEX `idx_original_ticket_code` (`original_ticket_code`);

