// 切换当前微信账号绑定的用户（用于测试）
// 使用方法: node scripts/switch-to-user.js <openid> <target_user_id>
// 例如: node scripts/switch-to-user.js "test_openid_123" 1

const db = require('../config/database');

async function switchToUser(openid, targetUserId) {
  try {
    console.log(`开始切换用户绑定...`);
    console.log(`OpenID: ${openid}`);
    console.log(`目标用户ID: ${targetUserId}`);

    // 检查目标用户是否存在
    const [targetUsers] = await db.query('SELECT id, nickname, real_name, role FROM users WHERE id = ?', [targetUserId]);
    if (targetUsers.length === 0) {
      console.error(`错误: 用户ID ${targetUserId} 不存在`);
      process.exit(1);
    }

    const targetUser = targetUsers[0];
    console.log(`目标用户信息:`);
    console.log(`  - 昵称: ${targetUser.nickname || '(未设置)'}`);
    console.log(`  - 姓名: ${targetUser.real_name || '(未设置)'}`);
    console.log(`  - 角色: ${targetUser.role}`);

    // 检查是否已经有用户使用这个openid
    const [existingUsers] = await db.query('SELECT id, nickname, real_name, role FROM users WHERE openid = ?', [openid]);
    
    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      console.log(`\n当前OpenID已绑定到用户:`);
      console.log(`  - ID: ${existingUser.id}`);
      console.log(`  - 昵称: ${existingUser.nickname || '(未设置)'}`);
      console.log(`  - 姓名: ${existingUser.real_name || '(未设置)'}`);
      console.log(`  - 角色: ${existingUser.role}`);

      // 将现有用户的openid清空或改为临时值
      await db.query('UPDATE users SET openid = ? WHERE id = ?', [`temp_${existingUser.id}_${Date.now()}`, existingUser.id]);
      console.log(`\n已解除原用户的OpenID绑定`);
    }

    // 将目标用户的openid更新为指定的openid
    await db.query('UPDATE users SET openid = ? WHERE id = ?', [openid, targetUserId]);
    console.log(`\n✓ 成功将OpenID绑定到目标用户`);

    // 验证结果
    const [verifyUsers] = await db.query('SELECT id, nickname, real_name, role FROM users WHERE id = ?', [targetUserId]);
    if (verifyUsers.length > 0 && verifyUsers[0].openid === openid) {
      console.log(`\n✓ 验证成功: 用户ID ${targetUserId} 现在使用OpenID ${openid}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('切换用户失败:', error);
    process.exit(1);
  }
}

// 从命令行参数获取openid和用户ID
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('使用方法: node scripts/switch-to-user.js <openid> <target_user_id>');
  console.log('例如: node scripts/switch-to-user.js "test_openid_123" 1');
  console.log('\n或者先查看当前登录的OpenID，然后运行:');
  console.log('1. 在小程序中打开控制台，查看 app.globalData.openid');
  console.log('2. 运行脚本: node scripts/switch-to-user.js "<openid>" 1');
  process.exit(1);
}

const openid = args[0];
const targetUserId = parseInt(args[1]);

if (isNaN(targetUserId)) {
  console.error('错误: 用户ID必须是数字');
  process.exit(1);
}

switchToUser(openid, targetUserId);





























































