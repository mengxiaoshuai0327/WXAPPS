const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { moment } = require('../../utils/dateHelper');

// 获取邀请列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, inviter_id, invitee_id, status, invite_code } = req.query;
    
    let query = `
      SELECT 
        i.id,
        i.inviter_id,
        i.invitee_id,
        i.invite_code,
        i.status,
        i.registered_at,
        i.purchased_at,
        i.created_at,
        u_inviter.nickname as inviter_name,
        u_inviter.real_name as inviter_real_name,
        u_inviter.member_id as inviter_member_id,
        u_inviter.instructor_id as inviter_instructor_id,
        u_inviter.role as inviter_role,
        u_inviter.channel_user_id as inviter_channel_user_id,
        ch.channel_name as inviter_channel_name,
        ch.channel_code as inviter_channel_code,
        u_invitee.nickname as invitee_name,
        u_invitee.real_name as invitee_real_name,
        u_invitee.member_id as invitee_member_id,
        u_invitee.phone as invitee_phone,
        COALESCE((SELECT COUNT(*) FROM discount_coupons dc 
         WHERE dc.source_user_id = i.invitee_id 
         AND dc.source = 'invite_register' 
         AND dc.user_id = i.inviter_id), 0) as register_coupon_count,
        COALESCE((SELECT SUM(COALESCE(dc.amount, 0)) FROM discount_coupons dc 
         WHERE dc.source_user_id = i.invitee_id 
         AND dc.source = 'invite_register' 
         AND dc.user_id = i.inviter_id), 0) as register_coupon_amount,
        COALESCE((SELECT COUNT(*) FROM discount_coupons dc 
         WHERE dc.source_user_id = i.invitee_id 
         AND dc.source = 'invite_purchase' 
         AND dc.user_id = i.inviter_id), 0) as purchase_coupon_count,
        COALESCE((SELECT SUM(COALESCE(dc.amount, 0)) FROM discount_coupons dc 
         WHERE dc.source_user_id = i.invitee_id 
         AND dc.source = 'invite_purchase' 
         AND dc.user_id = i.inviter_id), 0) as purchase_coupon_amount,
        COALESCE((SELECT COUNT(*) FROM discount_coupons dc 
         WHERE dc.user_id = i.invitee_id 
         AND dc.source_user_id = i.inviter_id
         AND dc.source IN ('channel_invite', 'instructor_invite')), 0) as invitee_coupon_count,
        COALESCE((SELECT SUM(COALESCE(dc.amount, 0)) FROM discount_coupons dc 
         WHERE dc.user_id = i.invitee_id 
         AND dc.source_user_id = i.inviter_id
         AND dc.source IN ('channel_invite', 'instructor_invite')), 0) as invitee_coupon_amount
      FROM invitations i
      LEFT JOIN users u_inviter ON i.inviter_id = u_inviter.id
      LEFT JOIN users u_invitee ON i.invitee_id = u_invitee.id
      LEFT JOIN channels ch ON u_inviter.channel_user_id = ch.id
      WHERE 1=1
    `;
    const params = [];

    if (inviter_id) {
      query += ' AND i.inviter_id = ?';
      params.push(inviter_id);
    }

    if (invitee_id) {
      query += ' AND i.invitee_id = ?';
      params.push(invitee_id);
    }

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    if (invite_code) {
      query += ' AND i.invite_code = ?';
      params.push(invite_code);
    }

    // 获取总数（构建独立的COUNT查询，避免子查询影响）
    let countQuery = 'SELECT COUNT(*) as total FROM invitations i WHERE 1=1';
    const countParams = [];
    
    if (inviter_id) {
      countQuery += ' AND i.inviter_id = ?';
      countParams.push(inviter_id);
    }
    if (invitee_id) {
      countQuery += ' AND i.invitee_id = ?';
      countParams.push(invitee_id);
    }
    if (status) {
      countQuery += ' AND i.status = ?';
      countParams.push(status);
    }
    if (invite_code) {
      countQuery += ' AND i.invite_code = ?';
      countParams.push(invite_code);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    // 排序和分页
    query += ' ORDER BY i.created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [results] = await db.query(query, params);

    // 格式化数据
    const formattedData = results.map(row => {
      // 构建邀请人显示信息
      let inviter_display_id = '';
      let inviter_role_text = '';
      if (row.inviter_role === 'instructor') {
        inviter_display_id = row.inviter_instructor_id || '';
        inviter_role_text = '教练';
      } else if (row.inviter_role === 'member') {
        // 判断是否为渠道销售（channel_user_id不为NULL）
        const hasChannelUserId = row.inviter_channel_user_id != null && 
                                 row.inviter_channel_user_id !== '' && 
                                 Number(row.inviter_channel_user_id) > 0;
        if (hasChannelUserId) {
          // 渠道销售，显示为渠道方
          inviter_display_id = row.inviter_member_id || '';
          inviter_role_text = '渠道方';
          if (row.inviter_channel_name) {
            inviter_display_id += ` (${row.inviter_channel_name})`;
          }
        } else {
          inviter_display_id = row.inviter_member_id || '';
          inviter_role_text = '会员';
        }
      } else {
        inviter_display_id = row.inviter_member_id || '';
        inviter_role_text = row.inviter_role || '未知';
      }

      return {
        id: row.id,
        inviter_id: row.inviter_id,
        inviter_name: row.inviter_name || row.inviter_real_name || '未知',
        inviter_member_id: row.inviter_member_id,
        inviter_instructor_id: row.inviter_instructor_id,
        inviter_role: row.inviter_role,
        inviter_channel_user_id: row.inviter_channel_user_id,
        inviter_channel_name: row.inviter_channel_name,
        inviter_channel_code: row.inviter_channel_code,
        inviter_display_id: inviter_display_id,
        inviter_role_text: inviter_role_text,
        invitee_id: row.invitee_id,
        invitee_name: row.invitee_name || row.invitee_real_name || '未知',
        invitee_member_id: row.invitee_member_id,
        invitee_phone: row.invitee_phone,
        invite_code: row.invite_code,
        status: row.status,
        registered_at: row.registered_at ? moment(row.registered_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss') : null,
        purchased_at: row.purchased_at ? moment(row.purchased_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss') : null,
        created_at: moment(row.created_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss'),
        register_coupon_count: parseInt(row.register_coupon_count) || 0,
        register_coupon_amount: parseFloat(row.register_coupon_amount) || 0,
        purchase_coupon_count: parseInt(row.purchase_coupon_count) || 0,
        purchase_coupon_amount: parseFloat(row.purchase_coupon_amount) || 0,
        invitee_coupon_count: parseInt(row.invitee_coupon_count) || 0,
        invitee_coupon_amount: parseFloat(row.invitee_coupon_amount) || 0
      };
    });

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: total
      }
    });
  } catch (error) {
    console.error('获取邀请列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取邀请统计信息
router.get('/stats', async (req, res) => {
  try {
    const { inviter_id } = req.query;
    
    let query = `
      SELECT 
        COUNT(*) as total_invitations,
        COUNT(CASE WHEN status = 'registered' THEN 1 END) as registered_count,
        COUNT(CASE WHEN status = 'purchased' THEN 1 END) as purchased_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
      FROM invitations
      WHERE 1=1
    `;
    const params = [];

    if (inviter_id) {
      query += ' AND inviter_id = ?';
      params.push(inviter_id);
    }

    const [stats] = await db.query(query, params);

    res.json({
      success: true,
      data: stats[0] || {
        total_invitations: 0,
        registered_count: 0,
        purchased_count: 0,
        pending_count: 0
      }
    });
  } catch (error) {
    console.error('获取邀请统计错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

module.exports = router;

