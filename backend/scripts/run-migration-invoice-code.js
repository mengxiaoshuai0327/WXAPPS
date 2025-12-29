const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;
  try {
    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'xiaocx_db',
      multipleStatements: true
    });

    console.log('✓ 数据库连接成功');

    // 读取SQL文件
    const sqlFile = path.join(__dirname, '../database/migrations/add_invoice_application_code.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('✓ 读取SQL文件成功');
    console.log('执行SQL迁移...\n');

    // 执行SQL
    await connection.query(sql);

    console.log('✓ 迁移执行成功！');
    console.log('\n已添加字段:');
    console.log('  - application_code (VARCHAR(50))');
    console.log('  - 唯一索引已创建');

  } catch (error) {
    console.error('✗ 迁移执行失败:', error.message);
    if (error.code === 'ER_DUP_FIELD_NAME') {
      console.error('\n提示: 字段可能已存在，请检查数据库表结构');
    }
    if (error.code === 'ER_DUP_KEYNAME') {
      console.error('\n提示: 索引可能已存在，请检查数据库表结构');
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

