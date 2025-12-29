-- 检查孟十五的注册信息和优惠券发放情况

-- 1. 检查孟十五的注册信息
SELECT 
  id, 
  member_id, 
  real_name, 
  inviter_id, 
  promotion_type,
  instructor_id_for_promotion, 
  instructor_name_for_promotion,
  created_at
FROM users 
WHERE real_name = '孟十五'
ORDER BY created_at DESC 
LIMIT 1;

-- 2. 检查孟十五是否发放了优惠券
SELECT 
  dc.id,
  dc.discount_code,
  dc.user_id,
  dc.amount,
  dc.source,
  dc.source_user_id,
  dc.start_date,
  dc.expiry_date,
  dc.status,
  dc.promotion_type,
  dc.instructor_id_for_promotion,
  dc.instructor_name_for_promotion,
  dc.created_at,
  u.real_name as user_name,
  u.member_id as user_member_id
FROM discount_coupons dc
LEFT JOIN users u ON dc.user_id = u.id
WHERE u.real_name = '孟十五'
ORDER BY dc.created_at DESC;

-- 3. 检查邀请人（授课人张三）的信息
SELECT 
  id,
  member_id,
  instructor_id,
  role,
  nickname,
  real_name
FROM users 
WHERE instructor_id = 'I140866389' 
  OR instructor_id = '140866389'
  OR real_name = '张三'
ORDER BY id DESC
LIMIT 5;

-- 4. 检查邀请记录
SELECT 
  i.id,
  i.inviter_id,
  i.invitee_id,
  i.invite_code,
  i.status,
  i.registered_at,
  i.created_at,
  u_inviter.real_name as inviter_name,
  u_inviter.instructor_id as inviter_instructor_id,
  u_invitee.real_name as invitee_name,
  u_invitee.member_id as invitee_member_id
FROM invitations i
LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
LEFT JOIN users u_invitee ON i.invitee_id = u_invitee.id
WHERE u_invitee.real_name = '孟十五'
ORDER BY i.created_at DESC;

-- 5. 检查授课人推广方案是否存在且激活
SELECT * 
FROM coupon_schemes 
WHERE scheme_type = 'instructor_invite' 
  AND status = 'active';

-- 6. 检查是否有其他通过同一个授课人注册的用户获得了优惠券（用于对比）
SELECT 
  dc.id,
  dc.user_id,
  dc.amount,
  dc.source,
  dc.source_user_id,
  dc.created_at,
  u.real_name as user_name,
  u.member_id,
  u.created_at as user_created_at,
  u_source.real_name as inviter_name,
  u_source.instructor_id as inviter_instructor_id
FROM discount_coupons dc
LEFT JOIN users u ON dc.user_id = u.id
LEFT JOIN users u_source ON dc.source_user_id = u_source.id
WHERE dc.source = 'instructor_invite'
  AND u_source.instructor_id IN ('I140866389', '140866389')
  AND u_source.role = 'instructor'
ORDER BY u.created_at DESC
LIMIT 10;

-- 7. 检查最近注册的通过授课人邀请的用户
SELECT 
  u.id,
  u.member_id,
  u.real_name,
  u.inviter_id,
  u.promotion_type,
  u.instructor_id_for_promotion,
  u.instructor_name_for_promotion,
  u.created_at,
  u_inviter.real_name as inviter_name,
  u_inviter.instructor_id as inviter_instructor_id,
  (SELECT COUNT(*) FROM discount_coupons dc WHERE dc.user_id = u.id AND dc.source = 'instructor_invite') as coupon_count
FROM users u
LEFT JOIN users u_inviter ON u.inviter_id = u_inviter.id
WHERE u_inviter.instructor_id IN ('I140866389', '140866389')
  AND u_inviter.role = 'instructor'
ORDER BY u.created_at DESC
LIMIT 10;

