// 为折扣券表添加开始日期字段
const db = require('../config/database');

async function addStartDateField() {
  try {
    // 检查字段是否已存在
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'discount_coupons' 
      AND COLUMN_NAME = 'start_date'
    `);

    if (columns.length === 0) {
      // 添加start_date字段
      await db.query(`
        ALTER TABLE discount_coupons 
        ADD COLUMN start_date DATE COMMENT '有效期开始日期' 
        AFTER expiry_date
      `);
      console.log('✓ 已添加 start_date 字段');
    } else {
      console.log('✓ start_date 字段已存在');
    }

    // 将现有的expiry_date作为end_date（如果需要重命名）
    // 这里我们保持expiry_date作为结束日期，添加start_date作为开始日期
    console.log('✓ 数据库结构更新完成');
    process.exit(0);
  } catch (error) {
    console.error('✗ 更新失败:', error);
    process.exit(1);
  }
}

addStartDateField();

