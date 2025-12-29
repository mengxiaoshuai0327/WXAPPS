const db = require('../config/database');

async function fixExistingData() {
  try {
    console.log('=== 修复现有数据 ===\n');

    // 1. 查找邀请码 M03152922 对应的用户（这应该是真正的邀请人）
    const [inviterUsers] = await db.query(`
      SELECT id, nickname, member_id
      FROM users
      WHERE member_id = 'M03152922'
    `);

    if (inviterUsers.length === 0) {
      console.log('未找到邀请码 M03152922 对应的用户，需要手动创建或指定正确的邀请人ID\n');
      console.log('请告诉我真正的邀请人（MXS）的用户ID或会员ID');
      process.exit(1);
    }

    const trueInviter = inviterUsers[0];
    console.log(`找到真正的邀请人: ${trueInviter.nickname} (ID=${trueInviter.id}, member_id=${trueInviter.member_id})\n`);

    // 2. 查找被邀请人SYY（ID=4）
    const [syyUsers] = await db.query(`
      SELECT id, nickname, member_id, inviter_id
      FROM users
      WHERE id = 4
    `);

    if (syyUsers.length === 0) {
      console.log('未找到被邀请人SYY');
      process.exit(1);
    }

    const syy = syyUsers[0];
    console.log(`被邀请人: ${syy.nickname} (ID=${syy.id}, member_id=${syy.member_id}, 当前inviter_id=${syy.inviter_id})\n`);

    // 3. 开始事务修复
    await db.query('START TRANSACTION');

    try {
      // 3.1 修复SYY的inviter_id
      await db.query('UPDATE users SET inviter_id = ? WHERE id = ?', [trueInviter.id, syy.id]);
      console.log(`✓ 已修复SYY的inviter_id: ${syy.inviter_id} -> ${trueInviter.id}`);

      // 3.2 修复邀请记录
      await db.query(`
        UPDATE invitations 
        SET inviter_id = ? 
        WHERE invitee_id = ? AND invite_code = 'M03152922'
      `, [trueInviter.id, syy.id]);
      console.log(`✓ 已修复邀请记录的inviter_id: ${syy.id} -> ${trueInviter.id}`);

      // 3.3 修复折扣券的user_id（应该给邀请人，而不是被邀请人）
      const [coupons] = await db.query(`
        SELECT id, user_id, source_user_id
        FROM discount_coupons
        WHERE source = 'invite_register'
          AND source_user_id = ?
          AND user_id = ?
      `, [syy.id, syy.id]);

      for (const coupon of coupons) {
        await db.query('UPDATE discount_coupons SET user_id = ? WHERE id = ?', [trueInviter.id, coupon.id]);
        console.log(`✓ 已修复折扣券 ${coupon.id} 的user_id: ${coupon.user_id} (SYY) -> ${trueInviter.id} (${trueInviter.nickname})`);
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

fixExistingData();





























































