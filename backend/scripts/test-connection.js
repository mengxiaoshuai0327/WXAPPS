// 测试数据库连接
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function testConnection() {
  try {
    console.log('正在测试数据库连接...');
    console.log('配置信息:');
    console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`  Port: ${process.env.DB_PORT || 3306}`);
    console.log(`  User: ${process.env.DB_USER || 'root'}`);
    console.log(`  Database: ${process.env.DB_NAME || 'xiaocx_db'}`);
    console.log('');

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    });

    console.log('✓ 数据库连接成功！');
    
    // 测试查询
    const [rows] = await connection.query('SELECT VERSION() as version');
    console.log(`✓ MySQL 版本: ${rows[0].version}`);
    
    await connection.end();
    console.log('\n✓ 连接测试完成，可以执行数据库初始化');
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 数据库连接失败:', error.message);
    console.error('\n请检查：');
    console.error('1. MySQL 服务是否已启动');
    console.error('2. .env 文件中的数据库配置是否正确');
    console.error('3. 数据库用户密码是否正确');
    console.error('\n提示：请先编辑 backend/.env 文件，配置正确的数据库信息');
    process.exit(1);
  }
}

testConnection();

