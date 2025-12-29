const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const moment = require('moment');
const XLSX = require('xlsx');

// 获取课程预定列表
router.get('/', async (req, res) => {
  try {
    const { user_id, course_id, schedule_id, status, date, page = 1, pageSize = 20 } = req.query;
    
    let query = `
      SELECT cb.*, 
             u.nickname as user_nickname, 
             u.real_name as user_name,
             u.member_id as user_member_id, 
             u.phone as user_phone,
             cs.schedule_date, cs.time_slot, cs.start_time, cs.end_time,
             cs.current_students, cs.max_students,
             c.id as course_id, c.title as course_title, c.subtitle as course_subtitle,
             c.course_code,
             ct.name as theme_name,
             u_instructor.nickname as instructor_name, 
             u_instructor.instructor_id as instructor_number,
             u_instructor.avatar_url as instructor_avatar,
             t.id as ticket_id, t.ticket_code, t.status as ticket_status,
             cb.checkin_status, cb.checkin_time, cb.evaluation_status, cb.evaluation_time,
             e.id as evaluation_id, e.submitted_at as evaluation_submitted_at
      FROM course_bookings cb
      JOIN users u ON cb.user_id = u.id
      JOIN course_schedules cs ON cb.schedule_id = cs.id
      JOIN courses c ON cs.course_id = c.id
      JOIN course_themes ct ON c.theme_id = ct.id
      JOIN users u_instructor ON c.instructor_id = u_instructor.id
      LEFT JOIN tickets t ON cb.ticket_id = t.id
      LEFT JOIN evaluations e ON cb.user_id = e.user_id AND cb.schedule_id = e.schedule_id
      WHERE 1=1
    `;
    const params = [];

    // 筛选条件
    if (user_id) {
      query += ' AND cb.user_id = ?';
      params.push(user_id);
    }
    if (req.query.user_keyword) {
      query += ' AND (u.member_id LIKE ? OR u.nickname LIKE ? OR u.real_name LIKE ? OR u.phone LIKE ?)';
      const keyword = `%${req.query.user_keyword}%`;
      params.push(keyword, keyword, keyword, keyword);
    }
    if (course_id) {
      query += ' AND c.id = ?';
      params.push(course_id);
    }
    if (req.query.course_keyword) {
      query += ' AND (c.title LIKE ? OR c.subtitle LIKE ?)';
      const keyword = `%${req.query.course_keyword}%`;
      params.push(keyword, keyword);
    }
    if (schedule_id) {
      query += ' AND cb.schedule_id = ?';
      params.push(schedule_id);
    }
    if (status) {
      query += ' AND cb.status = ?';
      params.push(status);
    }
    if (date) {
      query += ' AND cs.schedule_date = ?';
      params.push(date);
    }

    // 获取总数 - 构建独立的count查询
    let countQuery = `
      SELECT COUNT(*) as total
      FROM course_bookings cb
      JOIN users u ON cb.user_id = u.id
      JOIN course_schedules cs ON cb.schedule_id = cs.id
      JOIN courses c ON cs.course_id = c.id
      JOIN course_themes ct ON c.theme_id = ct.id
      JOIN users u_instructor ON c.instructor_id = u_instructor.id
      LEFT JOIN tickets t ON cb.ticket_id = t.id
      LEFT JOIN evaluations e ON cb.user_id = e.user_id AND cb.schedule_id = e.schedule_id
      WHERE 1=1
    `;
    const countParams = [];
    
    // 应用相同的筛选条件
    if (user_id) {
      countQuery += ' AND cb.user_id = ?';
      countParams.push(user_id);
    }
    if (req.query.user_keyword) {
      countQuery += ' AND (u.member_id LIKE ? OR u.nickname LIKE ? OR u.real_name LIKE ? OR u.phone LIKE ?)';
      const keyword = `%${req.query.user_keyword}%`;
      countParams.push(keyword, keyword, keyword, keyword);
    }
    if (course_id) {
      countQuery += ' AND c.id = ?';
      countParams.push(course_id);
    }
    if (req.query.course_keyword) {
      countQuery += ' AND (c.title LIKE ? OR c.subtitle LIKE ?)';
      const keyword = `%${req.query.course_keyword}%`;
      countParams.push(keyword, keyword);
    }
    if (schedule_id) {
      countQuery += ' AND cb.schedule_id = ?';
      countParams.push(schedule_id);
    }
    if (status) {
      countQuery += ' AND cb.status = ?';
      countParams.push(status);
    }
    if (date) {
      countQuery += ' AND cs.schedule_date = ?';
      countParams.push(date);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

    // 分页
    query += ' ORDER BY cb.booked_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [bookings] = await db.query(query, params);

    // 格式化数据
    const processedBookings = bookings.map(booking => {
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
        timeText += `（${start}-${end}）`;
      } else {
        timeText += (booking.time_slot === 'morning' ? '（9-12）' : (booking.time_slot === 'afternoon' ? '（14-17）' : '（9-17）'));
      }

      // 处理签到状态（兼容旧数据）
      let checkinStatus = booking.checkin_status || 'pending';
      if (!booking.checkin_status) {
        checkinStatus = 'pending';
      }

      // 处理问卷状态
      let evaluationStatus = 'pending';
      if (booking.evaluation_id) {
        evaluationStatus = 'submitted';
      } else if (booking.evaluation_status) {
        evaluationStatus = booking.evaluation_status;
      }

      return {
        ...booking,
        date_time_text: `${dateTimeText} ${timeText}`,
        booked_at_formatted: moment(booking.booked_at).format('YYYY-MM-DD HH:mm:ss'),
        cancelled_at_formatted: booking.cancelled_at ? moment(booking.cancelled_at).format('YYYY-MM-DD HH:mm:ss') : null,
        checkin_status: checkinStatus,
        checkin_time_formatted: booking.checkin_time ? moment(booking.checkin_time).format('YYYY-MM-DD HH:mm:ss') : null,
        evaluation_status: evaluationStatus,
        evaluation_time_formatted: booking.evaluation_submitted_at || booking.evaluation_time 
          ? moment(booking.evaluation_submitted_at || booking.evaluation_time).format('YYYY-MM-DD HH:mm:ss') 
          : null
      };
    });

    res.json({
      success: true,
      data: processedBookings,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取课程预定列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 导出课程预定列表到Excel（必须在 /:id 路由之前）
router.get('/export/excel', async (req, res) => {
  try {
    const { user_id, course_id, schedule_id, status, date } = req.query;
    
    // 使用与列表查询相同的查询逻辑，但不分页
    let query = `
      SELECT cb.*, 
             u.nickname as user_nickname, 
             u.real_name as user_name,
             u.member_id as user_member_id, 
             u.phone as user_phone,
             cs.schedule_date, cs.time_slot, cs.start_time, cs.end_time,
             cs.current_students, cs.max_students,
             c.id as course_id, c.title as course_title, c.subtitle as course_subtitle,
             c.course_code,
             ct.name as theme_name,
             u_instructor.nickname as instructor_name, 
             u_instructor.instructor_id as instructor_number,
             t.id as ticket_id, t.ticket_code, t.status as ticket_status,
             cb.checkin_status, cb.checkin_time, cb.evaluation_status, cb.evaluation_time,
             e.id as evaluation_id, e.submitted_at as evaluation_submitted_at
      FROM course_bookings cb
      JOIN users u ON cb.user_id = u.id
      JOIN course_schedules cs ON cb.schedule_id = cs.id
      JOIN courses c ON cs.course_id = c.id
      JOIN course_themes ct ON c.theme_id = ct.id
      JOIN users u_instructor ON c.instructor_id = u_instructor.id
      LEFT JOIN tickets t ON cb.ticket_id = t.id
      LEFT JOIN evaluations e ON cb.user_id = e.user_id AND cb.schedule_id = e.schedule_id
      WHERE 1=1
    `;
    const params = [];

    // 应用相同的筛选条件
    if (user_id) {
      query += ' AND cb.user_id = ?';
      params.push(user_id);
    }
    if (req.query.user_keyword) {
      query += ' AND (u.member_id LIKE ? OR u.nickname LIKE ? OR u.real_name LIKE ? OR u.phone LIKE ?)';
      const keyword = `%${req.query.user_keyword}%`;
      params.push(keyword, keyword, keyword, keyword);
    }
    if (course_id) {
      query += ' AND c.id = ?';
      params.push(course_id);
    }
    if (req.query.course_keyword) {
      query += ' AND (c.title LIKE ? OR c.subtitle LIKE ?)';
      const keyword = `%${req.query.course_keyword}%`;
      params.push(keyword, keyword);
    }
    if (schedule_id) {
      query += ' AND cb.schedule_id = ?';
      params.push(schedule_id);
    }
    if (status) {
      query += ' AND cb.status = ?';
      params.push(status);
    }
    if (date) {
      query += ' AND cs.schedule_date = ?';
      params.push(date);
    }

    query += ' ORDER BY cb.booked_at DESC';

    const [bookings] = await db.query(query, params);

    // 格式化数据并准备Excel数据
    const excelData = bookings.map(booking => {
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
        timeText += `（${start}-${end}）`;
      } else {
        timeText += (booking.time_slot === 'morning' ? '（9-12）' : (booking.time_slot === 'afternoon' ? '（14-17）' : '（9-17）'));
      }

      // 处理签到状态
      let checkinStatus = booking.checkin_status || 'pending';
      if (!booking.checkin_status) {
        checkinStatus = 'pending';
      }
      const checkinStatusText = checkinStatus === 'checked_in' ? '已签到' : 
                                 checkinStatus === 'not_checked_in' ? '未签到' : '待签到';

      // 处理问卷状态
      let evaluationStatus = 'pending';
      if (booking.evaluation_id) {
        evaluationStatus = 'submitted';
      } else if (booking.evaluation_status) {
        evaluationStatus = booking.evaluation_status;
      }
      const evaluationStatusText = evaluationStatus === 'submitted' ? '已填写' : 
                                   evaluationStatus === 'not_submitted' ? '未填写' : '待填写';

      // 处理预定状态
      const statusText = booking.status === 'booked' ? '已预订' : 
                         booking.status === 'cancelled' ? '已取消' : 
                         booking.status === 'completed' ? '已完成' : booking.status;

      return {
        '课程编号': booking.course_code || '-',
        '课程名称': booking.course_title || '-',
        '授课老师': booking.instructor_name || '-',
        '授课老师编号': booking.instructor_number || '-',
        '上课时间': `${dateTimeText} ${timeText}`,
        '会员（报名人）名称': booking.user_name || booking.user_nickname || '-',
        '会员（报名人）编号': booking.user_member_id || '-',
        '会员手机号': booking.user_phone || '-',
        '预定时间': moment(booking.booked_at).format('YYYY-MM-DD HH:mm:ss'),
        '预定状态': statusText,
        '使用课券编码': booking.ticket_code || '-',
        '签到状态': checkinStatusText,
        '签到时间': booking.checkin_time ? moment(booking.checkin_time).format('YYYY-MM-DD HH:mm:ss') : '-',
        '问卷状态': evaluationStatusText,
        '问卷填写时间': (booking.evaluation_submitted_at || booking.evaluation_time) 
          ? moment(booking.evaluation_submitted_at || booking.evaluation_time).format('YYYY-MM-DD HH:mm:ss')
          : '-'
      };
    });

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 设置列宽
    const colWidths = [
      { wch: 15 },  // 课程编号
      { wch: 30 },  // 课程名称
      { wch: 12 },  // 授课老师
      { wch: 18 },  // 授课老师编号
      { wch: 25 },  // 上课时间
      { wch: 20 },  // 会员名称
      { wch: 18 },  // 会员编号
      { wch: 15 },  // 手机号
      { wch: 20 },  // 预定时间
      { wch: 12 },  // 预定状态
      { wch: 18 },  // 使用课券编码
      { wch: 12 },  // 签到状态
      { wch: 20 },  // 签到时间
      { wch: 12 },  // 问卷状态
      { wch: 20 }   // 问卷填写时间
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, '课程预定列表');

    // 生成Excel文件缓冲区
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 设置响应头
    const filename = `课程预定列表_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    // 发送文件
    res.send(excelBuffer);
  } catch (error) {
    console.error('导出Excel错误:', error);
    res.status(500).json({ error: '导出失败', details: error.message });
  }
});

// 获取预定详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [bookings] = await db.query(
      `SELECT cb.*, 
              u.id as user_id,
              u.nickname as user_nickname,
              u.real_name as user_name, 
              u.member_id as user_member_id, 
              u.phone as user_phone,
              cs.schedule_date, cs.time_slot, cs.start_time, cs.end_time,
              cs.current_students, cs.max_students,
              c.id as course_id, c.title as course_title, c.subtitle as course_subtitle,
              ct.name as theme_name,
              u_instructor.nickname as instructor_name, u_instructor.avatar_url as instructor_avatar,
              t.id as ticket_id,
              t.ticket_code, t.status as ticket_status
       FROM course_bookings cb
       JOIN users u ON cb.user_id = u.id
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       JOIN courses c ON cs.course_id = c.id
       JOIN course_themes ct ON c.theme_id = ct.id
       JOIN users u_instructor ON c.instructor_id = u_instructor.id
       LEFT JOIN tickets t ON cb.ticket_id = t.id
       WHERE cb.id = ?`,
      [id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: '预定记录不存在' });
    }

    const booking = bookings[0];
    
    // 格式化时间
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
      timeText += `（${start}-${end}）`;
    } else {
      timeText += (booking.time_slot === 'morning' ? '（9-12）' : (booking.time_slot === 'afternoon' ? '（14-17）' : '（9-17）'));
    }

    booking.date_time_text = `${dateTimeText} ${timeText}`;
    booking.booked_at_formatted = moment(booking.booked_at).format('YYYY-MM-DD HH:mm:ss');
    booking.cancelled_at_formatted = booking.cancelled_at ? moment(booking.cancelled_at).format('YYYY-MM-DD HH:mm:ss') : null;

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('获取预定详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 更新预定（管理员操作）
router.put('/:id', async (req, res) => {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { user_id, schedule_id, status, ticket_id, booked_at } = req.body;

    if (!user_id || !schedule_id || !status) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '缺少必要参数：user_id, schedule_id, status' });
    }

    // 查找预定记录
    const [bookings] = await connection.query(
      `SELECT cb.*, cs.schedule_date as old_schedule_date
       FROM course_bookings cb
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       WHERE cb.id = ?`,
      [id]
    );

    if (bookings.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: '预定记录不存在' });
    }

    const booking = bookings[0];
    const oldScheduleId = booking.schedule_id;
    const oldUserId = booking.user_id;
    const oldTicketId = booking.ticket_id;
    const oldStatus = booking.status;

    // 检查用户是否存在
    const [users] = await connection.query('SELECT id FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: '用户不存在' });
    }

    // 检查新排期是否存在
    const [newSchedules] = await connection.query(
      'SELECT * FROM course_schedules WHERE id = ?',
      [schedule_id]
    );

    if (newSchedules.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: '新排期不存在' });
    }

    const newSchedule = newSchedules[0];

    // 如果状态改为已预订，检查新排期是否还有空位
    if (status === 'booked') {
      // 计算当前排期的实际报名人数（排除当前预订记录，如果它在这个排期上）
      let currentCount = newSchedule.current_students;
      if (parseInt(oldScheduleId) === parseInt(schedule_id) && oldStatus === 'booked') {
        // 如果新排期就是旧排期，且旧状态是已预订，当前记录已经计算在内，不需要额外判断
      } else {
        // 如果切换到新排期，需要检查新排期是否有空位
        if (currentCount >= newSchedule.max_students) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: '新排期已满员' });
        }
      }
    }

    // 处理课券
    // 如果提供了课券ID，验证课券是否存在且可用
    if (ticket_id) {
      const [tickets] = await connection.query(
        'SELECT id, status, user_id FROM tickets WHERE id = ?',
        [ticket_id]
      );
      if (tickets.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: '课券不存在' });
      }
      const ticket = tickets[0];
      if (parseInt(ticket.user_id) !== parseInt(user_id)) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: '课券不属于该用户' });
      }
    }

    // 处理排期人数变化
    // 情况1: 排期没有变化
    if (parseInt(oldScheduleId) === parseInt(schedule_id)) {
      // 状态从已预订改为其他：人数减1
      if (oldStatus === 'booked' && status !== 'booked') {
        await connection.query(
          'UPDATE course_schedules SET current_students = current_students - 1 WHERE id = ?',
          [oldScheduleId]
        );
      }
      // 状态从其他改为已预订：人数加1
      else if (oldStatus !== 'booked' && status === 'booked') {
        await connection.query(
          'UPDATE course_schedules SET current_students = current_students + 1 WHERE id = ?',
          [schedule_id]
        );
      }
    }
    // 情况2: 排期发生变化
    else {
      // 如果旧状态是已预订，原排期人数减1
      if (oldStatus === 'booked') {
        await connection.query(
          'UPDATE course_schedules SET current_students = current_students - 1 WHERE id = ?',
          [oldScheduleId]
        );
      }
      
      // 如果新状态是已预订，新排期人数加1
      if (status === 'booked') {
        await connection.query(
          'UPDATE course_schedules SET current_students = current_students + 1 WHERE id = ?',
          [schedule_id]
        );
      }
    }
    
    // 如果用户发生变化，且旧状态是已预订
    if (parseInt(oldUserId) !== parseInt(user_id) && oldStatus === 'booked') {
      // 旧用户的排期人数不变（因为新用户会加回来）
      // 但需要从新排期角度考虑
      // 实际上上面的逻辑已经处理了
    }

    // 处理课券变化
    // 如果旧课券被替换，释放旧课券
    if (oldTicketId && parseInt(oldTicketId) !== parseInt(ticket_id || 0)) {
      await connection.query(
        'UPDATE tickets SET status = ? WHERE id = ?',
        ['unused', oldTicketId]
      );
    }
    
    // 如果新课券被使用，更新新课券状态
    if (ticket_id && status === 'booked') {
      if (parseInt(ticket_id) !== parseInt(oldTicketId || 0)) {
        await connection.query(
          'UPDATE tickets SET status = ? WHERE id = ?',
          ['booked', ticket_id]
        );
      }
    }

    // 构建更新字段
    const updateFields = ['user_id = ?', 'schedule_id = ?', 'status = ?'];
    const updateValues = [user_id, schedule_id, status];
    
    if (ticket_id !== undefined) {
      updateFields.push('ticket_id = ?');
      updateValues.push(ticket_id || null);
    }
    
    if (booked_at) {
      updateFields.push('booked_at = ?');
      updateValues.push(booked_at);
    }
    
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
      updateFields.push('cancelled_at = NOW()');
    } else if (status !== 'cancelled' && oldStatus === 'cancelled') {
      updateFields.push('cancelled_at = NULL');
    }
    
    updateValues.push(id);
    
    // 更新预定记录
    await connection.query(
      `UPDATE course_bookings SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    await connection.commit();
    connection.release();
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('更新预定错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

// 取消预定（管理员操作）
router.put('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // 查找预定记录
    const [bookings] = await db.query(
      `SELECT cb.*, cs.schedule_date
       FROM course_bookings cb
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       WHERE cb.id = ? AND cb.status = 'booked'`,
      [id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: '预定记录不存在或已取消' });
    }

    const booking = bookings[0];

    // 使用事务
    await db.query('START TRANSACTION');
    
    try {
      // 释放课券
      if (booking.ticket_id) {
        await db.query(
          'UPDATE tickets SET status = ? WHERE id = ?',
          ['unused', booking.ticket_id]
        );
      }

      // 更新预定状态
      await db.query(
        'UPDATE course_bookings SET status = ?, cancelled_at = NOW() WHERE id = ?',
        ['cancelled', id]
      );

      // 更新课程报名人数
      await db.query(
        'UPDATE course_schedules SET current_students = current_students - 1 WHERE id = ?',
        [booking.schedule_id]
      );

      // 获取课程信息
      const [scheduleInfo] = await db.query(
        `SELECT cs.schedule_date, c.title as course_title
         FROM course_schedules cs
         JOIN courses c ON cs.course_id = c.id
         WHERE cs.id = ?`,
        [booking.schedule_id]
      );

      // 发送系统消息通知用户
      if (scheduleInfo.length > 0) {
        const schedule = scheduleInfo[0];
        const dateStr = new Date(schedule.schedule_date).toLocaleDateString('zh-CN');
        
        await db.query(
          `INSERT INTO system_messages (user_id, type, title, content, published, created_at) 
           VALUES (?, ?, ?, ?, 1, NOW())`,
          [
            booking.user_id,
            'course_cancelled',
            '课程预订取消通知',
            `您的课程"${schedule.course_title}"（${dateStr}）预订已取消，课券已自动退还。如有疑问，请联系客服。`
          ]
        );
      }

      await db.query('COMMIT');
      res.json({ success: true, message: '取消成功' });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('取消预定错误:', error);
    res.status(500).json({ error: '取消失败', details: error.message });
  }
});

module.exports = router;

