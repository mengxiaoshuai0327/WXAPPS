// 切换当前登录用户为授课人角色
// 使用方法：node scripts/switch-to-instructor.js <user_id>

const db = require('../config/database');
require('dotenv').config();

async function switchToInstructor(userId) {
  try {
    // 检查用户是否存在
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      console.error('用户不存在');
      process.exit(1);
    }

    const user = users[0];
    console.log(`当前用户: ${user.nickname || user.openid}, 角色: ${user.role}`);

    // 更新用户角色为授课人
    await db.query('UPDATE users SET role = ? WHERE id = ?', ['instructor', userId]);

    // 检查是否已有授课人信息，如果没有则创建
    const [instructors] = await db.query('SELECT * FROM instructors WHERE user_id = ?', [userId]);
    if (instructors.length === 0) {
      await db.query(
        'INSERT INTO instructors (user_id, bio, background) VALUES (?, ?, ?)',
        [userId, '授课人简介', '授课人背景介绍']
      );
      console.log('✓ 已创建授课人信息记录');
    }

    console.log(`✓ 用户 ${user.nickname || user.openid} 已切换为授课人角色`);
    console.log('\n请在小程序中重新登录以刷新角色信息');
  } catch (error) {
    console.error('切换角色失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// 从命令行参数获取用户ID
const userId = process.argv[2];

if (!userId) {
  console.log('使用方法: node scripts/switch-to-instructor.js <user_id>');
  console.log('\n示例: node scripts/switch-to-instructor.js 4');
  console.log('\n或者直接查询所有用户:');
  console.log('SELECT id, openid, nickname, role FROM users ORDER BY id DESC LIMIT 10;');
  process.exit(1);
}

switchToInstructor(userId);





























































