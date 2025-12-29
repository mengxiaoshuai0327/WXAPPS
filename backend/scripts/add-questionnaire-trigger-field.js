// 添加问卷触发字段到 course_schedules 表
const db = require('../config/database');

async function addQuestionnaireTriggerField() {
  try {
    console.log('开始添加 questionnaire_triggered 字段...');
    
    // 检查字段是否已存在
    const [columns] = await db.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'course_schedules' 
       AND COLUMN_NAME = 'questionnaire_triggered'`
    );

    if (columns.length > 0) {
      console.log('字段 questionnaire_triggered 已存在，跳过添加');
      return;
    }

    // 添加字段
    await db.query(
      `ALTER TABLE course_schedules 
       ADD COLUMN questionnaire_triggered BOOLEAN DEFAULT FALSE COMMENT '问卷是否已触发' 
       AFTER status`
    );

    console.log('✓ 成功添加 questionnaire_triggered 字段');
    
    // 添加索引
    await db.query(
      `CREATE INDEX idx_questionnaire_triggered ON course_schedules(questionnaire_triggered)`
    );
    
    console.log('✓ 成功添加索引');
    
    process.exit(0);
  } catch (error) {
    console.error('添加字段失败:', error);
    process.exit(1);
  }
}

addQuestionnaireTriggerField();

