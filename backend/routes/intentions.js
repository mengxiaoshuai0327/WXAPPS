const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 提交课程意向
router.post('/', async (req, res) => {
  try {
    const {
      user_id,
      selected_theme_ids,
      selected_course_ids,
      other_courses,
      preferred_time,
      preferred_instructor_id,
      preferred_instructor_name
    } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: '用户ID不能为空' });
    }

    // 验证用户是否存在
    const [users] = await db.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 如果有选择的老师ID，验证老师是否存在
    if (preferred_instructor_id) {
      const [instructors] = await db.query(
        'SELECT id, nickname, real_name FROM users WHERE id = ? AND role = ?',
        [preferred_instructor_id, 'instructor']
      );
      if (instructors.length === 0) {
        return res.status(400).json({ error: '选择的老师不存在' });
      }
    }

    // 如果有选择的主题ID，验证主题是否存在
    if (selected_theme_ids && selected_theme_ids.length > 0) {
      const placeholders = selected_theme_ids.map(() => '?').join(',');
      const [themes] = await db.query(
        `SELECT id FROM course_themes WHERE id IN (${placeholders})`,
        selected_theme_ids
      );
      if (themes.length !== selected_theme_ids.length) {
        return res.status(400).json({ error: '部分选择的主题不存在' });
      }
    }

    // 如果有选择的课程ID，验证课程是否存在
    if (selected_course_ids && selected_course_ids.length > 0) {
      const placeholders = selected_course_ids.map(() => '?').join(',');
      const [courses] = await db.query(
        `SELECT id FROM courses WHERE id IN (${placeholders})`,
        selected_course_ids
      );
      if (courses.length !== selected_course_ids.length) {
        return res.status(400).json({ error: '部分选择的课程不存在' });
      }
    }

    // 插入意向记录
    const [result] = await db.query(
      `INSERT INTO course_intentions 
       (user_id, selected_theme_ids, selected_course_ids, other_courses, 
        preferred_time, preferred_instructor_id, preferred_instructor_name, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        user_id,
        selected_theme_ids ? JSON.stringify(selected_theme_ids) : null,
        selected_course_ids ? JSON.stringify(selected_course_ids) : null,
        other_courses || null,
        preferred_time || null,
        preferred_instructor_id || null,
        preferred_instructor_name || null
      ]
    );

    res.json({
      success: true,
      message: '意向提交成功',
      data: { id: result.insertId }
    });
  } catch (error) {
    console.error('提交课程意向错误:', error);
    res.status(500).json({ error: '提交失败', details: error.message });
  }
});

module.exports = router;

