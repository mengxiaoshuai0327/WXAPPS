const express = require('express');
const router = express.Router();
const db = require('../../config/database');

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

// 管理员获取所有协议内容
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, type, title, content, version, created_at, updated_at FROM protocols ORDER BY type'
    );

    const protocols = {
      user_agreement: null,
      privacy_policy: null
    };

    rows.forEach(row => {
      protocols[row.type] = {
        id: row.id,
        type: row.type,
        title: row.title,
        content: row.content,
        version: row.version,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });

    res.json({
      success: true,
      data: protocols
    });
  } catch (error) {
    console.error('获取协议列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 管理员更新协议内容
router.put('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { title, content, version } = req.body;

    let protocolType;
    if (type === 'user') {
      protocolType = 'user_agreement';
    } else if (type === 'privacy') {
      protocolType = 'privacy_policy';
    } else {
      return res.status(400).json({ error: '无效的协议类型' });
    }

    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' });
    }

    // 检查是否存在
    const [existing] = await db.query(
      'SELECT id FROM protocols WHERE type = ?',
      [protocolType]
    );

    if (existing.length === 0) {
      // 不存在则创建
      await db.query(
        'INSERT INTO protocols (type, title, content, version) VALUES (?, ?, ?, ?)',
        [protocolType, title, content, version || '1.0']
      );
    } else {
      // 存在则更新
      await db.query(
        'UPDATE protocols SET title = ?, content = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE type = ?',
        [title, content, version || existing[0].version, protocolType]
      );
    }

    res.json({
      success: true,
      message: '更新成功'
    });
  } catch (error) {
    console.error('更新协议内容错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

module.exports = router;

