// 为系统消息表添加 published 字段
const mysql = require('mysql2/promise');
require('dotenv').config();

async function addPublishedField() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'xiaocx_db'
    });

    console.log('✓ 数据库连接成功');

    // 检查字段是否已存在
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? 
       AND TABLE_NAME = 'system_messages' 
       AND COLUMN_NAME = 'published'`,
      [process.env.DB_NAME || 'xiaocx_db']
    );

    if (columns.length === 0) {
      // 添加 published 字段
      await connection.query(
        `ALTER TABLE system_messages 
         ADD COLUMN published BOOLEAN DEFAULT 0 COMMENT '是否推送给前端' AFTER content`
      );
      console.log('✓ 已添加 published 字段');
      
      // 将现有消息设置为已发布（可选）
      await connection.query(
        `UPDATE system_messages SET published = 1 WHERE published = 0`
      );
      console.log('✓ 已将现有消息设置为已发布');
    } else {
      console.log('✓ published 字段已存在');
    }

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ 添加字段失败:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

addPublishedField();






























































