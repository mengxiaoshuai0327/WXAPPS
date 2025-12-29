const db = require('../config/database');
const moment = require('moment');
const { generateDiscountCode } = require('../utils/discountCode');

async function fixMissingInviterId() {
  try {
    const userId = 78; // 孟二六
    const inviteCode = 'M96143951';
    const inviterId = 53; // 联想1（渠道销售）
    
    console.log(`=== 修复用户 ID=${userId} 的邀请人信息 ===\n`);
    
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // 1. 查询邀请人信息
      const [inviters] = await connection.query(
        'SELECT id, member_id, real_name, channel_user_id FROM users WHERE id = ?',
        [inviterId]
      );
      
      if (inviters.length === 0) {
        throw new Error(`邀请人 ID=${inviterId} 不存在`);
      }
      
      const inviter = inviters[0];
      console.log(`找到邀请人: ${inviter.real_name} (ID: ${inviter.id}, member_id: ${inviter.member_id})`);
      
      // 2. 查询渠道方信息
      let channelName = null;
      let channelCode = null;
      if (inviter.channel_user_id) {
        const [channels] = await connection.query(
          'SELECT channel_name, channel_code FROM channels WHERE id = ?',
          [inviter.channel_user_id]
        );
        if (channels.length > 0) {
          channelName = channels[0].channel_name;
          channelCode = channels[0].channel_code;
          console.log(`渠道方: ${channelName} (channel_code: ${channelCode})`);
        }
      }
      
      // 3. 更新用户信息
      await connection.query(
        `UPDATE users 
         SET inviter_id = ?, 
             promotion_type = 'channel',
             channel_sales_id_for_promotion = ?,
             channel_sales_name_for_promotion = ?,
             channel_name_for_promotion = ?
         WHERE id = ?`,
        [inviterId, inviter.member_id, inviter.real_name, channelName, userId]
      );
      console.log(`✓ 已更新用户信息`);
      
      // 4. 创建邀请记录（使用 INSERT IGNORE 避免重复）
      const [existingInvitations] = await connection.query(
        'SELECT id FROM invitations WHERE inviter_id = ? AND invitee_id = ?',
        [inviterId, userId]
      );
      
      if (existingInvitations.length === 0) {
        try {
          await connection.query(
            'INSERT IGNORE INTO invitations (inviter_id, invitee_id, invite_code, status, registered_at) VALUES (?, ?, ?, ?, (SELECT created_at FROM users WHERE id = ?))',
            [inviterId, userId, inviteCode, 'registered', userId]
          );
          console.log(`✓ 已创建邀请记录`);
        } catch (inviteError) {
          // 如果是重复键错误，说明记录已存在（可能是其他被邀请人也使用了相同的邀请码）
          if (inviteError.code === 'ER_DUP_ENTRY') {
            console.log(`⚠️  邀请码 ${inviteCode} 已被其他邀请记录使用，尝试更新现有记录`);
            // 尝试更新现有记录
            await connection.query(
              'UPDATE invitations SET inviter_id = ?, invitee_id = ?, status = ? WHERE invite_code = ? AND invitee_id IS NULL OR invitee_id != ? LIMIT 1',
              [inviterId, userId, 'registered', inviteCode, userId]
            );
            // 如果更新失败（没有匹配的记录），创建一个新的记录使用不同的方式
            // 但由于 invite_code 是唯一键，我们需要检查是否有其他记录
            const [checkInvites] = await connection.query(
              'SELECT id, inviter_id, invitee_id FROM invitations WHERE invite_code = ?',
              [inviteCode]
            );
            if (checkInvites.length > 0 && checkInvites[0].invitee_id === userId) {
              console.log(`✓ 邀请记录已存在且关联到当前用户`);
            } else {
              console.log(`⚠️  无法创建邀请记录，邀请码已被其他用户使用`);
            }
          } else {
            throw inviteError;
          }
        }
      } else {
        console.log(`✓ 邀请记录已存在`);
      }
      
      // 5. 检查并发放优惠券（如果有渠道推广方案）
      if (channelCode) {
        const [schemes] = await connection.query(
          'SELECT * FROM channel_promotion_schemes WHERE channel_code = ? AND status = ?',
          [channelCode, 'active']
        );
        
        if (schemes.length > 0) {
          const scheme = schemes[0];
          const amount = parseFloat(scheme.amount);
          const expiry_days = parseInt(scheme.expiry_days) || 30;
          
          console.log(`找到渠道推广方案: 金额=¥${amount}, 有效期=${expiry_days}天`);
          
          // 检查是否已有优惠券
          const [existingCoupons] = await connection.query(
            'SELECT id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
            [userId, 'channel_invite', inviterId]
          );
          
          if (existingCoupons.length === 0 && amount > 0) {
            const discount_code = await generateDiscountCode();
            const expiry_date = moment().add(expiry_days, 'days').format('YYYY-MM-DD');
            
            await connection.query(
              `INSERT INTO discount_coupons (discount_code, user_id, amount, source, source_user_id, start_date, expiry_date, status, promotion_type, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion) 
               VALUES (?, ?, ?, 'channel_invite', ?, CURDATE(), ?, 'unused', 'channel', ?, ?, ?)`,
              [discount_code, userId, amount, inviterId, expiry_date, channelName, inviter.member_id, inviter.real_name]
            );
            console.log(`✓ 已发放优惠券: 金额¥${amount}，有效期${expiry_days}天`);
          } else if (existingCoupons.length > 0) {
            console.log(`✓ 优惠券已存在`);
          } else {
            console.log(`⚠️  优惠券金额为0，未发放`);
          }
        } else {
          console.log(`⚠️  未找到激活的渠道推广方案 (channel_code=${channelCode})`);
        }
      }
      
      await connection.commit();
      console.log(`\n✓ 修复完成！`);
      
      // 验证结果
      const [users] = await connection.query(
        'SELECT id, inviter_id, promotion_type, channel_sales_id_for_promotion FROM users WHERE id = ?',
        [userId]
      );
      console.log(`\n验证结果:`);
      console.log(`  用户ID: ${users[0].id}`);
      console.log(`  邀请人ID: ${users[0].inviter_id}`);
      console.log(`  推广类型: ${users[0].promotion_type}`);
      console.log(`  渠道销售ID: ${users[0].channel_sales_id_for_promotion}`);
      
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

fixMissingInviterId();

