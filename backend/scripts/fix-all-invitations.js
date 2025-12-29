const db = require('../config/database');

async function fixAllInvitations() {
  try {
    console.log('=== 修复所有邀请数据 ===\n');

    await db.query('START TRANSACTION');

    try {
      // 1. 修复所有自己邀请自己的邀请记录
      const [badInvitations] = await db.query(`
        SELECT id, inviter_id, invitee_id, invite_code
        FROM invitations
        WHERE inviter_id = invitee_id
      `);

      console.log(`找到 ${badInvitations.length} 条自己邀请自己的记录\n`);

      for (const inv of badInvitations) {
        // 根据邀请码查找真正的邀请人
        const [inviters] = await db.query(`
          SELECT id, nickname, member_id
          FROM users
          WHERE member_id = ? AND id != ?
        `, [inv.invite_code, inv.invitee_id]);

        if (inviters.length > 0) {
          const trueInviter = inviters[0];
          console.log(`修复邀请记录 ${inv.id}:`);
          console.log(`  邀请码: ${inv.invite_code}`);
          console.log(`  原邀请人ID: ${inv.inviter_id} (SYY)`);
          console.log(`  真实邀请人: ${trueInviter.nickname} (ID=${trueInviter.id}, member_id=${trueInviter.member_id})`);
          console.log(`  被邀请人ID: ${inv.invitee_id} (SYY)\n`);

          // 更新邀请记录
          await db.query('UPDATE invitations SET inviter_id = ? WHERE id = ?', [trueInviter.id, inv.id]);

          // 更新被邀请人的inviter_id
          await db.query('UPDATE users SET inviter_id = ? WHERE id = ?', [trueInviter.id, inv.invitee_id]);

          // 修复对应的折扣券（应该给邀请人，而不是被邀请人）
          await db.query(`
            UPDATE discount_coupons 
            SET user_id = ? 
            WHERE source = 'invite_register' 
              AND source_user_id = ? 
              AND user_id = ?
          `, [trueInviter.id, inv.invitee_id, inv.invitee_id]);

          console.log(`  ✓ 已修复\n`);
        } else {
          console.log(`警告：邀请记录 ${inv.id} 的邀请码 ${inv.invite_code} 找不到对应的邀请人，跳过\n`);
        }
      }

      await db.query('COMMIT');
      console.log('✓ 所有数据修复完成！');

      // 验证修复结果
      console.log('\n=== 验证修复结果 ===\n');
      const [fixedInvitations] = await db.query(`
        SELECT 
          i.id,
          i.inviter_id,
          i.invitee_id,
          i.invite_code,
          u_inviter.nickname as inviter_nickname,
          u_invitee.nickname as invitee_nickname
        FROM invitations i
        LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
        LEFT JOIN users u_invitee ON i.invitee_id = u_invitee.id
        WHERE i.invitee_id = 4
        ORDER BY i.created_at DESC
      `);

      fixedInvitations.forEach(inv => {
        console.log(`邀请码: ${inv.invite_code}`);
        console.log(`  邀请人: ${inv.inviter_nickname} (ID=${inv.inviter_id})`);
        console.log(`  被邀请人: ${inv.invitee_nickname} (ID=${inv.invitee_id})\n`);
      });

    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    process.exit(0);
  } catch (error) {
    console.error('修复失败:', error);
    process.exit(1);
  }
}

fixAllInvitations();





























































