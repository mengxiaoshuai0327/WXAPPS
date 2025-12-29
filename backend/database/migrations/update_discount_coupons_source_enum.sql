-- 更新 discount_coupons 表的 source 字段 ENUM 类型
-- 添加新的来源类型：channel_invite, instructor_invite, admin_special

-- 方法1：先将 ENUM 改为 VARCHAR（临时）
ALTER TABLE `discount_coupons` 
MODIFY COLUMN `source` VARCHAR(50) NOT NULL COMMENT '来源';

-- 方法2：再改回 ENUM，包含所有新的值
ALTER TABLE `discount_coupons` 
MODIFY COLUMN `source` ENUM(
  'invite_register', 
  'invite_purchase', 
  'instructor_reward', 
  'admin',
  'channel_invite',
  'instructor_invite',
  'admin_special'
) NOT NULL COMMENT '来源';
