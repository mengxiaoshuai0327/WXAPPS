const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 获取协议内容（小程序前端使用）
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    let protocolType;
    if (type === 'user') {
      protocolType = 'user_agreement';
    } else if (type === 'privacy') {
      protocolType = 'privacy_policy';
    } else {
      return res.status(400).json({ error: '无效的协议类型' });
    }

    const [rows] = await db.query(
      'SELECT id, type, title, content, version, updated_at FROM protocols WHERE type = ?',
      [protocolType]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '协议内容不存在' });
    }

    res.json({
      success: true,
      data: {
        id: rows[0].id,
        type: rows[0].type,
        title: rows[0].title,
        content: rows[0].content,
        version: rows[0].version,
        updated_at: rows[0].updated_at
      }
    });
  } catch (error) {
    console.error('获取协议内容错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

module.exports = router;

