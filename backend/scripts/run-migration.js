const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;
  
  try {
    // 连接数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'xiaocx_db',
      timezone: '+08:00'
    });

    console.log('✓ 数据库连接成功');

    // 读取 SQL 文件
    const migrationFile = process.argv[2];
    if (!migrationFile) {
      console.error('✗ 请指定迁移文件路径');
      console.log('用法: node scripts/run-migration.js <migration-file-path>');
      process.exit(1);
    }

    const sqlPath = path.join(__dirname, '..', migrationFile);
    
    if (!fs.existsSync(sqlPath)) {
      console.error(`✗ 文件不存在: ${sqlPath}`);
      process.exit(1);
    }

    let sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 移除注释（以--开头的行）
    sql = sql.replace(/--.*$/gm, '');
    
    // 分割 SQL 语句（以分号分割）
    let statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // 如果分割后为空，尝试执行整个SQL（可能是单条语句）
    if (statements.length === 0) {
      statements = [sql.trim()].filter(s => s.length > 0);
    }

    console.log(`开始执行迁移: ${migrationFile}`);
    console.log(`共 ${statements.length} 条 SQL 语句...\n`);

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
            console.error(`✗ [${i + 1}/${statements.length}] SQL 执行失败:`);
            console.error(`  错误代码: ${error.code}`);
            console.error(`  错误信息: ${error.message}`);
            throw error;
          }
        }
      }
    }

    console.log('\n✓ 迁移执行完成！');
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 迁移执行失败:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

runMigration();
