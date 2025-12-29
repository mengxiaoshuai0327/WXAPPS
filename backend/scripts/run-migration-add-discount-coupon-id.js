const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function runMigration() {
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

    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../database/migrations/add_discount_coupon_id_to_tickets.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // 执行SQL
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.query(statement);
          console.log('✓ 执行成功:', statement.substring(0, 50) + '...');
        } catch (err) {
          // 如果字段已存在，忽略错误
          if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column name')) {
            console.log('⚠ 字段已存在，跳过:', err.message);
          } else {
            throw err;
          }
        }
      }
    }

    console.log('✓ 数据库迁移完成');
    
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 数据库迁移失败:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

runMigration();

