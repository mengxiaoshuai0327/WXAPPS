const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const moment = require('moment');

// 获取课券管理列表
router.get('/', async (req, res) => {
  try {
    const { user_id, status, keyword, source, page = 1, pageSize = 20 } = req.query;
    
    // 使用GROUP BY确保每个课券只返回一行，避免JOIN导致重复
    // 先查询课券和用户信息，然后通过子查询获取关联数据
    let query = `
      SELECT t.id,
             t.user_id,
             t.ticket_code,
             t.source,
             t.source_user_id,
             t.status,
             t.purchase_amount,
             t.actual_amount,
             t.start_date,
             t.expiry_date,
             t.purchased_at,
             t.used_at,
             t.gifted_at,
             t.invoice_status,
             t.invoice_amount,
             t.discount_coupon_id,
             t.restrict_module_id,
             t.restrict_theme_id,
             t.restrict_course_id,
             t.original_ticket_code,
             t.created_at,
             t.updated_at,
             u.nickname as user_name, 
             u.member_id as user_member_id, 
             u.phone as user_phone,
             u_giver.member_id as giver_member_id,
             (SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.discount_coupon_id')) AS UNSIGNED)
              FROM operation_logs
              WHERE table_name = 'tickets' 
                AND action = 'purchase_tickets' 
                AND record_id = t.id
              ORDER BY id DESC
              LIMIT 1) as discount_coupon_id_from_log,
             (SELECT data
              FROM operation_logs
              WHERE table_name = 'tickets' 
                AND action = 'purchase_tickets' 
                AND record_id = t.id
              ORDER BY id DESC
              LIMIT 1) as purchase_log_data,
             (SELECT schedule_id
              FROM course_bookings
              WHERE ticket_id = t.id 
                AND status = 'booked'
              ORDER BY id DESC
              LIMIT 1) as schedule_id,
             (SELECT cs.course_id
              FROM course_bookings cb
              JOIN course_schedules cs ON cs.id = cb.schedule_id
              WHERE cb.ticket_id = t.id 
                AND cb.status = 'booked'
              ORDER BY cb.id DESC
              LIMIT 1) as course_id,
             (SELECT c.title
              FROM course_bookings cb
              JOIN course_schedules cs ON cs.id = cb.schedule_id
              JOIN courses c ON c.id = cs.course_id
              WHERE cb.ticket_id = t.id 
                AND cb.status = 'booked'
              ORDER BY cb.id DESC
              LIMIT 1) as course_title,
             (SELECT c.course_code
              FROM course_bookings cb
              JOIN course_schedules cs ON cs.id = cb.schedule_id
              JOIN courses c ON c.id = cs.course_id
              WHERE cb.ticket_id = t.id 
                AND cb.status = 'booked'
              ORDER BY cb.id DESC
              LIMIT 1) as course_code
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN users u_giver ON t.source_user_id = u_giver.id
      WHERE 1=1
    `;
    const params = [];

    // 用户筛选
    if (user_id) {
      query += ' AND t.user_id = ?';
      params.push(user_id);
    }

    // 关键词搜索（用户昵称、会员ID、手机号、课券编号）
    if (keyword) {
      query += ' AND (u.nickname LIKE ? OR u.member_id LIKE ? OR u.phone LIKE ? OR t.ticket_code LIKE ?)';
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern);
    }

    // 状态筛选
    if (status && status !== 'all') {
      query += ' AND t.status = ?';
      params.push(status);
    }

    // 来源筛选
    if (source && source !== 'all') {
      query += ' AND t.source = ?';
      params.push(source);
    }

    // 获取总数 - 构建独立的count查询
    let countQuery = `
      SELECT COUNT(*) as total
      FROM tickets t
      JOIN users u ON t.user_id = u.id
      WHERE 1=1
    `;
    const countParams = [];
    
    // 应用相同的筛选条件
    if (user_id) {
      countQuery += ' AND t.user_id = ?';
      countParams.push(user_id);
    }
    if (keyword) {
      countQuery += ' AND (u.nickname LIKE ? OR u.member_id LIKE ? OR u.phone LIKE ? OR t.ticket_code LIKE ?)';
      const keywordPattern = `%${keyword}%`;
      countParams.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern);
    }
    if (status && status !== 'all') {
      countQuery += ' AND t.status = ?';
      countParams.push(status);
    }
    if (source && source !== 'all') {
      countQuery += ' AND t.source = ?';
      countParams.push(source);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult[0]?.total || 0;

    // 排序和分页
    query += ' ORDER BY t.created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [tickets] = await db.query(query, params);
    
    console.log(`[管理员课券列表] 查询到 ${tickets.length} 条课券记录`);

    // 格式化数据
    const processedTickets = await Promise.all(tickets.map(async (ticket) => {
      // 状态文本将在查询发票信息后设置（因为需要根据发票状态判断是否显示"已开票"）
      let status_text = '';

      // 来源文本
      const sourceTexts = {
        'purchase': '自行购买',
        'gift': '他人赠予',
        'admin': '管理员发放',
        'instructor_reward': '授课奖励'
      };
      const source_text = sourceTexts[ticket.source] || ticket.source;

      // 获取折扣券信息
      // 优先从tickets表的discount_coupon_id字段获取（购买多张课券时，优惠券只记录在第一张课券上）
      let discount_coupon_id = ticket.discount_coupon_id ? parseInt(ticket.discount_coupon_id) : null;
      let discount_coupon_amount = null;
      let discount_coupon_code = null;
      
      if (discount_coupon_id) {
        // 如果tickets表中有discount_coupon_id，直接查询折扣券信息
        const [coupons] = await db.query('SELECT amount, discount_code FROM discount_coupons WHERE id = ?', [discount_coupon_id]);
        if (coupons.length > 0) {
          discount_coupon_amount = parseFloat(coupons[0].amount);
          discount_coupon_code = coupons[0].discount_code;
        }
      } else if (ticket.discount_coupon_id_from_log) {
        // 如果没有，尝试从购买日志中获取折扣券ID（兼容历史数据）
        discount_coupon_id = parseInt(ticket.discount_coupon_id_from_log);
        const [coupons] = await db.query('SELECT amount, discount_code FROM discount_coupons WHERE id = ?', [discount_coupon_id]);
        if (coupons.length > 0) {
          discount_coupon_amount = parseFloat(coupons[0].amount);
          discount_coupon_code = coupons[0].discount_code;
        }
      } else if (ticket.purchase_log_data) {
        // 尝试从日志数据中解析
        try {
          const logData = typeof ticket.purchase_log_data === 'string' 
            ? JSON.parse(ticket.purchase_log_data) 
            : ticket.purchase_log_data;
          if (logData.discount_coupon_id) {
            discount_coupon_id = parseInt(logData.discount_coupon_id);
            const [coupons] = await db.query('SELECT amount, discount_code FROM discount_coupons WHERE id = ?', [discount_coupon_id]);
            if (coupons.length > 0) {
              discount_coupon_amount = parseFloat(coupons[0].amount);
              discount_coupon_code = coupons[0].discount_code;
            }
          }
        } catch (e) {
          console.error('解析购买日志失败:', e);
        }
      }
      
      // 如果没有从日志中找到，尝试通过金额匹配（历史数据）
      if (!discount_coupon_id && ticket.purchased_at) {
        const purchaseAmount = parseFloat(ticket.purchase_amount || 0);
        const actualAmount = parseFloat(ticket.actual_amount || 0);
        const discountAmount = purchaseAmount - actualAmount;
        
        if (discountAmount > 0) {
          // 查找匹配的折扣券（通过金额和时间）
          const [matchedCoupons] = await db.query(
            `SELECT id, amount, discount_code FROM discount_coupons 
             WHERE user_id = ? AND amount = ? AND status = 'used' 
             AND used_at <= DATE_ADD(?, INTERVAL 1 DAY)
             AND used_at >= DATE_SUB(?, INTERVAL 1 DAY)
             ORDER BY ABS(TIMESTAMPDIFF(SECOND, used_at, ?)) ASC
             LIMIT 1`,
            [ticket.user_id, discountAmount, ticket.purchased_at, ticket.purchased_at, ticket.purchased_at]
          );
          
          if (matchedCoupons.length > 0) {
            discount_coupon_id = matchedCoupons[0].id;
            discount_coupon_amount = parseFloat(matchedCoupons[0].amount);
            discount_coupon_code = matchedCoupons[0].discount_code;
          }
        }
      }

      // 获取发票信息并确定开票状态
      // 对所有课券都查询发票信息，确保即使invoice_status字段未更新也能正确显示
      let invoice_info = null;
      let invoice_status_text = '未开票';
      
      // 查询关联的发票信息（ticket_ids是JSON数组，需要检查是否包含当前ticket.id）
      // 先尝试使用JSON_CONTAINS查询，如果失败则查询所有发票后在代码中过滤
      const ticketIdJson = JSON.stringify(ticket.id);
      let invoices = [];
      
      try {
        // 方法1：使用JSON_CONTAINS（推荐，性能好）
        const [invoicesResult] = await db.query(
          `SELECT id, invoice_number, status, created_at, ticket_ids
           FROM invoices 
           WHERE user_id = ? 
           AND ticket_ids IS NOT NULL
           AND JSON_CONTAINS(ticket_ids, ?)
           ORDER BY created_at DESC 
           LIMIT 1`,
          [ticket.user_id, ticketIdJson]
        );
        invoices = invoicesResult;
      } catch (error) {
        // 方法2：如果JSON_CONTAINS失败，查询所有发票后在代码中过滤
        console.warn('JSON_CONTAINS查询失败，使用备选方案:', error.message);
        const [allInvoices] = await db.query(
          `SELECT id, invoice_number, status, created_at, ticket_ids
           FROM invoices 
           WHERE user_id = ? 
           AND ticket_ids IS NOT NULL
           ORDER BY created_at DESC`,
          [ticket.user_id]
        );
        
        // 在代码中查找包含当前ticket.id的发票
        for (const inv of allInvoices) {
          let ticketIds = [];
          try {
            if (inv.ticket_ids) {
              ticketIds = typeof inv.ticket_ids === 'string' 
                ? JSON.parse(inv.ticket_ids) 
                : inv.ticket_ids;
            }
            if (Array.isArray(ticketIds) && ticketIds.includes(ticket.id)) {
              invoices = [inv];
              break;
            }
          } catch (e) {
            console.error('解析发票ticket_ids失败:', e);
          }
        }
      }
      
      if (invoices.length > 0) {
        invoice_info = {
          id: invoices[0].id,
          invoice_number: invoices[0].invoice_number,
          status: invoices[0].status,
          created_at: invoices[0].created_at ? moment(invoices[0].created_at).format('YYYY-MM-DD HH:mm:ss') : null
        };
        
        // 根据发票状态和发票号确定开票状态文本
        // 规则：如果有发票号，说明发票已经开好，显示"已开票"
        // 如果没有发票号，说明还在处理中，显示"已申请"
        if (invoices[0].invoice_number && invoices[0].invoice_number.trim() !== '') {
          invoice_status_text = '已开票';
        } else {
          // 没有发票号，说明用户已提交申请但管理员还未填写发票号
          invoice_status_text = '已申请';
        }
      } else {
        // 没有找到发票记录，根据ticket.invoice_status判断
        if (ticket.invoice_status === 'issued') {
          // 如果ticket.invoice_status是'issued'但找不到发票记录，可能是数据不一致，显示为已申请
          invoice_status_text = '已申请';
        } else {
          // ticket.invoice_status 为 'unissued' 或 null，显示未开票
          invoice_status_text = '未开票';
        }
      }

      // 设置课券状态文本（在查询发票信息之后）
      // 业务规则：
      // 1. 购买后 -> 未使用
      // 2. 预订后 -> 已预订
      // 3. 预订后取消 -> 未使用（课券状态已变回unused）
      // 4. 上完课 -> 已使用
      // 5. 退课券 -> 已退款（目前数据库不支持，暂不处理）
      // 6. 开票后 -> 已开票（优先级最高，通过invoice_status判断）
      if (invoice_status_text === '已开票' && invoice_info && invoice_info.invoice_number) {
        // 如果已开票，显示"已开票"（优先级最高）
        status_text = '已开票';
      } else {
        // 否则根据课券状态显示
        const statusTexts = {
          'unused': '未使用',
          'booked': '已预订',
          'used': '已使用',
          'expired': '已过期',
          'gifted': '已赠予'
        };
        status_text = statusTexts[ticket.status] || ticket.status;
      }

      // 格式化有效期范围
      let validity_period = null;
      if (ticket.start_date && ticket.expiry_date) {
        validity_period = moment(ticket.start_date).format('YYYY-MM-DD') + ' 至 ' + moment(ticket.expiry_date).format('YYYY-MM-DD');
      } else if (ticket.expiry_date) {
        validity_period = '至 ' + moment(ticket.expiry_date).format('YYYY-MM-DD');
      } else if (ticket.start_date) {
        validity_period = moment(ticket.start_date).format('YYYY-MM-DD') + ' 起';
      } else {
        validity_period = '永久有效';
      }

      return Object.assign({}, ticket, {
        status_text: status_text,
        source_text: source_text,
        purchase_date: ticket.purchased_at ? moment(ticket.purchased_at).format('YYYY-MM-DD') : null,
        start_date: ticket.start_date ? moment(ticket.start_date).format('YYYY-MM-DD') : null,
        expiry_date: ticket.expiry_date ? moment(ticket.expiry_date).format('YYYY-MM-DD') : null,
        validity_period: validity_period,
        used_date: ticket.used_at ? moment(ticket.used_at).format('YYYY-MM-DD') : null,
        purchase_amount: parseFloat(ticket.purchase_amount || 0),
        actual_amount: parseFloat(ticket.actual_amount || 0),
        discount_coupon_id: discount_coupon_id,
        discount_coupon_amount: discount_coupon_amount,
        discount_coupon_code: discount_coupon_code,
        course_id: ticket.course_id ? parseInt(ticket.course_id) : null,
        course_title: ticket.course_title || null,
        invoice_status: ticket.invoice_status || 'unissued',
        invoice_status_text: invoice_status_text,
        invoice_info: invoice_info,
        original_ticket_code: ticket.original_ticket_code || null
      });
    }));

    res.json({
      success: true,
      data: processedTickets,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取课券列表错误:', error);
    res.status(500).json({ 
      success: false,
      error: '获取失败', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// 获取赠券列表（赠送的课券记录）- 必须在 /:id 路由之前
router.get('/gifts', async (req, res) => {
  try {
    const { giver_id, receiver_id, page = 1, pageSize = 20, keyword } = req.query;
    
    let query = `
      SELECT DISTINCT t.*,
             u_giver.nickname as giver_name,
             u_giver.real_name as giver_real_name,
             u_giver.member_id as giver_member_id,
             u_giver.phone as giver_phone,
             u_receiver.nickname as receiver_name,
             u_receiver.real_name as receiver_real_name,
             u_receiver.member_id as receiver_member_id,
             u_receiver.phone as receiver_phone,
             cm.name as restrict_module_name,
             ct.name as restrict_theme_name
      FROM tickets t
      JOIN users u_giver ON t.source_user_id = u_giver.id
      JOIN users u_receiver ON t.user_id = u_receiver.id
      LEFT JOIN course_modules cm ON t.restrict_module_id = cm.id
      LEFT JOIN course_themes ct ON t.restrict_theme_id = ct.id
      WHERE t.source = 'gift' AND t.source_user_id IS NOT NULL
    `;
    const params = [];

    // 筛选条件
    if (giver_id) {
      query += ' AND t.source_user_id = ?';
      params.push(giver_id);
    }
    if (receiver_id) {
      query += ' AND t.user_id = ?';
      params.push(receiver_id);
    }
    if (keyword) {
      query += ' AND (u_giver.member_id LIKE ? OR u_giver.nickname LIKE ? OR u_receiver.member_id LIKE ? OR u_receiver.nickname LIKE ? OR t.ticket_code LIKE ?)';
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern, keywordPattern);
    }

    // 先添加GROUP BY到主查询（确保去重）
    query += ' GROUP BY t.id';

    // 获取总数（从主查询构建COUNT查询，移除GROUP BY和ORDER BY）
    let countQuery = query.replace(/SELECT DISTINCT[\s\S]*?FROM/i, 'SELECT COUNT(DISTINCT t.id) as total FROM');
    // 移除GROUP BY、ORDER BY和LIMIT（COUNT查询不需要）
    countQuery = countQuery.replace(/GROUP BY[\s\S]*$/i, '');
    countQuery = countQuery.replace(/ORDER BY[\s\S]*$/i, '');
    const countParamsOnly = [...params]; // COUNT查询不需要分页参数
    const [countResult] = await db.query(countQuery, countParamsOnly);
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

    // 继续添加排序和分页
    query += ' ORDER BY COALESCE(t.gifted_at, t.created_at) DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [giftTickets] = await db.query(query, params);

    // 格式化数据
    const processedGifts = await Promise.all(giftTickets.map(async (ticket) => {
      // 获取折扣券信息（从赠送人购买原课券时的日志中获取）
      // 原课券编号直接从字段中获取（original_ticket_code）
      let discount_coupon_code = null;
      let discount_coupon_amount = null;
      
      // 如果原课券编号存在，查找原课券的折扣券信息
      if (ticket.original_ticket_code && ticket.purchased_at && ticket.purchase_amount) {
        // 通过原课券编号查找原课券ID
        const [originalTickets] = await db.query(
          `SELECT id FROM tickets 
           WHERE ticket_code = ? AND status = 'gifted' 
           LIMIT 1`,
          [ticket.original_ticket_code]
        );
        
        if (originalTickets.length > 0) {
          // 从原课券的操作日志中获取折扣券信息
          const [logs] = await db.query(
            `SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(data, '$.discount_coupon_id')) AS UNSIGNED) as discount_coupon_id
             FROM operation_logs 
             WHERE table_name = 'tickets' AND action = 'purchase_tickets' 
             AND record_id = ?`,
            [originalTickets[0].id]
          );
          
          if (logs.length > 0 && logs[0].discount_coupon_id) {
            const [coupons] = await db.query(
              'SELECT discount_code, amount FROM discount_coupons WHERE id = ?',
              [logs[0].discount_coupon_id]
            );
            if (coupons.length > 0) {
              discount_coupon_code = coupons[0].discount_code;
              discount_coupon_amount = parseFloat(coupons[0].amount) || 0;
            }
          }
        }
        
        // 如果还没找到，尝试通过金额和时间直接匹配折扣券
        if (!discount_coupon_code && ticket.actual_amount) {
          const discountAmount = parseFloat(ticket.purchase_amount) - parseFloat(ticket.actual_amount);
          if (discountAmount > 0) {
            const [matchedCoupons] = await db.query(
              `SELECT discount_code, amount FROM discount_coupons 
               WHERE user_id = ? AND amount = ? AND status = 'used' 
               AND used_at <= DATE_ADD(?, INTERVAL 1 DAY)
               AND used_at >= DATE_SUB(?, INTERVAL 1 DAY)
               LIMIT 1`,
              [ticket.source_user_id, discountAmount, ticket.purchased_at, ticket.purchased_at]
            );
            if (matchedCoupons.length > 0) {
              discount_coupon_code = matchedCoupons[0].discount_code;
              discount_coupon_amount = parseFloat(matchedCoupons[0].amount) || 0;
            }
          }
        }
      }

      // 格式化有效期
      let validity_period = '';
      if (ticket.start_date && ticket.expiry_date) {
        validity_period = `${moment(ticket.start_date).format('YYYY-MM-DD')} 至 ${moment(ticket.expiry_date).format('YYYY-MM-DD')}`;
      } else if (ticket.start_date) {
        validity_period = `${moment(ticket.start_date).format('YYYY-MM-DD')} 起`;
      } else if (ticket.expiry_date) {
        validity_period = `至 ${moment(ticket.expiry_date).format('YYYY-MM-DD')}`;
      } else {
        validity_period = '永久有效';
      }

      return {
        ...ticket,
        purchase_date: ticket.purchased_at ? moment(ticket.purchased_at).format('YYYY-MM-DD') : null,
        purchase_amount: parseFloat(ticket.purchase_amount || 0),
        actual_amount: parseFloat(ticket.actual_amount || 0),
        gifted_at_formatted: ticket.gifted_at ? moment(ticket.gifted_at).format('YYYY-MM-DD HH:mm:ss') : (ticket.created_at ? moment(ticket.created_at).format('YYYY-MM-DD HH:mm:ss') : null),
        validity_period: validity_period,
        original_ticket_code: ticket.original_ticket_code || null,
        discount_coupon_code: discount_coupon_code,
        discount_coupon_amount: discount_coupon_amount
      };
    }));

    res.json({
      success: true,
      data: processedGifts,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取赠券列表错误:', error);
    res.status(500).json({ 
      success: false,
      error: '获取失败', 
      details: error.message 
    });
  }
});

// 获取课券详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [tickets] = await db.query(
      `SELECT t.*,
              u.nickname as user_name, 
              u.member_id as user_member_id, 
              u.phone as user_phone
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = ?`,
      [id]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ error: '课券不存在' });
    }

    const ticket = tickets[0];
    
    // 状态文本
    const statusTexts = {
      'unused': '未使用',
      'booked': '已预订',
      'used': '已使用',
      'expired': '已过期',
      'gifted': '已赠予'
    };
    ticket.status_text = statusTexts[ticket.status] || ticket.status;

    // 来源文本
    const sourceTexts = {
      'purchase': '自行购买',
      'gift': '他人赠予',
      'admin': '管理员发放',
      'instructor_reward': '授课奖励'
    };
    ticket.source_text = sourceTexts[ticket.source] || ticket.source;

    // 格式化购买时间
    if (ticket.purchased_at) {
      ticket.purchase_date = moment(ticket.purchased_at).format('YYYY-MM-DD HH:mm:ss');
      ticket.purchased_at_formatted = ticket.purchase_date;
    } else if (ticket.created_at) {
      ticket.purchase_date = moment(ticket.created_at).format('YYYY-MM-DD HH:mm:ss');
      ticket.purchased_at_formatted = ticket.purchase_date;
    } else {
      ticket.purchase_date = null;
      ticket.purchased_at_formatted = '暂无购买时间';
    }

    // 格式化有效期
    if (ticket.start_date && ticket.expiry_date) {
      const startDate = moment(ticket.start_date).format('YYYY-MM-DD');
      const endDate = moment(ticket.expiry_date).format('YYYY-MM-DD');
      ticket.expiry_date_formatted = endDate;
      ticket.expiry_date_range = startDate + '至' + endDate;
      ticket.validity_period = startDate + ' 至 ' + endDate;
    } else if (ticket.expiry_date) {
      ticket.expiry_date_formatted = moment(ticket.expiry_date).format('YYYY-MM-DD');
      ticket.expiry_date_range = '至' + ticket.expiry_date_formatted;
      ticket.validity_period = '至 ' + ticket.expiry_date_formatted;
    } else if (ticket.purchased_at) {
      // 如果没有有效期但有购买时间，计算3个月有效期
      const purchaseDate = moment(ticket.purchased_at);
      const startDate = purchaseDate.format('YYYY-MM-DD');
      const endDate = purchaseDate.clone().add(3, 'months').format('YYYY-MM-DD');
      ticket.expiry_date_formatted = endDate;
      ticket.expiry_date_range = startDate + '至' + endDate;
      ticket.validity_period = startDate + ' 至 ' + endDate;
    } else {
      ticket.expiry_date_formatted = null;
      ticket.expiry_date_range = '暂无有效期';
      ticket.validity_period = '暂无有效期';
    }

    // 格式化使用时间
    if (ticket.used_at) {
      ticket.used_date = moment(ticket.used_at).format('YYYY-MM-DD HH:mm:ss');
      ticket.used_at_formatted = ticket.used_date;
    } else {
      ticket.used_date = null;
      ticket.used_at_formatted = null;
    }

    // 如果是已预订或已使用状态，获取课程信息
    if (ticket.status === 'booked' || ticket.status === 'used') {
      const [bookings] = await db.query(
        `SELECT cb.*,
                cs.schedule_date, cs.time_slot, cs.start_time, cs.end_time,
                cs.current_students, cs.max_students,
                c.id as course_id, c.title as course_title, c.subtitle as course_subtitle,
                ct.name as theme_name,
                u_instructor.nickname as instructor_name, u_instructor.avatar_url as instructor_avatar
         FROM course_bookings cb
         JOIN course_schedules cs ON cb.schedule_id = cs.id
         JOIN courses c ON cs.course_id = c.id
         JOIN course_themes ct ON c.theme_id = ct.id
         JOIN users u_instructor ON c.instructor_id = u_instructor.id
         WHERE cb.ticket_id = ?
         ORDER BY cb.booked_at DESC
         LIMIT 1`,
        [id]
      );

      if (bookings.length > 0) {
        const booking = bookings[0];
        
        // 格式化课程日期和时间
        const scheduleDate = moment(booking.schedule_date);
        let dateTimeText = scheduleDate.format('YYYY-MM-DD');
        let timeText = '';
        
        if (booking.time_slot === 'full_day') {
          timeText = '全天';
        } else if (booking.time_slot === 'morning') {
          timeText = '上午';
        } else if (booking.time_slot === 'afternoon') {
          timeText = '下午';
        }

        if (booking.start_time && booking.end_time) {
          const start = moment(booking.start_time, 'HH:mm:ss').format('H');
          const end = moment(booking.end_time, 'HH:mm:ss').format('H');
          timeText += '（' + start + '-' + end + '点）';
        } else {
          if (booking.time_slot === 'morning') {
            timeText += '（9-12点）';
          } else if (booking.time_slot === 'afternoon') {
            timeText += '（14-17点）';
          } else if (booking.time_slot === 'full_day') {
            timeText += '（9-17点）';
          }
        }

        ticket.course_info = {
          booking_id: booking.id,
          course_id: booking.course_id,
          course_title: booking.course_title,
          course_subtitle: booking.course_subtitle || '',
          theme_name: booking.theme_name,
          instructor_name: booking.instructor_name,
          instructor_avatar: booking.instructor_avatar,
          schedule_date: booking.schedule_date,
          date_time_text: dateTimeText + ' ' + timeText,
          time_slot: booking.time_slot,
          current_students: booking.current_students,
          max_students: booking.max_students,
          booked_at: booking.booked_at ? moment(booking.booked_at).format('YYYY-MM-DD HH:mm:ss') : null,
          booking_status: booking.status
        };
      }
    }

    // 如果是赠予状态，获取赠予信息
    if (ticket.status === 'gifted' && ticket.source_user_id) {
      const [givers] = await db.query(
        'SELECT id, nickname, member_id FROM users WHERE id = ?',
        [ticket.source_user_id]
      );
      if (givers.length > 0) {
        ticket.giver_info = {
          id: givers[0].id,
          nickname: givers[0].nickname,
          member_id: givers[0].member_id
        };
      }
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('获取课券详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 删除课券
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查课券是否存在
    const [tickets] = await db.query('SELECT * FROM tickets WHERE id = ?', [id]);
    if (tickets.length === 0) {
      return res.status(404).json({ error: '课券不存在' });
    }

    const ticket = tickets[0];

    // 检查是否有预订记录（包括所有状态的预订，包括已取消的）
    const [bookings] = await db.query(
      `SELECT id, status FROM course_bookings WHERE ticket_id = ?`,
      [id]
    );
    if (bookings.length > 0) {
      // 检查是否有活跃的预订（booked状态）
      const activeBookings = bookings.filter(b => b.status === 'booked');
      if (activeBookings.length > 0) {
        return res.status(400).json({ 
          error: '该课券有活跃的预订记录，无法删除。请先取消相关预订。' 
        });
      }
      // 如果有已完成或已取消的预订，也提示无法删除（因为需要保留历史记录）
      return res.status(400).json({ 
        error: `该课券存在${bookings.length}条预订记录（已完成或已取消），无法删除。如需删除，请先在预订管理页面删除相关预订记录。` 
      });
    }

    // 检查是否有发票记录（如果课券已被开票，通常不允许删除）
    // 发票表中的 ticket_ids 字段存储的是 JSON 格式的课券ID数组
    const [invoices] = await db.query('SELECT id, ticket_ids FROM invoices', []);
    const ticketIdToCheck = parseInt(id);
    const hasInvoice = invoices.some(invoice => {
      try {
        if (invoice.ticket_ids) {
          const ticketIds = typeof invoice.ticket_ids === 'string' 
            ? JSON.parse(invoice.ticket_ids) 
            : invoice.ticket_ids;
          return Array.isArray(ticketIds) && ticketIds.includes(ticketIdToCheck);
        }
      } catch (e) {
        console.error('解析发票课券ID失败:', e);
      }
      return false;
    });
    
    if (hasInvoice) {
      return res.status(400).json({ 
        error: '该课券已被开票，无法删除。' 
      });
    }

    // 删除课券
    // 注意：由于外键约束，如果有任何预订记录引用此课券，删除会失败
    // 我们已经在上面检查了预订记录，但为了安全，使用事务确保数据一致性
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // 再次确认没有预订记录（双重检查）
      const [finalCheck] = await connection.query(
        'SELECT COUNT(*) as count FROM course_bookings WHERE ticket_id = ?',
        [id]
      );
      if (finalCheck[0].count > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          error: '该课券存在预订记录，无法删除。请先删除相关预订记录。' 
        });
      }
      
      // 执行删除
      await connection.query('DELETE FROM tickets WHERE id = ?', [id]);
      
      await connection.commit();
      connection.release();
      
      res.json({ success: true, message: '删除成功' });
    } catch (txError) {
      await connection.rollback();
      connection.release();
      throw txError;
    }
  } catch (error) {
    console.error('删除课券错误:', error);
    
    // 检查是否是外键约束错误
    let errorMessage = '删除失败';
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_NO_REFERENCED_ROW_2') {
      errorMessage = '删除失败：该课券仍被其他数据引用（如预订记录），无法删除。请先处理相关数据。';
    } else if (error.message) {
      errorMessage = `删除失败：${error.message}`;
    }
    
    res.status(500).json({ error: errorMessage, details: error.message });
  }
});

module.exports = router;

