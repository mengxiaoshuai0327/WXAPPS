// 检查所有推广方案配置
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../config/database');

async function checkAllPromotionSchemes() {
  try {
    console.log('=== 检查所有推广方案配置 ===\n');
    
    // 1. 检查coupon_schemes表中的所有推广方案
    console.log('1. coupon_schemes 表中的推广方案：');
    const [schemes] = await db.query('SELECT * FROM coupon_schemes ORDER BY scheme_type');
    
    if (schemes.length === 0) {
      console.log('  ❌ 未找到任何推广方案配置！');
    } else {
      schemes.forEach(scheme => {
        console.log(`\n  方案类型: ${scheme.scheme_type}`);
        console.log(`  状态: ${scheme.status} ${scheme.status === 'active' ? '✓' : '❌'}`);
        
        if (scheme.scheme_type === 'member_invite') {
          console.log(`  邀请人注册奖励: ¥${scheme.member_inviter_register_amount || 0}`);
          console.log(`  邀请人购买奖励: ¥${scheme.member_inviter_purchase_amount || 0}`);
          console.log(`  被邀请人奖励: ¥${scheme.member_invitee_amount || 0}`);
          console.log(`  有效期（邀请人）: ${scheme.inviter_expiry_days || 0} 天`);
          console.log(`  有效期（被邀请人）: ${scheme.invitee_expiry_days || 0} 天`);
        } else if (scheme.scheme_type === 'instructor_invite') {
          console.log(`  被邀请人奖励: ¥${scheme.instructor_invitee_amount || 0}`);
          console.log(`  有效期: ${scheme.invitee_expiry_days || 0} 天`);
        } else if (scheme.scheme_type === 'channel_caifu' || scheme.scheme_type === 'channel_other') {
          console.log(`  被邀请人奖励: ¥${scheme[scheme.scheme_type + '_amount'] || 0}`);
          console.log(`  有效期: ${scheme.invitee_expiry_days || 0} 天`);
        }
      });
    }
    
    // 2. 检查是否有激活的授课人推广方案
    console.log('\n\n2. 检查激活的授课人推广方案：');
    const [activeInstructorSchemes] = await db.query(
      "SELECT * FROM coupon_schemes WHERE scheme_type = 'instructor_invite' AND status = 'active'"
    );
    
    if (activeInstructorSchemes.length === 0) {
      console.log('  ❌ 未找到激活的授课人推广方案！');
      console.log('  ⚠️  这是导致注册时无法发放优惠券的原因！');
      console.log('\n  解决方案：');
      console.log('  需要在 coupon_schemes 表中创建或激活授课人推广方案：');
      console.log('  INSERT INTO coupon_schemes (scheme_type, instructor_invitee_amount, invitee_expiry_days, status)');
      console.log("  VALUES ('instructor_invite', 500.00, 30, 'active');");
    } else {
      const scheme = activeInstructorSchemes[0];
      console.log('  ✓ 找到激活的授课人推广方案：');
      console.log(`    被邀请人奖励: ¥${scheme.instructor_invitee_amount || 0}`);
      console.log(`    有效期: ${scheme.invitee_expiry_days || 0} 天`);
      
      if (!scheme.instructor_invitee_amount || parseFloat(scheme.instructor_invitee_amount) <= 0) {
        console.log('  ⚠️  警告：被邀请人奖励金额为0或未设置，即使有方案也不会发放优惠券！');
      }
    }
    
    // 3. 检查是否有激活的会员推广方案
    console.log('\n\n3. 检查激活的会员推广方案：');
    const [activeMemberSchemes] = await db.query(
      "SELECT * FROM coupon_schemes WHERE scheme_type = 'member_invite' AND status = 'active'"
    );
    
    if (activeMemberSchemes.length === 0) {
      console.log('  ❌ 未找到激活的会员推广方案！');
    } else {
      const scheme = activeMemberSchemes[0];
      console.log('  ✓ 找到激活的会员推广方案：');
      console.log(`    邀请人注册奖励: ¥${scheme.member_inviter_register_amount || 0}`);
      console.log(`    被邀请人奖励: ¥${scheme.member_invitee_amount || 0}`);
    }
    
    // 4. 查找张老师（授课人）
    console.log('\n\n4. 查找授课人（张老师）：');
    const [instructors] = await db.query(
      "SELECT id, instructor_id, nickname, real_name, role FROM users WHERE role = 'instructor' AND (nickname LIKE '%张%' OR real_name LIKE '%张%')"
    );
    
    if (instructors.length === 0) {
      console.log('  ❌ 未找到姓张的授课人');
    } else {
      console.log(`  找到 ${instructors.length} 位姓张的授课人：`);
      instructors.forEach(instructor => {
        console.log(`    - ID: ${instructor.id}, 授课人编号: ${instructor.instructor_id || 'N/A'}, 姓名: ${instructor.real_name || instructor.nickname}`);
      });
    }
    
    // 5. 查找刘一
    console.log('\n\n5. 查找用户（刘一）：');
    const [users] = await db.query(
      "SELECT id, member_id, nickname, real_name, inviter_id, promotion_type FROM users WHERE nickname LIKE '%刘一%' OR real_name LIKE '%刘一%'"
    );
    
    if (users.length === 0) {
      console.log('  ❌ 未找到用户刘一');
    } else {
      for (const user of users) {
        console.log(`    - ID: ${user.id}, 会员号: ${user.member_id}, 姓名: ${user.real_name || user.nickname}`);
        console.log(`      邀请人ID: ${user.inviter_id || 'N/A'}, 推广类型: ${user.promotion_type || 'N/A'}`);
        
        // 查找邀请记录
        if (user.inviter_id) {
          const [invitations] = await db.query(
            'SELECT * FROM invitations WHERE invitee_id = ?',
            [user.id]
          );
          if (invitations.length > 0) {
            console.log(`      邀请记录: ✓ 存在 (邀请码: ${invitations[0].invite_code || 'N/A'})`);
          } else {
            console.log(`      邀请记录: ❌ 不存在`);
          }
          
          // 查找优惠券
          const [coupons] = await db.query(
            "SELECT * FROM discount_coupons WHERE user_id = ? AND source IN ('instructor_invite', 'invite_register', 'channel_invite')",
            [user.id]
          );
          if (coupons.length > 0) {
            console.log(`      优惠券: ✓ ${coupons.length} 张`);
            coupons.forEach(c => {
              console.log(`        - ${c.discount_code}: ¥${c.amount}, 来源=${c.source}, 状态=${c.status}`);
            });
          } else {
            console.log(`      优惠券: ❌ 0 张（未发放）`);
          }
        }
      }
    }
    
    // 6. 检查渠道推广方案
    console.log('\n\n6. 检查渠道推广方案：');
    const [channelSchemes] = await db.query('SELECT * FROM channel_promotion_schemes WHERE status = ?', ['active']);
    if (channelSchemes.length === 0) {
      console.log('  ❌ 未找到激活的渠道推广方案');
    } else {
      console.log(`  ✓ 找到 ${channelSchemes.length} 个激活的渠道推广方案`);
      channelSchemes.forEach(scheme => {
        console.log(`    - ${scheme.channel_code}: ¥${scheme.amount}, 有效期${scheme.expiry_days}天`);
      });
    }
    
    console.log('\n\n=== 检查完成 ===');
    
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkAllPromotionSchemes();

