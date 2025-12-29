const db = require('../config/database');

async function checkInviteCode() {
  try {
    const inviteCode = 'I73084993';
    console.log(`=== 检查邀请码 ${inviteCode} ===\n`);

    // 1. 检查是否是instructor_id
    console.log('1. 检查是否是instructor_id:');
    const [instructorUsers] = await db.query(
      `SELECT id, member_id, instructor_id, role, nickname, real_name
       FROM users 
       WHERE instructor_id = ? AND role = 'instructor'`,
      [inviteCode]
    );
    
    if (instructorUsers.length > 0) {
      instructorUsers.forEach(user => {
        console.log(`  ✓ 找到授课人: id=${user.id}, instructor_id=${user.instructor_id}, name=${user.real_name || user.nickname}, role=${user.role}`);
      });
    } else {
      console.log(`  ✗ 未找到instructor_id=${inviteCode}的授课人`);
      // 检查是否只有数字部分存在
      const numOnly = inviteCode.replace(/^I/, '');
      console.log(`  尝试检查数字部分: ${numOnly}`);
      const [instructorUsers2] = await db.query(
        `SELECT id, member_id, instructor_id, role, nickname, real_name
         FROM users 
         WHERE instructor_id = ? AND role = 'instructor'`,
        [numOnly]
      );
      if (instructorUsers2.length > 0) {
        console.log(`  ⚠️  找到数字部分匹配: instructor_id=${instructorUsers2[0].instructor_id}`);
      }
    }

    // 2. 检查是否是member_id（以防万一）
    console.log('\n2. 检查是否是member_id:');
    const [memberUsers] = await db.query(
      `SELECT id, member_id, instructor_id, role, nickname, real_name, channel_user_id
       FROM users 
       WHERE member_id = ? AND role = 'member'`,
      [inviteCode]
    );
    
    if (memberUsers.length > 0) {
      memberUsers.forEach(user => {
        console.log(`  ✓ 找到会员: id=${user.id}, member_id=${user.member_id}, name=${user.real_name || user.nickname}`);
      });
    } else {
      console.log(`  ✗ 未找到member_id=${inviteCode}的会员`);
    }

    // 3. 检查孟二一的注册信息
    console.log('\n3. 检查孟二一的注册信息:');
    const [mengUsers] = await db.query(
      `SELECT id, member_id, instructor_id, role, inviter_id, promotion_type,
              instructor_id_for_promotion, channel_name_for_promotion,
              created_at
       FROM users 
       WHERE phone = '18900001111' OR real_name = '孟二一'
       ORDER BY created_at DESC
       LIMIT 5`
    );
    
    if (mengUsers.length > 0) {
      mengUsers.forEach(user => {
        console.log(`  用户ID: ${user.id}`);
        console.log(`  会员ID: ${user.member_id || 'NULL'}`);
        console.log(`  授课人ID: ${user.instructor_id || 'NULL'}`);
        console.log(`  角色: ${user.role}`);
        console.log(`  邀请人ID: ${user.inviter_id || 'NULL'}`);
        console.log(`  推广类型: ${user.promotion_type || 'NULL'}`);
        console.log(`  授课人ID（推广）: ${user.instructor_id_for_promotion || 'NULL'}`);
        console.log(`  注册时间: ${user.created_at}\n`);
      });
    } else {
      console.log('  ✗ 未找到孟二一的用户记录\n');
    }

    // 4. 检查邀请记录
    if (mengUsers.length > 0) {
      const mengUserId = mengUsers[0].id;
      console.log('4. 检查邀请记录:');
      const [invitations] = await db.query(
        `SELECT i.*, 
                u_inviter.member_id as inviter_member_id,
                u_inviter.instructor_id as inviter_instructor_id,
                u_inviter.role as inviter_role
         FROM invitations i
         LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
         WHERE i.invitee_id = ?
         ORDER BY i.created_at DESC`,
        [mengUserId]
      );
      
      if (invitations.length > 0) {
        invitations.forEach(inv => {
          console.log(`  邀请记录ID: ${inv.id}`);
          console.log(`  邀请码: ${inv.invite_code}`);
          console.log(`  邀请人ID: ${inv.inviter_id}`);
          console.log(`  邀请人member_id: ${inv.inviter_member_id || 'NULL'}`);
          console.log(`  邀请人instructor_id: ${inv.inviter_instructor_id || 'NULL'}`);
          console.log(`  邀请人角色: ${inv.inviter_role || 'NULL'}\n`);
        });
      } else {
        console.log('  ✗ 未找到邀请记录\n');
      }

      // 5. 检查优惠券
      console.log('5. 检查优惠券:');
      const [coupons] = await db.query(
        `SELECT dc.*,
                u_source.real_name as inviter_name
         FROM discount_coupons dc
         LEFT JOIN users u_source ON dc.source_user_id = u_source.id
         WHERE dc.user_id = ?
         ORDER BY dc.created_at DESC`,
        [mengUserId]
      );
      
      if (coupons.length > 0) {
        console.log(`  找到 ${coupons.length} 张优惠券:`);
        coupons.forEach(coupon => {
          console.log(`    优惠券ID: ${coupon.id}`);
          console.log(`    金额: ¥${coupon.amount}`);
          console.log(`    来源: ${coupon.source}`);
          console.log(`    邀请人: ${coupon.inviter_name || 'NULL'}\n`);
        });
      } else {
        console.log('  ✗ 未找到优惠券记录\n');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkInviteCode();

