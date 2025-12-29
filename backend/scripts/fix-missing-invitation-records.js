// 修复缺失的邀请记录
// 查找所有有inviter_id但没有对应invitations记录的用户，并创建邀请记录

const db = require('../config/database');

async function fixMissingInvitationRecords() {
  try {
    console.log('开始修复缺失的邀请记录...\n');

    // 查找所有有inviter_id的用户，但没有对应的invitations记录
    const [usersWithMissingInvitations] = await db.query(`
      SELECT 
        u.id as invitee_id,
        u.inviter_id,
        u.phone,
        u.real_name,
        u.member_id,
        u.created_at as user_created_at,
        u.channel_sales_id_for_promotion,
        inviter.member_id as inviter_member_id,
        inviter.instructor_id as inviter_instructor_id
      FROM users u
      LEFT JOIN invitations i ON i.inviter_id = u.inviter_id AND i.invitee_id = u.id
      LEFT JOIN users inviter ON inviter.id = u.inviter_id
      WHERE u.inviter_id IS NOT NULL
        AND u.role = 'member'
        AND i.id IS NULL
      ORDER BY u.created_at ASC
    `);

    console.log(`找到 ${usersWithMissingInvitations.length} 个缺失邀请记录的用户\n`);

    if (usersWithMissingInvitations.length === 0) {
      console.log('没有需要修复的记录');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const user of usersWithMissingInvitations) {
      try {
        // 确定邀请码（优先使用member_id，其次instructor_id）
        let invite_code = user.inviter_member_id || user.inviter_instructor_id || user.inviter_id.toString();
        
        // 确定状态（根据用户创建时间，如果已经注册了，应该是registered）
        const status = 'registered'; // 因为用户已经存在，所以状态是registered

        // 检查是否已经有相同的记录（防止重复插入）
        const [existing] = await db.query(
          'SELECT id FROM invitations WHERE inviter_id = ? AND invitee_id = ?',
          [user.inviter_id, user.invitee_id]
        );

        if (existing.length > 0) {
          console.log(`跳过：用户 ${user.invitee_id} (${user.phone || user.real_name}) 已有邀请记录`);
          continue;
        }

        // 插入邀请记录
        await db.query(
          `INSERT INTO invitations (inviter_id, invitee_id, invite_code, status, registered_at, created_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [user.inviter_id, user.invitee_id, invite_code, status, user.user_created_at || new Date(), user.user_created_at || new Date()]
        );

        console.log(`✓ 已创建邀请记录: 邀请人ID=${user.inviter_id} (${invite_code}) -> 被邀请人ID=${user.invitee_id} (${user.phone || user.real_name})`);
        successCount++;
      } catch (error) {
        console.error(`✗ 创建邀请记录失败: 用户ID=${user.invitee_id} (${user.phone || user.real_name}), 错误: ${error.message}`);
        failCount++;
      }
    }

    console.log(`\n修复完成:`);
    console.log(`  成功: ${successCount} 条`);
    console.log(`  失败: ${failCount} 条`);

    // 验证修复结果
    console.log('\n验证修复结果...');
    const [verification] = await db.query(`
      SELECT 
        COUNT(DISTINCT u.id) as users_with_inviter,
        COUNT(DISTINCT i.id) as invitation_records
      FROM users u
      LEFT JOIN invitations i ON i.inviter_id = u.inviter_id AND i.invitee_id = u.id
      WHERE u.inviter_id IS NOT NULL AND u.role = 'member'
    `);
    
    console.log(`用户中有邀请人的数量: ${verification[0].users_with_inviter}`);
    console.log(`邀请记录数量: ${verification[0].invitation_records}`);
    
    if (verification[0].users_with_inviter === verification[0].invitation_records) {
      console.log('✓ 所有用户都有对应的邀请记录');
    } else {
      console.log(`⚠ 仍有 ${verification[0].users_with_inviter - verification[0].invitation_records} 个用户缺少邀请记录`);
    }

  } catch (error) {
    console.error('修复过程中发生错误:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

fixMissingInvitationRecords();

