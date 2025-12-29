const db = require('../config/database');

async function checkInvitations() {
  try {
    // 查找邀请记录
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
    `);

    console.log('邀请记录：\n');
    invitations.forEach(inv => {
      console.log(`记录ID: ${inv.id}`);
      console.log(`  邀请码: ${inv.invite_code}`);
      console.log(`  邀请人 (inviter_id=${inv.inviter_id}): ${inv.inviter_nickname || 'N/A'} (${inv.inviter_member_id || 'N/A'})`);
      console.log(`  被邀请人 (invitee_id=${inv.invitee_id}): ${inv.invitee_nickname || 'N/A'} (${inv.invitee_member_id || 'N/A'})`);
      console.log(`  状态: ${inv.status}\n`);
    });

    // 根据邀请码查找用户
    if (invitations.length > 0 && invitations[0].invite_code) {
      const inviteCode = invitations[0].invite_code;
      console.log(`\n查找邀请码 ${inviteCode} 对应的用户：\n`);
      
      const [users] = await db.query(`
        SELECT id, nickname, member_id, phone, role
        FROM users
        WHERE member_id = ?
      `, [inviteCode]);

      users.forEach(user => {
        console.log(`找到用户:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  昵称: ${user.nickname}`);
        console.log(`  会员ID: ${user.member_id}`);
        console.log(`  手机号: ${user.phone || 'N/A'}`);
        console.log(`  角色: ${user.role}\n`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

checkInvitations();





























































