// 修复授课人推广方案配置
const db = require('../config/database');
require('dotenv').config();

async function fixInstructorPromotionScheme() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    console.log('=== 检查和修复授课人推广方案 ===\n');
    
    // 1. 检查是否存在授课人推广方案
    const [existing] = await connection.query(
      "SELECT * FROM coupon_schemes WHERE scheme_type = 'instructor_invite'"
    );
    
    if (existing.length > 0) {
      console.log('找到现有的授课人推广方案:');
      existing.forEach(scheme => {
        console.log(`  ID: ${scheme.id}, 状态: ${scheme.status}, 被邀请人金额: ¥${scheme.instructor_invitee_amount || 0}`);
      });
      
      // 如果存在但未激活，激活它
      if (existing.some(s => s.status === 'inactive')) {
        await connection.query(
          "UPDATE coupon_schemes SET status = 'active' WHERE scheme_type = 'instructor_invite' AND status = 'inactive'"
        );
        console.log('\n✓ 已激活授课人推广方案');
      }
      
      // 如果金额为0或NULL，设置为500
      if (existing.some(s => !s.instructor_invitee_amount || parseFloat(s.instructor_invitee_amount) <= 0)) {
        await connection.query(
          "UPDATE coupon_schemes SET instructor_invitee_amount = 500.00 WHERE scheme_type = 'instructor_invite'"
        );
        console.log('✓ 已将授课人推广方案的被邀请人金额设置为 ¥500');
      }
    } else {
      // 如果不存在，创建它
      console.log('未找到授课人推广方案，正在创建...');
      await connection.query(
        `INSERT INTO coupon_schemes (
          scheme_type, 
          instructor_invitee_amount, 
          invitee_expiry_days, 
          status, 
          name,
          description,
          created_at, 
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        ['instructor_invite', 500.00, 30, 'active', '授课人推广方案', '授课人推广优惠券配置']
      );
      console.log('✓ 已创建授课人推广方案：被邀请人奖励 ¥500，有效期 30 天');
    }
    
    // 2. 验证配置
    const [schemes] = await connection.query(
      "SELECT * FROM coupon_schemes WHERE scheme_type = 'instructor_invite' AND status = 'active'"
    );
    
    if (schemes.length > 0) {
      const scheme = schemes[0];
      console.log('\n=== 当前配置 ===');
      console.log(`  方案类型: ${scheme.scheme_type}`);
      console.log(`  状态: ${scheme.status} ✓`);
      console.log(`  被邀请人奖励: ¥${scheme.instructor_invitee_amount}`);
      console.log(`  有效期: ${scheme.invitee_expiry_days} 天`);
      
      if (scheme.instructor_invitee_amount && parseFloat(scheme.instructor_invitee_amount) > 0) {
        console.log('\n✓ 配置正确，授课人邀请注册时会正常发放优惠券');
      } else {
        console.log('\n⚠️  警告：被邀请人奖励金额为0，需要手动设置');
      }
    } else {
      console.log('\n❌ 错误：仍然未找到激活的授课人推广方案');
    }
    
    await connection.commit();
    console.log('\n=== 修复完成 ===');
    
  } catch (error) {
    await connection.rollback();
    console.error('修复失败:', error);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

fixInstructorPromotionScheme();

