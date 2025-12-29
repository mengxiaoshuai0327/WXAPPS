const db = require('../config/database');

async function findMXSUser() {
  try {
    // 查找所有可能的MXS用户（通过多种方式）
    const [users1] = await db.query(`
      SELECT id, nickname, member_id, phone, role, inviter_id
      FROM users
      WHERE nickname LIKE '%孟%' 
         OR nickname LIKE '%小帅%'
         OR nickname LIKE '%MXS%'
         OR nickname LIKE '%mxs%'
    `);

    // 查找所有会员，看看哪些可能是MXS
    const [users2] = await db.query(`
      SELECT id, nickname, member_id, phone, role, inviter_id
      FROM users
      WHERE role = 'member'
      ORDER BY id
    `);

    console.log('=== 可能的MXS用户 ===\n');
    if (users1.length > 0) {
      users1.forEach(user => {
        console.log(`ID: ${user.id} | ${user.nickname} | 会员ID: ${user.member_id || 'N/A'} | 手机号: ${user.phone || 'N/A'}`);
      });
    } else {
      console.log('未找到昵称包含"孟"、"小帅"、"MXS"的用户\n');
    }

    console.log('\n=== 所有会员用户 ===\n');
    users2.forEach(user => {
      console.log(`ID: ${user.id} | ${user.nickname} | 会员ID: ${user.member_id || 'N/A'} | 手机号: ${user.phone || 'N/A'}`);
    });

    // 检查邀请记录
    console.log('\n=== 邀请记录 ===\n');
    const [invitations] = await db.query(`
      SELECT 
        i.id,
        i.inviter_id,
        i.invitee_id,
        i.invite_code,
        u_inviter.nickname as inviter_nickname,
        u_inviter.member_id as inviter_member_id,
        u_invitee.nickname as invitee_nickname,
        u_invitee.member_id as invitee_member_id
      FROM invitations i
      LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
      LEFT JOIN users u_invitee ON i.invitee_id = u_invitee.id
      ORDER BY i.created_at DESC
    `);

    invitations.forEach(inv => {
      console.log(`邀请码: ${inv.invite_code}`);
      console.log(`  邀请人: ${inv.inviter_nickname} (ID=${inv.inviter_id}, member_id=${inv.inviter_member_id || 'N/A'})`);
      console.log(`  被邀请人: ${inv.invitee_nickname} (ID=${inv.invitee_id}, member_id=${inv.invitee_member_id || 'N/A'})\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

findMXSUser();





























































