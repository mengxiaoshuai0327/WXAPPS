// 执行迁移：添加schedule_interests表和interest_users_notified字段
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;
  
  try {
    console.log('开始执行迁移：添加schedule_interests表和相关字段...');
    
    connection = await db.getConnection();
    
    // 1. 检查并创建schedule_interests表
    const [tables] = await connection.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'schedule_interests'
    `);
    
    if (tables.length === 0) {
      console.log('创建schedule_interests表...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`schedule_interests\` (
          \`id\` INT PRIMARY KEY AUTO_INCREMENT,
          \`user_id\` INT NOT NULL COMMENT '用户ID',
          \`schedule_id\` INT NOT NULL COMMENT '排课ID（待开课）',
          \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '感兴趣时间',
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
          FOREIGN KEY (\`schedule_id\`) REFERENCES \`course_schedules\`(\`id\`) ON DELETE CASCADE,
          UNIQUE KEY \`uk_user_schedule\` (\`user_id\`, \`schedule_id\`) COMMENT '每个用户对每个待开课只能点一次感兴趣',
          INDEX \`idx_schedule_id\` (\`schedule_id\`),
          INDEX \`idx_user_id\` (\`user_id\`),
          INDEX \`idx_created_at\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='待开课意向表'
      `);
      console.log('✅ schedule_interests表创建成功');
    } else {
      console.log('⚠️ schedule_interests表已存在，跳过创建');
    }
    
    // 2. 检查并添加interest_users_notified字段
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'course_schedules' 
      AND COLUMN_NAME = 'interest_users_notified'
    `);
    
    if (columns.length === 0) {
      console.log('添加interest_users_notified字段到course_schedules表...');
      await connection.query(`
        ALTER TABLE \`course_schedules\`
        ADD COLUMN \`interest_users_notified\` BOOLEAN DEFAULT FALSE COMMENT '是否已通知意向用户' AFTER \`status\`
      `);
      console.log('✅ interest_users_notified字段添加成功');
    } else {
      console.log('⚠️ interest_users_notified字段已存在，跳过添加');
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


