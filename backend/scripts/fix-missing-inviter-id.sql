-- 修复孟二六（ID: 78）的邀请人信息
-- 邀请码: M96143951 (渠道销售，ID: 53)

-- 1. 更新用户的邀请人ID和推广信息
UPDATE users 
SET 
  inviter_id = 53,
  promotion_type = 'channel',
  channel_sales_id_for_promotion = 'M96143951',
  channel_sales_name_for_promotion = '联想1',
  channel_name_for_promotion = '联想有限公司'
WHERE id = 78;

-- 2. 创建邀请记录（如果不存在）
INSERT IGNORE INTO invitations (inviter_id, invitee_id, invite_code, status, registered_at)
VALUES (53, 78, 'M96143951', 'registered', (SELECT created_at FROM users WHERE id = 78));

-- 3. 检查是否有渠道推广方案，如果有则发放优惠券
-- 首先查询渠道方的 channel_code
-- 然后查询渠道推广方案
-- 如果有方案，插入优惠券记录

-- 查询渠道方信息
SELECT channel_code FROM channels WHERE id = 7;

-- 假设 channel_code 是 'channel_990959'，查询推广方案
-- SELECT * FROM channel_promotion_schemes WHERE channel_code = 'channel_990959' AND status = 'active';

-- 如果找到了方案，可以手动插入优惠券（这里需要根据实际方案配置调整金额和有效期）
-- INSERT INTO discount_coupons (discount_code, user_id, amount, source, source_user_id, start_date, expiry_date, status, promotion_type, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion)
-- VALUES ('DC...', 78, 500.00, 'channel_invite', 53, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'unused', 'channel', '联想有限公司', 'M96143951', '联想1');

-- 4. 验证更新结果
SELECT id, member_id, real_name, phone, inviter_id, promotion_type, 
       channel_sales_id_for_promotion, channel_name_for_promotion, created_at
FROM users 
WHERE id = 78;

