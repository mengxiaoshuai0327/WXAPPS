const db = require('../config/database');

async function checkLatestUser() {
  try {
    console.log('=== 检查最新注册的用户 ===\n');

    // 查找最新注册的用户
    const [users] = await db.query(
      `SELECT id, member_id, nickname, real_name, phone, role, inviter_id, promotion_type,
              instructor_id_for_promotion, channel_name_for_promotion,
              channel_sales_id_for_promotion, created_at
       FROM users 
       WHERE role = 'member'
       ORDER BY created_at DESC
       LIMIT 5`
    );
    
    if (users.length > 0) {
      console.log(`找到 ${users.length} 个最新注册的会员:\n`);
      users.forEach((user, index) => {
        console.log(`${index + 1}. 用户: ${user.real_name || user.nickname} (ID: ${user.id})`);
        console.log(`   手机号: ${user.phone}`);
        console.log(`   会员ID: ${user.member_id}`);
        console.log(`   邀请人ID: ${user.inviter_id || 'NULL'}`);
        console.log(`   推广类型: ${user.promotion_type || 'NULL'}`);
        console.log(`   渠道销售ID（推广）: ${user.channel_sales_id_for_promotion || 'NULL'}`);
        console.log(`   注册时间: ${user.created_at}`);
        
        if (user.inviter_id) {
          // 查找邀请人信息
          db.query(
            'SELECT id, member_id, real_name, role, channel_user_id FROM users WHERE id = ?',
            [user.inviter_id]
          ).then(([inviters]) => {
            if (inviters.length > 0) {
              const inviter = inviters[0];
              console.log(`   邀请人: ${inviter.real_name || 'N/A'} (ID: ${inviter.id}, member_id: ${inviter.member_id}, role: ${inviter.role})`);
              if (inviter.channel_user_id) {
                console.log(`   邀请人是渠道销售 (channel_user_id: ${inviter.channel_user_id})`);
              }
            }
          }).catch(err => {
            console.log(`   无法查询邀请人信息: ${err.message}`);
          });
        }
        
        // 检查邀请记录
        db.query(
          'SELECT * FROM invitations WHERE invitee_id = ? ORDER BY created_at DESC LIMIT 1',
          [user.id]
        ).then(([invitations]) => {
          if (invitations.length > 0) {
            console.log(`   邀请记录: 存在 (邀请码: ${invitations[0].invite_code})`);
          } else {
            console.log(`   邀请记录: 不存在`);
          }
        }).catch(err => {
          console.log(`   无法查询邀请记录: ${err.message}`);
        });
        
        // 检查优惠券
        db.query(
          'SELECT COUNT(*) as count, SUM(amount) as total FROM discount_coupons WHERE user_id = ?',
          [user.id]
        ).then(([coupons]) => {
          if (coupons[0].count > 0) {
            console.log(`   优惠券: ${coupons[0].count} 张，总金额: ¥${coupons[0].total || 0}`);
          } else {
            console.log(`   优惠券: 0 张`);
          }
        }).catch(err => {
          console.log(`   无法查询优惠券: ${err.message}`);
        });
        
        console.log('');
      });
    } else {
      console.log('未找到注册的会员');
    }

    // 等待异步查询完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkLatestUser();

