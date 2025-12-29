/**
 * 批量修复缺失 discount_code 的优惠券
 * 为所有 discount_code 为 NULL 的优惠券生成编号：DC{id}
 */

const db = require('../config/database');

async function fixMissingDiscountCodes() {
  try {
    console.log('开始修复缺失 discount_code 的优惠券...\n');
    
    // 查询所有 discount_code 为 NULL 的优惠券
    const [coupons] = await db.query(
      'SELECT id FROM discount_coupons WHERE discount_code IS NULL ORDER BY id ASC'
    );
    
    if (coupons.length === 0) {
      console.log('✓ 没有需要修复的优惠券');
      return;
    }
    
    console.log(`找到 ${coupons.length} 条缺失 discount_code 的优惠券\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const coupon of coupons) {
      try {
        const discount_code = `DC${coupon.id}`;
        
        // 检查该 discount_code 是否已存在（理论上不应该，因为使用的是 ID）
        const [existing] = await db.query(
          'SELECT id FROM discount_coupons WHERE discount_code = ?',
          [discount_code]
        );
        
        if (existing.length > 0 && existing[0].id !== coupon.id) {
          console.error(`⚠️  优惠券 ID=${coupon.id} 的编号 ${discount_code} 已存在（冲突），跳过`);
          errorCount++;
          continue;
        }
        
        // 更新 discount_code
        await db.query(
          'UPDATE discount_coupons SET discount_code = ? WHERE id = ?',
          [discount_code, coupon.id]
        );
        
        console.log(`✓ 优惠券 ID=${coupon.id}：已生成编号 ${discount_code}`);
        successCount++;
      } catch (error) {
        console.error(`✗ 优惠券 ID=${coupon.id}：更新失败 - ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n修复完成！`);
    console.log(`  - 成功：${successCount} 条`);
    console.log(`  - 失败：${errorCount} 条`);
    
    // 验证结果
    const [remaining] = await db.query(
      'SELECT COUNT(*) as count FROM discount_coupons WHERE discount_code IS NULL'
    );
    
    if (remaining[0].count === 0) {
      console.log(`\n✓ 所有优惠券都已拥有 discount_code`);
    } else {
      console.log(`\n⚠️  仍有 ${remaining[0].count} 条优惠券缺失 discount_code`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('修复过程出错:', error);
    process.exit(1);
  }
}

// 运行修复
fixMissingDiscountCodes();

