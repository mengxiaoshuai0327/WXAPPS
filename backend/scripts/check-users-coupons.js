/**
 * 检查指定用户的邀请和优惠券情况
 */

const db = require('../config/database');

async function checkUsersCoupons() {
  try {
    // 查找"王石儿"和"王石一"
    console.log('查找用户...\n');
    const [users] = await db.query(
      `SELECT u.id, u.nickname, u.real_name, u.member_id, u.inviter_id, u.created_at,
              u.promotion_type, u.instructor_id_for_promotion, u.instructor_name_for_promotion,
              u.channel_name_for_promotion, u.channel_sales_id_for_promotion, u.channel_sales_name_for_promotion
       FROM users u
       WHERE (u.nickname LIKE '%王石儿%' OR u.nickname LIKE '%王石一%' OR u.real_name LIKE '%王石儿%' OR u.real_name LIKE '%王石一%')
       ORDER BY u.created_at DESC`
    );
    
    if (users.length === 0) {
      console.log('未找到相关用户');
      return;
    }
    
    console.log(`找到 ${users.length} 个用户:\n`);
    
    for (const user of users) {
      console.log(`用户: ${user.real_name || user.nickname} (${user.member_id})`);
      console.log(`  注册时间: ${user.created_at}`);
      console.log(`  邀请人ID: ${user.inviter_id || 'NULL'}`);
      console.log(`  推广类型: ${user.promotion_type || 'NULL'}`);
      console.log(`  授课人ID: ${user.instructor_id_for_promotion || 'NULL'}`);
      console.log(`  授课人姓名: ${user.instructor_name_for_promotion || 'NULL'}`);
      console.log(`  渠道名称: ${user.channel_name_for_promotion || 'NULL'}`);
      console.log(`  渠道销售ID: ${user.channel_sales_id_for_promotion || 'NULL'}`);
      
      // 如果inviter_id存在，查找邀请人信息
      if (user.inviter_id) {
        const [inviters] = await db.query(
          'SELECT id, nickname, real_name, member_id, instructor_id, role FROM users WHERE id = ?',
          [user.inviter_id]
        );
        if (inviters.length > 0) {
          const inviter = inviters[0];
          console.log(`  邀请人信息: ${inviter.real_name || inviter.nickname} (${inviter.member_id || inviter.instructor_id || 'N/A'}), 角色=${inviter.role}`);
        }
      }
      
      // 查找邀请记录
      const [invitations] = await db.query(
        'SELECT * FROM invitations WHERE invitee_id = ?',
        [user.id]
      );
      
      if (invitations.length > 0) {
        console.log(`  邀请记录: invite_code=${invitations[0].invite_code || 'NULL'}, status=${invitations[0].status}`);
      } else {
        console.log(`  邀请记录: 无`);
      }
      
      // 查找优惠券
      const [coupons] = await db.query(
        `SELECT id, discount_code, amount, source, source_user_id, status, created_at, expiry_date
         FROM discount_coupons
         WHERE user_id = ? AND source IN ('instructor_invite', 'channel_invite', 'invite_register')
         ORDER BY created_at DESC`,
        [user.id]
      );
      
      if (coupons.length > 0) {
        console.log(`  优惠券数量: ${coupons.length}`);
        coupons.forEach(coupon => {
          console.log(`    - ${coupon.discount_code}: ¥${coupon.amount}, 来源=${coupon.source}, 状态=${coupon.status}, 创建时间=${coupon.created_at}`);
        });
      } else {
        console.log(`  优惠券数量: 0 (未发放)`);
        
        // 检查应该发放什么类型的优惠券
        if (user.promotion_type === 'instructor' || user.instructor_id_for_promotion) {
          console.log(`  应该发放授课人推广优惠券`);
          const [schemes] = await db.query(
            'SELECT * FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
            ['instructor_invite', 'active']
          );
          if (schemes.length > 0) {
            console.log(`  授课人推广方案存在，应该发放但未发放！`);
          }
        } else if (user.promotion_type === 'channel') {
          console.log(`  应该发放渠道推广优惠券`);
        }
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkUsersCoupons();


