const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { moment } = require('../../utils/dateHelper');

// 获取所有用户推广方案（包含用户信息）
router.get('/list', async (req, res) => {
  try {
    const { user_id, role, status, scheme_type } = req.query;
    
    let query = `
      SELECT 
        ups.*,
        u.nickname as user_nickname,
        u.real_name as user_real_name,
        u.instructor_id,
        u.channel_id,
        u.role as user_role,
        cs.name as scheme_type_name,
        cs.description as scheme_type_description
      FROM user_promotion_schemes ups
      LEFT JOIN users u ON ups.user_id = u.id
      LEFT JOIN coupon_schemes cs ON ups.scheme_type = cs.scheme_type
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ' AND ups.user_id = ?';
      params.push(user_id);
    }

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }

    if (status) {
      query += ' AND ups.status = ?';
      params.push(status);
    }

    if (scheme_type) {
      query += ' AND ups.scheme_type = ?';
      params.push(scheme_type);
    }

    query += ' ORDER BY ups.created_at DESC';

    const [schemes] = await db.query(query, params);
    
    res.json({ success: true, data: schemes });
  } catch (error) {
    console.error('获取用户推广方案列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 获取指定用户的推广方案列表
router.get('/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const [schemes] = await db.query(
      `SELECT ups.*, u.nickname, u.real_name, u.role, cs.name as scheme_type_name
       FROM user_promotion_schemes ups
       LEFT JOIN users u ON ups.user_id = u.id
       LEFT JOIN coupon_schemes cs ON ups.scheme_type = cs.scheme_type
       WHERE ups.user_id = ?
       ORDER BY ups.created_at DESC`,
      [user_id]
    );
    
    res.json({ success: true, data: schemes });
  } catch (error) {
    console.error('获取用户推广方案错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 创建用户推广方案
router.post('/create', async (req, res) => {
  try {
    const { user_id, scheme_type, name, description, start_date, end_date, status } = req.body;

    if (!user_id || !scheme_type) {
      return res.status(400).json({ success: false, error: '请填写完整信息（用户ID和方案类型）' });
    }

    // 验证用户是否存在且是教练或渠道方
    const [users] = await db.query(
      'SELECT id, role FROM users WHERE id = ? AND role IN (?, ?)',
      [user_id, 'instructor', 'channel']
    );

    if (users.length === 0) {
      return res.status(400).json({ success: false, error: '用户不存在或不是教练/渠道方' });
    }

    const userRole = users[0].role;
    
    // 验证方案类型是否匹配用户角色
    if (userRole === 'instructor' && scheme_type !== 'instructor_invite') {
      return res.status(400).json({ success: false, error: '教练只能使用教练推广方案' });
    }
    
    if (userRole === 'channel') {
      if (scheme_type !== 'channel_caifu' && scheme_type !== 'channel_other') {
        return res.status(400).json({ success: false, error: '渠道方只能使用财能渠道推广或其他渠道推广方案' });
      }
    }

    // 验证方案类型是否存在
    const [schemes] = await db.query(
      'SELECT scheme_type FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
      [scheme_type, 'active']
    );
    
    if (schemes.length === 0) {
      return res.status(400).json({ success: false, error: '该推广方案类型不存在或未激活' });
    }

    // 验证日期
    let startDate = start_date || null;
    let endDate = end_date || null;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start > end) {
        return res.status(400).json({ success: false, error: '开始日期不能晚于结束日期' });
      }
    }

    const schemeStatus = status || 'active';

    // 如果状态是激活，检查该用户是否已有其他激活的方案（在同一时间段）
    if (schemeStatus === 'active') {
      const today = moment().format('YYYY-MM-DD');
      const [existingActive] = await db.query(
        `SELECT id FROM user_promotion_schemes 
         WHERE user_id = ? 
         AND status = 'active'
         AND (
           (start_date IS NULL OR start_date <= ?)
           AND (end_date IS NULL OR end_date >= ?)
           OR
           (start_date IS NULL AND end_date IS NULL)
           OR
           (? >= start_date AND ? <= end_date)
           OR
           (? >= start_date AND end_date IS NULL)
           OR
           (start_date IS NULL AND ? <= end_date)
         )`,
        [user_id, today, today, today, today, today, today]
      );

      if (existingActive.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: '该用户已有激活的推广方案，请先停用现有方案或设置不同的时间段' 
        });
      }
    }

    const [result] = await db.query(
      `INSERT INTO user_promotion_schemes (user_id, scheme_type, name, description, start_date, end_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, scheme_type, name || null, description || null, startDate, endDate, schemeStatus]
    );

    const [newSchemes] = await db.query(
      `SELECT ups.*, u.nickname, u.real_name, u.role, u.instructor_id, u.channel_id, cs.name as scheme_type_name
       FROM user_promotion_schemes ups
       LEFT JOIN users u ON ups.user_id = u.id
       LEFT JOIN coupon_schemes cs ON ups.scheme_type = cs.scheme_type
       WHERE ups.id = ?`,
      [result.insertId]
    );
    
    res.json({ 
      success: true, 
      message: '创建成功',
      data: newSchemes[0]
    });
  } catch (error) {
    console.error('创建用户推广方案错误:', error);
    res.status(500).json({ success: false, error: '创建失败', details: error.message });
  }
});

