const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { moment } = require('../../utils/dateHelper');

// 获取所有营销方案（包含用户信息）
router.get('/list', async (req, res) => {
  try {
    const { user_id, role, status } = req.query;
    
    let query = `
      SELECT 
        mc.*,
        u.nickname as user_nickname,
        u.real_name as user_real_name,
        u.instructor_id,
        u.channel_id,
        u.role as user_role
      FROM marketing_campaigns mc
      LEFT JOIN users u ON mc.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      query += ' AND mc.user_id = ?';
      params.push(user_id);
    }

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }

    if (status) {
      query += ' AND mc.status = ?';
      params.push(status);
    }

    query += ' ORDER BY mc.created_at DESC';

    const [campaigns] = await db.query(query, params);
    
    res.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('获取营销方案列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 获取指定用户的营销方案列表
router.get('/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const [campaigns] = await db.query(
      `SELECT mc.*, u.nickname, u.real_name, u.role
       FROM marketing_campaigns mc
       LEFT JOIN users u ON mc.user_id = u.id
       WHERE mc.user_id = ?
       ORDER BY mc.created_at DESC`,
      [user_id]
    );
    
    res.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('获取用户营销方案错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 创建营销方案
router.post('/create', async (req, res) => {
  try {
    const { user_id, discount_rate, name, description, start_date, end_date, status } = req.body;

    if (!user_id || discount_rate === undefined) {
      return res.status(400).json({ success: false, error: '请填写完整信息（用户ID和折扣比例）' });
    }

    // 验证用户是否存在且是教练或渠道方
    const [users] = await db.query(
      'SELECT id, role FROM users WHERE id = ? AND role IN (?, ?)',
      [user_id, 'instructor', 'channel']
    );

    if (users.length === 0) {
      return res.status(400).json({ success: false, error: '用户不存在或不是教练/渠道方' });
    }

    const discountRate = parseFloat(discount_rate);
    if (discountRate < 0 || discountRate > 1) {
      return res.status(400).json({ success: false, error: '折扣比例必须在0-1之间（如0.20表示20%折扣，即8折）' });
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

    const campaignStatus = status || 'active';

    // 如果状态是激活，检查该用户是否已有其他激活的方案
    if (campaignStatus === 'active') {
      const today = moment().format('YYYY-MM-DD');
      const [existingActive] = await db.query(
        `SELECT id FROM marketing_campaigns 
         WHERE user_id = ? 
         AND status = 'active'
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`,
        [user_id, today, today]
      );

      if (existingActive.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: '该用户已有激活的营销方案，请先停用现有方案或设置不同的时间段' 
        });
      }
    }

    const [result] = await db.query(
      `INSERT INTO marketing_campaigns (user_id, discount_rate, name, description, start_date, end_date, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, discountRate, name || null, description || null, startDate, endDate, campaignStatus]
    );

    const [campaigns] = await db.query(
      `SELECT mc.*, u.nickname, u.real_name, u.role, u.instructor_id, u.channel_id
       FROM marketing_campaigns mc
       LEFT JOIN users u ON mc.user_id = u.id
       WHERE mc.id = ?`,
      [result.insertId]
    );
    
    res.json({ 
      success: true, 
      message: '创建成功',
      data: campaigns[0]
    });
  } catch (error) {
    console.error('创建营销方案错误:', error);
    res.status(500).json({ success: false, error: '创建失败', details: error.message });
  }
});

// 更新营销方案
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { discount_rate, name, description, start_date, end_date, status } = req.body;

    // 先获取当前方案信息
    const [currentCampaigns] = await db.query('SELECT user_id, status FROM marketing_campaigns WHERE id = ?', [id]);
    if (currentCampaigns.length === 0) {
      return res.status(404).json({ success: false, error: '营销方案不存在' });
    }

    const currentCampaign = currentCampaigns[0];
    const newStatus = status !== undefined ? status : currentCampaign.status;

    const updateFields = [];
    const updateValues = [];

    if (discount_rate !== undefined) {
      const discountRate = parseFloat(discount_rate);
      if (discountRate < 0 || discountRate > 1) {
        return res.status(400).json({ success: false, error: '折扣比例必须在0-1之间' });
      }
      updateFields.push('discount_rate = ?');
      updateValues.push(discountRate);
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

    // 如果状态是激活，检查该用户是否已有其他激活的方案（排除当前方案）
    if (newStatus === 'active') {
      const today = moment().format('YYYY-MM-DD');
      const [existingActive] = await db.query(
        `SELECT id FROM marketing_campaigns 
         WHERE user_id = ? 
         AND id != ?
         AND status = 'active'
         AND (start_date IS NULL OR start_date <= ?)
         AND (end_date IS NULL OR end_date >= ?)`,
        [currentCampaign.user_id, id, today, today]
      );

      if (existingActive.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: '该用户已有其他激活的营销方案，请先停用其他方案或设置不同的时间段' 
        });
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    updateValues.push(id);
    const query = `UPDATE marketing_campaigns SET ${updateFields.join(', ')} WHERE id = ?`;

    await db.query(query, updateValues);

    const [campaigns] = await db.query(
      `SELECT mc.*, u.nickname, u.real_name, u.role, u.instructor_id, u.channel_id
       FROM marketing_campaigns mc
       LEFT JOIN users u ON mc.user_id = u.id
       WHERE mc.id = ?`,
      [id]
    );

    res.json({ 
      success: true, 
      message: '更新成功',
      data: campaigns[0]
    });
  } catch (error) {
    console.error('更新营销方案错误:', error);
    res.status(500).json({ success: false, error: '更新失败', details: error.message });
  }
});

