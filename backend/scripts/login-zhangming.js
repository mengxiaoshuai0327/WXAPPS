// 快速登录张明账号（用于测试）
// 使用方法: node scripts/login-zhangming.js <openid>
// 如果不提供openid，将使用默认测试openid

const db = require('../config/database');

async function loginZhangMing(openid) {
  try {
    // 如果未提供openid，使用默认测试openid
    const targetOpenid = openid || `test_zhangming_${Date.now()}`;
    
    console.log(`开始登录张明账号...`);
    console.log(`使用的OpenID: ${targetOpenid}\n`);

    // 检查张明的账号信息
    const [zhangming] = await db.query('SELECT id, nickname, real_name, role, openid FROM users WHERE id = 1');
    if (zhangming.length === 0) {
      console.error('错误: 张明账号（ID=1）不存在');
      process.exit(1);
    }

    console.log(`张明账号信息:`);
    console.log(`  - ID: ${zhangming[0].id}`);
    console.log(`  - 昵称: ${zhangming[0].nickname}`);
    console.log(`  - 姓名: ${zhangming[0].real_name}`);
    console.log(`  - 角色: ${zhangming[0].role}`);
    console.log(`  - 当前OpenID: ${zhangming[0].openid || '(未绑定)'}\n`);

    // 检查是否已经有用户使用这个openid
    const [existingUsers] = await db.query('SELECT id, nickname, real_name FROM users WHERE openid = ?', [targetOpenid]);
    
    if (existingUsers.length > 0 && existingUsers[0].id !== 1) {
      const existingUser = existingUsers[0];
      console.log(`⚠️  警告: OpenID已绑定到其他用户:`);
      console.log(`  - ID: ${existingUser.id}`);
      console.log(`  - 昵称: ${existingUser.nickname || '(未设置)'}`);
      console.log(`  - 姓名: ${existingUser.real_name || '(未设置)'}`);
      console.log(`\n将解除该用户的绑定...`);
      
      // 将现有用户的openid清空
      await db.query('UPDATE users SET openid = ? WHERE id = ?', [`temp_${existingUser.id}_${Date.now()}`, existingUser.id]);
      console.log(`✓ 已解除原用户的OpenID绑定\n`);
    }

    // 将张明的openid更新为指定的openid
    await db.query('UPDATE users SET openid = ? WHERE id = ?', [targetOpenid, 1]);
    console.log(`✓ 成功将OpenID绑定到张明账号`);

    // 验证结果
    const [verify] = await db.query('SELECT id, nickname, real_name, role, openid FROM users WHERE id = 1', []);
    console.log(`\n✅ 登录设置完成!`);
    console.log(`\n当前绑定信息:`);
    console.log(`  - 用户: ${verify[0].real_name || verify[0].nickname}`);
    console.log(`  - OpenID: ${verify[0].openid}`);
    console.log(`  - 角色: ${verify[0].role}`);
    
    console.log(`\n📱 在小程序中的操作步骤:`);
    console.log(`1. 在小程序开发者工具的控制台输入以下命令设置OpenID:`);
    console.log(`   wx.setStorageSync('openid', '${targetOpenid}');`);
    console.log(`   wx.setStorageSync('userInfo', { id: 1, nickname: '张教授', role: 'instructor' });`);
    console.log(`   getApp().globalData.openid = '${targetOpenid}';`);
    console.log(`   getApp().globalData.userInfo = { id: 1, nickname: '张教授', role: 'instructor' };`);
    console.log(`\n2. 或者重新编译小程序，然后在小程序中重新登录`);
    console.log(`3. 小程序会自动识别OpenID并登录为张明账号\n`);

    process.exit(0);
  } catch (error) {
    console.error('登录设置失败:', error);
    process.exit(1);
  }
}

// 从命令行参数获取openid（可选）
const args = process.argv.slice(2);
const openid = args[0] || null;

loginZhangMing(openid);





























































