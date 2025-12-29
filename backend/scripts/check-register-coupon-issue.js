// 检查注册时优惠券发放问题
const db = require('../config/database');
require('dotenv').config();

async function checkRegisterCouponIssue() {
  try {
    const inviteCode = '140866389'; // 从图片中看到的邀请码
    
    console.log(`检查邀请码: ${inviteCode}\n`);
    
    // 1. 查找邀请码对应的用户
    let [inviters] = await db.query(
      'SELECT id, member_id, instructor_id, role, nickname, real_name FROM users WHERE member_id = ? OR instructor_id = ?',
      [inviteCode, inviteCode]
    );
    
    if (inviters.length === 0) {
      console.log(`❌ 未找到邀请码 ${inviteCode} 对应的用户`);
      process.exit(1);
    }
    
    const inviter = inviters[0];
    console.log(`✓ 找到邀请人:`);
    console.log(`  - ID: ${inviter.id}`);
    console.log(`  - 角色: ${inviter.role}`);
    console.log(`  - 会员号: ${inviter.member_id}`);
    console.log(`  - 授课人编号: ${inviter.instructor_id || 'N/A'}`);
    console.log(`  - 昵称: ${inviter.nickname}`);
    console.log(`  - 姓名: ${inviter.real_name || 'N/A'}\n`);
    
    // 2. 检查是否有激活的授课人推广方案
    if (inviter.role === 'instructor') {
      console.log(`检查授课人推广方案配置...`);
      const [schemes] = await db.query(
        'SELECT * FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
        ['instructor_invite', 'active']
      );
      
      if (schemes.length === 0) {
        console.log(`❌ 未找到激活的授课人推广方案 (scheme_type='instructor_invite', status='active')`);
        console.log(`\n这就是为什么注册时没有发放优惠券的原因！`);
        console.log(`\n需要在 coupon_schemes 表中创建或激活授课人推广方案。`);
        
        // 检查是否有未激活的方案
        const [inactiveSchemes] = await db.query(
          'SELECT * FROM coupon_schemes WHERE scheme_type = ?',
          ['instructor_invite']
        );
        
        if (inactiveSchemes.length > 0) {
          console.log(`\n找到 ${inactiveSchemes.length} 个未激活的授课人推广方案:`);
          inactiveSchemes.forEach(scheme => {
            console.log(`  - ID: ${scheme.id}, 状态: ${scheme.status}, 被邀请人金额: ${scheme.instructor_invitee_amount || 'N/A'}`);
          });
          console.log(`\n建议：将这些方案的状态改为 'active'`);
        } else {
          console.log(`\n需要创建授课人推广方案。`);
        }
      } else {
        const scheme = schemes[0];
        console.log(`✓ 找到激活的授课人推广方案:`);
        console.log(`  - ID: ${scheme.id}`);
        console.log(`  - 被邀请人金额: ¥${scheme.instructor_invitee_amount || 0}`);
        console.log(`  - 有效期天数: ${scheme.invitee_expiry_days || 30} 天`);
        
        if (!scheme.instructor_invitee_amount || parseFloat(scheme.instructor_invitee_amount) <= 0) {
          console.log(`\n⚠️  警告：授课人推广方案的被邀请人金额为 ${scheme.instructor_invitee_amount || 0}，金额必须大于0才会发放优惠券！`);
        }
      }
    } else if (inviter.role === 'member') {
      console.log(`该邀请人是会员角色，应该按照会员推广方案处理。`);
      const [memberSchemes] = await db.query(
        'SELECT * FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
        ['member_invite', 'active']
      );
      
      if (memberSchemes.length === 0) {
        console.log(`❌ 未找到激活的会员推广方案`);
      } else {
        const scheme = memberSchemes[0];
        console.log(`✓ 找到激活的会员推广方案:`);
        console.log(`  - 邀请人注册奖励: ¥${scheme.member_inviter_register_amount || 0}`);
        console.log(`  - 被邀请人注册奖励: ¥${scheme.member_invitee_amount || 0}`);
      }
    }
    
    // 3. 检查最近注册的用户（使用该邀请码）
    console.log(`\n检查最近使用该邀请码注册的用户...`);
    const [recentUsers] = await db.query(
      `SELECT u.id, u.member_id, u.nickname, u.real_name, u.created_at, 
              i.invite_code, i.status as invite_status
       FROM users u
       LEFT JOIN invitations i ON u.id = i.invitee_id AND i.invite_code = ?
       WHERE u.inviter_id = ?
       ORDER BY u.created_at DESC
       LIMIT 10`,
      [inviteCode, inviter.id]
    );
    
    if (recentUsers.length > 0) {
      console.log(`找到 ${recentUsers.length} 个使用该邀请码注册的用户:\n`);
      for (const user of recentUsers) {
        console.log(`用户: ${user.real_name || user.nickname} (${user.member_id})`);
        console.log(`  注册时间: ${user.created_at}`);
        console.log(`  邀请记录: ${user.invite_code ? '✓ 存在' : '❌ 不存在'}`);
        
        // 检查该用户是否有优惠券
        const [coupons] = await db.query(
          `SELECT id, discount_code, amount, source, status, created_at 
           FROM discount_coupons 
           WHERE user_id = ? AND source IN ('instructor_invite', 'invite_register')
           ORDER BY created_at DESC`,
          [user.id]
        );
        
        if (coupons.length > 0) {
          console.log(`  优惠券: ✓ ${coupons.length} 张`);
          coupons.forEach(c => {
            console.log(`    - ${c.discount_code}: ¥${c.amount}, 来源=${c.source}, 状态=${c.status}`);
          });
        } else {
          console.log(`  优惠券: ❌ 0 张（未发放）`);
        }
        console.log('');
      }
    } else {
      console.log(`未找到使用该邀请码注册的用户`);
    }
    
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkRegisterCouponIssue();

