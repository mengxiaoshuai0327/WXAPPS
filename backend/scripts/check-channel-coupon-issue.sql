-- 渠道推广优惠券发放问题排查SQL脚本
-- 用户：赵三（M87844615），邀请码：M85101163（财销1）

-- ============================================
-- 步骤1：检查被邀请人（赵三）信息
-- ============================================
SELECT '【步骤1】被邀请人信息' as step;
SELECT id, member_id, nickname, real_name, inviter_id, role, created_at 
FROM users 
WHERE member_id = 'M87844615';

-- ============================================
-- 步骤2：检查邀请人（财销1）信息
-- ============================================
SELECT '【步骤2】邀请人信息' as step;
SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name 
FROM users 
WHERE member_id = 'M85101163';

-- 如果上面的查询中 channel_user_id 为 NULL，说明财销1没有被识别为渠道销售
-- 这是问题的根源之一

-- ============================================
-- 步骤3：检查渠道方信息（如果channel_user_id存在）
-- ============================================
SELECT '【步骤3】渠道方信息' as step;
SELECT c.id, c.channel_code, c.channel_name, c.channel_short_name
FROM channels c
WHERE c.id = (
    SELECT u.channel_user_id 
    FROM users u 
    WHERE u.member_id = 'M85101163' 
      AND u.channel_user_id IS NOT NULL
);

-- 如果上面的查询没有结果，说明：
-- 1. 财销1的channel_user_id为NULL，或者
-- 2. 对应的渠道方记录不存在

-- 如果查询有结果但channel_code为NULL，这也是一个问题

-- ============================================
-- 步骤4：检查渠道推广方案配置
-- ============================================
SELECT '【步骤4】渠道推广方案配置' as step;
SELECT cps.*
FROM channel_promotion_schemes cps
WHERE cps.channel_code = (
    SELECT c.channel_code 
    FROM channels c
    WHERE c.id = (
        SELECT u.channel_user_id 
        FROM users u 
        WHERE u.member_id = 'M85101163' 
          AND u.channel_user_id IS NOT NULL
    )
    AND c.channel_code IS NOT NULL
)
AND cps.status = 'active';

-- 如果上面的查询没有结果，说明：
-- 1. 渠道方的channel_code为空，或者
-- 2. channel_promotion_schemes表中没有对应channel_code的配置，或者
-- 3. 配置的状态不是'active'

-- ============================================
-- 步骤5：检查所有激活的渠道推广方案（用于参考）
-- ============================================
SELECT '【步骤5】所有激活的渠道推广方案' as step;
SELECT * FROM channel_promotion_schemes WHERE status = 'active';

-- ============================================
-- 步骤6：检查已发放的优惠券
-- ============================================
SELECT '【步骤6】已发放的优惠券' as step;
SELECT dc.id, dc.discount_code, dc.amount, dc.source, dc.source_user_id, dc.status, 
       dc.channel_name_for_promotion, dc.channel_sales_id_for_promotion, 
       dc.channel_sales_name_for_promotion, dc.created_at
FROM discount_coupons dc
WHERE dc.user_id = (SELECT id FROM users WHERE member_id = 'M87844615')
  AND dc.source = 'channel_invite';

-- 如果上面的查询没有结果，说明优惠券确实没有被发放

-- ============================================
-- 步骤7：检查用户的所有优惠券（用于参考）
-- ============================================
SELECT '【步骤7】用户所有优惠券' as step;
SELECT id, discount_code, amount, source, source_user_id, status, created_at
FROM discount_coupons 
WHERE user_id = (SELECT id FROM users WHERE member_id = 'M87844615')
ORDER BY created_at DESC;

-- ============================================
-- 步骤8：检查所有渠道销售用户（用于参考）
-- ============================================
SELECT '【步骤8】所有渠道销售用户' as step;
SELECT u.id, u.member_id, u.nickname, u.real_name, u.channel_user_id, 
       c.channel_code, c.channel_name
FROM users u
LEFT JOIN channels c ON u.channel_user_id = c.id
WHERE u.role = 'member' 
  AND u.channel_user_id IS NOT NULL
ORDER BY u.member_id;

-- ============================================
-- 快速修复建议（请根据实际情况修改）
-- ============================================

-- 如果发现财销1的channel_user_id为NULL，需要执行：
-- 1. 先查找渠道方ID（替换'财销1'为实际的渠道名称）
-- SELECT id, channel_code, channel_name FROM channels WHERE channel_name LIKE '%财销1%';

-- 2. 然后更新财销1的channel_user_id（替换<渠道方ID>为实际的ID）
-- UPDATE users SET channel_user_id = <渠道方ID> WHERE member_id = 'M85101163';

-- 如果发现渠道方的channel_code为NULL，需要执行（替换<渠道方ID>和'<channel_code>'）：
-- UPDATE channels SET channel_code = '<channel_code>' WHERE id = <渠道方ID>;

-- 如果发现没有对应的渠道推广方案，需要在管理员后台创建：
-- INSERT INTO channel_promotion_schemes (channel_code, channel_name, amount, expiry_days, status)
-- VALUES ('<channel_code>', '<渠道名称>', 500.00, 30, 'active');

