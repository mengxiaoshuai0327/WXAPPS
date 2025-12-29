const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;
  
  try {
    // 从环境变量读取数据库配置
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'xiaocx_db',
      multipleStatements: true // 允许多条SQL语句
    };

    console.log(`正在连接数据库: ${config.host}:${config.port}/${config.database}...`);
    
    connection = await mysql.createConnection(config);
    console.log('✓ 数据库连接成功');

    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../database/migrations/add_channel_sales_support.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('正在执行迁移脚本...');
    
    // 检查字段是否已存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'channel_user_id'
    `, [config.database]);

    if (columns.length > 0) {
      console.log('⚠ channel_user_id 字段已存在，跳过迁移');
    } else {
      // 执行SQL
      await connection.query(sql);
      console.log('✓ 迁移执行成功！channel_user_id 字段已添加到 users 表');
    }

    // 验证字段是否添加成功
    const [verifyColumns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'channel_user_id'
    `, [config.database]);

    if (verifyColumns.length > 0) {
      const col = verifyColumns[0];
      console.log('\n字段信息:');
      console.log(`  字段名: ${col.COLUMN_NAME}`);
      console.log(`  数据类型: ${col.DATA_TYPE}`);
      console.log(`  可为空: ${col.IS_NULLABLE}`);
      console.log(`  注释: ${col.COLUMN_COMMENT}`);
    }

    console.log('\n✓ 迁移完成！');
    
  } catch (error) {
    console.error('✗ 迁移失败:', error.message);
    
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠ channel_user_id 字段已存在，这通常是正常的');
    } else {
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

runMigration();

