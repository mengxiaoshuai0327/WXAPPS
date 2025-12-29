// 执行迁移：添加schedule_id字段到system_messages表
const db = require('../config/database');

async function runMigration() {
  let connection;
  
  try {
    console.log('开始执行迁移：添加schedule_id字段到system_messages表...');
    
    connection = await db.getConnection();
    
    // 检查字段是否已存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'system_messages' 
      AND COLUMN_NAME = 'schedule_id'
    `);
    
    if (columns.length === 0) {
      console.log('添加schedule_id字段...');
      await connection.query(`
        ALTER TABLE \`system_messages\`
        ADD COLUMN \`schedule_id\` INT NULL COMMENT '关联的排课ID（用于schedule_available类型消息）' AFTER \`type\`
      `);
      console.log('✅ schedule_id字段添加成功');
      
      // 添加索引
      try {
        await connection.query(`
          ALTER TABLE \`system_messages\`
          ADD INDEX \`idx_schedule_id\` (\`schedule_id\`)
        `);
        console.log('✅ idx_schedule_id索引添加成功');
      } catch (indexError) {
        if (indexError.code !== 'ER_DUP_KEYNAME') {
          throw indexError;
        }
        console.log('⚠️ idx_schedule_id索引已存在，跳过');
      }
      
      // 添加外键
      try {
        await connection.query(`
          ALTER TABLE \`system_messages\`
          ADD FOREIGN KEY (\`schedule_id\`) REFERENCES \`course_schedules\`(\`id\`) ON DELETE CASCADE
        `);
        console.log('✅ schedule_id外键添加成功');
      } catch (fkError) {
        if (fkError.code !== 'ER_DUP_KEY') {
          throw fkError;
        }
        console.log('⚠️ schedule_id外键已存在，跳过');
      }
    } else {
      console.log('⚠️ schedule_id字段已存在，跳过添加');
    }
    
    console.log('\n✅ 迁移完成！');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

runMigration();


