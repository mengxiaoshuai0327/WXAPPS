// 运行海报表迁移脚本
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('开始执行海报表迁移...');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../database/migrations/add_text_fields_to_posters.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // 检查字段是否已存在
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'posters' 
      AND COLUMN_NAME IN ('text_content', 'text_position_x', 'text_position_y', 'text_font_size', 'text_color', 'text_align')
    `);
    
    const existingColumns = columns.map(col => col.COLUMN_NAME);
    
    if (existingColumns.length > 0) {
      console.log('⚠️  以下字段已存在，将跳过:', existingColumns.join(', '));
      
      // 只执行不存在的字段的SQL
      const fieldsToAdd = [
        { name: 'text_content', sql: "ADD COLUMN `text_content` TEXT NULL COMMENT '海报文字内容' AFTER `qr_code_size`" },
        { name: 'text_position_x', sql: "ADD COLUMN `text_position_x` INT DEFAULT 0 COMMENT '文字X坐标位置（像素）' AFTER `text_content`" },
        { name: 'text_position_y', sql: "ADD COLUMN `text_position_y` INT DEFAULT 0 COMMENT '文字Y坐标位置（像素）' AFTER `text_position_x`" },
        { name: 'text_font_size', sql: "ADD COLUMN `text_font_size` INT DEFAULT 32 COMMENT '文字大小（像素）' AFTER `text_position_y`" },
        { name: 'text_color', sql: "ADD COLUMN `text_color` VARCHAR(20) DEFAULT '#000000' COMMENT '文字颜色（十六进制）' AFTER `text_font_size`" },
        { name: 'text_align', sql: "ADD COLUMN `text_align` VARCHAR(20) DEFAULT 'left' COMMENT '文字对齐方式：left, center, right' AFTER `text_color`" }
      ];
      
      for (const field of fieldsToAdd) {
        if (!existingColumns.includes(field.name)) {
          console.log(`添加字段: ${field.name}`);
          await db.query(`ALTER TABLE \`posters\` ${field.sql}`);
        }
      }
    } else {
      // 执行完整的SQL
      console.log('执行完整迁移SQL...');
      const statements = sql.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        const trimmed = statement.trim();
        if (trimmed) {
          await db.query(trimmed);
        }
      }
    }
    
    console.log('✅ 迁移执行成功！');
    
    // 验证字段是否添加成功
    const [verifyColumns] = await db.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'posters' 
      AND COLUMN_NAME IN ('text_content', 'text_position_x', 'text_position_y', 'text_font_size', 'text_color', 'text_align')
      ORDER BY ORDINAL_POSITION
    `);
    
    if (verifyColumns.length > 0) {
      console.log('\n验证结果：');
      verifyColumns.forEach(col => {
        console.log(`  - ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (默认值: ${col.COLUMN_DEFAULT || 'NULL'})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 迁移执行失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

