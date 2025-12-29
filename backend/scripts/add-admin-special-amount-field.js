// 添加admin_special_amount字段
const db = require('../config/database');

async function addField() {
  try {
    // 检查字段是否已存在
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'coupon_schemes' 
      AND COLUMN_NAME = 'admin_special_amount'
    `);

    if (columns.length === 0) {
      // 添加字段
      await db.query(`
        ALTER TABLE coupon_schemes 
        ADD COLUMN admin_special_amount DECIMAL(10,2) DEFAULT 500.00 COMMENT '特殊推广默认金额' 
        AFTER admin_special_expiry_days
      `);
      console.log('✓ 已添加 admin_special_amount 字段');
    } else {
      console.log('✓ admin_special_amount 字段已存在');
    }

    // 更新现有数据
    await db.query(`
      UPDATE coupon_schemes 
      SET admin_special_amount = 500.00 
      WHERE scheme_type = 'admin_special' 
        AND (admin_special_amount IS NULL OR admin_special_amount = 0)
    `);
    console.log('✓ 已更新现有数据的默认值');
    
    console.log('✓ 数据库结构更新完成');
    process.exit(0);
  } catch (error) {
    // 如果是字段已存在的错误，忽略
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('✓ admin_special_amount 字段已存在，跳过添加');
      // 继续更新数据
      try {
        await db.query(`
          UPDATE coupon_schemes 
          SET admin_special_amount = 500.00 
          WHERE scheme_type = 'admin_special' 
            AND (admin_special_amount IS NULL OR admin_special_amount = 0)
        `);
        console.log('✓ 已更新现有数据的默认值');
      } catch (updateError) {
        console.log('更新数据时出错（可能已是最新）:', updateError.message);
      }
      process.exit(0);
    } else {
      console.error('✗ 更新失败:', error);
      process.exit(1);
    }
  }
}

addField();

