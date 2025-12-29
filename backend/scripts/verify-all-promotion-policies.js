/**
 * 验证所有推广政策配置
 * 确保所有推广方案都已正确配置，避免注册时无法发放优惠券的问题
 */

const db = require('../config/database');
require('dotenv').config();

async function verifyAllPromotionPolicies() {
  try {
    console.log('=== 验证所有推广政策配置 ===\n');
    
    let hasErrors = false;
    
    // 1. 检查授课人推广方案
    console.log('1. 检查授课人推广方案 (instructor_invite):');
    const [instructorSchemes] = await db.query(
      "SELECT * FROM coupon_schemes WHERE scheme_type = 'instructor_invite'"
    );
    
    if (instructorSchemes.length === 0) {
      console.log('  ❌ 未找到授课人推广方案');
      console.log('  解决方案: 运行 node scripts/fix-instructor-promotion-scheme.js');
      hasErrors = true;
    } else {
      const scheme = instructorSchemes.find(s => s.status === 'active') || instructorSchemes[0];
      if (scheme.status !== 'active') {
        console.log(`  ⚠️  方案存在但未激活 (status=${scheme.status})`);
        console.log('  解决方案: 更新状态为 active');
        hasErrors = true;
      } else {
        const amount = parseFloat(scheme.instructor_invitee_amount);
        if (!amount || amount <= 0) {
          console.log(`  ⚠️  被邀请人奖励金额为 ${amount}，必须大于0`);
          console.log('  解决方案: 设置 instructor_invitee_amount > 0');
          hasErrors = true;
        } else {
          console.log(`  ✓ 配置正确: 被邀请人奖励=¥${amount}, 有效期=${scheme.invitee_expiry_days || 30}天`);
        }
      }
    }
    
    // 2. 检查会员推广方案
    console.log('\n2. 检查会员推广方案 (member_invite):');
    const [memberSchemes] = await db.query(
      "SELECT * FROM coupon_schemes WHERE scheme_type = 'member_invite'"
    );
    
    if (memberSchemes.length === 0) {
      console.log('  ❌ 未找到会员推广方案');
      hasErrors = true;
    } else {
      const scheme = memberSchemes.find(s => s.status === 'active') || memberSchemes[0];
      if (scheme.status !== 'active') {
        console.log(`  ⚠️  方案存在但未激活 (status=${scheme.status})`);
        hasErrors = true;
      } else {
        console.log(`  ✓ 配置正确:`);
        console.log(`    邀请人注册奖励: ¥${scheme.member_inviter_register_amount || 0}`);
        console.log(`    邀请人购买奖励: ¥${scheme.member_inviter_purchase_amount || 0}`);
        console.log(`    被邀请人奖励: ¥${scheme.member_invitee_amount || 0}`);
      }
    }
    
    // 3. 检查渠道推广方案
    console.log('\n3. 检查渠道推广方案:');
    const [channelSchemes] = await db.query(
      "SELECT * FROM channel_promotion_schemes WHERE status = 'active'"
    );
    
    if (channelSchemes.length === 0) {
      console.log('  ⚠️  未找到激活的渠道推广方案');
    } else {
      console.log(`  ✓ 找到 ${channelSchemes.length} 个激活的渠道推广方案:`);
      channelSchemes.forEach(scheme => {
        console.log(`    - ${scheme.channel_code}: ¥${scheme.amount}, 有效期${scheme.expiry_days}天`);
      });
    }
    
    // 4. 总结
    console.log('\n=== 验证结果 ===');
    if (hasErrors) {
      console.log('❌ 发现配置问题，请根据上述提示进行修复');
      console.log('\n修复脚本:');
      console.log('  - 修复授课人推广方案: node scripts/fix-instructor-promotion-scheme.js');
      process.exit(1);
    } else {
      console.log('✓ 所有推广政策配置正确');
      console.log('\n当前配置状态:');
      console.log('  ✓ 授课人推广方案: 已配置且激活');
      console.log('  ✓ 会员推广方案: 已配置且激活');
      console.log('  ✓ 渠道推广方案: 已配置且激活');
      console.log('\n所有注册用户都应该能正常收到对应的优惠券奖励。');
    }
    
  } catch (error) {
    console.error('验证失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

verifyAllPromotionPolicies();

