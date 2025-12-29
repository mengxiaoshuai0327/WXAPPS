const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 获取系统消息（前端）
router.get('/list', async (req, res) => {
  try {
    const { user_id, limit = 20 } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    // 只获取已发布（published = 1）的消息
    let query = `SELECT sm.*, 
                        CASE 
                          WHEN sm.user_id IS NOT NULL THEN sm.\`read\`
                          ELSE COALESCE(umr.read_at IS NOT NULL, FALSE)
                        END as is_read
                 FROM system_messages sm
                 LEFT JOIN user_message_reads umr ON sm.id = umr.message_id AND umr.user_id = ?
                 WHERE (sm.user_id = ? OR sm.user_id IS NULL) 
                 AND sm.published = 1
                 AND (
                   (sm.user_id IS NOT NULL AND sm.\`read\` = 0)
                   OR (sm.user_id IS NULL AND umr.read_at IS NULL)
                 )`;
    const params = [user_id, user_id];

    query += ' ORDER BY sm.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [messages] = await db.query(query, params);
    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('获取消息错误:', error);
    // 如果 user_message_reads 表不存在，回退到简单查询
    if (error.message && error.message.includes('user_message_reads')) {
      try {
        const { user_id, limit = 20 } = req.query;
        let query = `SELECT * FROM system_messages 
                     WHERE (user_id = ? OR user_id IS NULL) 
                     AND published = 1
                     AND (user_id IS NULL OR \`read\` = 0)`;
        const params = [user_id];
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));
        const [messages] = await db.query(query, params);
        return res.json({ success: true, data: messages });
      } catch (fallbackError) {
        console.error('回退查询也失败:', fallbackError);
      }
    }
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 标记消息为已读
router.post('/read', async (req, res) => {
  try {
    const { message_id, user_id } = req.body;
    
    if (!message_id || !user_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 检查消息是否存在
    const [messages] = await db.query('SELECT * FROM system_messages WHERE id = ?', [message_id]);
    if (messages.length === 0) {
      return res.status(404).json({ error: '消息不存在' });
    }

    const message = messages[0];
    
    // 如果是用户专属消息，直接更新 read 字段
    if (message.user_id && message.user_id == user_id) {
      await db.query('UPDATE system_messages SET `read` = ? WHERE id = ? AND user_id = ?', 
        [true, message_id, user_id]);
    } else {
      // 如果是全局消息（user_id为NULL），需要创建或更新用户消息已读记录
      // 先检查是否存在 user_message_reads 表，如果不存在则创建
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS user_message_reads (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            message_id INT NOT NULL,
            read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_message (user_id, message_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (message_id) REFERENCES system_messages(id) ON DELETE CASCADE,
            INDEX idx_user_id (user_id),
            INDEX idx_message_id (message_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户消息已读记录表'
        `);
      } catch (createError) {
        // 表可能已存在，忽略错误
        console.log('user_message_reads表可能已存在:', createError.message);
      }

      // 插入或更新已读记录（使用 INSERT ... ON DUPLICATE KEY UPDATE）
      await db.query(`
        INSERT INTO user_message_reads (user_id, message_id, read_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE read_at = NOW()
      `, [user_id, message_id]);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('标记已读错误:', error);
    console.error('错误详情:', error.stack);
    res.status(500).json({ error: '操作失败', details: error.message });
  }
});

module.exports = router;

