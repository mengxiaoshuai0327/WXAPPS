// 检查刘一用户的优惠券发放情况
const db = require('../config/database');
require('dotenv').config();

async function checkLiuyiCoupon() {
  try {
    console.log('=== 检查刘一用户的优惠券发放情况 ===\n');
    
    // 1. 查找刘一用户
    const [users] = await db.query(
      "SELECT id, member_id, nickname, real_name, inviter_id, promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, created_at FROM users WHERE nickname LIKE '%刘一%' OR real_name LIKE '%刘一%'"
    );
    
    if (users.length === 0) {
      console.log('❌ 未找到用户刘一');
      process.exit(0);
    }
    
    for (const user of users) {
      console.log(`用户信息:`);
      console.log(`  姓名: ${user.real_name || user.nickname}`);
      console.log(`  会员号: ${user.member_id}`);
      console.log(`  用户ID: ${user.id}`);
      console.log(`  注册时间: ${user.created_at}`);
      console.log(`  邀请人ID: ${user.inviter_id || 'N/A'}`);
      console.log(`  推广类型: ${user.promotion_type || 'N/A'}`);
      console.log(`  授课人ID: ${user.instructor_id_for_promotion || 'N/A'}`);
      console.log(`  授课人姓名: ${user.instructor_name_for_promotion || 'N/A'}\n`);
      
      // 2. 查找邀请人信息
      if (user.inviter_id) {
        const [inviters] = await db.query(
          'SELECT id, nickname, real_name, member_id, instructor_id, role FROM users WHERE id = ?',
          [user.inviter_id]
        );
        
        if (inviters.length > 0) {
          const inviter = inviters[0];
          console.log(`邀请人信息:`);
          console.log(`  姓名: ${inviter.real_name || inviter.nickname}`);
          console.log(`  角色: ${inviter.role}`);
          console.log(`  会员号: ${inviter.member_id || 'N/A'}`);
          console.log(`  授课人编号: ${inviter.instructor_id || 'N/A'}\n`);
          
          if (inviter.role !== 'instructor') {
            console.log('⚠️  警告：邀请人不是授课人角色！');
          }
        } else {
          console.log('⚠️  警告：未找到邀请人信息\n');
        }
      }
      
      // 3. 查找邀请记录
      const [invitations] = await db.query(
        'SELECT * FROM invitations WHERE invitee_id = ?',
        [user.id]
      );
      
      if (invitations.length > 0) {
        console.log(`邀请记录: ✓ 存在`);
        invitations.forEach(inv => {
          console.log(`  邀请码: ${inv.invite_code}`);
          console.log(`  状态: ${inv.status}`);
          console.log(`  注册时间: ${inv.registered_at || inv.created_at}`);
        });
      } else {
        console.log(`邀请记录: ❌ 不存在\n`);
      }
      
      // 4. 查找优惠券
      const [coupons] = await db.query(
        "SELECT * FROM discount_coupons WHERE user_id = ? AND source IN ('instructor_invite', 'invite_register', 'channel_invite') ORDER BY created_at DESC",
        [user.id]
      );
      
      console.log(`\n优惠券情况:`);
      if (coupons.length > 0) {
        console.log(`  ✓ 找到 ${coupons.length} 张优惠券:`);
        coupons.forEach(c => {
          console.log(`    - ${c.discount_code}: ¥${c.amount}, 来源=${c.source}, 状态=${c.status}, 创建时间=${c.created_at}`);
        });
      } else {
        console.log(`  ❌ 未找到优惠券（未发放）`);
        
        // 5. 诊断为什么没有发放
        console.log(`\n=== 诊断原因 ===`);
        
        if (!user.inviter_id) {
          console.log(`❌ 原因1：用户没有邀请人ID（inviter_id为NULL）`);
        }
        
        if (user.promotion_type !== 'instructor') {
          console.log(`❌ 原因2：推广类型不是'instructor'，当前为'${user.promotion_type || 'NULL'}'`);
        }
        
        // 检查授课人推广方案
        const [schemes] = await db.query(
          "SELECT * FROM coupon_schemes WHERE scheme_type = 'instructor_invite' AND status = 'active'"
        );
        
        if (schemes.length === 0) {
          console.log(`❌ 原因3：未找到激活的授课人推广方案`);
        } else {
          const scheme = schemes[0];
          console.log(`✓ 授课人推广方案存在:`);
          console.log(`  被邀请人奖励: ¥${scheme.instructor_invitee_amount}`);
          console.log(`  有效期: ${scheme.invitee_expiry_days} 天`);
          
          if (!scheme.instructor_invitee_amount || parseFloat(scheme.instructor_invitee_amount) <= 0) {
            console.log(`❌ 原因4：授课人推广方案的被邀请人奖励金额为0或未设置`);
          }
        }
      }
      
      console.log('\n');
    }
    
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

checkLiuyiCoupon();

