const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'xiaocx',
    multipleStatements: true
  });

  try {
    const migrationFile = path.join(__dirname, '../database/migrations/add_ticket_fields_to_promotion_schemes.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('开始执行迁移...');
    
    // 执行SQL，忽略重复字段的错误
    try {
      await connection.query(sql);
      console.log('✅ 迁移执行成功');
    } catch (error) {
      if (error.code === 'ER_DUPLICATE_COLUMN_NAME') {
        console.log('⚠️  字段已存在，跳过迁移');
      } else {
        throw error;
      }
    }

    console.log('迁移完成');
  } catch (error) {
    console.error('❌ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();

