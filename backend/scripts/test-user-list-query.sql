-- 测试用户列表查询，检查inviter_channel_user_id字段是否正确获取

SELECT 
    u.id,
    u.member_id,
    u.real_name as user_name,
    u.inviter_id,
    u_inviter.real_name as inviter_real_name,
    u_inviter.member_id as inviter_member_id,
    u_inviter.role as inviter_role,
    u_inviter.channel_user_id as inviter_channel_user_id,
    CASE 
        WHEN u_inviter.role = 'member' AND u_inviter.channel_user_id IS NOT NULL THEN '是渠道销售'
        WHEN u_inviter.role = 'member' AND u_inviter.channel_user_id IS NULL THEN '普通会员'
        WHEN u_inviter.role = 'instructor' THEN '授课人'
        ELSE u_inviter.role
    END as inviter_type
FROM users u
LEFT JOIN users u_inviter ON u.inviter_id = u_inviter.id
WHERE u.inviter_id IS NOT NULL
  AND u_inviter.member_id IN ('M85101163', 'M96143951')
ORDER BY u.created_at DESC
LIMIT 10;

