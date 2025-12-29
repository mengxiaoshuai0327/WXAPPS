-- 检查渠道销售用户数据
-- 检查财销一(M85101163)和联想1(M96143951)的channel_user_id字段

-- ============================================
-- 步骤1：检查这两个用户的基本信息
-- ============================================
SELECT '【步骤1】用户基本信息' as step;

SELECT 
    id, 
    member_id, 
    role, 
    channel_user_id,
    nickname,
    real_name,
    CASE 
        WHEN role = 'member' AND channel_user_id IS NOT NULL THEN '是渠道销售'
        WHEN role = 'member' AND channel_user_id IS NULL THEN '普通会员'
        ELSE role
    END as user_type
FROM users 
WHERE member_id IN ('M85101163', 'M96143951');

-- ============================================
-- 步骤2：检查这些用户关联的渠道方信息（如果channel_user_id不为空）
-- ============================================
SELECT '【步骤2】关联的渠道方信息' as step;

SELECT 
    u.id as user_id,
    u.member_id,
    u.real_name as user_name,
    u.channel_user_id,
    c.id as channel_id,
    c.channel_code,
    c.channel_name
FROM users u
LEFT JOIN channels c ON u.channel_user_id = c.id
WHERE u.member_id IN ('M85101163', 'M96143951')
  AND u.channel_user_id IS NOT NULL;

-- ============================================
-- 步骤3：列出所有渠道方（供参考）
-- ============================================
SELECT '【步骤3】所有渠道方列表' as step;

SELECT id, channel_code, channel_name, created_at
FROM channels
ORDER BY id;

-- ============================================
-- 步骤4：检查是否有被邀请人使用这两个用户作为邀请人
-- ============================================
SELECT '【步骤4】邀请关系检查' as step;

SELECT 
    u_inviter.member_id as inviter_member_id,
    u_inviter.real_name as inviter_name,
    u_inviter.channel_user_id as inviter_channel_user_id,
    u_invitee.member_id as invitee_member_id,
    u_invitee.real_name as invitee_name,
    i.status as invitation_status,
    i.created_at as invitation_created_at
FROM invitations i
JOIN users u_inviter ON i.inviter_id = u_inviter.id
JOIN users u_invitee ON i.invitee_id = u_invitee.id
WHERE u_inviter.member_id IN ('M85101163', 'M96143951')
ORDER BY i.created_at DESC
LIMIT 10;

-- ============================================
-- 修复建议
-- ============================================
-- 如果步骤1中 channel_user_id 为 NULL，需要执行以下步骤：
--
-- 1. 从步骤3中找到对应的渠道方ID（假设为X）
-- 2. 执行以下SQL更新（请替换X为实际的渠道方ID）：
--
-- UPDATE users SET channel_user_id = X WHERE member_id = 'M85101163';
-- UPDATE users SET channel_user_id = X WHERE member_id = 'M96143951';
--
-- 3. 验证更新结果：
-- SELECT id, member_id, role, channel_user_id FROM users WHERE member_id IN ('M85101163', 'M96143951');

