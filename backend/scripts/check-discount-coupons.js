const db = require('../config/database');

async function checkDiscountCoupons() {
  try {
    console.log('=== 检查折扣券数据 ===\n');

    // 1. 查询所有邀请注册奖励的折扣券
    const [coupons] = await db.query(`
      SELECT 
        dc.id,
        dc.user_id,
        dc.amount,
        dc.source,
        dc.source_user_id,
        dc.created_at,
        u_owner.nickname as owner_nickname,
        u_owner.member_id as owner_member_id,
        u_source.nickname as source_nickname,
        u_source.member_id as source_member_id
      FROM discount_coupons dc
      JOIN users u_owner ON dc.user_id = u_owner.id
      LEFT JOIN users u_source ON dc.source_user_id = u_source.id
      WHERE dc.source = 'invite_register'
      ORDER BY dc.created_at DESC
    `);

    console.log('邀请注册奖励折扣券：');
    console.log(`共 ${coupons.length} 条记录\n`);
    
    coupons.forEach((coupon, index) => {
      console.log(`折扣券 ${index + 1}:`);
      console.log(`  ID: ${coupon.id}`);
      console.log(`  拥有者 (user_id=${coupon.user_id}): ${coupon.owner_nickname} (${coupon.owner_member_id})`);
      console.log(`  来源用户 (source_user_id=${coupon.source_user_id}): ${coupon.source_nickname || 'N/A'} (${coupon.source_member_id || 'N/A'})`);
      console.log(`  金额: ¥${coupon.amount}`);
      console.log(`  创建时间: ${coupon.created_at}\n`);
    });

    // 2. 查询邀请记录
    const [invitations] = await db.query(`
      SELECT 
        i.id,
        i.inviter_id,
        i.invitee_id,
        i.invite_code,
        i.status,
        u_inviter.nickname as inviter_nickname,
        u_inviter.member_id as inviter_member_id,
        u_invitee.nickname as invitee_nickname,
        u_invitee.member_id as invitee_member_id
      FROM invitations i
      LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
      LEFT JOIN users u_invitee ON i.invitee_id = u_invitee.id
      ORDER BY i.created_at DESC
      LIMIT 5
    `);

    console.log('\n=== 邀请记录 ===\n');
    invitations.forEach((inv, index) => {
      console.log(`邀请记录 ${index + 1}:`);
      console.log(`  邀请人 (inviter_id=${inv.inviter_id}): ${inv.inviter_nickname} (${inv.inviter_member_id})`);
      console.log(`  被邀请人 (invitee_id=${inv.invitee_id}): ${inv.invitee_nickname} (${inv.invitee_member_id})`);
      console.log(`  邀请码: ${inv.invite_code}`);
      console.log(`  状态: ${inv.status}\n`);
    });

    // 3. 查询SYY和MXS的用户信息
    const [users] = await db.query(`
      SELECT id, nickname, member_id, phone, role, inviter_id
      FROM users
      WHERE nickname IN ('SYY', '孟小帅', 'MXS') 
         OR member_id IN ('M03152922', 'M20472900')
    `);

    console.log('\n=== 相关用户信息 ===\n');
    users.forEach((user) => {
      console.log(`${user.nickname} (ID=${user.id}, member_id=${user.member_id}):`);
      console.log(`  角色: ${user.role}`);
      console.log(`  手机号: ${user.phone || 'N/A'}`);
      console.log(`  邀请人ID: ${user.inviter_id || 'N/A'}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkDiscountCoupons();





























































