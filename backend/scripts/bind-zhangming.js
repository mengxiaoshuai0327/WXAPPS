// 将指定OpenID绑定到张明（ID=1）的账号
// 使用方法: 
// 1. 在小程序中查看当前登录的OpenID (app.globalData.openid)
// 2. 运行: node scripts/bind-zhangming.js <openid>

const db = require('../config/database');

async function bindToZhangMing(openid) {
  try {
    console.log(`开始将OpenID绑定到张明账号...`);
    console.log(`OpenID: ${openid}`);

    // 检查张明的账号信息
    const [zhangming] = await db.query('SELECT id, nickname, real_name, role, openid FROM users WHERE id = 1');
    if (zhangming.length === 0) {
      console.error('错误: 张明账号（ID=1）不存在');
      process.exit(1);
    }

    console.log(`\n张明账号信息:`);
    console.log(`  - ID: ${zhangming[0].id}`);
    console.log(`  - 昵称: ${zhangming[0].nickname || '(未设置)'}`);
    console.log(`  - 姓名: ${zhangming[0].real_name || '(未设置)'}`);
    console.log(`  - 角色: ${zhangming[0].role}`);
    console.log(`  - 当前OpenID: ${zhangming[0].openid || '(未绑定)'}`);

    // 检查是否已经有用户使用这个openid
    const [existingUsers] = await db.query('SELECT id, nickname, real_name FROM users WHERE openid = ?', [openid]);
    
    if (existingUsers.length > 0 && existingUsers[0].id !== 1) {
      const existingUser = existingUsers[0];
      console.log(`\n⚠️  警告: OpenID已绑定到其他用户:`);
      console.log(`  - ID: ${existingUser.id}`);
      console.log(`  - 昵称: ${existingUser.nickname || '(未设置)'}`);
      console.log(`  - 姓名: ${existingUser.real_name || '(未设置)'}`);
      console.log(`\n将解除该用户的绑定...`);
      
      // 将现有用户的openid清空
      await db.query('UPDATE users SET openid = ? WHERE id = ?', [`temp_${existingUser.id}_${Date.now()}`, existingUser.id]);
      console.log(`✓ 已解除原用户的OpenID绑定`);
    }

    // 将张明的openid更新为指定的openid
    await db.query('UPDATE users SET openid = ? WHERE id = ?', [openid, 1]);
    console.log(`\n✓ 成功将OpenID绑定到张明账号`);

    // 验证结果
    const [verify] = await db.query('SELECT id, nickname, real_name, role, openid FROM users WHERE id = 1', []);
    console.log(`\n✓ 验证成功!`);
    console.log(`当前绑定信息:`);
    console.log(`  - 用户: ${verify[0].real_name || verify[0].nickname}`);
    console.log(`  - OpenID: ${verify[0].openid}`);
    console.log(`\n现在可以重新登录小程序，将以张明身份登录。`);

    process.exit(0);
  } catch (error) {
    console.error('绑定失败:', error);
    process.exit(1);
  }
}

// 从命令行参数获取openid
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('使用方法: node scripts/bind-zhangming.js <openid>');
  console.log('\n获取OpenID的方法:');
  console.log('1. 在小程序中打开调试器');
  console.log('2. 在控制台输入: getApp().globalData.openid');
  console.log('3. 复制输出的OpenID');
  console.log('4. 运行: node scripts/bind-zhangming.js "<openid>"');
  console.log('\n或者查看本地存储:');
  console.log('在小程序控制台输入: wx.getStorageSync("openid")');
  process.exit(1);
}

const openid = args[0];
bindToZhangMing(openid);





























































