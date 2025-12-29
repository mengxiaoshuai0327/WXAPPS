const db = require('../config/database');

async function checkMengshiwuCoupon() {
  try {
    console.log('=== 检查孟十五的注册信息和优惠券发放情况 ===\n');

    // 1. 检查孟十五的注册信息
    console.log('1. 检查孟十五的注册信息:');
    const [users] = await db.query(
      `SELECT 
        id, member_id, real_name, inviter_id, promotion_type,
        instructor_id_for_promotion, instructor_name_for_promotion,
        created_at
      FROM users 
      WHERE real_name = '孟十五'
      ORDER BY created_at DESC 
      LIMIT 1`
    );

    if (users.length === 0) {
      console.log('  未找到孟十五的用户记录\n');
      return;
    }

    const user = users[0];
    console.log(`  用户ID: ${user.id}`);
    console.log(`  会员ID: ${user.member_id}`);
    console.log(`  邀请人ID: ${user.inviter_id || 'NULL'}`);
    console.log(`  推广类型: ${user.promotion_type || 'NULL'}`);
    console.log(`  授课人ID: ${user.instructor_id_for_promotion || 'NULL'}`);
    console.log(`  授课人姓名: ${user.instructor_name_for_promotion || 'NULL'}`);
    console.log(`  注册时间: ${user.created_at}\n`);

    // 2. 检查优惠券
    console.log('2. 检查优惠券发放情况:');
    const [coupons] = await db.query(
      `SELECT 
        dc.id, dc.discount_code, dc.amount, dc.source, dc.source_user_id,
        dc.start_date, dc.expiry_date, dc.status, dc.created_at,
        u.real_name as user_name
      FROM discount_coupons dc
      LEFT JOIN users u ON dc.user_id = u.id
      WHERE dc.user_id = ?
      ORDER BY dc.created_at DESC`,
      [user.id]
    );

    if (coupons.length === 0) {
      console.log('  ❌ 未找到任何优惠券记录\n');
    } else {
      console.log(`  找到 ${coupons.length} 张优惠券:\n`);
      coupons.forEach((coupon, index) => {
        console.log(`  优惠券 ${index + 1}:`);
        console.log(`    ID: ${coupon.id}`);
        console.log(`    金额: ¥${coupon.amount}`);
        console.log(`    来源: ${coupon.source}`);
        console.log(`    状态: ${coupon.status}`);
        console.log(`    创建时间: ${coupon.created_at}\n`);
      });
    }

    // 3. 检查邀请人信息
    if (user.inviter_id) {
      console.log('3. 检查邀请人信息:');
      const [inviters] = await db.query(
        `SELECT id, member_id, instructor_id, role, nickname, real_name
        FROM users 
        WHERE id = ?`,
        [user.inviter_id]
      );

      if (inviters.length > 0) {
        const inviter = inviters[0];
        console.log(`  邀请人ID: ${inviter.id}`);
        console.log(`  邀请人姓名: ${inviter.real_name || inviter.nickname}`);
        console.log(`  邀请人角色: ${inviter.role}`);
        console.log(`  授课人ID: ${inviter.instructor_id || 'NULL'}\n`);
      }
    }

    // 4. 检查邀请记录
    console.log('4. 检查邀请记录:');
    const [invitations] = await db.query(
      `SELECT 
        i.id, i.invite_code, i.status, i.registered_at,
        u_inviter.real_name as inviter_name,
        u_invitee.real_name as invitee_name
      FROM invitations i
      LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
      LEFT JOIN users u_invitee ON i.invitee_id = u_invitee.id
      WHERE i.invitee_id = ?
      ORDER BY i.created_at DESC`,
      [user.id]
    );

    if (invitations.length === 0) {
      console.log('  ❌ 未找到邀请记录\n');
    } else {
      invitations.forEach((inv, index) => {
        console.log(`  邀请记录 ${index + 1}:`);
        console.log(`    邀请码: ${inv.invite_code}`);
        console.log(`    状态: ${inv.status}`);
        console.log(`    注册时间: ${inv.registered_at}\n`);
      });
    }

    // 5. 检查授课人推广方案
    console.log('5. 检查授课人推广方案:');
    const [schemes] = await db.query(
      `SELECT * 
      FROM coupon_schemes 
      WHERE scheme_type = 'instructor_invite' 
        AND status = 'active'`
    );

    if (schemes.length === 0) {
      console.log('  ❌ 未找到激活的授课人推广方案\n');
    } else {
      schemes.forEach((scheme, index) => {
        console.log(`  方案 ${index + 1}:`);
        console.log(`    ID: ${scheme.id}`);
        console.log(`    被邀请人金额: ¥${scheme.instructor_invitee_amount}`);
        console.log(`    有效期: ${scheme.invitee_expiry_days} 天\n`);
      });
    }

    // 6. 检查是否有其他用户通过同一个授课人获得了优惠券
    if (user.inviter_id) {
      console.log('6. 检查其他通过同一授课人注册的用户:');
      const [otherUsers] = await db.query(
        `SELECT 
          u.id, u.member_id, u.real_name, u.created_at,
          (SELECT COUNT(*) FROM discount_coupons dc WHERE dc.user_id = u.id AND dc.source = 'instructor_invite') as coupon_count
        FROM users u
        WHERE u.inviter_id = ?
        ORDER BY u.created_at DESC
        LIMIT 5`,
        [user.inviter_id]
      );

      console.log(`  找到 ${otherUsers.length} 个通过同一邀请人注册的用户:\n`);
      otherUsers.forEach((otherUser, index) => {
        console.log(`  用户 ${index + 1}: ${otherUser.real_name} (${otherUser.member_id})`);
        console.log(`    注册时间: ${otherUser.created_at}`);
        console.log(`    优惠券数量: ${otherUser.coupon_count}\n`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkMengshiwuCoupon();

