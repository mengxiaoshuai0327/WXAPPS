const db = require('../config/database');

async function listAllUsers() {
  try {
    const [users] = await db.query(`
      SELECT id, nickname, member_id, phone, role, inviter_id, created_at
      FROM users
      WHERE role IN ('member', 'instructor')
      ORDER BY id
    `);

    console.log('所有会员和授课人：\n');
    users.forEach(user => {
      console.log(`ID: ${user.id} | ${user.nickname || 'N/A'} | 会员ID: ${user.member_id || 'N/A'} | 角色: ${user.role} | 邀请人ID: ${user.inviter_id || 'N/A'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

listAllUsers();





























































