const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const moment = require('moment');

// 获取课程意向列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, keyword, start_date, end_date } = req.query;

    let query = `
      SELECT 
        ci.*,
        u.nickname as user_nickname,
        u.real_name as user_real_name,
        u.phone as user_phone,
        u.member_id as user_member_id,
        u_instructor.nickname as instructor_nickname,
        u_instructor.real_name as instructor_real_name
      FROM course_intentions ci
      LEFT JOIN users u ON ci.user_id = u.id
      LEFT JOIN users u_instructor ON ci.preferred_instructor_id = u_instructor.id
      WHERE 1=1
    `;
    const params = [];

    // 状态筛选
    if (status && status !== 'all') {
      query += ' AND ci.status = ?';
      params.push(status);
    }

    // 关键词搜索（用户昵称、手机号、会员ID、其他课程描述）
    if (keyword) {
      query += ` AND (
        u.nickname LIKE ? OR 
        u.real_name LIKE ? OR 
        u.phone LIKE ? OR 
        u.member_id LIKE ? OR
        ci.other_courses LIKE ?
      )`;
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern, keywordPattern);
    }

    // 日期范围筛选
    if (start_date) {
      query += ' AND DATE(ci.created_at) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND DATE(ci.created_at) <= ?';
      params.push(end_date);
    }

    // 获取总数
    let countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const countParams = [...params];
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    // 分页
    query += ' ORDER BY ci.created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [intentions] = await db.query(query, params);

    // 处理数据：解析JSON字段并获取主题和课程名称
    const processedIntentions = await Promise.all(intentions.map(async (intention) => {
      // 解析主题ID列表
      let selectedThemeIds = [];
      let selectedThemeNames = [];
      if (intention.selected_theme_ids) {
        try {
          selectedThemeIds = typeof intention.selected_theme_ids === 'string' 
            ? JSON.parse(intention.selected_theme_ids) 
            : intention.selected_theme_ids;
          
          if (selectedThemeIds.length > 0) {
            const placeholders = selectedThemeIds.map(() => '?').join(',');
            const [themes] = await db.query(
              `SELECT id, name FROM course_themes WHERE id IN (${placeholders})`,
              selectedThemeIds
            );
            selectedThemeNames = themes.map(t => t.name);
          }
        } catch (e) {
          console.error('解析主题ID失败:', e);
        }
      }

      // 解析课程ID列表
      let selectedCourseIds = [];
      let selectedCourseNames = [];
      if (intention.selected_course_ids) {
        try {
          selectedCourseIds = typeof intention.selected_course_ids === 'string'
            ? JSON.parse(intention.selected_course_ids)
            : intention.selected_course_ids;
          
          if (selectedCourseIds.length > 0) {
            const placeholders = selectedCourseIds.map(() => '?').join(',');
            const [courses] = await db.query(
              `SELECT id, title FROM courses WHERE id IN (${placeholders})`,
              selectedCourseIds
            );
            selectedCourseNames = courses.map(c => c.title);
          }
        } catch (e) {
          console.error('解析课程ID失败:', e);
        }
      }

    // 状态文本
    const statusTexts = {
      'pending': '待处理',
      'processing': '处理中',
      'completed': '已完成',
      'processed': '已处理', // 兼容旧值
      'cancelled': '已取消'
    };

      return {
        ...intention,
        selected_theme_ids: selectedThemeIds,
        selected_theme_names: selectedThemeNames,
        selected_course_ids: selectedCourseIds,
        selected_course_names: selectedCourseNames,
        status_text: statusTexts[intention.status] || intention.status,
        created_at_formatted: moment(intention.created_at).format('YYYY-MM-DD HH:mm:ss'),
        updated_at_formatted: intention.updated_at ? moment(intention.updated_at).format('YYYY-MM-DD HH:mm:ss') : null
      };
    }));

    res.json({
      success: true,
      data: processedIntentions,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取课程意向列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取课程意向详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [intentions] = await db.query(
      `SELECT 
        ci.*,
        u.nickname as user_nickname,
        u.real_name as user_real_name,
        u.phone as user_phone,
        u.member_id as user_member_id,
        u_instructor.nickname as instructor_nickname,
        u_instructor.real_name as instructor_real_name
      FROM course_intentions ci
      LEFT JOIN users u ON ci.user_id = u.id
      LEFT JOIN users u_instructor ON ci.preferred_instructor_id = u_instructor.id
      WHERE ci.id = ?`,
      [id]
    );

    if (intentions.length === 0) {
      return res.status(404).json({ error: '课程意向不存在' });
    }

    const intention = intentions[0];

    // 解析主题和课程信息
    let selectedThemeIds = [];
    let selectedThemeNames = [];
    if (intention.selected_theme_ids) {
      try {
        selectedThemeIds = typeof intention.selected_theme_ids === 'string'
          ? JSON.parse(intention.selected_theme_ids)
          : intention.selected_theme_ids;
        
        if (selectedThemeIds.length > 0) {
          const placeholders = selectedThemeIds.map(() => '?').join(',');
          const [themes] = await db.query(
            `SELECT id, name, description FROM course_themes WHERE id IN (${placeholders})`,
            selectedThemeIds
          );
          selectedThemeNames = themes.map(t => ({ id: t.id, name: t.name, description: t.description }));
        }
      } catch (e) {
        console.error('解析主题ID失败:', e);
      }
    }

    let selectedCourseIds = [];
    let selectedCourseNames = [];
    if (intention.selected_course_ids) {
      try {
        selectedCourseIds = typeof intention.selected_course_ids === 'string'
          ? JSON.parse(intention.selected_course_ids)
          : intention.selected_course_ids;
        
        if (selectedCourseIds.length > 0) {
          const placeholders = selectedCourseIds.map(() => '?').join(',');
          const [courses] = await db.query(
            `SELECT id, title, subtitle FROM courses WHERE id IN (${placeholders})`,
            selectedCourseIds
          );
          selectedCourseNames = courses.map(c => ({ id: c.id, title: c.title, subtitle: c.subtitle }));
        }
      } catch (e) {
        console.error('解析课程ID失败:', e);
      }
    }

    const statusTexts = {
      'pending': '待处理',
      'processing': '处理中',
      'completed': '已完成',
      'processed': '已处理', // 兼容旧值
      'cancelled': '已取消'
    };

    res.json({
      success: true,
      data: {
        ...intention,
        selected_theme_ids: selectedThemeIds,
        selected_themes: selectedThemeNames,
        selected_course_ids: selectedCourseIds,
        selected_courses: selectedCourseNames,
        status_text: statusTexts[intention.status] || intention.status,
        created_at_formatted: moment(intention.created_at).format('YYYY-MM-DD HH:mm:ss'),
        updated_at_formatted: intention.updated_at ? moment(intention.updated_at).format('YYYY-MM-DD HH:mm:ss') : null
      }
    });
  } catch (error) {
    console.error('获取课程意向详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 更新课程意向状态或备注
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_note } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (status !== undefined) {
      // 允许的状态值（兼容旧值 'processed'，映射为 'completed'）
      const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
      const mappedStatus = status === 'processed' ? 'completed' : status;
      
      if (!validStatuses.includes(mappedStatus)) {
        return res.status(400).json({ error: '无效的状态值' });
      }
      updateFields.push('status = ?');
      updateValues.push(mappedStatus);
    }

    if (admin_note !== undefined) {
      updateFields.push('admin_note = ?');
      updateValues.push(admin_note);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updateValues.push(id);
    await db.query(
      `UPDATE course_intentions SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新课程意向错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

// 删除课程意向
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [intentions] = await db.query('SELECT id FROM course_intentions WHERE id = ?', [id]);
    if (intentions.length === 0) {
      return res.status(404).json({ error: '课程意向不存在' });
    }

    await db.query('DELETE FROM course_intentions WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除课程意向错误:', error);
    res.status(500).json({ error: '删除失败', details: error.message });
  }
});

module.exports = router;

