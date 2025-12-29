// 执行迁移：添加schedule_available消息类型到system_messages表
const db = require('../config/database');

async function runMigration() {
  let connection;
  
  try {
    console.log('开始执行迁移：添加schedule_available消息类型...');
    
    connection = await db.getConnection();
    
    // 修改type字段的ENUM，添加schedule_available
    await connection.query(`
      ALTER TABLE \`system_messages\`
      MODIFY COLUMN \`type\` ENUM('system', 'course_cancelled', 'evaluation_reminder', 'ticket_expiring', 'invite_reward', 'ticket_gift', 'checkin_reminder', 'schedule_available') NOT NULL
    `);
    
    console.log('✅ schedule_available消息类型添加成功');
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


