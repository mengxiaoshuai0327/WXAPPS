const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const moment = require('moment');

// 获取系统消息列表（管理员）
router.get('/list', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword } = req.query;
    
    let query = `SELECT sm.*, 
                        u.nickname as receiver_name,
                        u.real_name as receiver_real_name,
                        u.member_id as receiver_member_id,
                        u.phone as receiver_phone
                 FROM system_messages sm
                 LEFT JOIN users u ON sm.user_id = u.id
                 WHERE 1=1`;
    const params = [];

    if (keyword) {
      query += ' AND (sm.title LIKE ? OR sm.content LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw);
    }

    // 获取总数（使用独立的COUNT查询，避免受分页参数影响）
    const countParams = keyword ? [`%${keyword}%`, `%${keyword}%`] : [];
    let countQuery = `SELECT COUNT(*) as total 
                      FROM system_messages sm
                      LEFT JOIN users u ON sm.user_id = u.id
                      WHERE 1=1`;
    if (keyword) {
      countQuery += ' AND (sm.title LIKE ? OR sm.content LIKE ?)';
    }
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

    // 获取分页数据
    query += ' ORDER BY sm.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [messages] = await db.query(query, params);

    // 格式化日期和接收人信息
    const formattedMessages = messages.map(msg => {
      let receiverText = '全员';
      if (msg.user_id) {
        if (msg.receiver_real_name) {
          receiverText = `${msg.receiver_real_name}（${msg.receiver_member_id || msg.receiver_phone || ''}）`;
        } else if (msg.receiver_name) {
          receiverText = `${msg.receiver_name}（${msg.receiver_member_id || msg.receiver_phone || ''}）`;
        } else {
          receiverText = `用户ID: ${msg.user_id}`;
        }
      }
      
      return {
        ...msg,
        created_at_formatted: moment(msg.created_at).format('YYYY-MM-DD HH:mm:ss'),
        published: msg.published ? true : false,
        receiver_text: receiverText
      };
    });

    res.json({
      success: true,
      data: formattedMessages,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取系统消息列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取单条系统消息详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [messages] = await db.query('SELECT * FROM system_messages WHERE id = ?', [id]);
    
    if (messages.length === 0) {
      return res.status(404).json({ error: '消息不存在' });
    }

    res.json({ success: true, data: messages[0] });
  } catch (error) {
    console.error('获取系统消息详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 创建系统消息
router.post('/create', async (req, res) => {
  try {
    const { title, content, user_id, user_ids, type, published } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' });
    }

    // 支持单个user_id或多个user_ids
    let targetUserIds = [];
    if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
      // 如果传入了user_ids数组，使用数组
      targetUserIds = user_ids.filter(id => id !== null && id !== undefined);
    } else if (user_id !== null && user_id !== undefined) {
      // 如果传入了单个user_id，转换为数组
      targetUserIds = [user_id];
    }
    // 如果targetUserIds为空，表示推送给全员（user_id = NULL）

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const messageType = type || 'system';
      const isPublished = published ? 1 : 0;
      const createdIds = [];

      if (targetUserIds.length === 0) {
        // 推送给全员（user_id = NULL）
        const [result] = await connection.query(
          `INSERT INTO system_messages (title, content, user_id, type, published, created_at) 
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [title, content, null, messageType, isPublished]
        );
        createdIds.push(result.insertId);
      } else {
        // 为每个用户创建一条消息
        for (const uid of targetUserIds) {
          const [result] = await connection.query(
            `INSERT INTO system_messages (title, content, user_id, type, published, created_at) 
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [title, content, uid, messageType, isPublished]
          );
          createdIds.push(result.insertId);
        }
      }

      await connection.commit();
      connection.release();

      res.json({ 
        success: true, 
        data: { 
          ids: createdIds,
          count: createdIds.length
        } 
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('创建系统消息错误:', error);
    res.status(500).json({ error: '创建失败', details: error.message });
  }
});

// 更新系统消息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, user_id, user_ids, targetType, type, published } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容不能为空' });
    }

    // 确定最终的user_id值
    let finalUserId = null;
    if (targetType === 'all') {
      finalUserId = null; // 全部用户
    } else if (targetType === 'specific') {
      // 如果指定了user_ids数组，使用第一个（编辑时通常是单个消息，只对应一个用户）
      if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
        finalUserId = user_ids[0];
      } else if (user_id !== null && user_id !== undefined) {
        finalUserId = user_id;
      }
    } else {
      // 兼容旧逻辑：如果没有targetType，使用user_id
      finalUserId = user_id || null;
    }

    await db.query(
      `UPDATE system_messages 
       SET title = ?, content = ?, user_id = ?, type = ?, published = ?
       WHERE id = ?`,
      [title, content, finalUserId, type || 'system', published ? 1 : 0, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('更新系统消息错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

// 删除系统消息
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM system_messages WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除系统消息错误:', error);
    res.status(500).json({ error: '删除失败', details: error.message });
  }
});

module.exports = router;












