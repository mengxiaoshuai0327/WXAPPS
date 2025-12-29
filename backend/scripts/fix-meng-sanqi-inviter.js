const db = require('../config/database');
const moment = require('moment');
const { generateDiscountCode } = require('../utils/discountCode');

async function fixInviter() {
  try {
    const inviteCode = 'M39124712';
    const userPhone = '13451223465';
    const userName = '孟三期';
    
    console.log(`=== 修复用户 "${userName}" 的邀请关系 ===\n`);
    
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // 1. 查询邀请人信息
      const [inviters] = await connection.query(
        'SELECT id, member_id, real_name, channel_user_id, role FROM users WHERE member_id = ? AND role = ?',
        [inviteCode, 'member']
      );
      
      if (inviters.length === 0) {
        throw new Error(`邀请人不存在（member_id=${inviteCode}）`);
      }
      
      const inviter = inviters[0];
      console.log(`找到邀请人: ${inviter.real_name || '未知'} (ID: ${inviter.id}, member_id: ${inviter.member_id}, role: ${inviter.role})`);
      
      // 2. 查询被邀请人信息
      const [invitees] = await connection.query(
        'SELECT id, member_id, real_name, phone, inviter_id FROM users WHERE phone = ? OR real_name = ? ORDER BY created_at DESC LIMIT 1',
        [userPhone, userName]
      );
      
      if (invitees.length === 0) {
        throw new Error(`被邀请人不存在（phone=${userPhone}, name=${userName}）`);
      }
      
      const invitee = invitees[0];
      console.log(`找到被邀请人: ${invitee.real_name} (ID: ${invitee.id}, member_id: ${invitee.member_id}, phone: ${invitee.phone})`);
      console.log(`当前邀请人ID: ${invitee.inviter_id || 'NULL'}`);
      
      // 3. 判断邀请人类型并设置相应的推广信息
      let promotion_type = null;
      let channel_name_for_promotion = null;
      let channel_code_for_promotion = null;
      let channel_sales_id_for_promotion = null;
      let channel_sales_name_for_promotion = null;
      
      // 如果邀请人是渠道销售（channel_user_id不为NULL）
      if (inviter.channel_user_id) {
        promotion_type = 'channel';
        channel_sales_id_for_promotion = inviter.member_id;
        channel_sales_name_for_promotion = inviter.real_name || '未知';
        
        // 查询渠道方信息
        const [channels] = await connection.query(
          'SELECT channel_name, channel_code FROM channels WHERE id = ?',
          [inviter.channel_user_id]
        );
        
        if (channels.length > 0) {
          channel_name_for_promotion = channels[0].channel_name;
          channel_code_for_promotion = channels[0].channel_code;
          console.log(`渠道方: ${channel_name_for_promotion} (channel_code: ${channel_code_for_promotion})`);
        }
      } else {
        promotion_type = 'member';
        console.log(`邀请人是普通会员`);
      }
      
      // 4. 更新用户信息
      await connection.query(
        `UPDATE users 
         SET inviter_id = ?, 
             promotion_type = ?,
             channel_sales_id_for_promotion = ?,
             channel_sales_name_for_promotion = ?,
             channel_name_for_promotion = ?
         WHERE id = ?`,
        [inviter.id, promotion_type, channel_sales_id_for_promotion, channel_sales_name_for_promotion, channel_name_for_promotion, invitee.id]
      );
      console.log(`✓ 已更新用户信息`);
      
      // 5. 创建邀请记录
      const [existingInvitations] = await connection.query(
        'SELECT id FROM invitations WHERE inviter_id = ? AND invitee_id = ?',
        [inviter.id, invitee.id]
      );
      
      if (existingInvitations.length === 0) {
        try {
          await connection.query(
            'INSERT IGNORE INTO invitations (inviter_id, invitee_id, invite_code, status, registered_at) VALUES (?, ?, ?, ?, (SELECT created_at FROM users WHERE id = ?))',
            [inviter.id, invitee.id, inviteCode, 'registered', invitee.id]
          );
          console.log(`✓ 已创建邀请记录`);
        } catch (inviteError) {
          if (inviteError.code === 'ER_DUP_ENTRY') {
            console.log(`⚠️  邀请记录已存在（可能是唯一键冲突）`);
          } else {
            throw inviteError;
          }
        }
      } else {
        console.log(`✓ 邀请记录已存在`);
      }
      
      // 6. 检查并发放优惠券（如果是渠道推广）
      if (promotion_type === 'channel' && channel_code_for_promotion) {
        const [schemes] = await connection.query(
          'SELECT * FROM channel_promotion_schemes WHERE channel_code = ? AND status = ?',
          [channel_code_for_promotion, 'active']
        );
        
        if (schemes.length > 0) {
          const scheme = schemes[0];
          const amount = parseFloat(scheme.amount);
          const expiry_days = parseInt(scheme.expiry_days) || 30;
          
          console.log(`找到渠道推广方案: 金额=¥${amount}, 有效期=${expiry_days}天`);
          
          // 检查是否已有优惠券
          const [existingCoupons] = await connection.query(
            'SELECT id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
            [invitee.id, 'channel_invite', inviter.id]
          );
          
          if (existingCoupons.length === 0 && amount > 0) {
            const discount_code = await generateDiscountCode();
            const expiry_date = moment().add(expiry_days, 'days').format('YYYY-MM-DD');
            
            await connection.query(
              `INSERT INTO discount_coupons (discount_code, user_id, amount, source, source_user_id, start_date, expiry_date, status, promotion_type, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion) 
               VALUES (?, ?, ?, 'channel_invite', ?, CURDATE(), ?, 'unused', 'channel', ?, ?, ?)`,
              [discount_code, invitee.id, amount, inviter.id, expiry_date, channel_name_for_promotion, inviter.member_id, inviter.real_name]
            );
            console.log(`✓ 已发放优惠券: 金额¥${amount}，有效期${expiry_days}天`);
          } else if (existingCoupons.length > 0) {
            console.log(`✓ 优惠券已存在`);
          } else {
            console.log(`⚠️  优惠券金额为0，未发放`);
          }
        } else {
          console.log(`⚠️  未找到激活的渠道推广方案 (channel_code=${channel_code_for_promotion})`);
        }
      } else if (promotion_type === 'member') {
        // 检查会员推广方案
        const [memberSchemes] = await connection.query(
          'SELECT * FROM coupon_schemes WHERE type = ? AND status = ?',
          ['member_invite', 'active']
        );
        
        if (memberSchemes.length > 0) {
          const scheme = memberSchemes[0];
          const amount = parseFloat(scheme.amount);
          const expiry_days = parseInt(scheme.expiry_days) || 30;
          
          console.log(`找到会员推广方案: 金额=¥${amount}, 有效期=${expiry_days}天`);
          
          // 检查是否已有优惠券
          const [existingCoupons] = await connection.query(
            'SELECT id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
            [invitee.id, 'member_invite', inviter.id]
          );
          
          if (existingCoupons.length === 0 && amount > 0) {
            const discount_code = await generateDiscountCode();
            const expiry_date = moment().add(expiry_days, 'days').format('YYYY-MM-DD');
            
            await connection.query(
              `INSERT INTO discount_coupons (discount_code, user_id, amount, source, source_user_id, start_date, expiry_date, status, promotion_type) 
               VALUES (?, ?, ?, 'member_invite', ?, CURDATE(), ?, 'unused', 'member')`,
              [discount_code, invitee.id, amount, inviter.id, expiry_date]
            );
            console.log(`✓ 已发放优惠券: 金额¥${amount}，有效期${expiry_days}天`);
          } else if (existingCoupons.length > 0) {
            console.log(`✓ 优惠券已存在`);
          }
        } else {
          console.log(`⚠️  未找到激活的会员推广方案`);
        }
      }
      
      await connection.commit();
      console.log(`\n✓ 修复完成！`);
      
      // 验证结果
      const [users] = await connection.query(
        'SELECT id, member_id, inviter_id, promotion_type, channel_sales_id_for_promotion FROM users WHERE id = ?',
        [invitee.id]
      );
      console.log(`\n验证结果:`);
      console.log(`  用户ID: ${users[0].id}`);
      console.log(`  会员ID: ${users[0].member_id}`);
      console.log(`  邀请人ID: ${users[0].inviter_id}`);
      console.log(`  推广类型: ${users[0].promotion_type}`);
      console.log(`  渠道销售ID: ${users[0].channel_sales_id_for_promotion || 'NULL'}`);
      
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

fixInviter();

