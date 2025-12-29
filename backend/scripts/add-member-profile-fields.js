// 添加会员详细资料和能力自评字段到users表
const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function runMigration() {
  let connection;
  try {
    // 读取数据库配置
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'cfo_courses',
      multipleStatements: true
    };

    console.log('连接到数据库...');
    connection = await mysql.createConnection(dbConfig);

    // 检查字段是否存在，如果不存在则添加
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME IN ('member_profile', 'ability_assessment')
    `);

    const existingColumns = columns.map(col => col.COLUMN_NAME);

    // 添加 member_profile 字段
    if (!existingColumns.includes('member_profile')) {
      console.log('添加 member_profile 字段...');
      await connection.query(`
        ALTER TABLE \`users\`
        ADD COLUMN \`member_profile\` JSON NULL COMMENT '会员详细资料（JSON格式）' AFTER \`company\`
      `);
      console.log('✓ member_profile 字段添加成功');
    } else {
      console.log('✓ member_profile 字段已存在，跳过');
    }

    // 添加 ability_assessment 字段
    if (!existingColumns.includes('ability_assessment')) {
      console.log('添加 ability_assessment 字段...');
      await connection.query(`
        ALTER TABLE \`users\`
        ADD COLUMN \`ability_assessment\` JSON NULL COMMENT '能力自评（JSON格式）' AFTER \`member_profile\`
      `);
      console.log('✓ ability_assessment 字段添加成功');
    } else {
      console.log('✓ ability_assessment 字段已存在，跳过');
    }

    console.log('\n迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();