// 更新用户推广方案
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { scheme_type, name, description, start_date, end_date, status } = req.body;

    // 先获取当前方案信息
    const [currentSchemes] = await db.query('SELECT user_id, status FROM user_promotion_schemes WHERE id = ?', [id]);
    if (currentSchemes.length === 0) {
      return res.status(404).json({ success: false, error: '推广方案不存在' });
    }

    const currentScheme = currentSchemes[0];
    const newStatus = status !== undefined ? status : currentScheme.status;

    const updateFields = [];
    const updateValues = [];

    if (scheme_type !== undefined) {
      updateFields.push('scheme_type = ?');
      updateValues.push(scheme_type);
    }
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (start_date !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(start_date || null);
    }
    if (end_date !== undefined) {
      updateFields.push('end_date = ?');
      updateValues.push(end_date || null);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    // 验证日期
    const finalStartDate = start_date !== undefined ? start_date : null;
    const finalEndDate = end_date !== undefined ? end_date : null;
    
    if (finalStartDate && finalEndDate) {
      const start = new Date(finalStartDate);
      const end = new Date(finalEndDate);
      if (start > end) {
        return res.status(400).json({ success: false, error: '开始日期不能晚于结束日期' });
      }
    }

    // 如果状态是激活，检查该用户是否已有其他激活的方案（排除当前方案，在同一时间段）
    if (newStatus === 'active') {
      const today = moment().format('YYYY-MM-DD');
      const [existingActive] = await db.query(
        `SELECT id FROM user_promotion_schemes 
         WHERE user_id = ? 
         AND id != ?
         AND status = 'active'
         AND (
           (start_date IS NULL OR start_date <= ?)
           AND (end_date IS NULL OR end_date >= ?)
           OR
           (start_date IS NULL AND end_date IS NULL)
           OR
           (? >= start_date AND ? <= end_date)
           OR
           (? >= start_date AND end_date IS NULL)
           OR
           (start_date IS NULL AND ? <= end_date)
         )`,
        [currentScheme.user_id, id, today, today, today, today, today, today]
      );

      if (existingActive.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: '该用户已有其他激活的推广方案，请先停用其他方案或设置不同的时间段' 
        });
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    updateValues.push(id);
    const query = `UPDATE user_promotion_schemes SET ${updateFields.join(', ')} WHERE id = ?`;

    await db.query(query, updateValues);

    const [updatedSchemes] = await db.query(
      `SELECT ups.*, u.nickname, u.real_name, u.role, u.instructor_id, u.channel_id, cs.name as scheme_type_name
       FROM user_promotion_schemes ups
       LEFT JOIN users u ON ups.user_id = u.id
       LEFT JOIN coupon_schemes cs ON ups.scheme_type = cs.scheme_type
       WHERE ups.id = ?`,
      [id]
    );

    res.json({ 
      success: true, 
      message: '更新成功',
      data: updatedSchemes[0]
    });
  } catch (error) {
    console.error('更新用户推广方案错误:', error);
    res.status(500).json({ success: false, error: '更新失败', details: error.message });
  }
});

// 删除用户推广方案
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM user_promotion_schemes WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除用户推广方案错误:', error);
    res.status(500).json({ success: false, error: '删除失败', details: error.message });
  }
});

module.exports = router;

