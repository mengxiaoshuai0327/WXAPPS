// 数据库初始化脚本
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
  let connection;
  
  try {
    // 连接数据库（不指定数据库名，用于创建数据库）
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('✓ 数据库连接成功');

    // 创建数据库（如果不存在）
    const dbName = process.env.DB_NAME || 'xiaocx_db';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✓ 数据库 ${dbName} 创建成功`);

    // 选择数据库
    await connection.query(`USE \`${dbName}\``);

    // 读取并执行 SQL 文件
    const sqlPath = path.join(__dirname, '../database/schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 分割 SQL 语句（以分号和换行分割）
    const statements = sql
      .split(/;\s*[\r\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`开始执行 ${statements.length} 条 SQL 语句...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          await connection.query(statement);
          console.log(`✓ [${i + 1}/${statements.length}] SQL 语句执行成功`);
        } catch (error) {
          // 忽略表已存在的错误
          if (error.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log(`⚠ [${i + 1}/${statements.length}] 表已存在，跳过`);
          } else {
            console.error(`✗ [${i + 1}/${statements.length}] SQL 执行失败:`, error.message);
          }
        }
      }
    }

    console.log('\n✓ 数据库初始化完成！');
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 数据库初始化失败:', error.message);
    console.error('\n请检查：');
    console.error('1. MySQL 服务是否已启动');
    console.error('2. .env 文件中的数据库配置是否正确');
    console.error('3. 数据库用户是否有足够权限');
    
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

initDatabase();

