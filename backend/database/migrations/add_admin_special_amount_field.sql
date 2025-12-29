-- 为coupon_schemes表添加admin_special_amount字段，用于特殊推广方案的金额配置

-- 直接尝试添加字段，如果已存在会报错，但我们可以忽略
ALTER TABLE `coupon_schemes` 
  ADD COLUMN `admin_special_amount` DECIMAL(10,2) DEFAULT 500.00 COMMENT '特殊推广默认金额' AFTER `admin_special_expiry_days`;

-- 更新现有数据，设置默认值为500
UPDATE `coupon_schemes` 
SET `admin_special_amount` = 500.00 
WHERE `scheme_type` = 'admin_special' 
  AND (`admin_special_amount` IS NULL OR `admin_special_amount` = 0);
