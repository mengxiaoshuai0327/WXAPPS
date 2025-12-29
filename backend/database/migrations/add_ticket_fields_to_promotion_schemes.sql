-- 为渠道推广方案表添加课券数量和单价字段
ALTER TABLE `channel_promotion_schemes`
  ADD COLUMN `ticket_count` INT DEFAULT 1 COMMENT '赠送课券数量（默认1张）' AFTER `amount`,
  ADD COLUMN `ticket_price` DECIMAL(10,2) NULL COMMENT '每张课券价格（NULL表示使用amount/ticket_count计算）' AFTER `ticket_count`;

-- 为coupon_schemes表添加课券数量和单价字段（用于教练推广方案）
ALTER TABLE `coupon_schemes`
  ADD COLUMN `ticket_count` INT DEFAULT 1 COMMENT '赠送课券数量（默认1张，仅用于instructor_invite类型）' AFTER `instructor_invitee_amount`,
  ADD COLUMN `ticket_price` DECIMAL(10,2) NULL COMMENT '每张课券价格（NULL表示使用instructor_invitee_amount/ticket_count计算，仅用于instructor_invite类型）' AFTER `ticket_count`;

-- 初始化现有数据：如果没有设置ticket_price，则根据amount/ticket_count计算
-- 对于channel_promotion_schemes
UPDATE `channel_promotion_schemes`
SET `ticket_price` = ROUND(`amount` / `ticket_count`, 2)
WHERE `ticket_price` IS NULL AND `amount` > 0 AND `ticket_count` > 0;

-- 对于coupon_schemes（仅instructor_invite类型）
UPDATE `coupon_schemes`
SET `ticket_price` = ROUND(`instructor_invitee_amount` / `ticket_count`, 2)
WHERE `scheme_type` = 'instructor_invite' 
  AND `ticket_price` IS NULL 
  AND `instructor_invitee_amount` > 0 
  AND `ticket_count` > 0;

