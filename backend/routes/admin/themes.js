const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const crypto = require('crypto');

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

// 获取主题列表
router.get('/', async (req, res) => {
  try {
    const [themes] = await db.query(
      `SELECT t.*, m.name as module_name
       FROM course_themes t
       JOIN course_modules m ON t.module_id = m.id
       ORDER BY t.id ASC`
    );
    res.json({ success: true, data: themes });
  } catch (error) {
    console.error('获取主题列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 创建主题
router.post('/', async (req, res) => {
  try {
    const { module_id, name, full_name, description, status } = req.body;
    console.log('[创建主题] 接收到的数据:', { module_id, name, full_name, description, status });
    if (!module_id || !name) {
      return res.status(400).json({ error: '请填写完整信息' });
    }
    
    // 生成唯一的主题ID
    const themeCode = await generateThemeCode();
    
    // 处理full_name：如果为空字符串，转换为null；否则保留原值
    const finalFullName = (full_name && full_name.trim()) ? full_name.trim() : null;
    
    const [result] = await db.query(
      'INSERT INTO course_themes (theme_code, module_id, name, full_name, description, status) VALUES (?, ?, ?, ?, ?, ?)',
      [themeCode, module_id, name, finalFullName, description || null, status || 'active']
    );
    console.log('[创建主题] 插入成功，full_name:', finalFullName);
    res.json({ success: true, data: { id: result.insertId, theme_code: themeCode } });
  } catch (error) {
    console.error('创建主题错误:', error);
    res.status(500).json({ error: '创建失败', details: error.message });
  }
});

// 更新主题
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { module_id, name, full_name, description, status } = req.body;
    console.log('[更新主题] 接收到的数据:', { id, module_id, name, full_name, description, status });
    
    // 确保status有值，默认为'active'
    const finalStatus = (status === 'active' || status === 'inactive') ? status : 'active';
    
    // 处理full_name：如果为空字符串，转换为null；否则保留原值
    const finalFullName = (full_name && full_name.trim()) ? full_name.trim() : null;
    
    // 检查是否有theme_code，如果没有则生成
    const [themes] = await db.query('SELECT theme_code FROM course_themes WHERE id = ?', [id]);
    let themeCode = themes[0]?.theme_code;
    
    if (!themeCode) {
      themeCode = await generateThemeCode();
      await db.query(
        'UPDATE course_themes SET theme_code = ?, module_id = ?, name = ?, full_name = ?, description = ?, status = ? WHERE id = ?',
        [themeCode, module_id, name, finalFullName, description || null, finalStatus, id]
      );
    } else {
      await db.query(
        'UPDATE course_themes SET module_id = ?, name = ?, full_name = ?, description = ?, status = ? WHERE id = ?',
        [module_id, name, finalFullName, description || null, finalStatus, id]
      );
    }
    console.log('[更新主题] 更新成功，full_name:', finalFullName);
    res.json({ success: true });
  } catch (error) {
    console.error('更新主题错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

// 删除主题
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // 检查是否有课程
    const [courses] = await db.query('SELECT COUNT(*) as count FROM courses WHERE theme_id = ?', [id]);
    if (courses[0].count > 0) {
      return res.status(400).json({ error: '该主题下还有课程，无法删除' });
    }
    await db.query('DELETE FROM course_themes WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除主题错误:', error);
    res.status(500).json({ error: '删除失败', details: error.message });
  }
});

module.exports = router;

