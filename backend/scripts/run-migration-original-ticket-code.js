const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connection = await db.getConnection();
  try {
    console.log('开始执行迁移：添加原课券编号字段...');
    
    // 执行迁移SQL
    await connection.query(`
      ALTER TABLE \`tickets\`
        ADD COLUMN \`original_ticket_code\` VARCHAR(50) COMMENT '原课券编号（赠送课券时记录）' AFTER \`restrict_theme_id\`,
        ADD INDEX \`idx_original_ticket_code\` (\`original_ticket_code\`);
    `);
    
    console.log('✓ 迁移执行成功！已添加 original_ticket_code 字段');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠ 字段已存在，跳过迁移');
    } else {
      console.error('✗ 迁移执行失败:', error.message);
      throw error;
    }
  } finally {
    connection.release();
  }
}

runMigration()
  .then(() => {
    console.log('迁移完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('迁移失败:', error);
    process.exit(1);
  });

