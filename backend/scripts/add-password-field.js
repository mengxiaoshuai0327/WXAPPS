// 添加password字段到users表的迁移脚本
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function addPasswordField() {
  let connection;
  try {
    console.log('开始执行数据库迁移：添加password字段...');
    
    // 获取数据库连接
    connection = await db.getConnection();
    
    // 检查password字段是否已存在
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'password'
    `);
    
    if (columns.length > 0) {
      console.log('✓ password字段已存在，跳过添加');
    } else {
      // 添加password字段
      await connection.query(`
        ALTER TABLE \`users\` 
        ADD COLUMN \`password\` VARCHAR(255) COMMENT '密码（加密存储）' AFTER \`phone\`
      `);
      console.log('✓ 成功添加password字段');
    }
    
    // 检查openid字段是否已经是可空
    const [openidColumn] = await connection.query(`
      SELECT IS_NULLABLE, COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'openid'
    `);
    
    if (openidColumn.length > 0 && openidColumn[0].IS_NULLABLE === 'NO') {
      // 修改openid字段为可空
      await connection.query(`
        ALTER TABLE \`users\` 
        MODIFY COLUMN \`openid\` VARCHAR(100) UNIQUE COMMENT '微信openid（可选）'
      `);
      console.log('✓ 成功将openid字段改为可空');
    } else {
      console.log('✓ openid字段已经是可空，跳过修改');
    }
    
    console.log('\n✅ 数据库迁移完成！');
    
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('提示：password字段可能已存在');
    }
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    process.exit(0);
  }
}

addPasswordField();

