const db = require('../config/database');

async function checkChannelUsers() {
  try {
    console.log('=== 检查渠道销售用户数据 ===\n');
    
    // 检查财销一和联想1的用户信息
    const [users] = await db.query(
      `SELECT id, member_id, role, channel_user_id, nickname, real_name 
       FROM users 
       WHERE member_id IN ('M85101163', 'M96143951')`
    );
    
    if (users.length === 0) {
      console.log('❌ 未找到这两个用户');
      return;
    }
    
    console.log(`找到 ${users.length} 个用户：\n`);
    
    for (const user of users) {
      console.log(`用户: ${user.real_name || user.nickname} (${user.member_id})`);
      console.log(`  ID: ${user.id}`);
      console.log(`  角色: ${user.role}`);
      console.log(`  channel_user_id: ${user.channel_user_id || 'NULL'}`);
      
      if (user.channel_user_id) {
        // 查找对应的渠道方信息
        const [channels] = await db.query(
          'SELECT id, channel_code, channel_name FROM channels WHERE id = ?',
          [user.channel_user_id]
        );
        
        if (channels.length > 0) {
          const channel = channels[0];
          console.log(`  ✓ 找到关联渠道方:`);
          console.log(`    渠道方ID: ${channel.id}`);
          console.log(`    渠道编码: ${channel.channel_code || '(空)'}`);
          console.log(`    渠道名称: ${channel.channel_name || '(空)'}`);
        } else {
          console.log(`  ❌ 警告：channel_user_id=${user.channel_user_id} 对应的渠道方不存在`);
        }
      } else {
        console.log(`  ⚠️  警告：channel_user_id 为 NULL，该用户不会被识别为渠道销售`);
      }
      console.log('');
    }
    
    // 列出所有渠道方，供参考
    console.log('=== 所有渠道方列表（供参考）===\n');
    const [allChannels] = await db.query(
      'SELECT id, channel_code, channel_name FROM channels ORDER BY id'
    );
    
    if (allChannels.length === 0) {
      console.log('未找到任何渠道方记录');
    } else {
      console.log('渠道方列表：');
      allChannels.forEach(ch => {
        console.log(`  ID: ${ch.id}, 编码: ${ch.channel_code || '(空)'}, 名称: ${ch.channel_name || '(空)'}`);
      });
    }
    
    console.log('\n=== 检查完成 ===');
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    process.exit(0);
  }
}

checkChannelUsers();

