// 检查course_themes表是否有status字段
const db = require('../config/database');

async function checkStatusField() {
  try {
    // 检查表结构
    const [columns] = await db.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'course_themes'
      AND COLUMN_NAME = 'status'
    `);
    
    if (columns.length === 0) {
      console.log('❌ status字段不存在，需要执行迁移');
      console.log('请运行: mysql -u root -p xiaocx_db < database/migrations/add_status_to_course_themes.sql');
      process.exit(1);
    } else {
      console.log('✅ status字段存在:');
      console.log('  字段名:', columns[0].COLUMN_NAME);
      console.log('  类型:', columns[0].COLUMN_TYPE);
      console.log('  默认值:', columns[0].COLUMN_DEFAULT);
      console.log('  允许NULL:', columns[0].IS_NULLABLE);
      
      // 检查现有数据的status值
      const [themes] = await db.query(`
        SELECT id, name, status, 
               CASE WHEN status IS NULL THEN 'NULL' ELSE status END as status_value
        FROM course_themes
        LIMIT 10
      `);
      
      console.log('\n📊 现有主题的status值:');
      themes.forEach(theme => {
        console.log(`  ID ${theme.id}: ${theme.name} - status: ${theme.status_value}`);
      });
      
      // 检查是否有NULL值
      const [nullCount] = await db.query(`
        SELECT COUNT(*) as count FROM course_themes WHERE status IS NULL
      `);
      
      if (nullCount[0].count > 0) {
        console.log(`\n⚠️  有 ${nullCount[0].count} 条记录的status为NULL，需要更新为'active'`);
        console.log('可以运行: UPDATE course_themes SET status = \'active\' WHERE status IS NULL');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('检查失败:', error);
    process.exit(1);
  }
}

checkStatusField();

