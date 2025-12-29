-- 渠道推广优惠券发放问题排查和修复SQL脚本
-- 用户：赵五（M23201355），邀请码：联想1（M96143951）

-- ============================================
-- 步骤1：检查被邀请人（赵五）的信息
-- ============================================
SELECT '【步骤1】被邀请人信息' as step;
SELECT id, member_id, nickname, real_name, inviter_id, role, created_at 
FROM users 
WHERE member_id = 'M23201355';

-- ============================================
-- 步骤2：检查邀请人（联想1）的信息
-- ============================================
SELECT '【步骤2】邀请人信息' as step;
SELECT id, member_id, role, channel_user_id, nickname, real_name 
FROM users 
WHERE member_id = 'M96143951';

-- ============================================
-- 步骤3：检查邀请关系
-- ============================================
SELECT '【步骤3】邀请关系检查' as step;
SELECT 
    u1.member_id as invitee_member_id,
    u1.inviter_id as invitee_inviter_id,
    u2.id as inviter_id,
    u2.member_id as inviter_member_id,
    CASE 
        WHEN u1.inviter_id = u2.id THEN '✓ 邀请关系正确'
        ELSE '❌ 邀请关系不匹配'
    END as relation_status
FROM users u1
LEFT JOIN users u2 ON u1.inviter_id = u2.id
WHERE u1.member_id = 'M23201355' AND u2.member_id = 'M96143951';

-- ============================================
-- 步骤4：检查渠道方信息（如果channel_user_id存在）
-- ============================================
SELECT '【步骤4】渠道方信息' as step;
SELECT c.id, c.channel_code, c.channel_name, c.channel_short_name
FROM channels c
WHERE c.id = (
    SELECT u.channel_user_id 
    FROM users u 
    WHERE u.member_id = 'M96143951' 
      AND u.channel_user_id IS NOT NULL
);

-- ============================================
-- 步骤5：检查渠道推广方案配置
-- ============================================
SELECT '【步骤5】渠道推广方案配置' as step;
SELECT cps.*
FROM channel_promotion_schemes cps
WHERE cps.channel_code = (
    SELECT c.channel_code 
    FROM channels c
    WHERE c.id = (
        SELECT u.channel_user_id 
        FROM users u 
        WHERE u.member_id = 'M96143951' 
          AND u.channel_user_id IS NOT NULL
    )
    AND c.channel_code IS NOT NULL
)
AND cps.status = 'active';

-- ============================================
-- 步骤6：检查所有激活的渠道推广方案（用于参考）
-- ============================================
SELECT '【步骤6】所有激活的渠道推广方案' as step;
SELECT * FROM channel_promotion_schemes WHERE status = 'active';

-- ============================================
-- 步骤7：检查已发放的优惠券
-- ============================================
SELECT '【步骤7】已发放的优惠券' as step;
SELECT dc.id, dc.discount_code, dc.amount, dc.source, dc.source_user_id, dc.status, 
       dc.channel_name_for_promotion, dc.channel_sales_id_for_promotion, 
       dc.channel_sales_name_for_promotion, dc.created_at
FROM discount_coupons dc
WHERE dc.user_id = (SELECT id FROM users WHERE member_id = 'M23201355')
  AND dc.source = 'channel_invite';

-- ============================================
-- 修复脚本（请根据实际情况执行）
-- ============================================

-- 修复1：如果发现联想1的channel_user_id为NULL，需要设置（请替换<渠道方ID>为实际的渠道方ID）
-- 首先查找渠道方ID：
SELECT '查找渠道方ID' as step;
SELECT id, channel_code, channel_name FROM channels WHERE channel_name LIKE '%联想%' OR channel_code LIKE '%联想%';

-- 然后更新（假设渠道方ID是X，请替换X为实际ID）：
-- UPDATE users SET channel_user_id = X WHERE member_id = 'M96143951';

-- 修复2：如果发现渠道方的channel_code为NULL，需要设置（请替换<渠道方ID>和'<channel_code>'）
-- UPDATE channels SET channel_code = '<channel_code>' WHERE id = <渠道方ID>;

-- 修复3：如果发现没有对应的渠道推广方案，需要创建（请替换相应的值）
-- INSERT INTO channel_promotion_schemes (channel_code, channel_name, amount, expiry_days, description, status)
-- VALUES ('<channel_code>', '<渠道名称>', 500.00, 30, '渠道推广方案', 'active');

