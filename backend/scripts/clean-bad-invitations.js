const db = require('../config/database');

async function cleanBadInvitations() {
  try {
    console.log('=== 清理无效邀请记录 ===\n');

    await db.query('START TRANSACTION');

    try {
      // 1. 删除自己邀请自己的邀请记录
      const [badInvitations] = await db.query(`
        SELECT id, inviter_id, invitee_id, invite_code
        FROM invitations
        WHERE inviter_id = invitee_id
      `);

      console.log(`找到 ${badInvitations.length} 条自己邀请自己的记录\n`);

      for (const inv of badInvitations) {
        console.log(`删除邀请记录 ${inv.id} (邀请码: ${inv.invite_code}, inviter_id=${inv.inviter_id}, invitee_id=${inv.invitee_id})`);
        
        // 删除对应的折扣券（这些折扣券不应该存在）
        await db.query(`
          DELETE FROM discount_coupons
          WHERE source = 'invite_register'
            AND source_user_id = ?
            AND user_id = ?
            AND created_at BETWEEN DATE_SUB((SELECT registered_at FROM invitations WHERE id = ?), INTERVAL 1 MINUTE)
            AND DATE_ADD((SELECT registered_at FROM invitations WHERE id = ?), INTERVAL 1 MINUTE)
        `, [inv.invitee_id, inv.invitee_id, inv.id, inv.id]);
        
        // 删除邀请记录
        await db.query('DELETE FROM invitations WHERE id = ?', [inv.id]);
        console.log(`  ✓ 已删除\n`);
      }

      // 2. 修复SYY的inviter_id（如果不是5的话）
      const [syy] = await db.query('SELECT id, inviter_id FROM users WHERE id = 4');
      if (syy.length > 0 && syy[0].inviter_id === 4) {
        // 查找正确的邀请人（用户ID 5，因为邀请码M03152922对应的是用户5）
        const [correctInvitation] = await db.query(`
          SELECT inviter_id FROM invitations 
          WHERE invitee_id = 4 AND inviter_id != 4 
          ORDER BY created_at DESC LIMIT 1
        `);
        
        if (correctInvitation.length > 0) {
          const correctInviterId = correctInvitation[0].inviter_id;
          await db.query('UPDATE users SET inviter_id = ? WHERE id = 4', [correctInviterId]);
          console.log(`✓ 已修复SYY的inviter_id: 4 -> ${correctInviterId}\n`);
        }
      }

      await db.query('COMMIT');
      console.log('✓ 清理完成！');

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    process.exit(0);
  } catch (error) {
    console.error('清理失败:', error);
    process.exit(1);
  }
}

cleanBadInvitations();





























































