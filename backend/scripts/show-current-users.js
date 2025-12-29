// 显示所有用户及其OpenID，帮助找到当前登录的用户
const db = require('../config/database');

async function showUsers() {
  try {
    console.log('=== 所有用户列表 ===\n');
    
    const [users] = await db.query(
      'SELECT id, openid, nickname, real_name, role, phone, member_id FROM users ORDER BY id'
    );
    
    users.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`  昵称: ${user.nickname || '(未设置)'}`);
      console.log(`  姓名: ${user.real_name || '(未设置)'}`);
      console.log(`  角色: ${user.role}`);
      console.log(`  OpenID: ${user.openid || '(未绑定)'}`);
      if (user.phone) console.log(`  手机: ${user.phone}`);
      if (user.member_id) console.log(`  会员ID: ${user.member_id}`);
      console.log('');
    });
    
    console.log('=== 张明账号信息（ID=1）===');
    const [zhangming] = await db.query('SELECT * FROM users WHERE id = 1');
    if (zhangming.length > 0) {
      const zm = zhangming[0];
      console.log(`  昵称: ${zm.nickname}`);
      console.log(`  姓名: ${zm.real_name}`);
      console.log(`  角色: ${zm.role}`);
      console.log(`  当前OpenID: ${zm.openid || '(未绑定)'}`);
    }
    
    console.log('\n如需将当前OpenID绑定到张明，请运行:');
    console.log('node scripts/bind-zhangming.js "<你的openid>"');
    
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

showUsers();





























































