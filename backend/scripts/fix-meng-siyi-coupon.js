const db = require('../config/database');
const moment = require('moment');
const { generateDiscountCode } = require('../utils/discountCode');

async function fixCoupon() {
  try {
    const userId = 103; // 孟司意
    const inviterId = 102; // 阿里1
    const channelUserId = 12; // 渠道方ID
    
    console.log(`=== 修复用户"孟司意"的优惠券 ===\n`);
    
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // 1. 查询渠道方信息
      console.log('1. 查询渠道方信息:');
      const [channels] = await connection.query(
        'SELECT id, channel_code, channel_name FROM channels WHERE id = ?',
        [channelUserId]
      );
      
      if (channels.length === 0) {
        throw new Error(`渠道方 ID=${channelUserId} 不存在`);
      }
      
      const channel = channels[0];
      console.log(`  ✓ 找到渠道方: ${channel.channel_name} (ID: ${channel.id}, channel_code: ${channel.channel_code})`);
      
      // 2. 查询渠道推广方案
      console.log(`\n2. 查询渠道推广方案 (channel_code=${channel.channel_code}):`);
      const [schemes] = await connection.query(
        'SELECT * FROM channel_promotion_schemes WHERE channel_code = ? AND status = ?',
        [channel.channel_code, 'active']
      );
      
      if (schemes.length === 0) {
        throw new Error(`未找到激活的渠道推广方案 (channel_code=${channel.channel_code})`);
      }
      
      const scheme = schemes[0];
      const amount = parseFloat(scheme.amount);
      const expiry_days = parseInt(scheme.expiry_days) || 30;
      
      console.log(`  ✓ 找到渠道推广方案:`);
      console.log(`    方案编码: ${scheme.scheme_code || scheme.id}`);
      console.log(`    奖励金额: ¥${amount}`);
      console.log(`    有效期: ${expiry_days}天`);
      
      // 3. 检查是否已有优惠券
      console.log(`\n3. 检查是否已有优惠券:`);
      const [existingCoupons] = await connection.query(
        'SELECT id, amount, status FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
        [userId, 'channel_invite', inviterId]
      );
      
      if (existingCoupons.length > 0) {
        console.log(`  ⚠️  已存在优惠券: ${existingCoupons.length} 张`);
        existingCoupons.forEach(c => {
          console.log(`    - ID: ${c.id}, 金额: ¥${c.amount}, 状态: ${c.status}`);
        });
      } else {
        console.log(`  ✓ 未找到优惠券，将发放新优惠券`);
      }
      
      // 4. 发放优惠券
      if (existingCoupons.length === 0 && amount > 0) {
        console.log(`\n4. 发放优惠券:`);
        const discount_code = await generateDiscountCode();
        const expiry_date = moment().add(expiry_days, 'days').format('YYYY-MM-DD');
        
        // 查询邀请人信息
        const [inviters] = await connection.query(
          'SELECT member_id, real_name FROM users WHERE id = ?',
          [inviterId]
        );
        
        const inviterMemberId = inviters.length > 0 ? inviters[0].member_id : null;
        const inviterName = inviters.length > 0 ? inviters[0].real_name : null;
        
        await connection.query(
          `INSERT INTO discount_coupons (discount_code, user_id, amount, source, source_user_id, start_date, expiry_date, status, promotion_type, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion) 
           VALUES (?, ?, ?, 'channel_invite', ?, CURDATE(), ?, 'unused', 'channel', ?, ?, ?)`,
          [discount_code, userId, amount, inviterId, expiry_date, channel.channel_name, inviterMemberId, inviterName]
        );
        
        console.log(`  ✓ 已发放优惠券:`);
        console.log(`    优惠券编号: ${discount_code}`);
        console.log(`    金额: ¥${amount}`);
        console.log(`    有效期: ${expiry_date} (${expiry_days}天)`);
        console.log(`    渠道方: ${channel.channel_name}`);
        console.log(`    邀请人: ${inviterName} (${inviterMemberId})`);
      } else if (existingCoupons.length > 0) {
        console.log(`\n4. 跳过发放（优惠券已存在）`);
      } else {
        console.log(`\n4. 跳过发放（金额为0）`);
      }
      
      await connection.commit();
      console.log(`\n✓ 修复完成！`);
      
      // 验证结果
      const [coupons] = await connection.query(
        'SELECT id, discount_code, amount, status, expiry_date FROM discount_coupons WHERE user_id = ? AND source = ?',
        [userId, 'channel_invite']
      );
      console.log(`\n验证结果:`);
      console.log(`  用户ID: ${userId}`);
      console.log(`  优惠券数量: ${coupons.length}`);
      if (coupons.length > 0) {
        coupons.forEach(c => {
          console.log(`    - 编号: ${c.discount_code}, 金额: ¥${c.amount}, 状态: ${c.status}, 有效期: ${c.expiry_date}`);
        });
      }
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('修复失败:', error);
    process.exit(1);
  }
}

fixCoupon();

