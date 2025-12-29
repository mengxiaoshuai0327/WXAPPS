// 执行迁移：添加is_popular字段到instructors表
const db = require('../config/database');

async function runMigration() {
  const connection = await db.getConnection();
  
  try {
    console.log('开始执行迁移：添加is_popular字段...');
    
    // 检查字段是否已存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'instructors'
      AND COLUMN_NAME = 'is_popular'
    `);

    if (columns.length > 0) {
      console.log('✅ is_popular字段已存在，跳过迁移');
      return;
    }

    await connection.beginTransaction();

    // 添加字段
    await connection.query(`
      ALTER TABLE \`instructors\`
        ADD COLUMN \`is_popular\` TINYINT(1) DEFAULT 0 COMMENT '是否热门教练：0=否，1=是' AFTER \`background\`
    `);
    console.log('✅ 已添加is_popular字段');

    // 添加索引
    await connection.query(`
      ALTER TABLE \`instructors\`
        ADD INDEX \`idx_is_popular\` (\`is_popular\`)
    `);
    console.log('✅ 已添加idx_is_popular索引');

    await connection.commit();
    console.log('✅ 迁移完成！');
    
  } catch (error) {
    await connection.rollback();
    
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️ 字段已存在，迁移可能已执行过');
    } else if (error.code === 'ER_DUP_KEYNAME') {
      console.log('⚠️ 索引已存在，迁移可能已执行过');
    } else {
      console.error('❌ 迁移失败:', error.message);
      console.error('错误详情:', error);
      throw error;
    }
  } finally {
    connection.release();
    process.exit(0);
  }
}

runMigration().catch(error => {
  console.error('执行迁移时出错:', error);
  process.exit(1);
});

