const db = require('../config/database');
const crypto = require('crypto');
require('dotenv').config();

// 生成唯一的模块ID（格式：M + 6位数字）
async function generateModuleCode() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const randomNum = crypto.randomInt(100000, 999999);
    const moduleCode = `M${randomNum}`;
    
    const [existing] = await db.query(
      'SELECT id FROM course_modules WHERE module_code = ?',
      [moduleCode]
    );
    
    if (existing.length === 0) {
      return moduleCode;
    }
    
    attempts++;
  }
  
  // 如果随机生成失败，使用时间戳
  const timestamp = Date.now().toString().slice(-6);
  return `M${timestamp}`;
}

// 生成唯一的主题ID（格式：T + 6位数字）
async function generateThemeCode() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const randomNum = crypto.randomInt(100000, 999999);
    const themeCode = `T${randomNum}`;
    
    const [existing] = await db.query(
      'SELECT id FROM course_themes WHERE theme_code = ?',
      [themeCode]
    );
    
    if (existing.length === 0) {
      return themeCode;
    }
    
    attempts++;
  }
  
  // 如果随机生成失败，使用时间戳
  const timestamp = Date.now().toString().slice(-6);
  return `T${timestamp}`;
}

async function initCFOModulesAndThemes() {
  const connection = await db.getConnection();
  
  try {
    console.log('=== 开始初始化CFO课程模块和主题 ===\n');
    
    await connection.beginTransaction();
    
    // 1. 创建模块
    const modules = [
      { name: '领导力', description: 'CFO领导力相关课程', sort_order: 1 },
      { name: '职业发展', description: 'CFO职业发展相关课程', sort_order: 2 },
      { name: '业财融合', description: '业务与财务融合相关课程', sort_order: 3 },
      { name: '财务运营', description: '财务运营相关课程', sort_order: 4 }
    ];
    
    const moduleMap = {};
    
    for (const module of modules) {
      const moduleCode = await generateModuleCode();
      const [result] = await connection.query(
        'INSERT INTO course_modules (module_code, name, description, sort_order) VALUES (?, ?, ?, ?)',
        [moduleCode, module.name, module.description, module.sort_order]
      );
      moduleMap[module.name] = result.insertId;
      console.log(`✓ 创建模块: ${module.name} (${moduleCode})`);
    }
    
    // 2. 创建主题
    const themes = [
      // 领导力模块
      { module: '领导力', name: 'CFO 特殊领导力', description: 'CFO特殊领导力' },
      
      // 职业发展模块
      { module: '职业发展', name: '职业发展 避险避坑', description: '职业发展避险避坑' },
      { module: '职业发展', name: 'CFO之后', description: 'CFO之后的发展路径' },
      
      // 业财融合模块
      { module: '业财融合', name: '财经BP驱动业务 (应用层)', description: '财经BP驱动业务应用层' },
      { module: '业财融合', name: '业财系统融合 (基础设施层)', description: '业财系统融合基础设施层' },
      
      // 财务运营模块
      { module: '财务运营', name: '架构', description: '法人架构与财务管控' },
      { module: '财务运营', name: '会计', description: '会计核算与财务报告' },
      { module: '财务运营', name: '合规', description: '内控合规与风险管理' },
      { module: '财务运营', name: '税务', description: '税务合规运营与优化' },
      { module: '财务运营', name: '债务融资', description: '债务融资' },
      { module: '财务运营', name: '资金管理', description: '司库资金管理' },
      { module: '财务运营', name: '股权融资', description: '股权融资（资本运作）' },
      { module: '财务运营', name: '上市与上市后', description: '上市与上市后（资本运作）' },
      { module: '财务运营', name: '并购与投资', description: '并购与投资（资本运作）' },
      { module: '财务运营', name: '数转智改', description: '数字化转型与智能化改造（前瞻热点）' },
      { module: '财务运营', name: '企业出海的CFO功课', description: '企业出海的CFO功课（前瞻热点）' }
    ];
    
    for (const theme of themes) {
      const moduleId = moduleMap[theme.module];
      if (!moduleId) {
        console.error(`✗ 找不到模块: ${theme.module}`);
        continue;
      }
      
      const themeCode = await generateThemeCode();
      await connection.query(
        'INSERT INTO course_themes (theme_code, module_id, name, description) VALUES (?, ?, ?, ?)',
        [themeCode, moduleId, theme.name, theme.description]
      );
      console.log(`✓ 创建主题: ${theme.name} (${themeCode}) - 模块: ${theme.module}`);
    }
    
    await connection.commit();
    console.log('\n=== CFO课程模块和主题初始化完成 ===');
    
  } catch (error) {
    await connection.rollback();
    console.error('\n✗ 初始化失败:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

// 执行初始化
initCFOModulesAndThemes();

