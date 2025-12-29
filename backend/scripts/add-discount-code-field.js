// 为折扣券表添加折扣券编号字段
const db = require('../config/database');

async function addDiscountCodeField() {
  try {
    console.log('=== 添加折扣券编号字段 ===\n');

    // 检查字段是否已存在
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discount_coupons' 
      AND COLUMN_NAME = 'discount_code'
    `);

    if (columns.length === 0) {
      // 添加discount_code字段
      await db.query(`
        ALTER TABLE discount_coupons 
        ADD COLUMN discount_code VARCHAR(50) UNIQUE COMMENT '折扣券编号' 
        AFTER id
      `);
      console.log('✓ 已添加 discount_code 字段');

      // 为现有数据生成折扣券编号
      const [existingCoupons] = await db.query(`
        SELECT id FROM discount_coupons WHERE discount_code IS NULL
      `);
      
      if (existingCoupons.length > 0) {
        console.log(`\n为 ${existingCoupons.length} 条现有记录生成折扣券编号...`);
        for (const coupon of existingCoupons) {
          const discountCode = `DC${String(coupon.id).padStart(8, '0')}`;
          await db.query(
            'UPDATE discount_coupons SET discount_code = ? WHERE id = ?',
            [discountCode, coupon.id]
          );
        }
        console.log('✓ 已为现有记录生成折扣券编号');
      }
    } else {
      console.log('✓ discount_code 字段已存在');
    }

    console.log('\n✓ 数据库结构更新完成');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ 更新失败:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  }
}

addDiscountCodeField();



