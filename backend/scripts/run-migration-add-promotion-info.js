// 执行添加推广来源信息字段的数据库迁移
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
      multipleStatements: true // 允许执行多条SQL语句
    });

    console.log('✓ 数据库连接成功');
    console.log(`数据库: ${process.env.DB_NAME || 'xiaocx_db'}`);

    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../database/migrations/add_promotion_info_fields.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('\n正在执行迁移脚本...');
    console.log('添加推广来源信息字段到users表和discount_coupons表\n');

    // 执行SQL
    await connection.query(sql);

    console.log('✓ 迁移执行成功！');
    console.log('\n已添加的字段：');
    console.log('  - users表: promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion');
    console.log('  - discount_coupons表: promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion');
    console.log('  - 已添加索引: idx_promotion_type (users表和discount_coupons表)');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ 迁移执行失败:', error.message);
    
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.error('字段已存在，迁移可能已经执行过。');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
      console.error('数据库不存在，请检查数据库名称。');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('数据库访问被拒绝，请检查用户名和密码。');
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();

