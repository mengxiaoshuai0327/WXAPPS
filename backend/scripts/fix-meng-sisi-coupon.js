const db = require('../config/database');
const moment = require('moment');
const { generateDiscountCode } = require('../utils/discountCode');

async function fixCoupon() {
  try {
    // 查询用户信息
    const [users] = await db.query(
      'SELECT id, member_id, real_name, phone, inviter_id, promotion_type, channel_sales_id_for_promotion FROM users WHERE phone = ? OR real_name = ? ORDER BY created_at DESC LIMIT 1',
      ['14566671111', '孟四四']
    );
    
    if (users.length === 0) {
      console.log('未找到用户');
      process.exit(1);
    }
    
    const user = users[0];
    console.log(`找到用户: ${user.real_name} (ID: ${user.id}, phone: ${user.phone})`);
    console.log(`邀请人ID: ${user.inviter_id}, 推广类型: ${user.promotion_type}`);
    
    if (!user.inviter_id) {
      console.log('用户没有邀请人，无需发放优惠券');
      process.exit(0);
    }
    
    // 查询邀请人信息
    const [inviters] = await db.query(
      'SELECT id, member_id, real_name, channel_user_id FROM users WHERE id = ?',
      [user.inviter_id]
    );
    
    if (inviters.length === 0) {
      console.log('未找到邀请人');
      process.exit(1);
    }
    
    const inviter = inviters[0];
    console.log(`邀请人: ${inviter.real_name} (ID: ${inviter.id}, member_id: ${inviter.member_id})`);
    
    // 查询渠道方和推广方案
    if (inviter.channel_user_id && user.promotion_type === 'channel') {
      const [channels] = await db.query(
        'SELECT id, channel_code, channel_name FROM channels WHERE id = ?',
        [inviter.channel_user_id]
      );
      
      if (channels.length > 0) {
        const channel = channels[0];
        console.log(`渠道方: ${channel.channel_name} (channel_code: ${channel.channel_code})`);
        
        const [schemes] = await db.query(
          'SELECT * FROM channel_promotion_schemes WHERE channel_code = ? AND status = ?',
          [channel.channel_code, 'active']
        );
        
        if (schemes.length > 0) {
          const scheme = schemes[0];
          const amount = parseFloat(scheme.amount);
          const expiry_days = parseInt(scheme.expiry_days) || 30;
          
          console.log(`推广方案: 金额¥${amount}, 有效期${expiry_days}天`);
          
          // 检查是否已有优惠券
          const [existing] = await db.query(
            'SELECT id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
            [user.id, 'channel_invite', inviter.id]
          );
          
          if (existing.length === 0 && amount > 0) {
            const connection = await db.getConnection();
            try {
              await connection.beginTransaction();
              
              const discount_code = await generateDiscountCode();
              const expiry_date = moment().add(expiry_days, 'days').format('YYYY-MM-DD');
              
              await connection.query(
                `INSERT INTO discount_coupons (discount_code, user_id, amount, source, source_user_id, start_date, expiry_date, status, promotion_type, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion) 
                 VALUES (?, ?, ?, 'channel_invite', ?, CURDATE(), ?, 'unused', 'channel', ?, ?, ?)`,
                [discount_code, user.id, amount, inviter.id, expiry_date, channel.channel_name, inviter.member_id, inviter.real_name]
              );
              
              await connection.commit();
              console.log(`✓ 已发放优惠券: 金额¥${amount}，有效期${expiry_date}`);
            } catch (error) {
              await connection.rollback();
              throw error;
            } finally {
              connection.release();
            }
          } else if (existing.length > 0) {
            console.log('优惠券已存在');
          } else {
            console.log('金额为0，不发放');
          }
        } else {
          console.log('未找到激活的推广方案');
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

fixCoupon();

