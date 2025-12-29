const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { moment } = require('../../utils/dateHelper');

// 获取所有优惠券推广方案（包含用户信息）
router.get('/list', async (req, res) => {
  try {
    const { user_id, role, status } = req.query;
    
    let query = `
      SELECT 
        cps.*,
        u.nickname as user_nickname,
        u.real_name as user_real_name,
        u.instructor_id,
        u.channel_id,
        u.role as user_role
      FROM coupon_promotion_schemes cps
      LEFT JOIN users u ON cps.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ' AND cps.user_id = ?';
      params.push(user_id);
    }

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }

    if (status) {
      query += ' AND cps.status = ?';
      params.push(status);
    }

    query += ' ORDER BY cps.created_at DESC';

    const [schemes] = await db.query(query, params);
    
    res.json({ success: true, data: schemes });
  } catch (error) {
    console.error('获取优惠券推广方案列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 获取指定用户的优惠券推广方案列表
router.get('/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const [schemes] = await db.query(
      `SELECT cps.*, u.nickname, u.real_name, u.role
       FROM coupon_promotion_schemes cps
       LEFT JOIN users u ON cps.user_id = u.id
       WHERE cps.user_id = ?
       ORDER BY cps.created_at DESC`,
      [user_id]
    );
    
    res.json({ success: true, data: schemes });
  } catch (error) {
    console.error('获取用户优惠券推广方案错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 创建优惠券推广方案
router.post('/create', async (req, res) => {
  try {
    const { 
      user_id, 
      scheme_type, 
      name, 
      description,
      member_inviter_register_amount,
      member_inviter_purchase_amount,
      member_invitee_amount,
      channel_caifu_amount,
      channel_other_amount,
      instructor_invitee_amount,
      start_date, 
      end_date, 
      status 
    } = req.body;

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

    // 验证方案类型
    const validSchemeTypes = ['member_invite', 'channel_caifu', 'channel_other', 'instructor_invite'];
    if (!validSchemeTypes.includes(scheme_type)) {
      return res.status(400).json({ success: false, error: '无效的方案类型' });
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
        `SELECT id FROM coupon_promotion_schemes 
         WHERE user_id = ? 
         AND status = 'active'
         AND scheme_type = ?
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`,
        [user_id, scheme_type, today, today]
      );

      if (existingActive.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: '该用户已有激活的同类型推广方案，请先停用现有方案或设置不同的时间段' 
        });
      }
    }

    const [result] = await db.query(
      `INSERT INTO coupon_promotion_schemes (
        user_id, scheme_type, name, description,
        member_inviter_register_amount, member_inviter_purchase_amount, member_invitee_amount,
        channel_caifu_amount, channel_other_amount, instructor_invitee_amount,
        start_date, end_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id, scheme_type, name || null, description || null,
        member_inviter_register_amount || null,
        member_inviter_purchase_amount || null,
        member_invitee_amount || null,
        channel_caifu_amount || null,
        channel_other_amount || null,
        instructor_invitee_amount || null,
        startDate, endDate, schemeStatus
      ]
    );

    const [schemes] = await db.query(
      `SELECT cps.*, u.nickname, u.real_name, u.role, u.instructor_id, u.channel_id
       FROM coupon_promotion_schemes cps
       LEFT JOIN users u ON cps.user_id = u.id
       WHERE cps.id = ?`,
      [result.insertId]
    );
    
    res.json({ 
      success: true, 
      message: '创建成功',
      data: schemes[0]
    });
  } catch (error) {
    console.error('创建优惠券推广方案错误:', error);
    res.status(500).json({ success: false, error: '创建失败', details: error.message });
  }
});

// 更新优惠券推广方案
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 先获取当前方案信息
    const [currentSchemes] = await db.query('SELECT user_id, status, scheme_type FROM coupon_promotion_schemes WHERE id = ?', [id]);
    if (currentSchemes.length === 0) {
      return res.status(404).json({ success: false, error: '推广方案不存在' });
    }

    const currentScheme = currentSchemes[0];
    const newStatus = updateData.status !== undefined ? updateData.status : currentScheme.status;

    const updateFields = [];
    const updateValues = [];

    // 构建更新字段
    const allowedFields = [
      'scheme_type', 'name', 'description',
      'member_inviter_register_amount', 'member_inviter_purchase_amount', 'member_invitee_amount',
      'channel_caifu_amount', 'channel_other_amount', 'instructor_invitee_amount',
      'start_date', 'end_date', 'status'
    ];
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        if (field === 'start_date' || field === 'end_date') {
          updateFields.push(`${field} = ?`);
          updateValues.push(updateData[field] || null);
        } else {
          updateFields.push(`${field} = ?`);
          updateValues.push(updateData[field]);
        }
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    // 验证日期
    const finalStartDate = updateData.start_date !== undefined ? updateData.start_date : null;
    const finalEndDate = updateData.end_date !== undefined ? updateData.end_date : null;
    
    if (finalStartDate && finalEndDate) {
      const start = new Date(finalStartDate);
      const end = new Date(finalEndDate);
      if (start > end) {
        return res.status(400).json({ success: false, error: '开始日期不能晚于结束日期' });
      }
    }

    // 如果状态是激活，检查该用户是否已有其他激活的方案（排除当前方案）
    if (newStatus === 'active') {
      const today = moment().format('YYYY-MM-DD');
      const schemeType = updateData.scheme_type || currentScheme.scheme_type;
      const [existingActive] = await db.query(
        `SELECT id FROM coupon_promotion_schemes 
         WHERE user_id = ? 
         AND id != ?
         AND status = 'active'
         AND scheme_type = ?
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`,
        [currentScheme.user_id, id, schemeType, today, today]
      );

      if (existingActive.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: '该用户已有其他激活的同类型推广方案，请先停用其他方案或设置不同的时间段' 
        });
      }
    }

    updateValues.push(id);
    const query = `UPDATE coupon_promotion_schemes SET ${updateFields.join(', ')} WHERE id = ?`;

    await db.query(query, updateValues);

    const [schemes] = await db.query(
      `SELECT cps.*, u.nickname, u.real_name, u.role, u.instructor_id, u.channel_id
       FROM coupon_promotion_schemes cps
       LEFT JOIN users u ON cps.user_id = u.id
       WHERE cps.id = ?`,
      [id]
    );

    res.json({ 
      success: true, 
      message: '更新成功',
      data: schemes[0]
    });
  } catch (error) {
    console.error('更新优惠券推广方案错误:', error);
    res.status(500).json({ success: false, error: '更新失败', details: error.message });
  }
});

// 删除优惠券推广方案
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM coupon_promotion_schemes WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除优惠券推广方案错误:', error);
    res.status(500).json({ success: false, error: '删除失败', details: error.message });
  }
});

module.exports = router;

