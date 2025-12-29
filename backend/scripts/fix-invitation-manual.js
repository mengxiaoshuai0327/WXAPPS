const db = require('../config/database');

// 使用方式：node scripts/fix-invitation-manual.js <inviter_user_id>
// 例如：node scripts/fix-invitation-manual.js 5
// 这将把SYY的邀请人设置为用户ID 5

async function fixInvitationManual() {
  try {
    const inviterUserId = process.argv[2];

    if (!inviterUserId) {
      console.log('使用方法: node scripts/fix-invitation-manual.js <邀请人用户ID>');
      console.log('例如: node scripts/fix-invitation-manual.js 5');
      process.exit(1);
    }

    const inviterId = parseInt(inviterUserId);
    const syyId = 4; // SYY的用户ID

    console.log(`=== 修复邀请数据 ===\n`);
    console.log(`邀请人用户ID: ${inviterId}`);
    console.log(`被邀请人用户ID: ${syyId}\n`);

    // 1. 查找邀请人信息
    const [inviters] = await db.query(`
      SELECT id, nickname, member_id
      FROM users
      WHERE id = ?
    `, [inviterId]);

    if (inviters.length === 0) {
      console.log(`错误：未找到用户ID ${inviterId} 对应的用户`);
      process.exit(1);
    }

    const inviter = inviters[0];
    console.log(`邀请人: ${inviter.nickname} (ID=${inviter.id}, member_id=${inviter.member_id || 'N/A'})\n`);

    // 2. 查找被邀请人SYY
    const [syyUsers] = await db.query(`
      SELECT id, nickname, member_id, inviter_id
      FROM users
      WHERE id = ?
    `, [syyId]);

    if (syyUsers.length === 0) {
      console.log('错误：未找到被邀请人SYY');
      process.exit(1);
    }

    const syy = syyUsers[0];
    console.log(`被邀请人: ${syy.nickname} (ID=${syy.id}, member_id=${syy.member_id}, 当前inviter_id=${syy.inviter_id})\n`);

    // 3. 开始事务修复
    await db.query('START TRANSACTION');

    try {
      // 3.1 修复SYY的inviter_id
      await db.query('UPDATE users SET inviter_id = ? WHERE id = ?', [inviterId, syyId]);
      console.log(`✓ 已修复SYY的inviter_id: ${syy.inviter_id} -> ${inviterId}`);

      // 3.2 修复邀请记录
      const updateResult = await db.query(`
        UPDATE invitations 
        SET inviter_id = ? 
        WHERE invitee_id = ?
      `, [inviterId, syyId]);
      console.log(`✓ 已修复邀请记录的inviter_id: ${syy.inviter_id} -> ${inviterId}`);

      // 3.3 修复折扣券的user_id（应该给邀请人，而不是被邀请人）
      const [coupons] = await db.query(`
        SELECT id, user_id, source_user_id
        FROM discount_coupons
        WHERE source = 'invite_register'
          AND source_user_id = ?
          AND user_id = ?
      `, [syyId, syyId]);

      if (coupons.length > 0) {
        for (const coupon of coupons) {
          await db.query('UPDATE discount_coupons SET user_id = ? WHERE id = ?', [inviterId, coupon.id]);
          console.log(`✓ 已修复折扣券 ${coupon.id} 的user_id: ${coupon.user_id} (SYY) -> ${inviterId} (${inviter.nickname})`);
        }
      } else {
        console.log('未找到需要修复的折扣券');
      }

      await db.query('COMMIT');
      console.log('\n✓ 数据修复完成！');
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

fixInvitationManual();





























































