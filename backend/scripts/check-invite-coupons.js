/**
 * 检查用户邀请和优惠券发放情况
 */

const db = require('../config/database');

async function checkInviteCoupons() {
  try {
    // 查找邀请码为I40866389的邀请人（授课人）
    console.log('查找邀请码 I40866389 对应的邀请人...\n');
    const [instructors] = await db.query(
      'SELECT id, nickname, real_name, member_id, instructor_id, role FROM users WHERE instructor_id = ?',
      ['I40866389']
    );
    
    if (instructors.length === 0) {
      console.log('未找到邀请码 I40866389 对应的邀请人');
      return;
    }
    
    const inviter = instructors[0];
    console.log(`找到邀请人: ID=${inviter.id}, 姓名=${inviter.real_name || inviter.nickname}, 会员号=${inviter.member_id}, 授课人ID=${inviter.instructor_id}, 角色=${inviter.role}\n`);
    
    // 查找被这个邀请人邀请的所有用户
    console.log('查找被邀请的用户...\n');
    const [invitees] = await db.query(
      `SELECT u.id, u.nickname, u.real_name, u.member_id, u.inviter_id, u.created_at,
              i.invite_code, i.status as invite_status
       FROM users u
       LEFT JOIN invitations i ON u.id = i.invitee_id AND i.inviter_id = ?
       WHERE u.inviter_id = ?
       ORDER BY u.created_at DESC`,
      [inviter.id, inviter.id]
    );
    
    console.log(`找到 ${invitees.length} 个被邀请的用户:\n`);
    
    for (const invitee of invitees) {
      console.log(`用户: ${invitee.real_name || invitee.nickname} (${invitee.member_id})`);
      console.log(`  注册时间: ${invitee.created_at}`);
      console.log(`  邀请关系: inviter_id=${invitee.inviter_id}, invite_code=${invitee.invite_code || 'NULL'}`);
      
      // 查找该用户的优惠券
      const [coupons] = await db.query(
        `SELECT id, discount_code, amount, source, source_user_id, status, created_at, expiry_date
         FROM discount_coupons
         WHERE user_id = ? AND source IN ('instructor_invite', 'channel_invite', 'invite_register')
         ORDER BY created_at DESC`,
        [invitee.id]
      );
      
      if (coupons.length > 0) {
        console.log(`  优惠券数量: ${coupons.length}`);
        coupons.forEach(coupon => {
          console.log(`    - ${coupon.discount_code}: ¥${coupon.amount}, 来源=${coupon.source}, 状态=${coupon.status}, 创建时间=${coupon.created_at}`);
        });
      } else {
        console.log(`  优惠券数量: 0 (未发放)`);
        
        // 检查授课人推广方案配置
        const [schemes] = await db.query(
          'SELECT * FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
          ['instructor_invite', 'active']
        );
        
        if (schemes.length > 0) {
          console.log(`  授课人推广方案存在，应该发放优惠券但未发放！`);
        } else {
          console.log(`  授课人推广方案不存在或未激活`);
        }
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkInviteCoupons();


