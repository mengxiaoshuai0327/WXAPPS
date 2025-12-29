-- 在tickets表中添加discount_coupon_id字段，用于记录该课券使用的优惠券
ALTER TABLE `tickets`
  ADD COLUMN `discount_coupon_id` INT NULL COMMENT '使用的折扣券ID（如果有使用优惠券）' AFTER `source_user_id`,
  ADD INDEX `idx_discount_coupon_id` (`discount_coupon_id`),
  ADD FOREIGN KEY (`discount_coupon_id`) REFERENCES `discount_coupons`(`id`) ON DELETE SET NULL;

