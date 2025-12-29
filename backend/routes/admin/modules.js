const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const crypto = require('crypto');

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

// 获取模块列表
router.get('/', async (req, res) => {
  try {
    const [modules] = await db.query('SELECT * FROM course_modules ORDER BY sort_order ASC, id ASC');
    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('获取模块列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 创建模块
router.post('/', async (req, res) => {
  try {
    const { name, description, sort_order } = req.body;
    if (!name) {
      return res.status(400).json({ error: '请输入模块名称' });
    }
    
    // 生成唯一的模块ID
    const moduleCode = await generateModuleCode();
    
    const [result] = await db.query(
      'INSERT INTO course_modules (module_code, name, description, sort_order) VALUES (?, ?, ?, ?)',
      [moduleCode, name, description || null, sort_order || 0]
    );
    res.json({ success: true, data: { id: result.insertId, module_code: moduleCode } });
  } catch (error) {
    console.error('创建模块错误:', error);
    res.status(500).json({ error: '创建失败', details: error.message });
  }
});

// 更新模块
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sort_order } = req.body;
    
    // 检查是否有module_code，如果没有则生成
    const [modules] = await db.query('SELECT module_code FROM course_modules WHERE id = ?', [id]);
    let moduleCode = modules[0]?.module_code;
    
    if (!moduleCode) {
      moduleCode = await generateModuleCode();
      await db.query(
        'UPDATE course_modules SET module_code = ?, name = ?, description = ?, sort_order = ? WHERE id = ?',
        [moduleCode, name, description || null, sort_order || 0, id]
      );
    } else {
      await db.query(
        'UPDATE course_modules SET name = ?, description = ?, sort_order = ? WHERE id = ?',
        [name, description || null, sort_order || 0, id]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('更新模块错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

// 删除模块
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 检查是否有主题
    const [themes] = await db.query('SELECT COUNT(*) as count FROM course_themes WHERE module_id = ?', [id]);
    if (themes[0].count > 0) {
      return res.status(400).json({ error: '该模块下还有主题，无法删除' });
    }
    await db.query('DELETE FROM course_modules WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除模块错误:', error);
    res.status(500).json({ error: '删除失败', details: error.message });
  }
});

module.exports = router;

