-- 添加会员详细资料和能力自评字段到users表
-- 使用JSON字段以便灵活存储

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `member_profile` JSON NULL COMMENT '会员详细资料（JSON格式）' AFTER `company`,
  ADD COLUMN IF NOT EXISTS `ability_assessment` JSON NULL COMMENT '能力自评（JSON格式）' AFTER `member_profile`;

-- 示例JSON结构：
-- member_profile: {
--   "position": "OA" | "OB" | "OC" | "OD" | "OE" | "OF",
--   "position_other": "自定义职位说明（当position为OF时）"
--   "company_type": "OA" | "OB" | "OC" | "OD" | "OE" | "OF" | "OG" | "OH" | "OI" | "OJ",
--   "company_type_other": "自定义公司类型说明（当company_type为OF或OJ时）"
--   -- 其他字段可以后续添加
-- }
-- 
-- ability_assessment: {
--   -- 能力自评相关字段，结构待定，可以根据实际需求扩展
-- }