// 删除营销方案
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await db.query('DELETE FROM marketing_campaigns WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除营销方案错误:', error);
    res.status(500).json({ success: false, error: '删除失败', details: error.message });
  }
});

// 获取教练/渠道方邀请统计
router.get('/invitation-stats', async (req, res) => {
  try {
    const { role, user_id } = req.query;

    let query = `
      SELECT 
        u.id,
        u.nickname,
        u.real_name,
        u.member_id,
        u.instructor_id,
        u.channel_id,
        u.role,
        COUNT(DISTINCT i.invitee_id) as invited_count,
        COUNT(DISTINCT CASE WHEN i.status = 'registered' THEN i.invitee_id END) as registered_count,
        COUNT(DISTINCT CASE WHEN i.status = 'purchased' THEN i.invitee_id END) as purchased_count
      FROM users u
      LEFT JOIN invitations i ON u.id = i.inviter_id
      WHERE u.role IN ('instructor', 'channel')
    `;
    const params = [];

    if (role) {
      query += ' AND u.role = ?';
      params.push(role);
    }

    if (user_id) {
      query += ' AND u.id = ?';
      params.push(user_id);
    }

    query += ' GROUP BY u.id ORDER BY invited_count DESC';

    const [stats] = await db.query(query, params);

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取邀请统计错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 获取营销方案统计数据
router.get('/campaign-stats', async (req, res) => {
  try {
    const { inviter_id, invitee_id, inviter_role, page = 1, pageSize = 20 } = req.query;

    let query = `
      SELECT 
        mcs.*,
        u_inviter.nickname as inviter_nickname,
        u_inviter.real_name as inviter_real_name,
        u_inviter.member_id as inviter_member_id,
        u_inviter.instructor_id as inviter_instructor_id,
        u_inviter.channel_id as inviter_channel_id,
        u_invitee.nickname as invitee_nickname,
        u_invitee.real_name as invitee_real_name,
        u_invitee.member_id as invitee_member_id,
        u_invitee.phone as invitee_phone,
        mc.name as campaign_name,
        mc.discount_rate as campaign_discount_rate
      FROM marketing_campaign_stats mcs
      LEFT JOIN users u_inviter ON mcs.inviter_id = u_inviter.id
      LEFT JOIN users u_invitee ON mcs.invitee_id = u_invitee.id
      LEFT JOIN marketing_campaigns mc ON mcs.first_purchase_campaign_id = mc.id
      WHERE 1=1
    `;
    const params = [];

    if (inviter_id) {
      query += ' AND mcs.inviter_id = ?';
      params.push(inviter_id);
    }

    if (invitee_id) {
      query += ' AND mcs.invitee_id = ?';
      params.push(invitee_id);
    }

    if (inviter_role) {
      query += ' AND mcs.inviter_role = ?';
      params.push(inviter_role);
    }

    // 获取总数
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0]?.total || 0;

    // 排序和分页
    query += ' ORDER BY mcs.created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [stats] = await db.query(query, params);

    // 格式化日期
    const formattedStats = stats.map(stat => {
      const formatted = { ...stat };
      if (stat.registered_at) {
        formatted.registered_at = moment(stat.registered_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      }
      if (stat.first_purchase_at) {
        formatted.first_purchase_at = moment(stat.first_purchase_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      }
      if (stat.created_at) {
        formatted.created_at = moment(stat.created_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      }
      if (stat.updated_at) {
        formatted.updated_at = moment(stat.updated_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      }
      return formatted;
    });

    res.json({ 
      success: true, 
      data: formattedStats,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: total
      }
    });
  } catch (error) {
    console.error('获取营销方案统计数据错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

module.exports = router;
