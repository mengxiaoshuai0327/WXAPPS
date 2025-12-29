const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const moment = require('moment');

// 获取折扣券管理列表
router.get('/', async (req, res) => {
  try {
    const { user_id, status, source, keyword, page = 1, pageSize = 20 } = req.query;
    
    let query = `
      SELECT dc.*,
             u.nickname as user_name, 
             u.member_id as user_member_id,
             u.instructor_id as user_instructor_id,
             u.phone as user_phone,
             u.role as user_role,
             u_source.nickname as source_user_name,
             u_source.member_id as source_user_member_id,
             u_source.instructor_id as source_user_instructor_id,
             u_source.role as source_user_role,
             CASE 
               WHEN dc.source = 'invite_register' AND i.id IS NOT NULL AND i.inviter_id = dc.user_id THEN 'inviter'
               WHEN dc.source = 'invite_register' AND i.id IS NOT NULL AND i.invitee_id = dc.user_id THEN 'invitee'
               ELSE NULL
             END as invite_register_type
      FROM discount_coupons dc
      JOIN users u ON dc.user_id = u.id
      LEFT JOIN users u_source ON dc.source_user_id = u_source.id
      LEFT JOIN invitations i ON (i.inviter_id = dc.user_id AND i.invitee_id = dc.source_user_id) 
                              OR (i.invitee_id = dc.user_id AND i.inviter_id = dc.source_user_id)
      WHERE 1=1
    `;
    const params = [];

    // 用户筛选
    if (user_id) {
      query += ' AND dc.user_id = ?';
      params.push(user_id);
    }

    // 关键词搜索（用户昵称、会员ID、手机号）
    if (keyword) {
      query += ' AND (u.nickname LIKE ? OR u.member_id LIKE ? OR u.phone LIKE ?)';
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern);
    }

    // 状态筛选
    if (status && status !== 'all') {
      if (status === 'expired') {
        // 已过期：status为unused且expiry_date已过期
        query += ' AND dc.status = ? AND (dc.expiry_date IS NOT NULL AND dc.expiry_date < CURDATE())';
        params.push('unused');
      } else {
        query += ' AND dc.status = ?';
        params.push(status);
      }
    }

    // 来源筛选
    if (source && source !== 'all') {
      query += ' AND dc.source = ?';
      params.push(source);
    }

    // 获取总数 - 构建独立的count查询
    let countQuery = `
      SELECT COUNT(*) as total
      FROM discount_coupons dc
      JOIN users u ON dc.user_id = u.id
      LEFT JOIN users u_source ON dc.source_user_id = u_source.id
      WHERE 1=1
    `;
    const countParams = [];
    
    // 应用相同的筛选条件
    if (user_id) {
      countQuery += ' AND dc.user_id = ?';
      countParams.push(user_id);
    }
    if (keyword) {
      countQuery += ' AND (u.nickname LIKE ? OR u.member_id LIKE ? OR u.phone LIKE ?)';
      const keywordPattern = `%${keyword}%`;
      countParams.push(keywordPattern, keywordPattern, keywordPattern);
    }
    if (status && status !== 'all') {
      if (status === 'expired') {
        countQuery += ' AND dc.status = ? AND (dc.expiry_date IS NOT NULL AND dc.expiry_date < CURDATE())';
        countParams.push('unused');
      } else {
        countQuery += ' AND dc.status = ?';
        countParams.push(status);
      }
    }
    if (source && source !== 'all') {
      countQuery += ' AND dc.source = ?';
      countParams.push(source);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    // 分页
    query += ' ORDER BY dc.created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [coupons] = await db.query(query, params);

    // 格式化数据
    const today = moment().startOf('day');
    const processedCoupons = coupons.map(coupon => {
      // 判断实际状态
      let actualStatus = coupon.status;
      let statusText = '';
      
      if (coupon.status === 'used') {
        statusText = '已使用';
      } else if (coupon.status === 'expired') {
        statusText = '已过期';
      } else if (coupon.start_date || coupon.expiry_date) {
        // 检查是否在有效期内
        const startDate = coupon.start_date ? moment(coupon.start_date).startOf('day') : null;
        const expiryDate = coupon.expiry_date ? moment(coupon.expiry_date).startOf('day') : null;
        
        if (expiryDate && expiryDate.isBefore(today)) {
          actualStatus = 'expired';
          statusText = '已过期';
        } else if (startDate && startDate.isAfter(today)) {
          statusText = '未生效';
        } else {
          statusText = '未使用';
        }
      } else {
        statusText = '未使用';
      }

      // 来源文本（按照最新优惠券政策）
      // invite_register需要区分是给邀请人还是被邀请人的
      let source_text = '';
      if (coupon.source === 'invite_register') {
        if (coupon.invite_register_type === 'inviter') {
          source_text = '会员推广-邀请注册奖励（给邀请人）';
        } else if (coupon.invite_register_type === 'invitee') {
          source_text = '会员推广-注册奖励（给被邀请人）';
        } else {
          // 如果无法判断，使用通用描述
          source_text = '会员推广-注册奖励';
        }
      } else {
        const sourceTexts = {
          'invite_purchase': '会员推广-邀请购券奖励（给邀请人）',
          'instructor_invite': '教练推广奖励（给被邀请人）',
          'channel_invite': '渠道推广奖励（给被邀请人）',
          'instructor_reward': '授课奖励',
          'admin_special': '特殊推广（管理员发放）',
          'admin': '管理员发放'
        };
        source_text = sourceTexts[coupon.source] || coupon.source;
      }

      // 格式化时间段
      let period_text = '';
      if (coupon.start_date && coupon.expiry_date) {
        period_text = `${moment(coupon.start_date).format('YYYY-MM-DD')} 至 ${moment(coupon.expiry_date).format('YYYY-MM-DD')}`;
      } else if (coupon.start_date) {
        period_text = `${moment(coupon.start_date).format('YYYY-MM-DD')} 起`;
      } else if (coupon.expiry_date) {
        period_text = `至 ${moment(coupon.expiry_date).format('YYYY-MM-DD')}`;
      } else {
        period_text = '永久有效';
      }

      // 构建用户信息显示（会员显示member_id，教练显示instructor_id）
      let user_info_text = '';
      if (coupon.user_role === 'instructor' && coupon.user_instructor_id) {
        user_info_text = `教练：${coupon.user_name || '未知'} (${coupon.user_instructor_id})`;
      } else if (coupon.user_member_id) {
        user_info_text = `会员：${coupon.user_name || '未知'} (${coupon.user_member_id})`;
      } else {
        user_info_text = coupon.user_name || '未知';
      }

      // 构建邀请人信息显示（如果有）
      let inviter_info_text = null;
      if (coupon.source_user_id && coupon.source_user_name) {
        if (coupon.source_user_role === 'instructor' && coupon.source_user_instructor_id) {
          inviter_info_text = `教练：${coupon.source_user_name} (${coupon.source_user_instructor_id})`;
        } else if (coupon.source_user_member_id) {
          inviter_info_text = `会员：${coupon.source_user_name} (${coupon.source_user_member_id})`;
        } else {
          inviter_info_text = coupon.source_user_name;
        }
      }

      return {
        ...coupon,
        actual_status: actualStatus,
        status_text: statusText,
        source_text,
        amount_formatted: parseFloat(coupon.amount).toFixed(2),
        created_at_formatted: moment(coupon.created_at).format('YYYY-MM-DD HH:mm:ss'),
        start_date_formatted: coupon.start_date ? moment(coupon.start_date).format('YYYY-MM-DD') : null,
        expiry_date_formatted: coupon.expiry_date ? moment(coupon.expiry_date).format('YYYY-MM-DD') : null,
        period_text: period_text,
        used_at_formatted: coupon.used_at ? moment(coupon.used_at).format('YYYY-MM-DD HH:mm:ss') : null,
        user_info_text: user_info_text,
        inviter_info_text: inviter_info_text
      };
    });

    res.json({
      success: true,
      data: processedCoupons,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取优惠券列表错误:', error);
    res.status(500).json({ 
      success: false,
      error: '获取失败', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 获取折扣券详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [coupons] = await db.query(
      `SELECT dc.*,
             u.nickname as user_name, 
             u.member_id as user_member_id,
             u.instructor_id as user_instructor_id,
             u.phone as user_phone,
             u.role as user_role,
             u_source.nickname as source_user_name,
             u_source.member_id as source_user_member_id,
             u_source.instructor_id as source_user_instructor_id,
             u_source.role as source_user_role,
             CASE 
               WHEN dc.source = 'invite_register' AND i.id IS NOT NULL AND i.inviter_id = dc.user_id THEN 'inviter'
               WHEN dc.source = 'invite_register' AND i.id IS NOT NULL AND i.invitee_id = dc.user_id THEN 'invitee'
               ELSE NULL
             END as invite_register_type
       FROM discount_coupons dc
       JOIN users u ON dc.user_id = u.id
       LEFT JOIN users u_source ON dc.source_user_id = u_source.id
       LEFT JOIN invitations i ON (i.inviter_id = dc.user_id AND i.invitee_id = dc.source_user_id) 
                               OR (i.invitee_id = dc.user_id AND i.inviter_id = dc.source_user_id)
       WHERE dc.id = ?`,
      [id]
    );

    if (coupons.length === 0) {
      return res.status(404).json({ error: '优惠券不存在' });
    }

    const coupon = coupons[0];
    
    // 判断实际状态
    let actualStatus = coupon.status;
    let statusText = '';
    const today = moment().startOf('day');
    
    if (coupon.status === 'used') {
      statusText = '已使用';
    } else if (coupon.status === 'expired') {
      statusText = '已过期';
    } else if (coupon.start_date || coupon.expiry_date) {
      // 检查是否在有效期内
      const startDate = coupon.start_date ? moment(coupon.start_date).startOf('day') : null;
      const expiryDate = coupon.expiry_date ? moment(coupon.expiry_date).startOf('day') : null;
      
      if (expiryDate && expiryDate.isBefore(today)) {
        actualStatus = 'expired';
        statusText = '已过期';
      } else if (startDate && startDate.isAfter(today)) {
        statusText = '未生效';
      } else {
        statusText = '未使用';
      }
    } else {
      statusText = '未使用';
    }

      // 来源文本（按照最新优惠券政策）
      // invite_register需要区分是给邀请人还是被邀请人的
      let source_text = '';
      if (coupon.source === 'invite_register') {
        if (coupon.invite_register_type === 'inviter') {
          source_text = '会员推广-邀请注册奖励（给邀请人）';
        } else if (coupon.invite_register_type === 'invitee') {
          source_text = '会员推广-注册奖励（给被邀请人）';
        } else {
          // 如果无法判断，使用通用描述
          source_text = '会员推广-注册奖励';
        }
      } else {
        const sourceTexts = {
          'invite_purchase': '会员推广-邀请购券奖励（给邀请人）',
          'instructor_invite': '教练推广奖励（给被邀请人）',
          'channel_invite': '渠道推广奖励（给被邀请人）',
          'instructor_reward': '授课奖励',
          'admin_special': '特殊推广（管理员发放）',
          'admin': '管理员发放'
        };
        source_text = sourceTexts[coupon.source] || coupon.source;
      }

    coupon.actual_status = actualStatus;
    coupon.status_text = statusText;
    coupon.source_text = source_text;
    // 格式化时间段
    let period_text = '';
    if (coupon.start_date && coupon.expiry_date) {
      period_text = `${moment(coupon.start_date).format('YYYY-MM-DD')} 至 ${moment(coupon.expiry_date).format('YYYY-MM-DD')}`;
    } else if (coupon.start_date) {
      period_text = `${moment(coupon.start_date).format('YYYY-MM-DD')} 起`;
    } else if (coupon.expiry_date) {
      period_text = `至 ${moment(coupon.expiry_date).format('YYYY-MM-DD')}`;
    } else {
      period_text = '永久有效';
    }

    coupon.amount_formatted = parseFloat(coupon.amount).toFixed(2);
    coupon.created_at_formatted = moment(coupon.created_at).format('YYYY-MM-DD HH:mm:ss');
    coupon.start_date_formatted = coupon.start_date ? moment(coupon.start_date).format('YYYY-MM-DD') : null;
    coupon.expiry_date_formatted = coupon.expiry_date ? moment(coupon.expiry_date).format('YYYY-MM-DD') : null;
    coupon.period_text = period_text;
    coupon.used_at_formatted = coupon.used_at ? moment(coupon.used_at).format('YYYY-MM-DD HH:mm:ss') : null;

    // 构建用户信息显示（会员显示member_id，教练显示instructor_id）
    let user_info_text = '';
    if (coupon.user_role === 'instructor' && coupon.user_instructor_id) {
      user_info_text = `教练：${coupon.user_name || '未知'} (${coupon.user_instructor_id})`;
    } else if (coupon.user_member_id) {
      user_info_text = `会员：${coupon.user_name || '未知'} (${coupon.user_member_id})`;
    } else {
      user_info_text = coupon.user_name || '未知';
    }

    // 构建邀请人信息显示（如果有）
    let inviter_info_text = null;
    if (coupon.source_user_id && coupon.source_user_name) {
      if (coupon.source_user_role === 'instructor' && coupon.source_user_instructor_id) {
        inviter_info_text = `教练：${coupon.source_user_name} (${coupon.source_user_instructor_id})`;
      } else if (coupon.source_user_member_id) {
        inviter_info_text = `会员：${coupon.source_user_name} (${coupon.source_user_member_id})`;
      } else {
        inviter_info_text = coupon.source_user_name;
      }
    }

    coupon.user_info_text = user_info_text;
    coupon.inviter_info_text = inviter_info_text;

    res.json({ success: true, data: coupon });
  } catch (error) {
    console.error('获取优惠券详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 管理员发放优惠券（特殊推广）
router.post('/', async (req, res) => {
  try {
    const { user_id, amount, start_date, expiry_date, source_user_id } = req.body;

    if (!user_id || !amount) {
      return res.status(400).json({ error: '缺少必要参数：user_id, amount' });
    }

    // 验证面值：特殊推广必须是100-1000之间的整百数
    if (amount < 100 || amount > 1000 || amount % 100 !== 0) {
      return res.status(400).json({ error: '优惠券面值必须是100-1000之间的整百数' });
    }

    // 检查用户是否存在
    const [users] = await db.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证日期范围
    if (start_date && expiry_date && start_date > expiry_date) {
      return res.status(400).json({ error: '开始日期不能晚于结束日期' });
    }

    // 获取特殊推广方案的配置（有效期）
    const [schemes] = await db.query(
      'SELECT admin_special_expiry_days FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
      ['admin_special', 'active']
    );
    
    let expiry_date_to_use = expiry_date;
    if (!expiry_date_to_use && schemes.length > 0) {
      // 如果没有指定有效期，使用特殊推广方案的默认有效期（7天）
      const expiryDays = parseInt(schemes[0].admin_special_expiry_days) || 7;
      expiry_date_to_use = moment().add(expiryDays, 'days').format('YYYY-MM-DD');
    }

    // 设置start_date：如果没有提供，使用今天
    const start_date_to_use = start_date || moment().format('YYYY-MM-DD');
    
    // 创建优惠券（使用admin_special作为来源，表示特殊推广）
    // 生成优惠券编码：先插入获取ID，然后生成 DC{id}
    const [result] = await db.query(
      `INSERT INTO discount_coupons (user_id, amount, source, source_user_id, start_date, expiry_date, status) 
       VALUES (?, ?, 'admin_special', ?, ?, ?, 'unused')`,
      [user_id, amount, source_user_id || null, start_date_to_use, expiry_date_to_use || null]
    );
    
    // 生成并更新优惠券编号
    const discount_code = `DC${result.insertId}`;
    await db.query(
      'UPDATE discount_coupons SET discount_code = ? WHERE id = ?',
      [discount_code, result.insertId]
    );

      res.json({ 
        success: true, 
        data: { id: result.insertId },
        message: '优惠券发放成功' 
      });
  } catch (error) {
    console.error('发放优惠券错误:', error);
    res.status(500).json({ 
      success: false,
      error: '发放失败', 
      message: error.message,
      details: error.message 
    });
  }
});

// 更新优惠券（管理员操作）
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, expiry_date, status } = req.body;

    // 检查折扣券是否存在
    const [coupons] = await db.query('SELECT * FROM discount_coupons WHERE id = ?', [id]);
    if (coupons.length === 0) {
      return res.status(404).json({ error: '优惠券不存在' });
    }

    const updateFields = [];
    const updateValues = [];

    if (amount !== undefined) {
      // 验证面值只能是100或500
      if (amount !== 100 && amount !== 500) {
        return res.status(400).json({ error: '折扣券面值只能是100元或500元' });
      }
      updateFields.push('amount = ?');
      updateValues.push(amount);
    }

    if (expiry_date !== undefined) {
      updateFields.push('expiry_date = ?');
      updateValues.push(expiry_date);
    }

    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (req.body.start_date !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(req.body.start_date);
    }

    if (req.body.expiry_date !== undefined) {
      updateFields.push('expiry_date = ?');
      updateValues.push(req.body.expiry_date);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updateValues.push(id);
    await db.query(
      `UPDATE discount_coupons SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新优惠券错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

// 删除优惠券（管理员操作）
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查折扣券是否存在
    const [coupons] = await db.query('SELECT * FROM discount_coupons WHERE id = ?', [id]);
    if (coupons.length === 0) {
      return res.status(404).json({ error: '优惠券不存在' });
    }

    await db.query('DELETE FROM discount_coupons WHERE id = ?', [id]);

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除优惠券错误:', error);
    res.status(500).json({ error: '删除失败', details: error.message });
  }
});

// 获取优惠券统计
router.get('/stats/summary', async (req, res) => {
  try {
    const [unusedCount] = await db.query(
      "SELECT COUNT(*) as count FROM discount_coupons WHERE status = 'unused' AND (expiry_date IS NULL OR expiry_date >= CURDATE())"
    );
    
    const [usedCount] = await db.query(
      "SELECT COUNT(*) as count FROM discount_coupons WHERE status = 'used'"
    );
    
    const [expiredCount] = await db.query(
      "SELECT COUNT(*) as count FROM discount_coupons WHERE status = 'unused' AND expiry_date IS NOT NULL AND expiry_date < CURDATE()"
    );

    const [totalAmount] = await db.query(
      "SELECT SUM(amount) as total FROM discount_coupons WHERE status = 'used'"
    );

    res.json({
      success: true,
      data: {
        unused: unusedCount[0].count,
        used: usedCount[0].count,
        expired: expiredCount[0].count,
        total_used_amount: parseFloat(totalAmount[0].total || 0).toFixed(2)
      }
    });
  } catch (error) {
    console.error('获取优惠券统计错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

module.exports = router;

