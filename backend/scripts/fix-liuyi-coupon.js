/**
 * 为刘一用户补发授课人推广优惠券
 * 
 * 使用说明：
 * 1. 确保刘一用户的邀请人是授课人（张老师）
 * 2. 确保授课人推广方案已配置且激活
 * 3. 运行此脚本补发优惠券
 */

const db = require('../config/database');
const moment = require('moment');
const { generateDiscountCode } = require('../utils/discountCode');
require('dotenv').config();

async function fixLiuyiCoupon() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    console.log('=== 为刘一用户补发授课人推广优惠券 ===\n');
    
    // 1. 查找刘一用户
    const [users] = await connection.query(
      "SELECT id, member_id, nickname, real_name, inviter_id, promotion_type, instructor_id_for_promotion, instructor_name_for_promotion FROM users WHERE nickname LIKE '%刘一%' OR real_name LIKE '%刘一%'"
    );
    
    if (users.length === 0) {
      console.log('❌ 未找到用户刘一');
      await connection.rollback();
      process.exit(1);
    }
    
    for (const user of users) {
      console.log(`处理用户: ${user.real_name || user.nickname} (${user.member_id})`);
      console.log(`  用户ID: ${user.id}`);
      console.log(`  邀请人ID: ${user.inviter_id || 'N/A'}`);
      console.log(`  推广类型: ${user.promotion_type || 'N/A'}\n`);
      
      // 检查是否已有优惠券
      const [existingCoupons] = await connection.query(
        "SELECT * FROM discount_coupons WHERE user_id = ? AND source = 'instructor_invite'",
        [user.id]
      );
      
      if (existingCoupons.length > 0) {
        console.log(`  ⚠️  用户已有 ${existingCoupons.length} 张授课人推广优惠券，跳过`);
        existingCoupons.forEach(c => {
          console.log(`    - ${c.discount_code}: ¥${c.amount}, 状态=${c.status}`);
        });
        continue;
      }
      
      // 检查邀请人信息
      if (!user.inviter_id) {
        console.log(`  ❌ 用户没有邀请人ID，无法补发优惠券`);
        console.log(`  提示：需要先更新用户的inviter_id`);
        continue;
      }
      
      const [inviters] = await connection.query(
        'SELECT id, nickname, real_name, role, instructor_id FROM users WHERE id = ?',
        [user.inviter_id]
      );
      
      if (inviters.length === 0) {
        console.log(`  ❌ 未找到邀请人信息`);
        continue;
      }
      
      const inviter = inviters[0];
      console.log(`  邀请人: ${inviter.real_name || inviter.nickname}, 角色=${inviter.role}`);
      
      if (inviter.role !== 'instructor') {
        console.log(`  ⚠️  警告：邀请人不是授课人角色，当前为 ${inviter.role}`);
        console.log(`  是否继续？(y/n) - 脚本将自动继续...`);
      }
      
      // 获取授课人推广方案
      const [schemes] = await connection.query(
        "SELECT * FROM coupon_schemes WHERE scheme_type = 'instructor_invite' AND status = 'active'"
      );
      
      if (schemes.length === 0) {
        console.log(`  ❌ 未找到激活的授课人推广方案`);
        continue;
      }
      
      const scheme = schemes[0];
      const amount = parseFloat(scheme.instructor_invitee_amount);
      const expiry_days = parseInt(scheme.invitee_expiry_days) || 30;
      
      if (amount <= 0) {
        console.log(`  ❌ 授课人推广方案的金额为 ${amount}，必须大于0`);
        continue;
      }
      
      console.log(`  使用推广方案: 金额=¥${amount}, 有效期=${expiry_days}天\n`);
      
      // 确保用户信息正确
      if (user.promotion_type !== 'instructor') {
        await connection.query(
          "UPDATE users SET promotion_type = 'instructor', instructor_id_for_promotion = ?, instructor_name_for_promotion = ? WHERE id = ?",
          [inviter.instructor_id, inviter.real_name || inviter.nickname, user.id]
        );
        console.log(`  ✓ 已更新用户的推广类型为 'instructor'`);
      }
      
      // 创建邀请记录（如果不存在）
      const [invitations] = await connection.query(
        'SELECT id FROM invitations WHERE inviter_id = ? AND invitee_id = ?',
        [user.inviter_id, user.id]
      );
      
      if (invitations.length === 0) {
        const inviteCode = inviter.instructor_id || inviter.member_id;
        try {
          await connection.query(
            'INSERT IGNORE INTO invitations (inviter_id, invitee_id, invite_code, status, registered_at) VALUES (?, ?, ?, ?, ?)',
            [user.inviter_id, user.id, inviteCode, 'registered', user.created_at || new Date()]
          );
          console.log(`  ✓ 已创建邀请记录`);
        } catch (inviteError) {
          console.log(`  ⚠️  创建邀请记录失败（可能已存在），继续处理`);
        }
      }
      
      // 发放优惠券
      const discount_code = await generateDiscountCode();
      const expiry_date = moment().add(expiry_days, 'days').format('YYYY-MM-DD');
      
      await connection.query(
        `INSERT INTO discount_coupons (discount_code, user_id, amount, source, source_user_id, start_date, expiry_date, status,
         promotion_type, instructor_id_for_promotion, instructor_name_for_promotion) 
         VALUES (?, ?, ?, 'instructor_invite', ?, CURDATE(), ?, 'unused', 'instructor', ?, ?)`,
        [discount_code, user.id, amount, user.inviter_id, expiry_date, inviter.instructor_id, inviter.real_name || inviter.nickname]
      );
      
      console.log(`  ✓ 已发放优惠券: ${discount_code}, 金额=¥${amount}, 有效期=${expiry_date}`);
      console.log('');
    }
    
    await connection.commit();
    console.log('=== 补发完成 ===');
    
  } catch (error) {
    await connection.rollback();
    console.error('补发失败:', error);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

fixLiuyiCoupon();

