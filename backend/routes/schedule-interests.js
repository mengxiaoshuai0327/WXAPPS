const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 用户点击感兴趣
router.post('/interest', async (req, res) => {
  try {
    const { user_id, schedule_id } = req.body;
    
    if (!user_id || !schedule_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 检查排课是否存在且为待开课状态
    const [schedules] = await db.query(
      'SELECT id, status FROM course_schedules WHERE id = ?',
      [schedule_id]
    );

    if (schedules.length === 0) {
      return res.status(404).json({ error: '排课不存在' });
    }

    if (schedules[0].status !== 'draft') {
      return res.status(400).json({ error: '只能对待开课表示感兴趣' });
    }

    // 检查是否已经点过感兴趣
    const [existing] = await db.query(
      'SELECT id FROM schedule_interests WHERE user_id = ? AND schedule_id = ?',
      [user_id, schedule_id]
    );

    if (existing.length > 0) {
      return res.json({ success: true, message: '已关注此课程' });
    }

    // 添加感兴趣记录
    await db.query(
      'INSERT INTO schedule_interests (user_id, schedule_id) VALUES (?, ?)',
      [user_id, schedule_id]
    );

    res.json({ success: true, message: '关注成功' });
  } catch (error) {
    console.error('添加感兴趣错误:', error);
    res.status(500).json({ error: '操作失败', details: error.message });
  }
});

// 用户取消感兴趣
router.delete('/interest', async (req, res) => {
  try {
    const { user_id, schedule_id } = req.query;
    
    if (!user_id || !schedule_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    await db.query(
      'DELETE FROM schedule_interests WHERE user_id = ? AND schedule_id = ?',
      [user_id, schedule_id]
    );

    res.json({ success: true, message: '取消关注成功' });
  } catch (error) {
    console.error('取消感兴趣错误:', error);
    res.status(500).json({ error: '操作失败', details: error.message });
  }
});

// 检查用户是否对某个排课感兴趣
router.get('/check', async (req, res) => {
  try {
    const { user_id, schedule_id } = req.query;
    
    if (!user_id || !schedule_id) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const [interests] = await db.query(
      'SELECT id FROM schedule_interests WHERE user_id = ? AND schedule_id = ?',
      [user_id, schedule_id]
    );

    res.json({ success: true, is_interested: interests.length > 0 });
  } catch (error) {
    console.error('检查感兴趣错误:', error);
    res.status(500).json({ error: '查询失败', details: error.message });
  }
});

// 获取某个排课的意向会员列表（管理员用）
router.get('/schedule/:schedule_id/users', async (req, res) => {
  try {
    const { schedule_id } = req.params;
    
    const [users] = await db.query(
      `SELECT si.id, si.user_id, si.created_at,
              u.nickname, u.member_id, u.phone
       FROM schedule_interests si
       JOIN users u ON si.user_id = u.id
       WHERE si.schedule_id = ?
       ORDER BY si.created_at DESC`,
      [schedule_id]
    );

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('获取意向会员列表错误:', error);
    res.status(500).json({ error: '查询失败', details: error.message });
  }
});

module.exports = router;


