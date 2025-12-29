const db = require('../config/database');

async function fixInvitationData() {
  try {
    console.log('=== 修复邀请数据 ===\n');

    // 1. 查找MXS的用户信息（会员ID应该是M03152922）
    const [mxsUsers] = await db.query(`
      SELECT id, nickname, member_id, phone
      FROM users
      WHERE member_id = 'M03152922'
         OR (nickname LIKE '%孟小帅%' OR nickname LIKE '%MXS%')
    `);

    if (mxsUsers.length === 0) {
      console.log('未找到MXS用户，请先确认MXS的member_id');
      process.exit(1);
    }

    const mxs = mxsUsers[0];
    console.log(`找到邀请人: ${mxs.nickname} (ID=${mxs.id}, member_id=${mxs.member_id})\n`);

    // 2. 查找SYY的用户信息
    const [syyUsers] = await db.query(`
      SELECT id, nickname, member_id, phone, inviter_id
      FROM users
      WHERE member_id = 'M20472900'
         OR nickname = 'SYY'
    `);

    if (syyUsers.length === 0) {
      console.log('未找到SYY用户');
      process.exit(1);
    }

    const syy = syyUsers[0];
    console.log(`找到被邀请人: ${syy.nickname} (ID=${syy.id}, member_id=${syy.member_id}, 当前inviter_id=${syy.inviter_id})\n`);

    // 3. 开始事务修复
    await db.query('START TRANSACTION');

    try {
      // 3.1 修复SYY的inviter_id
      if (syy.inviter_id !== mxs.id) {
        await db.query('UPDATE users SET inviter_id = ? WHERE id = ?', [mxs.id, syy.id]);
        console.log(`✓ 已修复SYY的inviter_id: ${syy.inviter_id} -> ${mxs.id}`);
      }

      // 3.2 修复邀请记录
      const [invitations] = await db.query(`
        SELECT id, inviter_id, invitee_id
        FROM invitations
        WHERE invitee_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, [syy.id]);

      if (invitations.length > 0) {
        const inv = invitations[0];
        if (inv.inviter_id !== mxs.id) {
          await db.query('UPDATE invitations SET inviter_id = ? WHERE id = ?', [mxs.id, inv.id]);
          console.log(`✓ 已修复邀请记录的inviter_id: ${inv.inviter_id} -> ${mxs.id}`);
        }
      }

      // 3.3 修复折扣券的user_id（应该给邀请人MXS，而不是被邀请人SYY）
      const [coupons] = await db.query(`
        SELECT id, user_id, source_user_id
        FROM discount_coupons
        WHERE source = 'invite_register'
          AND source_user_id = ?
          AND user_id = ?
      `, [syy.id, syy.id]);

      for (const coupon of coupons) {
        if (coupon.user_id === syy.id && coupon.source_user_id === syy.id) {
          await db.query('UPDATE discount_coupons SET user_id = ? WHERE id = ?', [mxs.id, coupon.id]);
          console.log(`✓ 已修复折扣券 ${coupon.id} 的user_id: ${coupon.user_id} (SYY) -> ${mxs.id} (MXS)`);
        }
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

fixInvitationData();





























































