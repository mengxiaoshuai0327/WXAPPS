const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const moment = require('moment');

// 获取发票管理列表
router.get('/', async (req, res) => {
  try {
    const { user_id, status, page = 1, pageSize = 20, keyword } = req.query;
    
    let query = `
      SELECT i.*, 
             u.nickname as user_name, 
             u.member_id as user_member_id, 
             u.phone as user_phone
      FROM invoices i
      JOIN users u ON i.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // 筛选条件
    if (user_id) {
      query += ' AND i.user_id = ?';
      params.push(user_id);
    }
    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }
    if (keyword) {
      query += ' AND (u.nickname LIKE ? OR u.member_id LIKE ? OR u.phone LIKE ? OR i.invoice_header LIKE ? OR i.email LIKE ?)';
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern, keywordPattern);
    }

    // 获取总数
    const countQuery = query.replace(/SELECT i\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0] ? countResult[0].total : 0;

    // 分页
    query += ' ORDER BY i.created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [invoices] = await db.query(query, params);

    // 格式化数据
    const processedInvoices = invoices.map(invoice => {
      // 解析课券ID列表
      let ticketIds = [];
      try {
        if (invoice.ticket_ids) {
          ticketIds = typeof invoice.ticket_ids === 'string' 
            ? JSON.parse(invoice.ticket_ids) 
            : invoice.ticket_ids;
        }
      } catch (e) {
        console.error('解析课券ID失败:', e);
      }

      return {
        ...invoice,
        ticket_ids: ticketIds,
        ticket_codes: invoice.ticket_codes ? invoice.ticket_codes.split(',') : [],
        amount: parseFloat(invoice.amount) || 0,
        created_at_formatted: moment(invoice.created_at).format('YYYY-MM-DD HH:mm:ss'),
        issued_at_formatted: invoice.issued_at ? moment(invoice.issued_at).format('YYYY-MM-DD HH:mm:ss') : null
      };
    });

    res.json({
      success: true,
      data: processedInvoices,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取发票列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取发票详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [invoices] = await db.query(
      `SELECT i.*, 
              u.nickname as user_name, 
              u.member_id as user_member_id, 
              u.phone as user_phone
       FROM invoices i
       JOIN users u ON i.user_id = u.id
       WHERE i.id = ?`,
      [id]
    );

    if (invoices.length === 0) {
      return res.status(404).json({ error: '发票不存在' });
    }

    const invoice = invoices[0];
    
    // 解析课券ID列表
    let ticketIds = [];
    try {
      if (invoice.ticket_ids) {
        ticketIds = typeof invoice.ticket_ids === 'string' 
          ? JSON.parse(invoice.ticket_ids) 
          : invoice.ticket_ids;
      }
    } catch (e) {
      console.error('解析课券ID失败:', e);
    }

    // 获取课券详情（包含优惠券信息）
    // 注意：如果课券是赠予出去的（status='gifted'），需要查找对应的赠予课券（通过original_ticket_code匹配）来获取使用信息
    let tickets = [];
    if (ticketIds.length > 0) {
      const placeholders = ticketIds.map(() => '?').join(',');
      const [ticketList] = await db.query(
        `SELECT 
                t.id, 
                t.ticket_code, 
                t.actual_amount, 
                t.purchase_amount, 
                t.status,
                -- 如果是赠予出去的课券，使用赠予课券的使用信息；否则使用当前课券的使用信息
                COALESCE(t_gift.used_at, t.used_at) as used_at,
                t.discount_coupon_id,
                -- 如果是赠予出去的课券，使用赠予课券的课程信息；否则使用当前课券的课程信息
                COALESCE(c_gift.title, c.title) as course_title,
                dc.id as coupon_id, 
                dc.amount as coupon_amount, 
                dc.discount_code as coupon_code
         FROM tickets t
         -- 查找赠予课券（如果当前课券被赠予出去了）
         LEFT JOIN tickets t_gift ON t.ticket_code = t_gift.original_ticket_code 
           AND t_gift.source = 'gift' 
           AND t_gift.status = 'used'
         -- 当前课券的课程信息
         LEFT JOIN course_bookings cb ON t.id = cb.ticket_id
         LEFT JOIN course_schedules cs ON cb.schedule_id = cs.id
         LEFT JOIN courses c ON cs.course_id = c.id
         -- 赠予课券的课程信息
         LEFT JOIN course_bookings cb_gift ON t_gift.id = cb_gift.ticket_id
         LEFT JOIN course_schedules cs_gift ON cb_gift.schedule_id = cs_gift.id
         LEFT JOIN courses c_gift ON cs_gift.course_id = c_gift.id
         -- 优惠券信息
         LEFT JOIN discount_coupons dc ON t.discount_coupon_id = dc.id
         WHERE t.id IN (${placeholders})`,
        ticketIds
      );
      // 格式化课券数据，添加优惠券信息和使用时间格式化
      tickets = ticketList.map(ticket => ({
        ...ticket,
        actual_amount: parseFloat(ticket.actual_amount || ticket.purchase_amount || 0),
        used_at: ticket.used_at ? moment(ticket.used_at).format('YYYY-MM-DD HH:mm') : null,
        discount_coupon: ticket.discount_coupon_id ? {
          id: ticket.coupon_id,
          amount: ticket.coupon_amount,
          discount_code: ticket.coupon_code
        } : null
      }));
    }

    invoice.ticket_ids = ticketIds;
    invoice.ticket_codes = invoice.ticket_codes ? invoice.ticket_codes.split(',') : [];
    invoice.tickets = tickets;
    invoice.amount = parseFloat(invoice.amount) || 0;
    invoice.created_at_formatted = moment(invoice.created_at).format('YYYY-MM-DD HH:mm:ss');
    invoice.issued_at_formatted = invoice.issued_at ? moment(invoice.issued_at).format('YYYY-MM-DD HH:mm:ss') : null;

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('获取发票详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 更新发票状态（管理员操作）
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, invoice_number } = req.body;

    if (!status) {
      return res.status(400).json({ error: '缺少必要参数：status' });
    }

    const validStatuses = ['pending', 'processing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    const updateData = { status };
    // 如果提供了发票号，无论状态如何都更新发票号和开票时间
    if (invoice_number) {
      updateData.invoice_number = invoice_number;
      updateData.issued_at = moment().format('YYYY-MM-DD HH:mm:ss');
      // 如果有发票号，自动将状态设置为completed
      if (!status || status === 'pending' || status === 'processing') {
        updateData.status = 'completed';
      }
    } else if (status === 'completed') {
      // 如果状态设为completed但没有发票号，设置开票时间
      updateData.issued_at = moment().format('YYYY-MM-DD HH:mm:ss');
    }

    await db.query(
      'UPDATE invoices SET ? WHERE id = ?',
      [updateData, id]
    );

    res.json({ success: true, message: '状态更新成功' });
  } catch (error) {
    console.error('更新发票状态错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

module.exports = router;

