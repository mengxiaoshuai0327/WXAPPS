-- 添加推广来源信息字段到users表和discount_coupons表

-- 1. 在users表中添加推广来源信息字段
ALTER TABLE `users`
  ADD COLUMN `promotion_type` ENUM('instructor', 'channel') NULL COMMENT '推广类型：授课人推广/渠道推广' AFTER `inviter_id`,
  ADD COLUMN `instructor_id_for_promotion` VARCHAR(50) NULL COMMENT '推广授课人ID（如果是授课人推广）' AFTER `promotion_type`,
  ADD COLUMN `instructor_name_for_promotion` VARCHAR(100) NULL COMMENT '推广授课人姓名（如果是授课人推广）' AFTER `instructor_id_for_promotion`,
  ADD COLUMN `channel_name_for_promotion` VARCHAR(200) NULL COMMENT '推广渠道名称（如果是渠道推广）' AFTER `instructor_name_for_promotion`,
  ADD COLUMN `channel_sales_id_for_promotion` VARCHAR(50) NULL COMMENT '推广渠道销售ID（如果是渠道推广）' AFTER `channel_name_for_promotion`,
  ADD COLUMN `channel_sales_name_for_promotion` VARCHAR(100) NULL COMMENT '推广渠道销售姓名（如果是渠道推广）' AFTER `channel_sales_id_for_promotion`;

-- 2. 在discount_coupons表中添加推广来源信息字段
ALTER TABLE `discount_coupons`
  ADD COLUMN `promotion_type` ENUM('instructor', 'channel') NULL COMMENT '推广类型：授课人推广/渠道推广' AFTER `source_user_id`,
  ADD COLUMN `instructor_id_for_promotion` VARCHAR(50) NULL COMMENT '推广授课人ID（如果是授课人推广）' AFTER `promotion_type`,
  ADD COLUMN `instructor_name_for_promotion` VARCHAR(100) NULL COMMENT '推广授课人姓名（如果是授课人推广）' AFTER `instructor_id_for_promotion`,
  ADD COLUMN `channel_name_for_promotion` VARCHAR(200) NULL COMMENT '推广渠道名称（如果是渠道推广）' AFTER `instructor_name_for_promotion`,
  ADD COLUMN `channel_sales_id_for_promotion` VARCHAR(50) NULL COMMENT '推广渠道销售ID（如果是渠道推广）' AFTER `channel_name_for_promotion`,
  ADD COLUMN `channel_sales_name_for_promotion` VARCHAR(100) NULL COMMENT '推广渠道销售姓名（如果是渠道推广）' AFTER `channel_sales_id_for_promotion`;

-- 3. 添加索引以便查询
ALTER TABLE `users`
  ADD INDEX `idx_promotion_type` (`promotion_type`);

ALTER TABLE `discount_coupons`
  ADD INDEX `idx_promotion_type` (`promotion_type`);

