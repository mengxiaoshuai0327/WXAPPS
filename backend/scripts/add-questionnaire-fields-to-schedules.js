// 添加调查问卷链接和ID字段到course_schedules表
require('dotenv').config({ path: '../.env' });
const db = require('../config/database');

async function addQuestionnaireFields() {
  let connection;
  try {
    console.log('连接到数据库...');
    connection = await db.getConnection();
    console.log('数据库连接成功。');

    // 检查字段是否已存在
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'course_schedules' 
       AND COLUMN_NAME IN ('questionnaire_url', 'questionnaire_id')`
    );

    const existingColumns = columns.map(c => c.COLUMN_NAME);
    
    if (!existingColumns.includes('questionnaire_url')) {
      console.log('添加 questionnaire_url 字段...');
      await connection.query(`
        ALTER TABLE course_schedules
          ADD COLUMN questionnaire_url VARCHAR(500) NULL COMMENT '调查问卷链接' AFTER location
      `);
      console.log('✓ questionnaire_url 字段添加成功');
    } else {
      console.log('questionnaire_url 字段已存在，跳过添加');
    }

    if (!existingColumns.includes('questionnaire_id')) {
      console.log('添加 questionnaire_id 字段...');
      await connection.query(`
        ALTER TABLE course_schedules
          ADD COLUMN questionnaire_id VARCHAR(100) NULL COMMENT '调查问卷ID号' AFTER questionnaire_url
      `);
      console.log('✓ questionnaire_id 字段添加成功');
    } else {
      console.log('questionnaire_id 字段已存在，跳过添加');
    }

    console.log('\n迁移完成！');
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    process.exit(0);
  }
}

addQuestionnaireFields();


