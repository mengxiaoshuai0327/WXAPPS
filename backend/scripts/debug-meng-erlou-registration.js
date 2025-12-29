const db = require('../config/database');

async function debugRegistration() {
  try {
    const inviteCode = 'M96143951';
    const userPhone = '16677889000';
    const userName = '孟二六';
    
    console.log(`=== 调试注册问题：邀请码=${inviteCode}, 用户=${userName} (${userPhone}) ===\n`);

    // 1. 检查邀请码对应的邀请人
    console.log('1. 检查邀请码对应的邀请人:');
    const [inviters] = await db.query(
      `SELECT id, member_id, instructor_id, role, channel_user_id, nickname, real_name
       FROM users 
       WHERE member_id = ? AND role = 'member'`,
      [inviteCode]
    );
    
    if (inviters.length > 0) {
      const inviter = inviters[0];
      console.log(`  ✓ 找到邀请人:`);
      console.log(`    ID: ${inviter.id}`);
      console.log(`    member_id: ${inviter.member_id}`);
      console.log(`    角色: ${inviter.role}`);
      console.log(`    姓名: ${inviter.real_name || inviter.nickname}`);
      console.log(`    渠道销售? channel_user_id: ${inviter.channel_user_id || 'NULL'}`);
      
      if (inviter.channel_user_id) {
        console.log(`    ⚠️  这是渠道销售！`);
        // 检查渠道方信息
        const [channels] = await db.query(
          'SELECT id, channel_code, channel_name FROM channels WHERE id = ?',
          [inviter.channel_user_id]
        );
        if (channels.length > 0) {
          console.log(`    所属渠道方: ${channels[0].channel_name} (channel_code=${channels[0].channel_code})`);
        }
      } else {
        console.log(`    ✓ 这是普通会员`);
      }
    } else {
      console.log(`  ✗ 未找到邀请人（member_id=${inviteCode}）`);
    }

    // 2. 检查新注册用户
    console.log(`\n2. 检查新注册用户 "${userName}":`);
    const [newUsers] = await db.query(
      `SELECT id, member_id, instructor_id, role, inviter_id, promotion_type,
              instructor_id_for_promotion, channel_name_for_promotion,
              channel_sales_id_for_promotion, created_at
       FROM users 
       WHERE phone = ? OR real_name = ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [userPhone, userName]
    );
    
    if (newUsers.length > 0) {
      const newUser = newUsers[0];
      console.log(`  ✓ 找到用户:`);
      console.log(`    用户ID: ${newUser.id}`);
      console.log(`    会员ID: ${newUser.member_id || 'NULL'}`);
      console.log(`    角色: ${newUser.role}`);
      console.log(`    邀请人ID: ${newUser.inviter_id || 'NULL'}`);
      console.log(`    推广类型: ${newUser.promotion_type || 'NULL'}`);
      console.log(`    渠道销售ID（推广）: ${newUser.channel_sales_id_for_promotion || 'NULL'}`);
      console.log(`    注册时间: ${newUser.created_at}`);
      
      // 3. 检查邀请记录
      if (newUser.inviter_id) {
        console.log(`\n3. 检查邀请记录:`);
        const [invitations] = await db.query(
          `SELECT i.*, 
                  u_inviter.member_id as inviter_member_id,
                  u_inviter.instructor_id as inviter_instructor_id,
                  u_inviter.role as inviter_role,
                  u_inviter.channel_user_id as inviter_channel_user_id
           FROM invitations i
           LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
           WHERE i.invitee_id = ?
           ORDER BY i.created_at DESC`,
          [newUser.id]
        );
        
        if (invitations.length > 0) {
          invitations.forEach(inv => {
            console.log(`  ✓ 找到邀请记录:`);
            console.log(`    邀请码: ${inv.invite_code}`);
            console.log(`    邀请人ID: ${inv.inviter_id}`);
            console.log(`    邀请人member_id: ${inv.inviter_member_id || 'NULL'}`);
            console.log(`    邀请人角色: ${inv.inviter_role || 'NULL'}`);
            console.log(`    邀请人channel_user_id: ${inv.inviter_channel_user_id || 'NULL'}`);
          });
        } else {
          console.log(`  ✗ 未找到邀请记录`);
        }

        // 4. 检查优惠券
        console.log(`\n4. 检查优惠券:`);
        const [coupons] = await db.query(
          `SELECT dc.*,
                  u_source.real_name as source_user_name,
                  u_source.member_id as source_user_member_id
           FROM discount_coupons dc
           LEFT JOIN users u_source ON dc.source_user_id = u_source.id
           WHERE dc.user_id = ?
           ORDER BY dc.created_at DESC`,
          [newUser.id]
        );
        
        if (coupons.length > 0) {
          console.log(`  ✓ 找到 ${coupons.length} 张优惠券:`);
          coupons.forEach(coupon => {
            console.log(`    优惠券ID: ${coupon.id}`);
            console.log(`    金额: ¥${coupon.amount}`);
            console.log(`    来源: ${coupon.source}`);
            console.log(`    邀请人: ${coupon.source_user_name || 'NULL'} (${coupon.source_user_member_id || 'NULL'})`);
            console.log(`    创建时间: ${coupon.created_at}\n`);
          });
        } else {
          console.log(`  ✗ 未找到优惠券记录`);
        }

        // 5. 检查推广方案配置
        if (inviters.length > 0) {
          const inviter = inviters[0];
          console.log(`\n5. 检查推广方案配置:`);
          
          if (inviter.channel_user_id) {
            // 渠道销售 - 检查渠道推广方案
            console.log(`  邀请人是渠道销售，检查渠道推广方案...`);
            const [channels] = await db.query(
              'SELECT channel_code FROM channels WHERE id = ?',
              [inviter.channel_user_id]
            );
            
            if (channels.length > 0) {
              const channelCode = channels[0].channel_code;
              console.log(`    渠道方channel_code: ${channelCode}`);
              
              const [channelSchemes] = await db.query(
                `SELECT * FROM channel_promotion_schemes 
                 WHERE channel_code = ? AND status = 'active'`,
                [channelCode]
              );
              
              if (channelSchemes.length > 0) {
                const scheme = channelSchemes[0];
                console.log(`  ✓ 找到激活的渠道推广方案:`);
                console.log(`    金额: ¥${scheme.amount || 0}`);
              } else {
                console.log(`  ✗ 未找到激活的渠道推广方案（channel_code=${channelCode}）`);
              }
            }
          } else {
            // 普通会员 - 检查会员推广方案
            console.log(`  邀请人是普通会员，检查会员推广方案...`);
            const [memberSchemes] = await db.query(
              `SELECT * FROM coupon_schemes 
               WHERE scheme_type = 'member_invite' AND status = 'active'`,
              []
            );
            
            if (memberSchemes.length > 0) {
              const scheme = memberSchemes[0];
              console.log(`  ✓ 找到激活的会员推广方案:`);
              console.log(`    邀请人注册奖励: ¥${scheme.member_inviter_register_amount || 0}`);
              console.log(`    被邀请人奖励: ¥${scheme.member_invitee_amount || 0}`);
              
              if (!scheme.member_invitee_amount || parseFloat(scheme.member_invitee_amount) <= 0) {
                console.log(`  ⚠️  警告：被邀请人奖励金额为0或未设置！`);
              }
            } else {
              console.log(`  ✗ 未找到激活的会员推广方案`);
            }
          }
        }
      } else {
        console.log(`  ✗ 用户没有邀请人ID，说明注册时未找到邀请人`);
      }
    } else {
      console.log(`  ✗ 未找到用户记录`);
    }

    process.exit(0);
  } catch (error) {
    console.error('调试失败:', error);
    process.exit(1);
  }
}

debugRegistration();

