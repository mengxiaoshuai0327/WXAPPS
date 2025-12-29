const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'xiaocx_db',
      multipleStatements: true
    });

    console.log('✓ 数据库连接成功');

    const sqlFile = path.join(__dirname, '../database/migrations/add_checkin_fields.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('✓ 读取SQL文件成功');
    console.log('执行SQL迁移...\n');

    await connection.query(sql);

    console.log('✓ 迁移执行成功！');
    console.log('\n已添加字段:');
    console.log('  - course_schedules.checkin_triggered');
    console.log('  - course_bookings.checkin_status');
    console.log('  - course_bookings.checkin_time');
    console.log('  - course_bookings.evaluation_status');
    console.log('  - course_bookings.evaluation_time');
    console.log('  - system_messages.type: checkin_reminder');

  } catch (error) {
    console.error('✗ 迁移执行失败:', error.message);
    if (error.code === 'ER_DUP_FIELD_NAME') {
      console.error('\n提示: 字段可能已存在');
    }
    if (error.code === 'ER_DUP_KEYNAME') {
      console.error('\n提示: 索引可能已存在');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✓ 数据库连接已关闭');
    }
  }
}

runMigration();

