const db = require('../config/database');

async function debugInviterIssue() {
  try {
    const inviteCode = 'M36456006';
    const userPhone = '15566667123';
    const userName = '孟三一';
    
    console.log(`=== 调试邀请关系问题：邀请码=${inviteCode}, 用户=${userName} ===\n`);

    // 1. 检查邀请码对应的邀请人
    console.log('1. 检查邀请码对应的邀请人:');
    const [inviters] = await db.query(
      `SELECT id, member_id, instructor_id, role, channel_user_id, nickname, real_name
       FROM users 
       WHERE member_id = ? AND role = 'member'`,
      [inviteCode]
    );
    
    if (inviters.length > 0) {
      const inviter = inviters[0];
      console.log(`  ✓ 找到邀请人:`);
      console.log(`    ID: ${inviter.id}`);
      console.log(`    member_id: ${inviter.member_id}`);
      console.log(`    角色: ${inviter.role}`);
      console.log(`    姓名: ${inviter.real_name || inviter.nickname}`);
      console.log(`    渠道销售? channel_user_id: ${inviter.channel_user_id || 'NULL'}`);
      
      if (inviter.channel_user_id) {
        // 检查渠道方信息
        const [channels] = await db.query(
          'SELECT id, channel_code, channel_name FROM channels WHERE id = ?',
          [inviter.channel_user_id]
        );
        if (channels.length > 0) {
          console.log(`    所属渠道方: ${channels[0].channel_name} (channel_code=${channels[0].channel_code})`);
        }
      }
    } else {
      console.log(`  ✗ 未找到邀请人（member_id=${inviteCode}）`);
    }

    // 2. 检查新注册用户
    console.log(`\n2. 检查新注册用户 "${userName}":`);
    const [newUsers] = await db.query(
      `SELECT id, member_id, instructor_id, role, inviter_id, promotion_type,
              instructor_id_for_promotion, channel_name_for_promotion,
              channel_sales_id_for_promotion, created_at
       FROM users 
       WHERE phone = ? OR real_name = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [userPhone, userName]
    );
    
    if (newUsers.length > 0) {
      const newUser = newUsers[0];
      console.log(`  ✓ 找到用户:`);
      console.log(`    用户ID: ${newUser.id}`);
      console.log(`    会员ID: ${newUser.member_id || 'NULL'}`);
      console.log(`    角色: ${newUser.role}`);
      console.log(`    邀请人ID: ${newUser.inviter_id || 'NULL'} ← 这里应该是 ${inviters.length > 0 ? inviters[0].id : 'NULL'}`);
      console.log(`    推广类型: ${newUser.promotion_type || 'NULL'}`);
      console.log(`    渠道销售ID（推广）: ${newUser.channel_sales_id_for_promotion || 'NULL'}`);
      console.log(`    注册时间: ${newUser.created_at}`);
      
      // 3. 检查邀请记录
      if (newUser.inviter_id) {
        console.log(`\n3. 检查邀请记录:`);
        const [invitations] = await db.query(
          `SELECT * FROM invitations WHERE invitee_id = ? ORDER BY created_at DESC`,
          [newUser.id]
        );
        
        if (invitations.length > 0) {
          invitations.forEach(inv => {
            console.log(`  ✓ 找到邀请记录:`);
            console.log(`    邀请码: ${inv.invite_code}`);
            console.log(`    邀请人ID: ${inv.inviter_id}`);
          });
        } else {
          console.log(`  ✗ 未找到邀请记录`);
        }
      } else {
        console.log(`\n3. ✗ 用户没有邀请人ID，说明注册时未找到邀请人`);
      }
    } else {
      console.log(`  ✗ 未找到用户记录`);
    }

    process.exit(0);
  } catch (error) {
    console.error('调试失败:', error);
    process.exit(1);
  }
}

debugInviterIssue();

