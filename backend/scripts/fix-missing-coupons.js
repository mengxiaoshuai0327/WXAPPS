/**
 * 为缺失优惠券的用户补发优惠券
 */

const db = require('../config/database');
const moment = require('moment');
const { generateDiscountCode } = require('../utils/discountCode');

async function fixMissingCoupons() {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 邀请人ID（I40866389对应的用户ID）
    const inviterId = 34;
    const inviteCode = 'I40866389';
    
    // 需要补发优惠券的用户（通过昵称或真实姓名查找）
    const userNames = ['十二', '十一', '王石儿', '王石一'];
    
    const [users] = await connection.query(
      `SELECT id, nickname, real_name, member_id, inviter_id
       FROM users
       WHERE nickname IN (?) OR real_name IN (?)
       ORDER BY created_at DESC`,
      [userNames, userNames]
    );
    
    if (users.length === 0) {
      console.log('未找到相关用户');
      await connection.rollback();
      connection.release();
      return;
    }
    
    console.log(`找到 ${users.length} 个用户，开始补发优惠券...\n`);
    
    // 查找授课人推广方案配置
    const [schemes] = await connection.query(
      'SELECT * FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
      ['instructor_invite', 'active']
    );
    
    if (schemes.length === 0) {
      console.log('未找到激活的授课人推广方案，无法补发优惠券');
      await connection.rollback();
      connection.release();
      return;
    }
    
    const scheme = schemes[0];
    const amount = parseFloat(scheme.instructor_invitee_amount);
    const expiry_days = parseInt(scheme.invitee_expiry_days) || 30;
    
    console.log(`授课人推广方案: 金额=¥${amount}, 有效期=${expiry_days}天\n`);
    
    for (const user of users) {
      console.log(`处理用户: ${user.real_name || user.nickname} (${user.member_id})`);
      
      // 检查是否已经有优惠券
      const [existingCoupons] = await connection.query(
        'SELECT id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
        [user.id, 'instructor_invite', inviterId]
      );
      
      if (existingCoupons.length > 0) {
        console.log(`  已存在优惠券，跳过\n`);
        continue;
      }
      
      // 更新用户的邀请人信息
      if (!user.inviter_id) {
        await connection.query(
          `UPDATE users SET inviter_id = ?, promotion_type = 'instructor', instructor_id_for_promotion = ?, instructor_name_for_promotion = ? WHERE id = ?`,
          [inviterId, inviteCode, '张三', user.id]
        );
        console.log(`  ✓ 已更新用户邀请人信息`);
      }
      
      // 创建邀请记录（使用 INSERT IGNORE 避免唯一约束冲突）
      const [existingInvitations] = await connection.query(
        'SELECT id FROM invitations WHERE inviter_id = ? AND invitee_id = ?',
        [inviterId, user.id]
      );
      
      if (existingInvitations.length === 0) {
        try {
          await connection.query(
            'INSERT IGNORE INTO invitations (inviter_id, invitee_id, invite_code, status, registered_at) VALUES (?, ?, ?, ?, ?)',
            [inviterId, user.id, inviteCode, 'registered', user.created_at || new Date()]
          );
          console.log(`  ✓ 已创建邀请记录`);
        } catch (inviteError) {
          // 如果仍然失败，记录警告但继续
          console.log(`  ⚠ 创建邀请记录失败（可能已存在），继续处理优惠券`);
        }
      }
      
      // 发放优惠券
      const discount_code = await generateDiscountCode();
      const expiry_date = moment().add(expiry_days, 'days').format('YYYY-MM-DD');
      
      await connection.query(
        `INSERT INTO discount_coupons (discount_code, user_id, amount, source, source_user_id, start_date, expiry_date, status,
         promotion_type, instructor_id_for_promotion, instructor_name_for_promotion) 
         VALUES (?, ?, ?, 'instructor_invite', ?, CURDATE(), ?, 'unused', 'instructor', ?, ?)`,
        [discount_code, user.id, amount, inviterId, expiry_date, inviteCode, '张三']
      );
      
      console.log(`  ✓ 已发放优惠券: ${discount_code}, 金额=¥${amount}, 有效期=${expiry_date}\n`);
    }
    
    await connection.commit();
    connection.release();
    
    console.log('补发完成！');
    
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('补发失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixMissingCoupons();

