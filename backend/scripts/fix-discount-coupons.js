const db = require('../config/database');

async function fixDiscountCoupons() {
  try {
    console.log('=== 修复折扣券数据 ===\n');

    await db.query('START TRANSACTION');

    try {
      // 查找所有邀请注册奖励的折扣券，其中user_id等于source_user_id（错误情况）
      const [wrongCoupons] = await db.query(`
        SELECT 
          dc.id,
          dc.user_id,
          dc.source_user_id,
          i.inviter_id,
          i.invitee_id,
          i.invite_code
        FROM discount_coupons dc
        JOIN invitations i ON dc.source_user_id = i.invitee_id 
          AND dc.source = 'invite_register'
          AND dc.created_at BETWEEN DATE_SUB(i.registered_at, INTERVAL 1 MINUTE) 
          AND DATE_ADD(i.registered_at, INTERVAL 1 MINUTE)
        WHERE dc.user_id = dc.source_user_id
          AND dc.user_id = i.invitee_id
      `);

      console.log(`找到 ${wrongCoupons.length} 条错误的折扣券记录\n`);

      for (const coupon of wrongCoupons) {
        console.log(`修复折扣券 ${coupon.id}:`);
        console.log(`  当前user_id: ${coupon.user_id} (被邀请人)`);
        console.log(`  应该的user_id: ${coupon.inviter_id} (邀请人)`);
        console.log(`  邀请记录ID: ${coupon.invite_code}\n`);

        // 将折扣券的user_id改为邀请人
        if (coupon.inviter_id && coupon.inviter_id !== coupon.user_id) {
          await db.query('UPDATE discount_coupons SET user_id = ? WHERE id = ?', [coupon.inviter_id, coupon.id]);
          console.log(`  ✓ 已修复折扣券 ${coupon.id} 的user_id: ${coupon.user_id} -> ${coupon.inviter_id}\n`);
        }
      }

      await db.query('COMMIT');
      console.log('✓ 折扣券数据修复完成！');

      // 验证修复结果
      console.log('\n=== 验证修复结果 ===\n');
      const [fixedCoupons] = await db.query(`
        SELECT 
          dc.id,
          dc.user_id,
          dc.source_user_id,
          dc.amount,
          u_owner.nickname as owner_nickname,
          u_owner.member_id as owner_member_id,
          u_source.nickname as source_nickname,
          u_source.member_id as source_member_id
        FROM discount_coupons dc
        JOIN users u_owner ON dc.user_id = u_owner.id
        LEFT JOIN users u_source ON dc.source_user_id = u_source.id
        WHERE dc.source = 'invite_register'
          AND dc.source_user_id = 4
        ORDER BY dc.created_at DESC
      `);

      fixedCoupons.forEach(coupon => {
        console.log(`折扣券 ${coupon.id}:`);
        console.log(`  拥有者: ${coupon.owner_nickname} (ID=${coupon.user_id}, member_id=${coupon.owner_member_id || 'N/A'})`);
        console.log(`  来源用户: ${coupon.source_nickname} (ID=${coupon.source_user_id}, member_id=${coupon.source_member_id || 'N/A'})`);
        console.log(`  金额: ¥${coupon.amount}\n`);
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

fixDiscountCoupons();





























































