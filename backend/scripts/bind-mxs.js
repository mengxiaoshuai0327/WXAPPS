// 将指定OpenID绑定到孟小帅（MXS）的账号
// 使用方法: node scripts/bind-mxs.js <openid>

const db = require('../config/database');

async function bindToMXS(openid) {
  try {
    console.log(`开始将OpenID绑定到孟小帅账号...`);
    console.log(`OpenID: ${openid}\n`);

    // 查找孟小帅的账号（ID=4或昵称/姓名包含孟小帅/MXS）
    const [users] = await db.query(
      `SELECT id, nickname, real_name, role, openid FROM users 
       WHERE id = 4 OR nickname LIKE '%MXS%' OR real_name LIKE '%孟小帅%' 
       ORDER BY id ASC LIMIT 1`
    );
    
    if (users.length === 0) {
      console.error('错误: 未找到孟小帅账号');
      process.exit(1);
    }

    const mxsUser = users[0];
    console.log(`找到账号信息:`);
    console.log(`  - ID: ${mxsUser.id}`);
    console.log(`  - 昵称: ${mxsUser.nickname || '(未设置)'}`);
    console.log(`  - 姓名: ${mxsUser.real_name || '(未设置)'}`);
    console.log(`  - 角色: ${mxsUser.role}`);
    console.log(`  - 当前OpenID: ${mxsUser.openid || '(未绑定)'}\n`);

    // 检查是否已经有用户使用这个openid
    const [existingUsers] = await db.query('SELECT id, nickname, real_name FROM users WHERE openid = ?', [openid]);
    
    if (existingUsers.length > 0 && existingUsers[0].id !== mxsUser.id) {
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

    // 将孟小帅的openid更新为指定的openid
    await db.query('UPDATE users SET openid = ? WHERE id = ?', [openid, mxsUser.id]);
    console.log(`✓ 成功将OpenID绑定到孟小帅账号`);

    // 验证结果
    const [verify] = await db.query('SELECT id, nickname, real_name, role, openid FROM users WHERE id = ?', [mxsUser.id]);
    console.log(`\n✓ 验证成功!`);
    console.log(`当前绑定信息:`);
    console.log(`  - 用户: ${verify[0].real_name || verify[0].nickname}`);
    console.log(`  - OpenID: ${verify[0].openid}`);
    console.log(`  - 角色: ${verify[0].role}`);
    console.log(`\n现在可以重新登录小程序，将以孟小帅身份登录。`);

    process.exit(0);
  } catch (error) {
    console.error('绑定失败:', error);
    process.exit(1);
  }
}

// 从命令行参数获取openid
const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('使用方法: node scripts/bind-mxs.js <openid>');
  console.log('\n获取OpenID的方法:');
  console.log('1. 在小程序中打开调试器');
  console.log('2. 在控制台输入: getApp().globalData.openid');
  console.log('3. 复制输出的OpenID');
  console.log('4. 运行: node scripts/bind-mxs.js "<openid>"');
  console.log('\n或者查看本地存储:');
  console.log('在小程序控制台输入: wx.getStorageSync("openid")');
  process.exit(1);
}

const openid = args[0];
bindToMXS(openid);





























































