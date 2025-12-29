const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment-timezone');

// 获取用户课券列表
router.get('/list', async (req, res) => {
  try {
    const { user_id, status } = req.query;
    
    // 如果是已预订或已使用状态，需要JOIN课程预订表获取课程信息
    let query, params;
    if (status === 'booked') {
      // 已预订：使用 LEFT JOIN，确保所有 status='booked' 的课券都能显示
      // 只JOIN status='booked'的预订记录，排除已取消(cancelled)和已完成(completed)的记录
      // 使用子查询确保每张课券只返回最新的一个预订记录（如果有多条预订记录）
      query = `
        SELECT t.*, 
               cb.id as booking_id,
               cb.booked_at,
               cb.status as booking_status,
               cs.schedule_date,
               cs.time_slot,
               cs.start_time,
               cs.end_time,
               c.id as course_id,
               c.title as course_title,
               c.subtitle as course_subtitle,
               ct.name as theme_name,
               u_instructor.nickname as instructor_name
        FROM tickets t
        LEFT JOIN (
          SELECT cb1.*
          FROM course_bookings cb1
          INNER JOIN (
            SELECT ticket_id, MAX(booked_at) as max_booked_at
            FROM course_bookings
            WHERE status = 'booked'
            GROUP BY ticket_id
          ) cb2 ON cb1.ticket_id = cb2.ticket_id 
                AND cb1.booked_at = cb2.max_booked_at
                AND cb1.status = 'booked'
        ) cb ON t.id = cb.ticket_id
        LEFT JOIN course_schedules cs ON cb.schedule_id = cs.id
        LEFT JOIN courses c ON cs.course_id = c.id
        LEFT JOIN course_themes ct ON c.theme_id = ct.id
        LEFT JOIN users u_instructor ON c.instructor_id = u_instructor.id
        WHERE t.user_id = ? AND t.status = ?
        ORDER BY cb.booked_at DESC, t.created_at DESC
      `;
      params = [user_id, status];
    } else if (status === 'used') {
      // 已使用：查询用户已使用的课券，以及用户赠予出去且已被受赠人使用的课券
      // 1. 用户自己使用的课券（t.user_id = ? AND t.status = 'used'）
      // 2. 用户赠予出去且已被受赠人使用的课券：
      //    - 查询受赠人使用的课券（t_gift.source_user_id = ? AND t_gift.source = 'gift' AND t_gift.status = 'used'）
      //    - 通过t_gift.original_ticket_code查找原课券（t_original）
      //    - 返回原课券的信息（ID、ticket_code等），但使用赠予课券的使用信息（course、used_at等）
      query = `
        SELECT 
          -- 如果是赠予出去的课券，使用原课券的信息；否则使用当前课券的信息
          COALESCE(t_original.id, t.id) as id,
          COALESCE(t_original.ticket_code, t.ticket_code) as ticket_code,
          COALESCE(t_original.user_id, t.user_id) as user_id,
          COALESCE(t_original.source, t.source) as source,
          COALESCE(t_original.source_user_id, t.source_user_id) as source_user_id,
          -- 如果返回的是原课券（通过LEFT JOIN找到的），状态应该是'used'（因为已被使用），否则使用原课券的实际状态
          CASE WHEN t_original.id IS NOT NULL THEN 'used' ELSE COALESCE(t_original.status, t.status) END as status,
          COALESCE(t_original.purchase_amount, t.purchase_amount) as purchase_amount,
          COALESCE(t_original.actual_amount, t.actual_amount) as actual_amount,
          COALESCE(t_original.purchased_at, t.purchased_at) as purchased_at,
          COALESCE(t_original.start_date, t.start_date) as start_date,
          COALESCE(t_original.expiry_date, t.expiry_date) as expiry_date,
          COALESCE(t_original.invoice_status, t.invoice_status) as invoice_status,
          COALESCE(t_original.invoice_amount, t.invoice_amount) as invoice_amount,
          COALESCE(t_original.created_at, t.created_at) as created_at,
          COALESCE(t_original.updated_at, t.updated_at) as updated_at,
          COALESCE(t_original.gifted_at, t.gifted_at) as gifted_at,
          COALESCE(t_original.restrict_module_id, t.restrict_module_id) as restrict_module_id,
          COALESCE(t_original.restrict_theme_id, t.restrict_theme_id) as restrict_theme_id,
          COALESCE(t_original.restrict_course_id, t.restrict_course_id) as restrict_course_id,
          COALESCE(t_original.original_ticket_code, t.original_ticket_code) as original_ticket_code,
          COALESCE(t_original.discount_coupon_id, t.discount_coupon_id) as discount_coupon_id,
          -- 使用赠予课券的使用信息（课程、使用时间等）
          t.used_at,
          cb.id as booking_id,
          cb.booked_at,
          cb.status as booking_status,
          cs.schedule_date,
          cs.time_slot,
          cs.start_time,
          cs.end_time,
          c.id as course_id,
          c.title as course_title,
          c.subtitle as course_subtitle,
          ct.name as theme_name,
          u_instructor.nickname as instructor_name
        FROM tickets t
        LEFT JOIN course_bookings cb ON t.id = cb.ticket_id
        LEFT JOIN course_schedules cs ON cb.schedule_id = cs.id
        LEFT JOIN courses c ON cs.course_id = c.id
        LEFT JOIN course_themes ct ON c.theme_id = ct.id
        LEFT JOIN users u_instructor ON c.instructor_id = u_instructor.id
        -- 如果是赠予出去的课券，通过original_ticket_code查找原课券
        LEFT JOIN tickets t_original ON t.original_ticket_code = t_original.ticket_code 
          AND t_original.user_id = ?
          AND t.source = 'gift'
          AND t.source_user_id = ?
        WHERE (t.user_id = ? AND t.status = ?) 
           OR (t.source_user_id = ? AND t.source = 'gift' AND t.status = ?)
        ORDER BY t.used_at DESC, t.created_at DESC
      `;
      params = [user_id, user_id, user_id, status, user_id, status];
    } else if (status === 'gifted') {
      // 已赠送：查询用户赠送出去的课券（user_id = 赠送人ID 且 status = 'gifted'）
      // 原课券在赠送后，user_id 保持不变（仍然是赠送人的ID），status 改为 'gifted'
      // 需要关联接收人的信息（通过新创建的课券记录查找，该记录的 source_user_id = 赠送人ID）
      // 同时需要返回赠予课券的状态（t_received.status），以便显示赠予课券是否已被使用
      query = `
        SELECT 
          t_original.*,
          t_received.user_id as receiver_id,
          u_receiver.real_name as receiver_real_name,
          u_receiver.nickname as receiver_nickname,
          u_receiver.member_id as receiver_member_id,
          t_received.ticket_code as receiver_ticket_code,
          t_received.status as gift_status
        FROM tickets t_original
        LEFT JOIN tickets t_received ON t_original.ticket_code = t_received.original_ticket_code AND t_received.source = 'gift'
        LEFT JOIN users u_receiver ON t_received.user_id = u_receiver.id
        WHERE t_original.user_id = ? AND t_original.status = ?
        ORDER BY t_original.gifted_at DESC
      `;
      params = [user_id, status];
    } else {
      query = 'SELECT * FROM tickets WHERE user_id = ?';
      params = [user_id];

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC';
    }

    const [tickets] = await db.query(query, params);
    
    console.log(`[课券列表] 查询状态: ${status}, 返回记录数: ${tickets.length}`);
    
    // 为已开票的课券添加发票信息，并格式化数据
    // 使用 Promise.allSettled 确保即使某个课券处理失败，其他课券仍能返回
    const processedTicketsResults = await Promise.allSettled(tickets.map(async (ticket) => {
      // 如果是已预订状态，添加课程信息和预订时间
      if (status === 'booked') {
        console.log('[已预订课券] 处理课券:', {
          ticket_id: ticket.id,
          ticket_code: ticket.ticket_code,
          booking_id: ticket.booking_id,
          course_title: ticket.course_title,
          schedule_date: ticket.schedule_date
        });
        
        // 格式化预订时间
        ticket.booked_at_formatted = ticket.booked_at ? moment(ticket.booked_at).format('YYYY-MM-DD HH:mm:ss') : null;
        
        // 格式化课程日期和时间
        if (ticket.schedule_date) {
          const scheduleDate = moment(ticket.schedule_date);
          let timeText = '';
          if (ticket.time_slot === 'full_day') {
            timeText = '全天';
          } else if (ticket.time_slot === 'morning') {
            timeText = '上午';
          } else if (ticket.time_slot === 'afternoon') {
            timeText = '下午';
          }
          
          if (ticket.start_time && ticket.end_time) {
            const start = moment(ticket.start_time, 'HH:mm:ss').format('HH:mm');
            const end = moment(ticket.end_time, 'HH:mm:ss').format('HH:mm');
            timeText += ` ${start}-${end}`;
          } else {
            // 如果没有具体时间，使用默认时间
            if (ticket.time_slot === 'morning') {
              timeText += ' 09:00-12:00';
            } else if (ticket.time_slot === 'afternoon') {
              timeText += ' 14:00-17:00';
            } else if (ticket.time_slot === 'full_day') {
              timeText += ' 09:00-17:00';
            }
          }
          
          ticket.course_date_time = `${scheduleDate.format('YYYY-MM-DD')} ${timeText}`;
        } else {
          ticket.course_date_time = '暂无时间信息';
        }
        
        // 确保课程标题存在
        if (!ticket.course_title) {
          ticket.course_title = '暂无课程信息';
        }
      } else if (status === 'used') {
        // 如果是已使用状态，添加课程信息和上课时间
        console.log('[已使用课券] 处理课券:', {
          ticket_id: ticket.id,
          ticket_code: ticket.ticket_code,
          booking_id: ticket.booking_id,
          course_title: ticket.course_title,
          schedule_date: ticket.schedule_date,
          used_at: ticket.used_at
        });
        
        // 格式化使用时间
        ticket.used_at_formatted = ticket.used_at ? moment(ticket.used_at).format('YYYY-MM-DD HH:mm:ss') : null;
        
        // 格式化课程日期和时间
        if (ticket.schedule_date) {
          const scheduleDate = moment(ticket.schedule_date);
          let timeText = '';
          if (ticket.time_slot === 'full_day') {
            timeText = '全天';
          } else if (ticket.time_slot === 'morning') {
            timeText = '上午';
          } else if (ticket.time_slot === 'afternoon') {
            timeText = '下午';
          }
          
          if (ticket.start_time && ticket.end_time) {
            const start = moment(ticket.start_time, 'HH:mm:ss').format('HH:mm');
            const end = moment(ticket.end_time, 'HH:mm:ss').format('HH:mm');
            timeText += ` ${start}-${end}`;
          } else {
            // 如果没有具体时间，使用默认时间
            if (ticket.time_slot === 'morning') {
              timeText += ' 09:00-12:00';
            } else if (ticket.time_slot === 'afternoon') {
              timeText += ' 14:00-17:00';
            } else if (ticket.time_slot === 'full_day') {
              timeText += ' 09:00-17:00';
            }
          }
          
          ticket.course_date_time = `${scheduleDate.format('YYYY-MM-DD')} ${timeText}`;
        } else {
          ticket.course_date_time = '暂无时间信息';
        }
        
        // 确保课程标题存在
        if (!ticket.course_title) {
          ticket.course_title = '暂无课程信息';
        }
        
        // 检查是否可以开票
        // 对于已使用状态的课券：
        // 1. 如果返回的是原课券（通过LEFT JOIN找到的），ticket.user_id是原课券的user_id，如果等于当前用户ID，说明是赠予人，可以开票
        // 2. 如果返回的是赠予课券本身（source = 'gift'），受赠人不能开票，只有赠予人（source_user_id）可以开票
        // 3. 对于用户自己使用的普通课券，可以开票
        if (ticket.source === 'gift' && ticket.source_user_id) {
          // 如果是赠予课券，只有赠予人可以开票
          ticket.can_invoice = parseInt(ticket.source_user_id) === parseInt(user_id);
        } else {
          // 原课券或普通课券，只有拥有者可以开票
          ticket.can_invoice = parseInt(ticket.user_id) === parseInt(user_id);
        }
      } else if (status === 'gifted') {
        // 如果是已赠送状态，格式化赠送时间（转换为北京时间）
        ticket.gifted_at_formatted = ticket.gifted_at ? moment.tz(ticket.gifted_at, 'Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss') : null;
        
        // 设置赠予课券的状态：如果 gift_status 为 NULL，说明还没有被领取或不存在，默认为 'waiting'
        // 如果 gift_status 有值，则使用该值（如 'unused', 'booked', 'used', 'expired'）
        if (!ticket.gift_status) {
          ticket.gift_status = 'waiting'; // 等待领取
        }
        
        // 格式化有效期
        if (ticket.start_date && ticket.expiry_date) {
          const startDate = moment(ticket.start_date).format('YYYY-MM-DD');
          const endDate = moment(ticket.expiry_date).format('YYYY-MM-DD');
          ticket.expiry_date_range = `${startDate}至${endDate}`;
        } else if (ticket.expiry_date) {
          ticket.expiry_date_range = `至${moment(ticket.expiry_date).format('YYYY-MM-DD')}`;
        } else {
          ticket.expiry_date_range = '暂无有效期';
        }
        
        // 如果没有接收人信息，尝试通过 original_ticket_code 查找
        if (!ticket.receiver_real_name && !ticket.receiver_nickname && ticket.ticket_code) {
          try {
            const [receiverTickets] = await db.query(
              `SELECT t.*, u.real_name, u.nickname, u.member_id 
               FROM tickets t
               JOIN users u ON t.user_id = u.id
               WHERE t.original_ticket_code = ? AND t.source = 'gift'
               LIMIT 1`,
              [ticket.ticket_code]
            );
            if (receiverTickets.length > 0) {
              ticket.receiver_id = receiverTickets[0].user_id;
              ticket.receiver_real_name = receiverTickets[0].real_name || null;
              ticket.receiver_nickname = receiverTickets[0].nickname || null;
              ticket.receiver_member_id = receiverTickets[0].member_id || '';
              ticket.receiver_ticket_code = receiverTickets[0].ticket_code;
              // 更新赠予课券的状态
              if (!ticket.gift_status) {
                ticket.gift_status = receiverTickets[0].status || 'waiting';
              }
            }
          } catch (err) {
            console.error('查找接收人信息失败:', err);
          }
        }
        
        // 设置接收人显示名称（优先使用真实姓名）
        ticket.receiver_name = ticket.receiver_real_name || ticket.receiver_nickname || null;
      } else {
        // 非已预订状态，添加来源文本
        const sourceTexts = {
          'purchase': '自行购买',
          'gift': '他人赠予',
          'admin': '管理员发放',
          'instructor_reward': '授课奖励'
        };
        ticket.source_text = sourceTexts[ticket.source] || ticket.source;
        
        // 格式化有效期：显示为"开始日期至结束日期"的格式
        // 对于未使用课券，如果没有有效期，尝试根据购买时间计算（3个月有效期）
        if (ticket.start_date && ticket.expiry_date) {
          const startDate = moment(ticket.start_date).format('YYYY-MM-DD');
          const endDate = moment(ticket.expiry_date).format('YYYY-MM-DD');
          ticket.expiry_date_range = `${startDate}至${endDate}`;
        } else if (ticket.expiry_date) {
          // 如果没有开始日期，只显示结束日期
          ticket.expiry_date_range = `至${moment(ticket.expiry_date).format('YYYY-MM-DD')}`;
        } else if (ticket.purchased_at) {
          // 如果没有有效期但有购买时间，根据购买时间计算3个月有效期
          const purchaseDate = moment(ticket.purchased_at);
          const startDate = purchaseDate.format('YYYY-MM-DD');
          const endDate = purchaseDate.clone().add(3, 'months').format('YYYY-MM-DD');
          ticket.expiry_date_range = `${startDate}至${endDate}`;
        } else if (ticket.created_at) {
          // 如果没有购买时间和有效期，使用创建时间计算
          const createDate = moment(ticket.created_at);
          const startDate = createDate.format('YYYY-MM-DD');
          const endDate = createDate.clone().add(3, 'months').format('YYYY-MM-DD');
          ticket.expiry_date_range = `${startDate}至${endDate}`;
        } else {
          ticket.expiry_date_range = '暂无有效期';
        }
        
        // 添加购买时间（优先使用purchased_at，如果没有则使用created_at）
        if (ticket.purchased_at) {
          ticket.purchased_at_formatted = moment(ticket.purchased_at).format('YYYY-MM-DD HH:mm:ss');
        } else if (ticket.created_at) {
          ticket.purchased_at_formatted = moment(ticket.created_at).format('YYYY-MM-DD HH:mm:ss');
        } else {
          ticket.purchased_at_formatted = '暂无购买时间';
        }
        
        // 如果课券没有 start_date 和 expiry_date，但可以计算，则更新数据库（异步，不阻塞响应）
        if (!ticket.start_date && !ticket.expiry_date && ticket.purchased_at) {
          const purchaseDate = moment(ticket.purchased_at);
          const start_date = purchaseDate.format('YYYY-MM-DD');
          const expiry_date = purchaseDate.clone().add(3, 'months').format('YYYY-MM-DD');
          // 异步更新数据库，不等待完成
          db.query(
            'UPDATE tickets SET start_date = ?, expiry_date = ? WHERE id = ?',
            [start_date, expiry_date, ticket.id]
          ).catch(err => {
            console.error(`[课券列表] 更新课券${ticket.id}有效期失败:`, err);
          });
        }
        
        // 检查是否可以开票：如果课券是赠予的（source = 'gift'），受赠人（当前user_id）不能开票，只有赠予人（source_user_id）可以开票
        // 注意：当查询条件 WHERE t.user_id = ? 时，ticket.user_id 是当前查询用户（受赠人）的ID
        // 对于赠予课券，ticket.source_user_id 是赠予人的ID
        // 所以如果 ticket.user_id !== ticket.source_user_id，说明当前用户是受赠人，不能开票
        // 对于非已使用状态的课券，只有在已使用状态下才能开票，所以这里设为true（实际开票时会在后端再次检查）
        if (ticket.source === 'gift' && ticket.source_user_id) {
          ticket.can_invoice = false; // 受赠人不能开票
        } else {
          ticket.can_invoice = true;
        }
        
        console.log('[未使用课券] 格式化后的数据:', {
          ticket_code: ticket.ticket_code,
          purchased_at_formatted: ticket.purchased_at_formatted,
          expiry_date_range: ticket.expiry_date_range,
          start_date: ticket.start_date,
          expiry_date: ticket.expiry_date
        });
        
        // 保留获取时间字段（用于兼容）
        ticket.acquired_at = ticket.purchased_at_formatted;
      }
      
      if (ticket.invoice_status === 'issued') {
        // 查询关联的发票信息
        const [invoices] = await db.query(
          `SELECT id, invoice_number, status, created_at
           FROM invoices 
           WHERE user_id = ? 
           AND JSON_CONTAINS(ticket_ids, ?)
           ORDER BY created_at DESC 
           LIMIT 1`,
          [ticket.user_id, JSON.stringify(ticket.id)]
        );
        
        if (invoices.length > 0) {
          ticket.invoice_info = {
            id: invoices[0].id,
            invoice_number: invoices[0].invoice_number,
            status: invoices[0].status,
            created_at: invoices[0].created_at ? moment(invoices[0].created_at).format('YYYY-MM-DD HH:mm:ss') : null
          };
        }
      }
      
      // 统一处理 can_invoice 字段：如果还没有设置，则根据课券来源判断
      // 如果课券是赠予的（source = 'gift'），受赠人（ticket.user_id）不能开票，只有赠予人（ticket.source_user_id）可以开票
      // user_id 是当前查询用户的ID
      if (ticket.can_invoice === undefined) {
        if (ticket.source === 'gift' && ticket.source_user_id) {
          // 如果 ticket.source_user_id = user_id，说明当前用户是赠予人，可以开票
          // 如果 ticket.user_id = user_id 且 ticket.source_user_id != user_id，说明当前用户是受赠人，不能开票
          ticket.can_invoice = parseInt(ticket.source_user_id) === parseInt(user_id);
        } else {
          // 非赠予课券，可以根据状态判断是否可以开票
          // 只有已使用状态的课券可以开票
          ticket.can_invoice = ticket.status === 'used';
        }
      }
      
      return ticket;
    }));
    
    // 处理 Promise.allSettled 的结果，过滤掉失败的项
    const processedTickets = processedTicketsResults
      .map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`[课券列表] 处理课券失败 (索引 ${index}, ID: ${tickets[index]?.id}):`, result.reason);
          // 返回原始课券数据，至少保证基本数据能显示
          const originalTicket = tickets[index];
          if (originalTicket) {
            // 至少设置基本字段
            originalTicket.course_title = originalTicket.course_title || '暂无课程信息';
            originalTicket.course_date_time = originalTicket.course_date_time || '暂无时间信息';
            originalTicket.used_at_formatted = originalTicket.used_at ? moment(originalTicket.used_at).format('YYYY-MM-DD HH:mm:ss') : null;
            // 确保 can_invoice 字段也被设置
            if (originalTicket.can_invoice === undefined) {
              if (originalTicket.source === 'gift' && originalTicket.source_user_id) {
                originalTicket.can_invoice = false;
              } else {
                originalTicket.can_invoice = originalTicket.status === 'used';
              }
            }
            return originalTicket;
          }
          return null;
        }
      })
      .filter(ticket => ticket !== null);
    
    console.log(`[课券列表] 处理完成，成功: ${processedTickets.length}/${tickets.length}`);
    
    res.json({ success: true, data: processedTickets });
  } catch (error) {
    console.error('获取课券列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 购买课券
router.post('/purchase', async (req, res) => {
  try {
    const { user_id, quantity, discount_coupon_ids } = req.body;
    const ticket_price = 1500; // 单张课券价格
    
    // 处理优惠券ID：支持单个ID（向后兼容）或ID数组
    let discountCouponIds = [];
    if (discount_coupon_ids) {
      if (Array.isArray(discount_coupon_ids)) {
        discountCouponIds = discount_coupon_ids;
      } else {
        // 向后兼容：如果是单个ID，转换为数组
        discountCouponIds = [discount_coupon_ids];
      }
    }
    // 限制优惠券数量不能超过购买数量
    if (discountCouponIds.length > quantity) {
      return res.status(400).json({ 
        success: false, 
        error: `最多只能使用${quantity}张优惠券（与购买数量相同）` 
      });
    }

    // 检查是否首次购买（在插入tickets之前检查）
    const [user] = await db.query(
      'SELECT inviter_id, first_purchase_discount_applied FROM users WHERE id = ?', 
      [user_id]
    );
    let isFirstPurchase = false;
    let isFirstPurchaseDiscountApplicable = false;
    let inviter_id = user[0]?.inviter_id || null;
    let inviter_role = null;
    let first_purchase_discount_rate = null;
    let first_purchase_campaign_id = null;
    
    // 获取邀请人角色
    if (inviter_id) {
      const [inviterInfo] = await db.query('SELECT role FROM users WHERE id = ?', [inviter_id]);
      inviter_role = inviterInfo[0]?.role || null;
    }
    
    if (inviter_id) {
      const [existingPurchases] = await db.query(
        `SELECT COUNT(*) as count FROM tickets 
         WHERE user_id = ? AND source = 'purchase'`,
        [user_id]
      );
      isFirstPurchase = existingPurchases[0].count === 0;
      
      // 检查是否可以应用首次购买折扣（通过教练/渠道方邀请注册的，且未使用过）
      if (isFirstPurchase && 
          (inviter_role === 'instructor' || inviter_role === 'channel') && 
          !user[0].first_purchase_discount_applied) {
        // 重新查询邀请人当前有效的营销方案折扣比例
        try {
          const today = moment().format('YYYY-MM-DD');
          const [campaigns] = await db.query(
            `SELECT id, discount_rate FROM marketing_campaigns 
             WHERE user_id = ?
             AND status = 'active'
             AND (start_date IS NULL OR start_date <= ?)
             AND (end_date IS NULL OR end_date >= ?)
             ORDER BY created_at DESC 
             LIMIT 1`,
            [inviter_id, today, today]
          );
          
          if (campaigns.length > 0) {
            first_purchase_discount_rate = parseFloat(campaigns[0].discount_rate);
            first_purchase_campaign_id = campaigns[0].id;
            isFirstPurchaseDiscountApplicable = true;
            console.log(`✓ 找到邀请人 ${inviter_id} 当前有效的营销方案，折扣比例: ${first_purchase_discount_rate * 100}%，方案ID: ${first_purchase_campaign_id}`);
          } else {
            console.warn(`⚠ 未找到邀请人 ${inviter_id} 在当前时间（${today}）生效的激活营销方案，无法享受首次购买折扣`);
          }
        } catch (campaignError) {
          console.error('查询营销方案失败:', campaignError);
        }
      }
    }

    // 计算总金额（不含折扣券，因为折扣券只从第一张课券扣除）
    let total_amount = ticket_price * quantity;
    let discount_amount = 0;
    let first_purchase_discount_amount = 0;

    // 应用首次购买折扣（如果适用，优先于折扣券）
    // 首次购买折扣只从第一张课券扣除，不平均分摊
    if (isFirstPurchaseDiscountApplicable && first_purchase_discount_rate) {
      // 首次购买折扣只计算第一张课券的折扣金额
      first_purchase_discount_amount = Math.floor(ticket_price * first_purchase_discount_rate);
      console.log(`✓ 应用首次购买折扣: ${first_purchase_discount_rate * 100}%，第一张课券折扣金额: ${first_purchase_discount_amount}元，使用营销方案ID: ${first_purchase_campaign_id}`);
    }

    // 使用折扣券（在首次购买折扣之后）
    // 新逻辑：每张课券最多使用一张优惠券，按用户选择的顺序分配
    const usedCoupons = []; // 存储已使用的优惠券信息 [{id, amount}]
    
    if (discountCouponIds.length > 0) {
      // 查询所有优惠券信息
      const placeholders = discountCouponIds.map(() => '?').join(',');
      const [coupons] = await db.query(
        `SELECT * FROM discount_coupons WHERE id IN (${placeholders}) AND user_id = ? AND status = ?`, 
        [...discountCouponIds, user_id, 'unused']
      );
      
      if (coupons.length !== discountCouponIds.length) {
        return res.status(400).json({ 
          success: false, 
          error: '部分优惠券不存在或已被使用' 
        });
      }
      
      // 按照用户选择的顺序（discountCouponIds数组的顺序）分配优惠券
      // 创建一个映射以便快速查找优惠券信息
      const couponMap = {};
      coupons.forEach(coupon => {
        couponMap[coupon.id] = coupon;
      });
      
      // 为每张课券分配优惠券（按照用户选择的顺序，最多使用数量不超过购买数量）
      const maxCouponsToUse = Math.min(discountCouponIds.length, quantity);
      for (let i = 0; i < maxCouponsToUse; i++) {
        const couponId = discountCouponIds[i];
        const coupon = couponMap[couponId];
        if (coupon) {
          usedCoupons.push({
            id: coupon.id,
            amount: parseFloat(coupon.amount)
          });
          discount_amount += Math.min(coupon.amount, ticket_price); // 每张优惠券最多抵扣一张课券的价格
        }
      }
      
      // 标记所有使用的优惠券为已使用
      if (usedCoupons.length > 0) {
        const usedIds = usedCoupons.map(c => c.id);
        const updatePlaceholders = usedIds.map(() => '?').join(',');
        await db.query(
          `UPDATE discount_coupons SET status = ?, used_at = NOW() WHERE id IN (${updatePlaceholders})`, 
          ['used', ...usedIds]
        );
      }
    }

    // 创建课券记录
    // 课券有效期是三个月，自购买日开始
    const purchaseDate = moment(); // 购买日期
    const start_date = purchaseDate.format('YYYY-MM-DD'); // 有效期开始日期（购买日期）
    const expiry_date = purchaseDate.clone().add(3, 'months').format('YYYY-MM-DD'); // 有效期结束日期（购买日期 + 3个月）
    
    const tickets = []; // 存储创建的课券ID
    let final_total_amount = 0; // 总实际支付金额
    
    for (let i = 0; i < quantity; i++) {
      const ticket_code = 'T' + Date.now().toString() + i.toString().padStart(3, '0');
      
      // 为每张课券分配优惠券（第i张课券使用第i个优惠券，如果有的话）
      const couponForThisTicket = usedCoupons[i] || null;
      const discount_coupon_id_for_ticket = couponForThisTicket ? couponForThisTicket.id : null;
      const couponDiscountAmount = couponForThisTicket ? Math.min(couponForThisTicket.amount, ticket_price) : 0;
      
      // 计算每张课券的实际支付金额
      let ticket_actual_amount = ticket_price; // 默认是原价
      
      // 扣除优惠券金额（每张课券最多使用一张优惠券）
      if (couponDiscountAmount > 0) {
        ticket_actual_amount -= couponDiscountAmount;
      }
      
      // 如果有首次购买折扣，只从第一张课券扣除
      if (i === 0 && first_purchase_discount_amount > 0) {
        ticket_actual_amount -= first_purchase_discount_amount;
      }
      
      // 确保实际支付金额不为负数
      ticket_actual_amount = Math.max(0, ticket_actual_amount);
      
      // 累加总金额
      final_total_amount += ticket_actual_amount;
      
      console.log(`[第${i + 1}张课券] 原价: ${ticket_price}, 优惠券: ${couponDiscountAmount}, 首次购买折扣: ${i === 0 ? first_purchase_discount_amount : 0}, 实际支付: ${ticket_actual_amount}`);
      
      const [result] = await db.query(
        `INSERT INTO tickets (user_id, ticket_code, source, purchase_amount, actual_amount, 
         start_date, expiry_date, purchased_at, discount_coupon_id) 
         VALUES (?, ?, 'purchase', ?, ?, ?, ?, NOW(), ?)`,
        [user_id, ticket_code, ticket_price, ticket_actual_amount, start_date, expiry_date, discount_coupon_id_for_ticket]
      );
      tickets.push(result.insertId);
    }

    // 如果应用了首次购买折扣，标记为已使用
    if (isFirstPurchaseDiscountApplicable) {
      await db.query(
        'UPDATE users SET first_purchase_discount_applied = TRUE WHERE id = ?',
        [user_id]
      );
    }

    // 记录购买日志（包含折扣券ID数组和首次购买折扣）
    // 注意：每张课券最多使用一张优惠券，优惠券已记录在对应课券的discount_coupon_id字段中
    await db.query(
      `INSERT INTO operation_logs (user_id, action, table_name, record_id, data) 
       VALUES (?, 'purchase_tickets', 'tickets', ?, ?)`,
      [user_id, tickets[0], JSON.stringify({ 
        quantity, 
        total_amount: final_total_amount, // 总实际支付金额
        discount_amount,
        first_purchase_discount_amount,
        discount_coupon_ids: usedCoupons.map(c => c.id), // 记录所有使用的优惠券ID数组
        discount_coupons: usedCoupons.map((c, index) => ({
          coupon_id: c.id,
          coupon_amount: c.amount,
          applied_to_ticket_id: tickets[index] // 记录每张优惠券应用到的课券ID
        })),
        ticket_ids: tickets // 记录所有创建的课券ID
      })]
    );

    // 如果有邀请人且是首次购券，检查邀请人角色并发放奖励（仅普通会员邀请）
    if (user[0]?.inviter_id && isFirstPurchase) {
      // 获取邀请人角色和推广来源信息
      const [inviterInfo] = await db.query(
        'SELECT role, channel_user_id, nickname, real_name FROM users WHERE id = ?', 
        [user[0].inviter_id]
      );
      const inviter_role = inviterInfo[0]?.role;
      const inviter_channel_user_id = inviterInfo[0]?.channel_user_id;
      
      // 获取用户的推广来源信息
      const [purchaserInfo] = await db.query(
        'SELECT promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion FROM users WHERE id = ?',
        [user_id]
      );
      const promotion_type = purchaserInfo[0]?.promotion_type;
      const instructor_id_for_promotion = purchaserInfo[0]?.instructor_id_for_promotion;
      const instructor_name_for_promotion = purchaserInfo[0]?.instructor_name_for_promotion;
      const channel_name_for_promotion = purchaserInfo[0]?.channel_name_for_promotion;
      const channel_sales_id_for_promotion = purchaserInfo[0]?.channel_sales_id_for_promotion;
      const channel_sales_name_for_promotion = purchaserInfo[0]?.channel_sales_name_for_promotion;
      
      // 只有普通会员邀请（非渠道销售）才给邀请人发放购券奖励折扣券
      // 渠道销售邀请不发放购券奖励，因为渠道推广方案只奖励被邀请人
      if (inviter_role === 'member' && !inviter_channel_user_id) {
      // 使用事务确保折扣券创建和邀请记录更新的原子性
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // 检查是否已经发放过购券奖励（避免重复发放）
        const [existingCoupons] = await connection.query(
          'SELECT id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
          [user[0].inviter_id, 'invite_purchase', user_id]
        );

        if (existingCoupons.length === 0) {
          // 查找会员推广方案配置，按照方案配置发放购券奖励
          const { generateDiscountCode } = require('../utils/discountCode');
          
          const [memberSchemes] = await connection.query(
            'SELECT * FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
            ['member_invite', 'active']
          );
          
          if (memberSchemes.length > 0) {
            const scheme = memberSchemes[0];
            const inviterPurchaseAmount = parseFloat(scheme.member_inviter_purchase_amount) || 500;
            const inviterExpiryDays = parseInt(scheme.inviter_expiry_days) || 90;
            
            if (inviterPurchaseAmount > 0) {
              const discount_code = await generateDiscountCode();
              const expiry_date = moment().add(inviterExpiryDays, 'days').format('YYYY-MM-DD');
              
              await connection.query(
                `INSERT INTO discount_coupons (discount_code, user_id, amount, source, source_user_id, start_date, expiry_date, status,
                 promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion) 
                 VALUES (?, ?, ?, 'invite_purchase', ?, CURDATE(), ?, 'unused', ?, ?, ?, ?, ?, ?)`,
                [discount_code, user[0].inviter_id, inviterPurchaseAmount, user_id, expiry_date,
                 promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion]
              );
              console.log(`✓ 已为邀请人 ${user[0].inviter_id} 发放购券奖励折扣券：金额¥${inviterPurchaseAmount}，有效期${inviterExpiryDays}天，被邀请人: ${user_id}（按照会员推广方案配置）`);
            }
          } else {
            console.warn(`⚠ 未找到激活的会员推广方案，无法发放购券奖励`);
          }
        } else {
          console.log(`⚠ 邀请人 ${user[0].inviter_id} 已收到被邀请人 ${user_id} 的购券奖励，跳过重复发放`);
        }

        // 更新邀请记录（使用inviter_id匹配，不依赖invite_code，因为invite_code可能是member_id或instructor_id）
        await connection.query(
          'UPDATE invitations SET status = ?, purchased_at = NOW() WHERE inviter_id = ? AND invitee_id = ?',
          ['purchased', user[0].inviter_id, user_id]
        );

        // 创建消息提醒给邀请人
        try {
          // 获取被邀请人信息
          const [purchaser] = await connection.query(
            'SELECT real_name, nickname, member_id FROM users WHERE id = ?',
            [user_id]
          );
          
          if (purchaser.length > 0) {
            const inviteeName = purchaser[0].real_name || purchaser[0].nickname || '新用户';
            const inviteeMemberId = purchaser[0].member_id || '';
            
            // 获取购券奖励金额（用于消息提示）
            let purchaseRewardAmount = 500; // 默认值
            const [schemes] = await connection.query(
              'SELECT member_inviter_purchase_amount FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
              ['member_invite', 'active']
            );
            if (schemes.length > 0) {
              purchaseRewardAmount = parseFloat(schemes[0].member_inviter_purchase_amount) || 500;
            }
            
            // 创建邀请购券成功消息
            await connection.query(
              `INSERT INTO system_messages (user_id, type, title, content, published, created_at) 
               VALUES (?, ?, ?, ?, 1, NOW())`,
              [
                user[0].inviter_id,
                'invite_reward',
                '邀请成功！获得购券奖励',
                `恭喜！您邀请的会员${inviteeName}${inviteeMemberId ? '（' + inviteeMemberId + '）' : ''}已成功购买课程，您已获得${purchaseRewardAmount}元折扣券奖励，可在"我的折扣券"中查看使用。`
              ]
            );
            console.log(`✓ 已为邀请人 ${user[0].inviter_id} 创建购券奖励消息提醒`);
          }
        } catch (messageError) {
          console.error('创建消息提醒失败:', messageError);
          // 消息创建失败不影响购券流程，只记录错误
        }

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        console.error('发放购券奖励失败:', error);
        // 不抛出错误，避免影响购券流程
      } finally {
        connection.release();
      }
      } else if (inviter_role === 'instructor' || inviter_role === 'channel') {
        // 教练/渠道方邀请：不发放折扣券，但更新邀请记录
        try {
          await db.query(
            'UPDATE invitations SET status = ?, purchased_at = NOW() WHERE inviter_id = ? AND invitee_id = ?',
            ['purchased', user[0].inviter_id, user_id]
          );
          console.log(`✓ 教练/渠道方 ${user[0].inviter_id} 的被邀请人 ${user_id} 首次购买完成，已更新邀请记录`);
        } catch (error) {
          console.error('更新邀请记录失败:', error);
        }
      }
    }
    
    // 更新营销方案统计数据
    if (inviter_id) {
      try {
        // 获取邀请码
        const [inviteInfo] = await db.query(
          'SELECT invite_code FROM invitations WHERE inviter_id = ? AND invitee_id = ? LIMIT 1',
          [inviter_id, user_id]
        );
        const invite_code = inviteInfo[0]?.invite_code || null;
        
        // 计算累计购买数量和金额（包含本次购买，使用原价）
        const [allTickets] = await db.query(
          `SELECT COUNT(*) as count, SUM(purchase_amount) as total_amount 
           FROM tickets WHERE user_id = ? AND source = 'purchase'`,
          [user_id]
        );
        const total_purchase_quantity = parseInt(allTickets[0]?.count || 0);
        const total_purchase_amount = parseFloat(allTickets[0]?.total_amount || 0);
        
        if (isFirstPurchase) {
          // 首次购买：更新首次购买相关字段
          await db.query(
            `UPDATE marketing_campaign_stats 
             SET first_purchase_at = NOW(),
                 first_purchase_quantity = ?,
                 first_purchase_amount = ?,
                 first_purchase_discount_amount = ?,
                 first_purchase_actual_amount = ?,
                 first_purchase_campaign_id = ?,
                 first_purchase_discount_rate = ?,
                 total_purchase_quantity = ?,
                 total_purchase_amount = ?,
                 updated_at = NOW()
             WHERE inviter_id = ? AND invitee_id = ?`,
            [
              quantity,
              original_amount,
              first_purchase_discount_amount,
              total_amount,
              first_purchase_campaign_id,
              first_purchase_discount_rate,
              total_purchase_quantity,
              total_purchase_amount,
              inviter_id,
              user_id
            ]
          );
          console.log(`✓ 更新营销方案统计：首次购买记录 - 邀请人 ${inviter_id}, 被邀请人 ${user_id}`);
        } else {
          // 非首次购买：只更新累计统计
          await db.query(
            `UPDATE marketing_campaign_stats 
             SET total_purchase_quantity = ?,
                 total_purchase_amount = ?,
                 updated_at = NOW()
             WHERE inviter_id = ? AND invitee_id = ?`,
            [
              total_purchase_quantity,
              total_purchase_amount,
              inviter_id,
              user_id
            ]
          );
        }
      } catch (statsError) {
        // 如果表不存在或更新失败，只记录警告，不影响购买流程
        console.warn(`更新营销方案统计失败: ${statsError.message}`);
      }
    }

    const final_discount_amount = discount_amount + first_purchase_discount_amount;
    res.json({ 
      success: true, 
      tickets, 
      total_amount, 
      discount_amount: final_discount_amount,
      first_purchase_discount_amount,
      coupon_discount_amount: discount_amount
    });
  } catch (error) {
    console.error('购买课券错误:', error);
    res.status(500).json({ error: '购买失败', details: error.message });
  }
});

// 赠予课券
router.post('/gift', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const { ticket_id, giver_id, receiver_member_id, restrict_module_id: input_module_id, restrict_theme_id: input_theme_id, restrict_course_id: input_course_id } = req.body;
    let restrict_module_id = input_module_id || null;
    let restrict_theme_id = input_theme_id || null;
    let restrict_course_id = input_course_id || null;

    // 检查接收人是否存在
    if (!receiver_member_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '请输入受赠人的会员编号' });
    }

    const [receivers] = await db.query('SELECT id FROM users WHERE member_id = ?', [receiver_member_id]);
    if (receivers.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: '受赠人会员编号不存在' });
    }

    const receiver_id = receivers[0].id;

    // 检查是否是自己
    if (parseInt(receiver_id) === parseInt(giver_id)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '不能赠予给自己' });
    }

    // 检查课券状态
    const [tickets] = await connection.query('SELECT * FROM tickets WHERE id = ? AND user_id = ?', 
      [ticket_id, giver_id]);
    
    if (tickets.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: '课券不存在' });
    }

    const ticket = tickets[0];

    // 检查是否可以赠予
    if (ticket.status === 'booked' || ticket.status === 'used') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '已被使用或占用的课券不能赠予' });
    }

    if (ticket.source === 'instructor_reward') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '授课奖励的课券不能赠予' });
    }
    
    if (ticket.source === 'gift') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '他人赠予的课券不能再次转赠' });
    }

    // 检查是否即将过期（3天内）
    if (ticket.expiry_date) {
      const daysToExpiry = moment(ticket.expiry_date).diff(moment(), 'days');
      if (daysToExpiry <= 3) {
        await connection.rollback();
        connection.release();
        return res.json({ 
          success: false, 
          warning: true, 
          message: '该课券即将在3天内过期，是否继续赠予？' 
        });
      }
    }

    // 如果设置了课程限制，验证课程是否存在并自动填充模块和主题
    if (restrict_course_id) {
      const [courses] = await connection.query(
        `SELECT c.id, c.theme_id, ct.module_id 
         FROM courses c
         JOIN course_themes ct ON c.theme_id = ct.id
         WHERE c.id = ?`,
        [restrict_course_id]
      );
      if (courses.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: '限定的课程不存在' });
      }
      
      // 如果设置了课程，自动填充对应的主题和模块
      const courseThemeId = courses[0].theme_id;
      const courseModuleId = courses[0].module_id;
      
      // 如果同时设置了主题，验证是否匹配
      if (restrict_theme_id && parseInt(restrict_theme_id) !== parseInt(courseThemeId)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: '限定的课程不属于限定的主题' });
      }
      
      // 如果同时设置了模块，验证是否匹配
      if (restrict_module_id && parseInt(restrict_module_id) !== parseInt(courseModuleId)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: '限定的课程不属于限定的模块' });
      }
      
      // 自动填充主题和模块ID
      restrict_theme_id = courseThemeId;
      restrict_module_id = courseModuleId;
    } else if (restrict_theme_id) {
      // 如果设置了主题限制，验证模块和主题的关联
      const [themes] = await connection.query(
        'SELECT module_id FROM course_themes WHERE id = ?',
        [restrict_theme_id]
      );
      if (themes.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: '限定的主题不存在' });
      }
      
      // 如果同时设置了模块和主题，验证它们是否匹配
      if (restrict_module_id) {
        if (parseInt(themes[0].module_id) !== parseInt(restrict_module_id)) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: '限定的主题不属于限定的模块' });
        }
      } else {
        // 如果只选择了主题而没有选择模块，自动填充主题所属的模块ID
        restrict_module_id = themes[0].module_id;
      }
    }

    // 1. 将原课券状态改为已赠送（保留 user_id，因为这是赠送人的ID，用于查询赠送出去的课券）
    await connection.query(
      `UPDATE tickets 
       SET status = ?, gift_status = ?, gifted_at = NOW() 
       WHERE id = ?`,
      [
        'gifted',              // 状态改为已赠送
        'unused',              // 赠送状态
        ticket_id
      ]
    );

    // 2. 为新受赠人创建新的课券记录
    // 生成新的课券编号
    const new_ticket_code = 'T' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // 确保有效期字段有值
    let start_date = ticket.start_date;
    let expiry_date = ticket.expiry_date;
    let purchased_at = ticket.purchased_at;
    
    // 如果没有有效期但有购买时间，计算3个月有效期
    if (!start_date && !expiry_date && purchased_at) {
      const purchaseDate = moment(purchased_at);
      start_date = purchaseDate.format('YYYY-MM-DD');
      expiry_date = purchaseDate.clone().add(3, 'months').format('YYYY-MM-DD');
    } else if (!start_date && purchased_at) {
      start_date = moment(purchased_at).format('YYYY-MM-DD');
    }
    
    // 插入新的课券记录（保存原课券编号）
    const giftTime = moment().format('YYYY-MM-DD HH:mm:ss');
    const [newTicketResult] = await connection.query(
      `INSERT INTO tickets (
        user_id, ticket_code, source, source_user_id,
        purchase_amount, actual_amount,
        start_date, expiry_date, purchased_at,
        restrict_module_id, restrict_theme_id, restrict_course_id,
        original_ticket_code,
        status, gifted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        receiver_id,              // 受赠人ID
        new_ticket_code,          // 新的课券编号
        'gift',                   // 来源：赠送
        giver_id,                 // 赠送人ID
        ticket.purchase_amount || 0,   // 继承原课券金额
        ticket.actual_amount || 0,     // 继承原课券实际支付金额
        start_date,               // 有效期开始
        expiry_date,              // 有效期结束
        purchased_at || null,     // 购买时间（原课券的购买时间）
        restrict_module_id || null,
        restrict_theme_id || null,
        restrict_course_id || null,
        ticket.ticket_code,       // 原课券编号
        'unused',                 // 新课券状态：未使用
        giftTime                  // 赠送时间
      ]
    );
    
    const new_ticket_id = newTicketResult.insertId;

    // 获取赠送人和受赠人信息用于系统消息
    const [giverInfo] = await connection.query(
      'SELECT nickname, real_name, member_id FROM users WHERE id = ?',
      [giver_id]
    );
    const [receiverInfo] = await connection.query(
      'SELECT nickname, real_name FROM users WHERE id = ?',
      [receiver_id]
    );

    const giverName = giverInfo[0]?.real_name || giverInfo[0]?.nickname || '一位用户';
    const giverMemberId = giverInfo[0]?.member_id || '';
    const receiverName = receiverInfo[0]?.real_name || receiverInfo[0]?.nickname || '您';

    // 构建限制条件描述
    let restrictionText = '';
    if (restrict_module_id || restrict_theme_id || restrict_course_id) {
      const restrictions = [];
      if (restrict_module_id) {
        const [modules] = await connection.query(
          'SELECT name FROM course_modules WHERE id = ?',
          [restrict_module_id]
        );
        if (modules.length > 0) {
          restrictions.push(`模块：${modules[0].name}`);
        }
      }
      if (restrict_theme_id) {
        const [themes] = await connection.query(
          'SELECT name FROM course_themes WHERE id = ?',
          [restrict_theme_id]
        );
        if (themes.length > 0) {
          restrictions.push(`主题：${themes[0].name}`);
        }
      }
      if (restrict_course_id) {
        const [courses] = await connection.query(
          'SELECT title FROM courses WHERE id = ?',
          [restrict_course_id]
        );
        if (courses.length > 0) {
          restrictions.push(`课程：${courses[0].title}`);
        }
      }
      if (restrictions.length > 0) {
        restrictionText = `\n\n使用限制：${restrictions.join('、')}`;
      }
    } else {
      restrictionText = '\n\n无使用限制，可用于预订任意课程。';
    }

    // 格式化有效期信息
    let validityText = '';
    if (ticket.start_date && ticket.expiry_date) {
      validityText = `${moment(ticket.start_date).format('YYYY-MM-DD')} 至 ${moment(ticket.expiry_date).format('YYYY-MM-DD')}`;
    } else if (ticket.expiry_date) {
      validityText = `至 ${moment(ticket.expiry_date).format('YYYY-MM-DD')}`;
    } else if (ticket.purchased_at) {
      const expiryDate = moment(ticket.purchased_at).add(3, 'months').format('YYYY-MM-DD');
      validityText = `${moment(ticket.purchased_at).format('YYYY-MM-DD')} 至 ${expiryDate}`;
    }

    // 创建系统消息通知受赠人
    const messageContent = `${giverName}${giverMemberId ? `（会员编号：${giverMemberId}）` : ''} 向您赠送了一张课券。\n\n` +
      `课券编号：${new_ticket_code}\n` +
      `课券金额：¥${parseFloat(ticket.purchase_amount || 0).toFixed(2)}\n` +
      (validityText ? `有效期：${validityText}\n` : '') +
      restrictionText;

    await connection.query(
      `INSERT INTO system_messages (user_id, type, title, content, published, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        receiver_id,
        'ticket_gift',
        '收到课券赠送',
        messageContent,
        1
      ]
    );

    await connection.commit();
    connection.release();

    // 获取赠送人信息
    const [givers] = await connection.query('SELECT member_id FROM users WHERE id = ?', [giver_id]);
    const giver_member_id = givers[0]?.member_id;

    res.json({ 
      success: true, 
      ticket_code: new_ticket_code,
      new_ticket_id: new_ticket_id,
      original_ticket_id: ticket_id,
      giver_member_id: giver_member_id,
      receiver_member_id: receiver_member_id
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('赠予课券错误:', error);
    res.status(500).json({ error: '赠予失败', details: error.message });
  }
});

