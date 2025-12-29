const db = require('../config/database');

async function findUsers() {
  try {
    // 查找所有可能的用户
    const [users] = await db.query(`
      SELECT id, nickname, member_id, phone, role, inviter_id
      FROM users
      WHERE nickname LIKE '%孟%' 
         OR nickname LIKE '%小帅%'
         OR nickname LIKE '%MXS%'
         OR member_id LIKE '%03152922%'
         OR member_id LIKE '%20472900%'
      ORDER BY id
    `);

    console.log('找到的用户：\n');
    users.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`  昵称: ${user.nickname}`);
      console.log(`  会员ID: ${user.member_id || 'N/A'}`);
      console.log(`  手机号: ${user.phone || 'N/A'}`);
      console.log(`  角色: ${user.role}`);
      console.log(`  邀请人ID: ${user.inviter_id || 'N/A'}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

findUsers();





























































