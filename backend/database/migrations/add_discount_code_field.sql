-- 添加折扣券编号字段
ALTER TABLE `discount_coupons` 
ADD COLUMN `discount_code` VARCHAR(50) UNIQUE COMMENT '折扣券编号' AFTER `id`;

-- 为现有数据生成折扣券编号（如果需要）
UPDATE `discount_coupons` 
SET `discount_code` = CONCAT('DC', LPAD(id, 8, '0'))
WHERE `discount_code` IS NULL;



