-- 检查邀请码 173084993 对应的用户信息

-- 1. 检查是否是member_id
SELECT id, member_id, instructor_id, role, nickname, real_name, channel_user_id
FROM users 
WHERE member_id = '173084993'
   OR member_id LIKE '%173084993%';

-- 2. 检查是否是instructor_id（尝试I前缀格式）
SELECT id, member_id, instructor_id, role, nickname, real_name, channel_user_id
FROM users 
WHERE instructor_id = '173084993'
   OR instructor_id = 'I173084993'
   OR instructor_id LIKE '%173084993%';

-- 3. 检查是否是渠道方ID（channel_code）
SELECT id, channel_code, channel_name
FROM channels 
WHERE channel_code LIKE '%173084993%'
   OR channel_code = '173084993'
   OR channel_code = 'channel_173084993';

-- 4. 检查孟二一的注册信息
SELECT id, member_id, instructor_id, role, inviter_id, promotion_type,
       instructor_id_for_promotion, channel_name_for_promotion,
       created_at
FROM users 
WHERE phone = '18900001111'
   OR real_name = '孟二一'
ORDER BY created_at DESC
LIMIT 5;

-- 5. 检查孟二一的邀请记录
SELECT i.*, 
       u_inviter.member_id as inviter_member_id,
       u_inviter.instructor_id as inviter_instructor_id,
       u_inviter.role as inviter_role
FROM invitations i
LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
LEFT JOIN users u_invitee ON i.invitee_id = u_invitee.id
WHERE u_invitee.phone = '18900001111'
   OR u_invitee.real_name = '孟二一'
ORDER BY i.created_at DESC;

-- 6. 检查孟二一的优惠券
SELECT dc.*,
       u.real_name as user_name,
       u_source.real_name as inviter_name
FROM discount_coupons dc
LEFT JOIN users u ON dc.user_id = u.id
LEFT JOIN users u_source ON dc.source_user_id = u_source.id
WHERE u.phone = '18900001111'
   OR u.real_name = '孟二一'
ORDER BY dc.created_at DESC;

