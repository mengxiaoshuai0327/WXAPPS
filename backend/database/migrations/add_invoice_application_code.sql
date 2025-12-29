-- 添加发票申请编码字段
ALTER TABLE `invoices` 
ADD COLUMN `application_code` VARCHAR(50) COMMENT '发票申请编码' AFTER `id`,
ADD UNIQUE INDEX `idx_application_code` (`application_code`);

