// 检查用户优惠券统计数据
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('../config/database');
const moment = require('moment');

async function checkCouponStats() {
  try {
    // 从命令行参数获取用户ID，或者查询所有有优惠券的用户
    const userId = process.argv[2];
    
    if (userId) {
      console.log(`\n检查用户 ${userId} 的优惠券统计：`);
      await checkUserCouponStats(userId);
    } else {
      console.log('\n检查所有有优惠券的用户：');
      // 查询所有有优惠券的用户
      const [users] = await db.query(
        `SELECT DISTINCT user_id FROM discount_coupons LIMIT 10`
      );
      
      for (const user of users) {
        await checkUserCouponStats(user.user_id);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

async function checkUserCouponStats(userId) {
  try {
    const today = moment().format('YYYY-MM-DD');
    console.log(`\n=== 用户ID: ${userId}, 日期: ${today} ===`);
    
    // 查询所有优惠券
    const [allCoupons] = await db.query(
      `SELECT id, amount, status, expiry_date, created_at 
       FROM discount_coupons 
       WHERE user_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    console.log(`总优惠券数量: ${allCoupons.length}`);
    
    if (allCoupons.length > 0) {
      console.log('\n所有优惠券详情:');
      allCoupons.forEach(coupon => {
        console.log(`  - ID: ${coupon.id}, 金额: ${coupon.amount}, 状态: ${coupon.status}, 过期日期: ${coupon.expiry_date || '无'}`);
      });
    }
    
    // 统计未使用的优惠券
    const [unusedStats] = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
       FROM discount_coupons 
       WHERE user_id = ? AND status = 'unused' 
       AND (expiry_date IS NULL OR expiry_date >= ?)`,
      [userId, today]
    );
    
    console.log(`\n未使用优惠券（有效期内）:`);
    console.log(`  数量: ${unusedStats[0]?.count || 0}`);
    console.log(`  总金额: ${unusedStats[0]?.total_amount || 0}`);
    
    // 统计已使用的优惠券
    const [usedCount] = await db.query(
      `SELECT COUNT(*) as count 
       FROM discount_coupons 
       WHERE user_id = ? AND status = 'used'`,
      [userId]
    );
    
    console.log(`\n已使用优惠券:`);
    console.log(`  数量: ${usedCount[0]?.count || 0}`);
    
    // 统计已过期的优惠券
    const [expiredCount] = await db.query(
      `SELECT COUNT(*) as count 
       FROM discount_coupons 
       WHERE user_id = ? AND status = 'unused' 
       AND expiry_date IS NOT NULL AND expiry_date < ?`,
      [userId, today]
    );
    
    console.log(`\n已过期优惠券:`);
    console.log(`  数量: ${expiredCount[0]?.count || 0}`);
    
    // 模拟API返回
    const result = {
      unused: parseInt(unusedStats[0]?.count || 0),
      unused_amount: parseFloat(unusedStats[0]?.total_amount || 0),
      used: parseInt(usedCount[0]?.count || 0),
      expired: parseInt(expiredCount[0]?.count || 0)
    };
    
    console.log(`\nAPI应该返回的数据:`);
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error(`检查用户 ${userId} 失败:`, error);
  }
}

checkCouponStats();