// 领取赠予的课券
router.post('/receive-gift', async (req, res) => {
  try {
    const { user_id, giver_member_id, ticket_code } = req.body;

    // 查找赠予的课券
    const [users] = await db.query('SELECT id FROM users WHERE member_id = ?', [giver_member_id]);
    if (users.length === 0) {
      return res.status(404).json({ error: '赠予人不存在' });
    }

    const giver_id = users[0].id;
    const [tickets] = await db.query(
      'SELECT * FROM tickets WHERE ticket_code = ? AND source_user_id = ? AND status = ?',
      [ticket_code, giver_id, 'gifted']
    );

    if (tickets.length === 0) {
      return res.status(404).json({ error: '课券不存在或已被领取' });
    }

    // 转移课券所有权
    await db.query(
      'UPDATE tickets SET user_id = ?, status = ?, gift_status = ? WHERE id = ?',
      [user_id, 'unused', 'unused', tickets[0].id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('领取课券错误:', error);
    res.status(500).json({ error: '领取失败', details: error.message });
  }
});

// 开发票
router.post('/invoice', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { ticket_ids, invoice_header, tax_number, email } = req.body;

    if (!ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '请选择要开发票的课券' });
    }

    if (!invoice_header) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '请填写发票抬头' });
    }

    if (!email) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '请填写收发票邮箱' });
    }

    // 检查课券是否可以开发票（必须是已使用且未开票的）
    // 特殊处理：如果课券状态是'gifted'，但是存在关联的已使用的赠予课券（original_ticket_code匹配），则允许开票（这是赠予人为原课券开票的情况）
    // 同时查询优惠券信息（用于开票时记录留痕）
    const placeholders = ticket_ids.map(() => '?').join(',');
    const [tickets] = await connection.query(
      `SELECT t.*, dc.id as coupon_id, dc.amount as coupon_amount, dc.discount_code as coupon_code
       FROM tickets t
       LEFT JOIN discount_coupons dc ON t.discount_coupon_id = dc.id
       WHERE t.id IN (${placeholders}) 
       AND t.invoice_status = ?
       AND ((t.status = ? AND t.status != ?) OR (t.status = ? AND EXISTS(
         SELECT 1 FROM tickets t_gift 
         WHERE t_gift.original_ticket_code = t.ticket_code 
         AND t_gift.source = 'gift' 
         AND t_gift.status = 'used'
       )))`,
      [...ticket_ids, 'unissued', 'used', 'gifted', 'gifted']
    );
    
    // 移除重复的giftedCheck逻辑，因为查询条件已经处理了（允许状态为'gifted'但存在已使用赠予课券的原课券）
    
    if (tickets.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '没有可开发票的课券，请确保课券已使用且未开票' });
    }

    // 检查课券的归属和权限
    // 对于赠予课券（source = 'gift'），只有赠予人（source_user_id）可以开票
    // 对于普通课券，只有课券拥有者（user_id）可以开票
    // 需要从请求中获取user_id来验证权限
    const { user_id: request_user_id } = req.body;
    
    if (!request_user_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '缺少用户ID参数' });
    }
    
    // 检查所有课券的权限，并确定发票归属用户
    let invoiceUserId = null;
    for (const ticket of tickets) {
      if (ticket.source === 'gift' && ticket.source_user_id) {
        // 赠予课券：只有赠予人可以开票
        if (parseInt(request_user_id) !== parseInt(ticket.source_user_id)) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: '受赠人收到的课券不能开票，只有赠予人可以开票' });
        }
        // 确定发票归属：如果是赠予课券，发票归属赠予人
        if (!invoiceUserId) {
          invoiceUserId = ticket.source_user_id;
        } else if (parseInt(invoiceUserId) !== parseInt(ticket.source_user_id)) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: '所选课券必须属于同一用户' });
        }
      } else {
        // 普通课券：只有课券拥有者可以开票
        if (parseInt(request_user_id) !== parseInt(ticket.user_id)) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: '只能为自己的课券开票' });
        }
        // 确定发票归属：如果是普通课券，发票归属课券拥有者
        if (!invoiceUserId) {
          invoiceUserId = ticket.user_id;
        } else if (parseInt(invoiceUserId) !== parseInt(ticket.user_id)) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: '所选课券必须属于同一用户' });
        }
      }
    }
    
    // 如果所有课券都通过了权限检查，使用确定的发票归属用户ID
    if (!invoiceUserId) {
      invoiceUserId = request_user_id;
    }

    // 计算发票总金额
    // 注意：如果课券使用了优惠券（discount_coupon_id不为NULL），需要在该张课券下抵扣优惠券金额后再计算
    let total_amount = 0;
    let discount_coupon_info = null; // 记录使用的优惠券信息（用于记录留痕）
    
    for (const ticket of tickets) {
      let ticket_amount = parseFloat(ticket.actual_amount || ticket.purchase_amount || 0);
      
      // 如果该课券使用了优惠券，需要进一步处理
      if (ticket.discount_coupon_id) {
        // 查询优惠券信息（如果JOIN查询没有获取到，则单独查询）
        let coupon = null;
        if (ticket.coupon_id) {
          // 已经从JOIN查询中获取到优惠券信息
          coupon = {
            id: ticket.coupon_id,
            amount: ticket.coupon_amount,
            discount_code: ticket.coupon_code
          };
        } else {
          // 如果没有从JOIN获取到，单独查询
          const [coupons] = await connection.query(
            'SELECT id, amount, discount_code FROM discount_coupons WHERE id = ?',
            [ticket.discount_coupon_id]
          );
          if (coupons.length > 0) {
            coupon = coupons[0];
          }
        }
        
        if (coupon) {
          discount_coupon_info = {
            ticket_id: ticket.id,
            ticket_code: ticket.ticket_code,
            coupon_id: coupon.id,
            coupon_code: coupon.discount_code,
            coupon_amount: parseFloat(coupon.amount)
          };
          
          // actual_amount已经是扣除优惠券后的金额，所以直接使用即可
          // 这里主要是记录优惠券信息用于留痕
          console.log(`✓ 课券${ticket.ticket_code}使用了优惠券${coupon.discount_code}，金额${coupon.amount}元，课券实际支付金额${ticket_amount}元`);
        }
      }
      
      total_amount += ticket_amount;
    }

    // 获取课券编号
    const ticket_codes = tickets.map(t => t.ticket_code).join(',');

    // 生成唯一的发票申请编码
    // 格式：INV + 时间戳 + 3位随机数
    const generateApplicationCode = () => {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      return `INV${timestamp}${random}`;
    };

    let application_code = generateApplicationCode();
    // 确保申请编码唯一（检查数据库中是否已存在）
    let exists = true;
    let retries = 0;
    while (exists && retries < 10) {
      const [checkResult] = await connection.query(
        'SELECT id FROM invoices WHERE application_code = ?',
        [application_code]
      );
      if (checkResult.length === 0) {
        exists = false;
      } else {
        application_code = generateApplicationCode();
        retries++;
      }
    }

    // 创建发票记录
    const [invoiceResult] = await connection.query(
      `INSERT INTO invoices (application_code, user_id, invoice_header, tax_number, email, amount, ticket_ids, ticket_codes, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [application_code, invoiceUserId, invoice_header, tax_number || null, email, total_amount, JSON.stringify(ticket_ids), ticket_codes, 'pending']
    );

    const invoiceId = invoiceResult.insertId;

    // 更新课券发票状态
    // 注意：每张课券的invoice_amount应该是它自己的actual_amount，而不是总金额
    for (const ticket of tickets) {
      const ticket_actual_amount = parseFloat(ticket.actual_amount || ticket.purchase_amount || 0);
      await connection.query(
        'UPDATE tickets SET invoice_status = ?, invoice_amount = ? WHERE id = ?',
        ['issued', ticket_actual_amount, ticket.id]
      );
    }

    // 记录发票日志（包含优惠券信息，用于管理员后台记录留痕）
    const invoiceLogData = {
      ticket_ids,
      invoice_header,
      tax_number,
      email,
      total_amount
    };
    
    // 如果有优惠券信息，添加到日志中
    if (discount_coupon_info) {
      invoiceLogData.discount_coupon_info = discount_coupon_info;
      console.log(`✓ 发票${invoiceId}包含优惠券抵扣：课券${discount_coupon_info.ticket_code}使用了优惠券${discount_coupon_info.coupon_code}，金额${discount_coupon_info.coupon_amount}元`);
    }
    
    await connection.query(
      `INSERT INTO operation_logs (user_id, action, table_name, record_id, data) 
       VALUES (?, 'issue_invoice', 'invoices', ?, ?)`,
      [invoiceUserId, invoiceId, JSON.stringify(invoiceLogData)]
    );

    await connection.commit();
    connection.release();
    res.json({ success: true, invoice_id: invoiceId, total_amount });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('开发票错误:', error);
    res.status(500).json({ error: '开发票失败', details: error.message });
  }
});

// 获取课券统计
router.get('/stats', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    // 使用与管理员后台完全相同的统计逻辑：直接统计 t.status
    // 这样可以确保统计和列表完全一致
    // 参考：backend/routes/admin/tickets.js 的统计逻辑
    
    // 未使用课券：status = 'unused'
    const [unused] = await db.query(
      'SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND status = ?',
      [user_id, 'unused']
    );
    
    // 已预订课券：status = 'booked'（与管理员后台逻辑一致）
    const [booked] = await db.query(
      'SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND status = ?',
      [user_id, 'booked']
    );
    
    // 已使用课券：status = 'used'（与管理员后台逻辑一致）
    const [used] = await db.query(
      'SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND status = ?',
      [user_id, 'used']
    );

    const unusedCount = parseInt(unused[0].count) || 0;
    const bookedCount = parseInt(booked[0].count) || 0;
    const usedCount = parseInt(used[0].count) || 0;
    
    console.log('[课券统计API] 用户ID:', user_id);
    console.log('[课券统计API] 统计逻辑：直接统计 t.status');
    console.log('[课券统计API] 未使用:', unusedCount, '已预订:', bookedCount, '已使用:', usedCount);
    
    res.json({
      success: true,
      data: {
        unused: unusedCount,
        booked: bookedCount,
        used: usedCount
      }
    });
  } catch (error) {
    console.error('获取课券统计错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取课券详情（用户端）- 必须在 /stats 之后，避免路由冲突
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    // 查询课券基本信息（包括限制模块、主题和课程信息，以及优惠券信息）
    const [tickets] = await db.query(
      `SELECT t.*,
              u.nickname as user_name, 
              u.member_id as user_member_id, 
              u.phone as user_phone,
              cm.name as restrict_module_name,
              ct.name as restrict_theme_name,
              c_restrict.title as restrict_course_name,
              dc.id as coupon_id,
              dc.discount_code as coupon_code,
              dc.amount as coupon_amount,
              dc.source as coupon_source,
              dc.channel_name_for_promotion,
              dc.channel_sales_id_for_promotion,
              dc.channel_sales_name_for_promotion,
              dc.instructor_name_for_promotion
       FROM tickets t
       JOIN users u ON t.user_id = u.id
       LEFT JOIN course_modules cm ON t.restrict_module_id = cm.id
       LEFT JOIN course_themes ct ON t.restrict_theme_id = ct.id
       LEFT JOIN courses c_restrict ON t.restrict_course_id = c_restrict.id
       LEFT JOIN discount_coupons dc ON t.discount_coupon_id = dc.id
       WHERE t.id = ? AND t.user_id = ?`,
      [id, user_id]
    );

    if (tickets.length === 0) {
      return res.status(404).json({ error: '课券不存在或无权限查看' });
    }

    const ticket = tickets[0];
    
    // 调试：输出优惠券相关信息
    console.log(`[课券详情] 查询结果 - discount_coupon_id: ${ticket.discount_coupon_id}, coupon_id: ${ticket.coupon_id}, coupon_amount: ${ticket.coupon_amount}`);
    
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
      ticket.purchased_at_formatted = moment(ticket.purchased_at).format('YYYY-MM-DD HH:mm:ss');
    } else if (ticket.created_at) {
      ticket.purchased_at_formatted = moment(ticket.created_at).format('YYYY-MM-DD HH:mm:ss');
    } else {
      ticket.purchased_at_formatted = '暂无购买时间';
    }

    // 格式化有效期
    if (ticket.start_date && ticket.expiry_date) {
      const startDate = moment(ticket.start_date).format('YYYY-MM-DD');
      const endDate = moment(ticket.expiry_date).format('YYYY-MM-DD');
      ticket.expiry_date_range = startDate + '至' + endDate;
      ticket.validity_period = startDate + ' 至 ' + endDate;
    } else if (ticket.expiry_date) {
      ticket.expiry_date_range = '至' + moment(ticket.expiry_date).format('YYYY-MM-DD');
      ticket.validity_period = '至 ' + moment(ticket.expiry_date).format('YYYY-MM-DD');
    } else if (ticket.purchased_at) {
      // 如果没有有效期但有购买时间，计算3个月有效期
      const purchaseDate = moment(ticket.purchased_at);
      const startDate = purchaseDate.format('YYYY-MM-DD');
      const endDate = purchaseDate.clone().add(3, 'months').format('YYYY-MM-DD');
      ticket.expiry_date_range = startDate + '至' + endDate;
      ticket.validity_period = startDate + ' 至 ' + endDate;
    } else {
      ticket.expiry_date_range = '暂无有效期';
      ticket.validity_period = '暂无有效期';
    }

    // 格式化使用时间
    if (ticket.used_at) {
      ticket.used_at_formatted = moment(ticket.used_at).format('YYYY-MM-DD HH:mm:ss');
    } else {
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
         WHERE cb.ticket_id = ? AND cb.user_id = ?
         ORDER BY cb.booked_at DESC
         LIMIT 1`,
        [id, user_id]
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
          const start = moment(booking.start_time, 'HH:mm:ss').format('HH:mm');
          const end = moment(booking.end_time, 'HH:mm:ss').format('HH:mm');
          timeText += ` ${start}-${end}`;
        } else {
          if (booking.time_slot === 'morning') {
            timeText += ' 09:00-12:00';
          } else if (booking.time_slot === 'afternoon') {
            timeText += ' 14:00-17:00';
          } else if (booking.time_slot === 'full_day') {
            timeText += ' 09:00-17:00';
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
          date_time_text: dateTimeText + timeText,
          time_slot: booking.time_slot,
          current_students: booking.current_students,
          max_students: booking.max_students,
          booked_at: booking.booked_at ? moment(booking.booked_at).format('YYYY-MM-DD HH:mm:ss') : null,
          booking_status: booking.status
        };
      }
    }

    // 如果是已赠予状态（赠送人查看自己赠送出去的课券），获取受赠人信息和使用信息
    if (ticket.status === 'gifted' && ticket.ticket_code) {
      // 通过 original_ticket_code 查找受赠人创建的课券，获取受赠人信息和使用信息
      const [receiverTickets] = await db.query(
        `SELECT t.*, 
                u.id as receiver_id, 
                u.real_name as receiver_real_name, 
                u.nickname as receiver_nickname, 
                u.member_id as receiver_member_id,
                cb.id as booking_id,
                cb.booked_at,
                cb.status as booking_status,
                cs.schedule_date,
                cs.time_slot,
                cs.start_time,
                cs.end_time,
                c.id as course_id,
                c.title as course_title,
                c.subtitle as course_subtitle,
                ct.name as theme_name,
                u_instructor.nickname as instructor_name
         FROM tickets t
         JOIN users u ON t.user_id = u.id
         LEFT JOIN course_bookings cb ON t.id = cb.ticket_id
         LEFT JOIN course_schedules cs ON cb.schedule_id = cs.id
         LEFT JOIN courses c ON cs.course_id = c.id
         LEFT JOIN course_themes ct ON c.theme_id = ct.id
         LEFT JOIN users u_instructor ON c.instructor_id = u_instructor.id
         WHERE t.original_ticket_code = ? AND t.source = 'gift'
         LIMIT 1`,
        [ticket.ticket_code]
      );
      
      if (receiverTickets.length > 0) {
        const receiverTicket = receiverTickets[0];
        // 优先使用真实姓名，如果没有则使用昵称
        const receiverName = receiverTicket.receiver_real_name || receiverTicket.receiver_nickname || '未知用户';
        ticket.receiver_info = {
          id: receiverTicket.receiver_id,
          real_name: receiverTicket.receiver_real_name || null,
          nickname: receiverTicket.receiver_nickname || null,
          name: receiverName, // 显示名称（优先真实姓名）
          member_id: receiverTicket.receiver_member_id || ''
        };
        
        // 设置赠予课券的状态
        ticket.gift_status = receiverTicket.status || 'waiting';
        
        // 如果受赠人课券已使用，添加使用信息
        if (receiverTicket.status === 'used' && receiverTicket.used_at) {
          ticket.gift_used_at = receiverTicket.used_at;
          ticket.gift_used_at_formatted = moment(receiverTicket.used_at).format('YYYY-MM-DD HH:mm:ss');
          
          // 如果有课程信息，添加课程详情
          if (receiverTicket.course_id) {
            const scheduleDate = moment(receiverTicket.schedule_date);
            let dateTimeText = scheduleDate.format('YYYY-MM-DD');
            let timeText = '';
            
            if (receiverTicket.time_slot === 'full_day') {
              timeText = '全天';
            } else if (receiverTicket.time_slot === 'morning') {
              timeText = '上午';
            } else if (receiverTicket.time_slot === 'afternoon') {
              timeText = '下午';
            }
            
            if (receiverTicket.start_time && receiverTicket.end_time) {
              const start = moment(receiverTicket.start_time, 'HH:mm:ss').format('HH:mm');
              const end = moment(receiverTicket.end_time, 'HH:mm:ss').format('HH:mm');
              timeText += ` ${start}-${end}`;
            } else {
              if (receiverTicket.time_slot === 'morning') {
                timeText += ' 09:00-12:00';
              } else if (receiverTicket.time_slot === 'afternoon') {
                timeText += ' 14:00-17:00';
              } else if (receiverTicket.time_slot === 'full_day') {
                timeText += ' 09:00-17:00';
              }
            }
            
            ticket.gift_usage_info = {
              course_id: receiverTicket.course_id,
              course_title: receiverTicket.course_title,
              course_subtitle: receiverTicket.course_subtitle || null,
              theme_name: receiverTicket.theme_name || null,
              instructor_name: receiverTicket.instructor_name || null,
              schedule_date: receiverTicket.schedule_date,
              time_slot: receiverTicket.time_slot,
              start_time: receiverTicket.start_time,
              end_time: receiverTicket.end_time,
              date_time_text: `${dateTimeText} ${timeText}`
            };
          }
        } else if (receiverTicket.status === 'booked' && receiverTicket.booking_id) {
          // 如果已预订但未使用，添加预订信息
          ticket.gift_booking_info = {
            booking_id: receiverTicket.booking_id,
            booked_at: receiverTicket.booked_at,
            booked_at_formatted: receiverTicket.booked_at ? moment(receiverTicket.booked_at).format('YYYY-MM-DD HH:mm:ss') : null,
            course_id: receiverTicket.course_id,
            course_title: receiverTicket.course_title,
            course_subtitle: receiverTicket.course_subtitle || null,
            theme_name: receiverTicket.theme_name || null,
            instructor_name: receiverTicket.instructor_name || null,
            schedule_date: receiverTicket.schedule_date,
            time_slot: receiverTicket.time_slot,
            start_time: receiverTicket.start_time,
            end_time: receiverTicket.end_time
          };
          
          // 格式化预订的课程日期和时间
          if (receiverTicket.schedule_date) {
            const scheduleDate = moment(receiverTicket.schedule_date);
            let dateTimeText = scheduleDate.format('YYYY-MM-DD');
            let timeText = '';
            
            if (receiverTicket.time_slot === 'full_day') {
              timeText = '全天';
            } else if (receiverTicket.time_slot === 'morning') {
              timeText = '上午';
            } else if (receiverTicket.time_slot === 'afternoon') {
              timeText = '下午';
            }
            
            if (receiverTicket.start_time && receiverTicket.end_time) {
              const start = moment(receiverTicket.start_time, 'HH:mm:ss').format('HH:mm');
              const end = moment(receiverTicket.end_time, 'HH:mm:ss').format('HH:mm');
              timeText += ` ${start}-${end}`;
            }
            
            ticket.gift_booking_info.date_time_text = `${dateTimeText} ${timeText}`;
          }
        }
      }
      
      // 格式化赠予时间（转换为北京时间）
      if (ticket.gifted_at) {
        ticket.gifted_at_formatted = moment.tz(ticket.gifted_at, 'Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      }
    }
    
    // 如果是他人赠送的课券（受赠人查看接收到的课券），获取赠送人信息和限制信息
    if (ticket.source === 'gift' && ticket.source_user_id) {
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
      
      // 格式化赠予时间（转换为北京时间）
      if (ticket.gifted_at) {
        ticket.gifted_at_formatted = moment.tz(ticket.gifted_at, 'Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      }
      
      // 添加限制信息（如果有限制ID但没有名称，需要再次查询）
      if (ticket.restrict_module_id || ticket.restrict_theme_id || ticket.restrict_course_id) {
        ticket.restrictions = {};
        
        // 如果JOIN没有获取到名称，需要单独查询
        if (ticket.restrict_module_id && !ticket.restrict_module_name) {
          const [modules] = await db.query(
            'SELECT name FROM course_modules WHERE id = ?',
            [ticket.restrict_module_id]
          );
          if (modules.length > 0) {
            ticket.restrict_module_name = modules[0].name;
          }
        }
        
        if (ticket.restrict_theme_id && !ticket.restrict_theme_name) {
          const [themes] = await db.query(
            'SELECT name FROM course_themes WHERE id = ?',
            [ticket.restrict_theme_id]
          );
          if (themes.length > 0) {
            ticket.restrict_theme_name = themes[0].name;
          }
        }
        
        if (ticket.restrict_course_id && !ticket.restrict_course_name) {
          const [courses] = await db.query(
            'SELECT title FROM courses WHERE id = ?',
            [ticket.restrict_course_id]
          );
          if (courses.length > 0) {
            ticket.restrict_course_name = courses[0].title;
          }
        }
        
        // 设置限制信息
        if (ticket.restrict_module_name) {
          ticket.restrictions.module_name = ticket.restrict_module_name;
        }
        if (ticket.restrict_theme_name) {
          ticket.restrictions.theme_name = ticket.restrict_theme_name;
        }
        if (ticket.restrict_course_name) {
          ticket.restrictions.course_name = ticket.restrict_course_name;
        }
      }
    }

    // 如果有使用优惠券，添加优惠券信息
    if (ticket.discount_coupon_id) {
      console.log(`[课券详情] 课券使用了优惠券，discount_coupon_id=${ticket.discount_coupon_id}, coupon_id=${ticket.coupon_id}, coupon_amount=${ticket.coupon_amount}`);
      
      // 如果 JOIN 查询没有获取到优惠券信息，或者金额为空，单独查询
      if (!ticket.coupon_id || !ticket.coupon_amount) {
        console.log(`[课券详情] JOIN查询未获取到完整优惠券信息（coupon_id=${ticket.coupon_id}, coupon_amount=${ticket.coupon_amount}），单独查询优惠券ID=${ticket.discount_coupon_id}`);
        try {
          const [coupons] = await db.query(
            `SELECT id, discount_code, amount, source, 
                    channel_name_for_promotion, channel_sales_id_for_promotion, 
                    channel_sales_name_for_promotion, instructor_name_for_promotion
             FROM discount_coupons 
             WHERE id = ?`,
            [ticket.discount_coupon_id]
          );
          if (coupons.length > 0) {
            const coupon = coupons[0];
            ticket.coupon_id = coupon.id;
            ticket.coupon_code = coupon.discount_code;
            ticket.coupon_amount = coupon.amount;
            ticket.coupon_source = coupon.source;
            ticket.channel_name_for_promotion = coupon.channel_name_for_promotion;
            ticket.channel_sales_id_for_promotion = coupon.channel_sales_id_for_promotion;
            ticket.channel_sales_name_for_promotion = coupon.channel_sales_name_for_promotion;
            ticket.instructor_name_for_promotion = coupon.instructor_name_for_promotion;
            console.log(`[课券详情] 单独查询成功，优惠券金额=${coupon.amount}`);
          } else {
            console.warn(`[课券详情] 未找到优惠券ID=${ticket.discount_coupon_id}的记录`);
          }
        } catch (couponError) {
          console.error('[课券详情] 查询优惠券信息失败:', couponError);
        }
      }

      // 构建优惠券信息（只要有 discount_coupon_id 就构建，即使金额为0也显示）
      ticket.coupon_info = {
        id: ticket.coupon_id || null,
        discount_code: ticket.coupon_code || null,
        amount: parseFloat(ticket.coupon_amount || 0),
        source: ticket.coupon_source || null,
        channel_name: ticket.channel_name_for_promotion || null,
        channel_sales_id: ticket.channel_sales_id_for_promotion || null,
        channel_sales_name: ticket.channel_sales_name_for_promotion || null,
        instructor_name: ticket.instructor_name_for_promotion || null
      };
      
      // 生成优惠券来源文本
      const sourceTexts = {
        'invite_register': '邀请注册奖励',
        'instructor_invite': '教练邀请奖励',
        'channel_invite': '渠道邀请奖励',
        'admin_special': '特殊推广',
        'member_invite': '会员邀请奖励'
      };
      ticket.coupon_info.source_text = sourceTexts[ticket.coupon_source] || '优惠券';
      console.log(`[课券详情] 构建优惠券信息成功:`, JSON.stringify(ticket.coupon_info, null, 2));
    } else {
      console.log(`[课券详情] 课券未使用优惠券，discount_coupon_id=${ticket.discount_coupon_id}`);
    }

    res.json({ success: true, data: ticket });
  } catch (error) {
    console.error('获取课券详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

module.exports = router;

