const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { moment, now: getNow, today, normalizeDateString, isBefore, isAfter, isSame } = require('../utils/dateHelper');

// 获取课程模块列表（用户端）
router.get('/modules', async (req, res) => {
  try {
    const [modules] = await db.query(
      'SELECT id, module_code, name, description, sort_order FROM course_modules ORDER BY sort_order ASC, id ASC'
    );
    res.json({ success: true, data: modules });
  } catch (error) {
    console.error('获取课程模块错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取课程列表（用于选择）
router.get('/list', async (req, res) => {
  try {
    const { instructor_id } = req.query;
    console.log('[课程列表API] 收到请求, instructor_id:', instructor_id);
    
    let query = `
      SELECT c.id, c.title, c.subtitle, c.course_code, c.instructor_id as instructor_user_id,
              ct.name as theme_name,
              u.nickname as instructor_name
       FROM courses c
       JOIN course_themes ct ON c.theme_id = ct.id
       JOIN users u ON c.instructor_id = u.id
       WHERE 1=1
    `;
    const params = [];
    
    if (instructor_id) {
      query += ' AND c.instructor_id = ?';
      params.push(instructor_id);
    }
    
    query += ' ORDER BY c.created_at DESC';
    
    const [courses] = await db.query(query, params);
    console.log('[课程列表API] 返回课程数量:', courses.length);
    res.json({ success: true, data: courses });
  } catch (error) {
    console.error('[课程列表API] 获取课程列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取课程主题列表
router.get('/themes', async (req, res) => {
  try {
    const { module_id } = req.query;
    // 返回主题列表，包含模块信息（类似管理员后台的主题列表）
    // 游客模式下只返回激活的主题
    let query = `
      SELECT t.id, t.name, t.full_name, t.description, t.module_id, t.status, m.name as module_name
      FROM course_themes t
      JOIN course_modules m ON t.module_id = m.id
      WHERE 1=1
    `;
    const params = [];
    
    // 如果指定了module_id，只返回该模块下的主题
    if (module_id && module_id !== 'null' && module_id !== 'undefined' && module_id !== '') {
      query += ' AND t.module_id = ?';
      params.push(parseInt(module_id));
    }
    
    // 返回所有主题（包括未激活的），前端根据status字段显示不同样式
    query += ' ORDER BY t.id ASC';
    const [themes] = await db.query(query, params);
    console.log('[获取课程主题] 查询结果数量:', themes.length);
    console.log('[获取课程主题] 第一条数据示例:', themes[0] ? JSON.stringify(themes[0]) : '无数据');
    res.json({ success: true, data: themes });
  } catch (error) {
    console.error('获取课程主题错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取课程表
router.get('/schedule', async (req, res) => {
  try {
    const { module_id, theme_id, year_month, date, page = 1, pageSize = 20, user_id } = req.query;
    console.log('[课程表API] 请求参数:', { module_id, theme_id, year_month, date, page, pageSize, user_id });
    
    let query = `
      SELECT cs.*, 
             DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
             c.id as course_id, c.title, c.subtitle, c.course_code, c.instructor_id,
             u.nickname as instructor_name, u.avatar_url as instructor_avatar,
             ct.name as theme_name, ct.module_id,
             cm.name as module_name,
             cs.schedule_date, cs.time_slot, cs.start_time, cs.end_time
      FROM course_schedules cs
      JOIN courses c ON cs.course_id = c.id
      JOIN course_themes ct ON c.theme_id = ct.id
      JOIN course_modules cm ON ct.module_id = cm.id
      JOIN users u ON c.instructor_id = u.id
      WHERE 1=1
    `;
    const params = [];

    // 处理 module_id：排除 null、undefined、空字符串和字符串 "null"
    if (module_id && module_id !== 'null' && module_id !== 'undefined' && module_id !== '') {
      query += ' AND ct.module_id = ?';
      params.push(parseInt(module_id));
    }

    // 处理 theme_id：排除 null、undefined、空字符串和字符串 "null"
    if (theme_id && theme_id !== 'null' && theme_id !== 'undefined' && theme_id !== '') {
      query += ' AND c.theme_id = ?';
      params.push(parseInt(theme_id));
    }

    // 处理 year_month（年月筛选）：格式 YYYY-MM
    // 待开课（draft状态）没有日期，所以需要特殊处理
    if (year_month && year_month !== 'null' && year_month !== 'undefined' && year_month !== '') {
      query += ' AND (cs.status = \'draft\' OR DATE_FORMAT(cs.schedule_date, "%Y-%m") = ?)';
      params.push(year_month);
    } else if (date && date !== 'null' && date !== 'undefined' && date !== '') {
      // 向后兼容：如果提供了精确日期，使用精确日期筛选
      query += ' AND (cs.status = \'draft\' OR cs.schedule_date = ?)';
      params.push(date);
    }

    // 排序规则：待开课排在最前面，然后是未到开课时间的，最后是已开课的
    query += ` ORDER BY 
      CASE 
        WHEN cs.status = 'draft' THEN 0
        WHEN CONCAT(cs.schedule_date, ' ', COALESCE(cs.end_time, '23:59:59')) > NOW() THEN 1
        ELSE 2
      END ASC,
      cs.schedule_date ASC, 
      cs.start_time ASC`;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    console.log('[课程表API] 执行查询:', query);
    console.log('[课程表API] 查询参数:', params);

    const [schedules] = await db.query(query, params);
    console.log('[课程表API] 查询结果数量:', schedules.length);
    const todayDate = today();

    // 处理每个课程，添加格式化信息和状态
    const processedSchedules = await Promise.all(schedules.map(async (schedule) => {
      // 待开课（draft状态）没有日期和时间，直接返回"待开课"
      if (schedule.status === 'draft') {
        const instructorAvatar = schedule.instructor_avatar || null;
        
        // 检查用户是否感兴趣
        let is_interested = false;
        if (user_id) {
          try {
            const [interests] = await db.query(
              'SELECT id FROM schedule_interests WHERE user_id = ? AND schedule_id = ?',
              [user_id, schedule.id]
            );
            is_interested = interests.length > 0;
          } catch (tableError) {
            // 如果表不存在，默认为false（表还未创建）
            if (tableError.code !== 'ER_NO_SUCH_TABLE') {
              throw tableError;
            }
          }
        }
        
        return {
          ...schedule,
          date_time_text: '待开课',
          location: schedule.location || null, // 明确包含location字段
          is_past: false,
          booking_id: null,
          has_booking: false,
          can_book: false,
          can_cancel: false,
          instructor_avatar: instructorAvatar,
          is_own_course: false,
          is_interested: is_interested
        };
      }
      
      // 明确指定日期格式，避免时区问题（优先使用格式化后的日期）
      let dateTimeText = '';
      if (schedule.schedule_date_formatted) {
        dateTimeText = schedule.schedule_date_formatted;
      } else if (schedule.schedule_date) {
        const dateStr = schedule.schedule_date.toString();
        if (dateStr.includes('T')) {
          dateTimeText = dateStr.split('T')[0];
        } else if (dateStr.includes(' ')) {
          dateTimeText = dateStr.split(' ')[0];
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateTimeText = dateStr;
        } else {
          dateTimeText = moment(schedule.schedule_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        }
      }
      const scheduleDate = moment.tz(dateTimeText, 'YYYY-MM-DD', 'Asia/Shanghai');
      
      // 格式化日期和时间（已在上方处理）
      let timeText = '';
      if (schedule.time_slot === 'full_day') {
        timeText = '全天';
      } else if (schedule.time_slot === 'morning') {
        timeText = '上午';
      } else if (schedule.time_slot === 'afternoon') {
        timeText = '下午';
      }

      // 获取结束时间用于判断课程是否已结束
      let endTime = schedule.end_time || '17:00:00';
      if (!schedule.end_time) {
        // 如果没有结束时间，使用默认值
        const defaultEndTimes = {
          'morning': '12:00:00',
          'afternoon': '17:00:00',
          'full_day': '17:00:00'
        };
        endTime = defaultEndTimes[schedule.time_slot] || '17:00:00';
      }

      if (schedule.start_time && schedule.end_time) {
        // 格式化为 HH:mm-HH:mm
        const start = moment(schedule.start_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
        const end = moment(schedule.end_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
        timeText += ` ${start}-${end}`;
      } else {
        // 默认时间格式
        const defaultTimes = {
          'morning': '09:00-12:00',
          'afternoon': '14:00-17:00',
          'full_day': '09:00-17:00'
        };
        timeText += ` ${defaultTimes[schedule.time_slot] || '09:00-17:00'}`;
      }

      // 判断课程是否已结束：比较当前时间与课程结束时间
      const now = getNow();
      const endDateTime = moment.tz(`${dateTimeText} ${endTime}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
      // 如果当前时间已经超过或等于课程结束时间，则标记为已结束
      const isPast = now.isSameOrAfter(endDateTime);

      const dateTimeFormatted = `${dateTimeText} ${timeText}`;

      // 检查课程是否已经开始（当前时间是否超过课程开始时间）
      const startTime = schedule.start_time || '09:00:00';
      const startDateTimeStr = `${dateTimeText} ${startTime}`;
      const startDateTime = moment.tz(startDateTimeStr, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
      const isStarted = startDateTime.isValid() && (now.isAfter(startDateTime) || now.isSame(startDateTime));
      
      // 判断课程是否正在进行中（已开始但未结束）
      const isInProgress = isStarted && !isPast;

      // 检查用户是否已预订
      let bookingId = null;
      if (user_id) {
        const [bookings] = await db.query(
          'SELECT id FROM course_bookings WHERE user_id = ? AND schedule_id = ? AND status = ?',
          [user_id, schedule.id, 'booked']
        );
        if (bookings.length > 0) {
          bookingId = bookings[0].id;
        }
      }

      // 判断是否可以预订
      // 如果是教练自己的课程，不能预订
      // 如果课程已经开始，也不能预订
      // 注意：即使状态是 completed，只要课程还没开始，也应该允许预订（可能是状态被错误设置为 completed）
      const isOwnCourse = user_id && schedule.instructor_id && parseInt(user_id) === parseInt(schedule.instructor_id);
      const canBook = !isPast && 
                      !isStarted &&
                      (schedule.status === 'scheduled' || schedule.status === 'completed') && // 允许 completed 状态的课程在未开始时也可以预订
                      schedule.current_students < schedule.max_students &&
                      !bookingId &&
                      !isOwnCourse;

      // 判断是否可以取消（开课前3天，在开课前第三天的23:59:59之前）
      let canCancel = false;
      let hasBooking = false;
      if (bookingId && !isPast) {
        hasBooking = true;
        const cancelDeadline = scheduleDate.clone().subtract(3, 'days').startOf('day');
        const todayForCancel = today();
        // 允许在开课前3天（含）之前取消，即今天 <= cancelDeadline
        canCancel = todayForCancel.isBefore(cancelDeadline) || todayForCancel.isSame(cancelDeadline, 'day');
      } else if (bookingId && isPast) {
        hasBooking = true;
      }

      // 处理头像URL，如果为空则返回null
      const instructorAvatar = schedule.instructor_avatar || null;
      
      return {
        ...schedule,
        date_time_text: dateTimeFormatted,
        location: schedule.location || null, // 明确包含location字段
        is_past: isPast,
        is_started: isStarted,
        is_in_progress: isInProgress,
        booking_id: bookingId,
        has_booking: hasBooking,
        can_book: canBook,
        can_cancel: canCancel,
        instructor_avatar: instructorAvatar,
        is_own_course: isOwnCourse || false
      };
    }));

    console.log('[课程表API] 处理后的课程数量:', processedSchedules.length);
    res.json({ success: true, data: processedSchedules });
  } catch (error) {
    console.error('[课程表API] 获取课程表错误:', error);
    console.error('[课程表API] 错误堆栈:', error.stack);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取教练的授课列表（未完成和已完成课程）
router.get('/instructor/schedules', async (req, res) => {
  try {
    const { instructor_id } = req.query;
    
    if (!instructor_id) {
      return res.status(400).json({ error: '缺少教练ID' });
    }

    const todayDate = today();

    // 获取该教练的所有排课（包括未完成和已完成）
    const [schedules] = await db.query(
      `SELECT cs.*, 
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
              c.id as course_id, c.title, c.subtitle, c.course_code,
              ct.name as theme_name,
              COUNT(DISTINCT cb.id) as booking_count
       FROM course_schedules cs
       JOIN courses c ON cs.course_id = c.id
       JOIN course_themes ct ON c.theme_id = ct.id
       LEFT JOIN course_bookings cb ON cb.schedule_id = cs.id AND cb.status IN ('booked', 'completed')
       WHERE c.instructor_id = ?
       GROUP BY cs.id
       ORDER BY cs.schedule_date DESC, cs.start_time ASC`,
      [instructor_id]
    );
    
    // 处理签到状态（兼容旧数据）
    const processedSchedules = schedules.map(schedule => ({
      ...schedule,
      checkin_triggered: schedule.checkin_triggered === 1 || schedule.checkin_triggered === true || false,
      questionnaire_triggered: schedule.questionnaire_triggered === 1 || schedule.questionnaire_triggered === true || false
    }));

    // 处理排课数据，区分未完成和已完成
    const finalProcessedSchedules = processedSchedules.map(schedule => {
      // 明确指定日期格式，避免时区问题（优先使用格式化后的日期）
      let dateTimeText = '';
      if (schedule.schedule_date_formatted) {
        dateTimeText = schedule.schedule_date_formatted;
      } else if (schedule.schedule_date) {
        const dateStr = schedule.schedule_date.toString();
        if (dateStr.includes('T')) {
          dateTimeText = dateStr.split('T')[0];
        } else if (dateStr.includes(' ')) {
          dateTimeText = dateStr.split(' ')[0];
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateTimeText = dateStr;
        } else {
          dateTimeText = moment(schedule.schedule_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        }
      }
      // 检查课程是否已完成：只有状态是completed且结束时间已过，才显示为已完成
      let isCompleted = false;
      if (schedule.status === 'completed') {
        // 如果状态已经是completed，检查结束时间是否已过
        if (schedule.end_time) {
          const scheduleDate = moment(dateTimeText, 'YYYY-MM-DD', 'Asia/Shanghai');
          const endTimeStr = schedule.end_time.toString();
          const endDateTime = moment.tz(`${dateTimeText} ${endTimeStr}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
          const now = moment.tz('Asia/Shanghai');
          // 只有结束时间已过，才显示为已完成
          isCompleted = now.isAfter(endDateTime) || now.isSame(endDateTime);
        } else {
          // 如果没有结束时间，但状态是completed，也显示为已完成（兼容旧数据）
          isCompleted = true;
        }
      }

      // 格式化日期和时间（已在上方处理）
      let timeText = '';
      
      if (schedule.time_slot === 'full_day') {
        timeText = '全天';
      } else if (schedule.time_slot === 'morning') {
        timeText = '上午';
      } else if (schedule.time_slot === 'afternoon') {
        timeText = '下午';
      }

      if (schedule.start_time && schedule.end_time) {
        // 格式化为 HH:mm-HH:mm
        const start = moment(schedule.start_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
        const end = moment(schedule.end_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
        timeText += ` ${start}-${end}`;
      } else {
        // 默认时间格式
        const defaultTimes = {
          'morning': '09:00-12:00',
          'afternoon': '14:00-17:00',
          'full_day': '09:00-17:00'
        };
        timeText += ` ${defaultTimes[schedule.time_slot] || '09:00-17:00'}`;
      }

      return {
        ...schedule,
        schedule_date: dateTimeText, // 确保 schedule_date 是格式化后的字符串
        date_time_text: `${dateTimeText} ${timeText}`,
        location: schedule.location || null, // 明确包含location字段
        is_completed: isCompleted,
        booking_count: parseInt(schedule.booking_count) || 0
      };
    });

    // 分类：未完成和已完成
    const incomplete = finalProcessedSchedules.filter(s => !s.is_completed);
    const completed = finalProcessedSchedules.filter(s => s.is_completed);

    res.json({ 
      success: true, 
      data: {
        incomplete,
        completed
      }
    });
  } catch (error) {
    console.error('获取授课列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取排课详情（教练查看，包含报名人员列表）- 必须在 /:id/statistics 之前
router.get('/schedules/:id/detail', async (req, res) => {
  try {
    const { id } = req.params;
    const { instructor_id } = req.query;
    
    if (!instructor_id) {
      return res.status(400).json({ error: '缺少教练ID' });
    }

    // 获取排课信息
    const [schedules] = await db.query(
      `SELECT cs.*, 
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
              c.id as course_id, c.title, c.subtitle, c.course_code, c.instructor_id,
              ct.name as theme_name
       FROM course_schedules cs
       JOIN courses c ON cs.course_id = c.id
       JOIN course_themes ct ON c.theme_id = ct.id
       WHERE cs.id = ?`,
      [id]
    );

    if (schedules.length === 0) {
      return res.status(404).json({ error: '排课不存在' });
    }

    const schedule = schedules[0];

    // 验证权限：只有该课程的教练才能查看
    if (parseInt(schedule.instructor_id) !== parseInt(instructor_id)) {
      return res.status(403).json({ error: '无权查看此排课详情' });
    }

    // 格式化日期和时间
    // 明确指定日期格式，避免时区问题（优先使用格式化后的日期）
    let dateTimeText = '';
    if (schedule.schedule_date_formatted) {
      dateTimeText = schedule.schedule_date_formatted;
    } else if (schedule.schedule_date) {
      const dateStr = schedule.schedule_date.toString();
      // 如果是 ISO 格式（包含T），只取日期部分
      if (dateStr.includes('T')) {
        dateTimeText = dateStr.split('T')[0];
      }
      // 如果包含空格（日期时间格式），只取日期部分
      else if (dateStr.includes(' ')) {
        dateTimeText = dateStr.split(' ')[0];
      }
      // 如果已经是 YYYY-MM-DD 格式，直接使用
      else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dateTimeText = dateStr;
      }
      // 否则使用moment解析并格式化
      else {
        // 先解析日期，再转换时区
        const parsed = moment(schedule.schedule_date);
        dateTimeText = parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
      }
    }
    
    // 创建 scheduleDate 对象用于日期比较（使用东八区）
    // 如果 dateTimeText 是空字符串，使用当前日期
    const scheduleDate = dateTimeText ? moment.tz(dateTimeText, 'YYYY-MM-DD', 'Asia/Shanghai') : moment.tz('Asia/Shanghai');
    
    let timeText = '';
    if (schedule.time_slot === 'full_day') {
      timeText = '全天';
    } else if (schedule.time_slot === 'morning') {
      timeText = '上午';
    } else if (schedule.time_slot === 'afternoon') {
      timeText = '下午';
    }

    if (schedule.start_time && schedule.end_time) {
      // 格式化为 HH:mm-HH:mm
      const start = moment(schedule.start_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
      const end = moment(schedule.end_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
      timeText += ` ${start}-${end}`;
    } else {
      // 默认时间格式
      const defaultTimes = {
        'morning': '09:00-12:00',
        'afternoon': '14:00-17:00',
        'full_day': '09:00-17:00'
      };
      timeText += ` ${defaultTimes[schedule.time_slot] || '09:00-17:00'}`;
    }

    // 获取报名人员列表（包含签到状态）
    const [bookings] = await db.query(
      `SELECT cb.*, 
              u.id as user_id, u.nickname, u.real_name, u.phone, u.member_id,
              u.avatar_url, cb.checkin_status, cb.checkin_time
       FROM course_bookings cb
       JOIN users u ON cb.user_id = u.id
       WHERE cb.schedule_id = ? AND cb.status IN ('booked', 'completed')
       ORDER BY cb.booked_at ASC`,
      [id]
    );

    // 处理报名人员数据
    const enrolledUsers = bookings.map(booking => ({
      user_id: booking.user_id,
      nickname: booking.nickname || '未设置昵称',
      real_name: booking.real_name || '',
      phone: booking.phone || '',
      member_id: booking.member_id || '',
      avatar_url: booking.avatar_url || null,
      booked_at: booking.booked_at,
      checkin_status: booking.checkin_status || 'pending',
      checkin_time: booking.checkin_time || null
    }));

    // 计算是否可以触发签到和评价（用于前端显示）
    const todayDate = today();
    const now = getNow();
    
    let canTriggerCheckin = false;
    let canTriggerEvaluation = false;
    let checkinTriggerReason = '';
    let triggerReason = '';
    
    // 解析开始时间和结束时间
    const startTime = schedule.start_time || '09:00:00';
    const endTime = schedule.end_time || '17:00:00';
    const startTimeParts = startTime.split(':');
    const endTimeParts = endTime.split(':');
    const startHour = parseInt(startTimeParts[0]);
    const startMinute = parseInt(startTimeParts[1]);
    const endHour = parseInt(endTimeParts[0]);
    const endMinute = parseInt(endTimeParts[1]);
    
    // 判断是否可以触发签到：当天上课时间前30分钟到当天课程结束
    if (schedule.checkin_triggered) {
      canTriggerCheckin = false;
      checkinTriggerReason = '已触发';
    } else if (scheduleDate.isAfter(todayDate)) {
      canTriggerCheckin = false;
      checkinTriggerReason = '课程还未开课';
    } else if (scheduleDate.isBefore(todayDate)) {
      // 开课日期已过，不能触发签到
      canTriggerCheckin = false;
      checkinTriggerReason = '只能开课当天触发签到';
    } else if (scheduleDate.isSame(todayDate, 'day')) {
      // 开课当天，检查具体时间
      // 触发开始时间 = 上课开始时间 - 30分钟
      const checkinStartTime = moment.tz(scheduleDate.format('YYYY-MM-DD') + ' ' + startTime, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai')
        .subtract(30, 'minutes');
      // 触发结束时间 = 课程结束时间
      const checkinEndTime = moment.tz(scheduleDate.format('YYYY-MM-DD') + ' ' + endTime, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
      
      if (now.isBefore(checkinStartTime)) {
        canTriggerCheckin = false;
        checkinTriggerReason = `可在${checkinStartTime.format('HH:mm')}后触发签到（上课前30分钟）`;
      } else if (now.isAfter(checkinEndTime)) {
        canTriggerCheckin = false;
        checkinTriggerReason = `只能在课程结束前触发签到（最晚${checkinEndTime.format('HH:mm')}）`;
      } else {
        canTriggerCheckin = true;
      }
    }
    
    // 判断是否可以触发评价：课程结束前1小时之后都可以触发问卷
    if (schedule.questionnaire_triggered) {
      canTriggerEvaluation = false;
      triggerReason = '已触发';
    } else {
      // 计算课程结束时间
      const endTime = schedule.end_time || '17:00:00';
      const courseEndTime = moment.tz(scheduleDate.format('YYYY-MM-DD') + ' ' + endTime, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
      
      // 触发开始时间 = 课程结束时间 - 1小时
      const evaluationStartTime = courseEndTime.clone().subtract(1, 'hour');
      
      // 如果当前时间 >= 课程结束前1小时，就可以触发
      if (now.isBefore(evaluationStartTime)) {
        canTriggerEvaluation = false;
        triggerReason = `可在${evaluationStartTime.format('YYYY-MM-DD HH:mm')}后触发问卷（课程结束前1小时）`;
      } else {
        canTriggerEvaluation = true;
      }
    }

    // 确保字段存在（兼容旧数据）
    const checkinTriggered = schedule.checkin_triggered === 1 || schedule.checkin_triggered === true || false;
    const questionnaireTriggered = schedule.questionnaire_triggered === 1 || schedule.questionnaire_triggered === true || false;

    res.json({
      success: true,
      data: {
        schedule: {
          ...schedule,
          date_time_text: `${dateTimeText} ${timeText}`,
          location: schedule.location || '线下·教室', // 默认地点
          checkin_triggered: checkinTriggered,
          questionnaire_triggered: questionnaireTriggered,
          can_trigger_checkin: canTriggerCheckin,
          can_trigger_evaluation: canTriggerEvaluation,
          checkin_trigger_reason: checkinTriggerReason,
          trigger_reason: triggerReason
        },
        enrolled_users: enrolledUsers,
        enrolled_count: enrolledUsers.length
      }
    });
  } catch (error) {
    console.error('获取排课详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 触发签到打卡（教练在开课当天触发）
router.post('/schedules/:id/trigger-checkin', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { instructor_id } = req.body;

    if (!instructor_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '缺少教练ID' });
    }

    // 检查排课是否存在
    const [schedules] = await connection.query(
      `SELECT cs.*, 
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
              c.instructor_id, c.title as course_title, c.course_code
       FROM course_schedules cs
       JOIN courses c ON cs.course_id = c.id
       WHERE cs.id = ?`,
      [id]
    );

    if (schedules.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: '排课不存在' });
    }

    const schedule = schedules[0];

    // 检查是否是该课程的教练
    if (parseInt(schedule.instructor_id) !== parseInt(instructor_id)) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({ error: '只有该课程的教练才能触发签到' });
    }

    // 检查是否已经触发过
    if (schedule.checkin_triggered) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '签到已经触发过，不能重复触发' });
    }

    // 检查时间限制：只有开课当天才能触发签到，并且需要达到指定时间
    // 明确指定日期格式，避免时区问题
    let scheduleDateStr = '';
    if (schedule.schedule_date_formatted) {
      scheduleDateStr = schedule.schedule_date_formatted;
    } else if (schedule.schedule_date) {
      const dateStr = schedule.schedule_date.toString();
      if (dateStr.includes('T')) {
        scheduleDateStr = dateStr.split('T')[0];
      } else if (dateStr.includes(' ')) {
        scheduleDateStr = dateStr.split(' ')[0];
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        scheduleDateStr = dateStr;
      } else {
        scheduleDateStr = moment(schedule.schedule_date, 'YYYY-MM-DD', 'Asia/Shanghai').format('YYYY-MM-DD');
      }
    }
    const scheduleDate = moment.tz(scheduleDateStr, 'YYYY-MM-DD', 'Asia/Shanghai');
    const todayDate = today();
    const now = getNow();
    
    if (scheduleDate.isBefore(todayDate)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '只能开课当天触发签到，开课日期已过' });
    }
    
    if (!scheduleDate.isSame(todayDate, 'day')) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '只能开课当天触发签到' });
    }
    
    // 检查时间限制：当天上课时间前30分钟到当天课程结束
    const startTime = schedule.start_time || '09:00:00';
    const endTime = schedule.end_time || '17:00:00';
    // 触发开始时间 = 上课开始时间 - 30分钟
    const checkinStartTime = moment.tz(scheduleDateStr + ' ' + startTime, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai')
      .subtract(30, 'minutes');
    // 触发结束时间 = 课程结束时间
    const checkinEndTime = moment.tz(scheduleDateStr + ' ' + endTime, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
    
    if (now.isBefore(checkinStartTime)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: `只能在${checkinStartTime.format('HH:mm')}后触发签到（上课前30分钟）` });
    }
    
    if (now.isAfter(checkinEndTime)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: `只能在课程结束前触发签到（最晚${checkinEndTime.format('HH:mm')}）` });
    }

    // 更新排课状态：标记签到已触发
    await connection.query(
      'UPDATE course_schedules SET checkin_triggered = TRUE WHERE id = ?',
      [id]
    );

    // 获取所有已预订该课程的学员（状态为 booked 或 completed）
    const [bookings] = await connection.query(
      `SELECT cb.user_id, cb.id as booking_id, u.nickname, u.member_id
       FROM course_bookings cb
       JOIN users u ON cb.user_id = u.id
       WHERE cb.schedule_id = ? AND cb.status IN ('booked', 'completed')`,
      [id]
    );

    // 为所有学员初始化签到状态为 pending
    if (bookings.length > 0) {
      const bookingIds = bookings.map(b => b.booking_id);
      const placeholders = bookingIds.map(() => '?').join(',');
      await connection.query(
        `UPDATE course_bookings SET checkin_status = 'pending' 
         WHERE id IN (${placeholders})`,
        bookingIds
      );

      // 为每个学员发送系统消息提醒
      const dateStr = scheduleDate.format('YYYY-MM-DD');
      let timeText = '';
      if (schedule.time_slot === 'morning') {
        timeText = '上午';
      } else if (schedule.time_slot === 'afternoon') {
        timeText = '下午';
      } else if (schedule.time_slot === 'full_day') {
        timeText = '全天';
      }
      
      for (const booking of bookings) {
        await connection.query(
          `INSERT INTO system_messages (user_id, type, title, content, \`read\`, published, created_at) 
           VALUES (?, 'checkin_reminder', ?, ?, FALSE, 1, NOW())`,
          [
            booking.user_id,
            '签到提醒',
            `您报名的课程"${schedule.course_title}"（${dateStr} ${timeText}）已开始签到，请前往首页进行签到打卡。`
          ]
        );
      }
      console.log(`已为 ${bookings.length} 位学员发送签到提醒消息`);
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `签到已触发，已通知 ${bookings.length} 位学员进行签到`
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('触发签到错误:', error);
    res.status(500).json({ error: '触发失败', details: error.message });
  }
});

// 执行签到打卡（学员签到）
router.post('/bookings/:id/checkin', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '缺少用户ID' });
    }

    // 检查预订是否存在且属于该用户
    const [bookings] = await connection.query(
      `SELECT cb.*, cs.checkin_triggered, cs.schedule_date, cs.time_slot,
              c.title as course_title
       FROM course_bookings cb
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       JOIN courses c ON cs.course_id = c.id
       WHERE cb.id = ? AND cb.user_id = ?`,
      [id, user_id]
    );

    if (bookings.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: '预订记录不存在或不属于当前用户' });
    }

    const booking = bookings[0];

    // 检查签到是否已触发
    if (!booking.checkin_triggered) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '该课程的签到尚未触发' });
    }

    // 检查是否已经签到
    if (booking.checkin_status === 'checked_in') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '您已经签到过了' });
    }

    // 执行签到
    await connection.query(
      `UPDATE course_bookings 
       SET checkin_status = 'checked_in', checkin_time = NOW() 
       WHERE id = ?`,
      [id]
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '签到成功'
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('签到错误:', error);
    res.status(500).json({ error: '签到失败', details: error.message });
  }
});

// 获取待签到列表（学员）
router.get('/pending-checkins', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    // 查询待签到的课程（签到已触发，但用户还未签到）
    const [bookings] = await db.query(
      `SELECT cb.*, cb.id as booking_id,
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
              cs.schedule_date, cs.time_slot, cs.start_time, cs.end_time,
              cs.checkin_triggered, cs.location,
              c.id as course_id, c.title, c.subtitle, c.course_code,
              ct.name as theme_name,
              u.nickname as instructor_name, u.avatar_url as instructor_avatar
       FROM course_bookings cb
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       JOIN courses c ON cs.course_id = c.id
       JOIN course_themes ct ON c.theme_id = ct.id
       JOIN users u ON c.instructor_id = u.id
       WHERE cb.user_id = ? 
         AND cs.checkin_triggered = TRUE
         AND cb.checkin_status = 'pending'
         AND cb.status IN ('booked', 'completed')
       ORDER BY cs.schedule_date DESC, cs.start_time ASC`,
      [user_id]
    );

    const processedBookings = bookings.map(booking => {
      // 明确指定日期格式，避免时区问题
      let scheduleDateText = '';
      if (booking.schedule_date_formatted) {
        scheduleDateText = booking.schedule_date_formatted;
      } else if (booking.schedule_date) {
        const dateStr = booking.schedule_date.toString();
        if (dateStr.includes('T')) {
          scheduleDateText = dateStr.split('T')[0];
        } else if (dateStr.includes(' ')) {
          scheduleDateText = dateStr.split(' ')[0];
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          scheduleDateText = dateStr;
        } else {
          scheduleDateText = moment(booking.schedule_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        }
      }
      
      let timeText = '';
      if (booking.time_slot === 'full_day') {
        timeText = '全天';
      } else if (booking.time_slot === 'morning') {
        timeText = '上午';
      } else if (booking.time_slot === 'afternoon') {
        timeText = '下午';
      }

      if (booking.start_time && booking.end_time) {
        // 格式化为 HH:mm-HH:mm
        const start = moment(booking.start_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
        const end = moment(booking.end_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
        timeText += ` ${start}-${end}`;
      }

      return {
        ...booking,
        schedule_date_text: scheduleDateText,
        time_text: timeText,
        location: booking.location || null // 明确包含location字段
      };
    });

    res.json({
      success: true,
      data: processedBookings
    });
  } catch (error) {
    console.error('获取待签到列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 触发课后打卡（更新排课状态并触发问卷）- 必须在 /:id/statistics 之前
router.post('/schedules/:id/check-in', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { instructor_id } = req.body;

    if (!instructor_id) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '缺少教练ID' });
    }

    // 检查排课是否存在
    const [schedules] = await connection.query(
      `SELECT cs.*, 
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
              c.instructor_id, c.title as course_title
       FROM course_schedules cs
       JOIN courses c ON cs.course_id = c.id
       WHERE cs.id = ?`,
      [id]
    );

    if (schedules.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: '排课不存在' });
    }

    const schedule = schedules[0];

    // 检查是否是该课程的教练
    if (parseInt(schedule.instructor_id) !== parseInt(instructor_id)) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({ error: '只有该课程的教练才能触发课后评价' });
    }

    // 检查是否已经触发过
    if (schedule.questionnaire_triggered) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '课后评价已经触发过，不能重复触发' });
    }

    // 检查时间限制：课程结束前1小时之后都可以触发问卷
    // 明确指定日期格式，避免时区问题
    let scheduleDateStr = '';
    if (schedule.schedule_date_formatted) {
      scheduleDateStr = schedule.schedule_date_formatted;
    } else if (schedule.schedule_date) {
      const dateStr = schedule.schedule_date.toString();
      if (dateStr.includes('T')) {
        scheduleDateStr = dateStr.split('T')[0];
      } else if (dateStr.includes(' ')) {
        scheduleDateStr = dateStr.split(' ')[0];
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        scheduleDateStr = dateStr;
      } else {
        scheduleDateStr = moment(schedule.schedule_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
      }
    }
    const scheduleDate = moment.tz(scheduleDateStr, 'YYYY-MM-DD', 'Asia/Shanghai');
    const now = getNow();
    
    // 计算课程结束时间
    const endTime = schedule.end_time || '17:00:00';
    const courseEndTime = moment.tz(scheduleDateStr + ' ' + endTime, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
    
    // 触发开始时间 = 课程结束时间 - 1小时
    const evaluationStartTime = courseEndTime.clone().subtract(1, 'hour');
    
    // 如果当前时间 < 课程结束前1小时，不能触发
    if (now.isBefore(evaluationStartTime)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: `只能在${evaluationStartTime.format('YYYY-MM-DD HH:mm')}后触发问卷（课程结束前1小时）` });
    }
    
    // 可以触发（当前时间 >= 课程结束前1小时）

    // 更新排课状态为已完成
    await connection.query(
      'UPDATE course_schedules SET status = ?, questionnaire_triggered = TRUE WHERE id = ?',
      ['completed', id]
    );

    // 更新所有相关预订状态为已完成
    await connection.query(
      `UPDATE course_bookings SET status = ? 
       WHERE schedule_id = ? AND status = 'booked'`,
      ['completed', id]
    );

    // 获取所有已预订该课程的学员
    const [bookings] = await connection.query(
      `SELECT cb.user_id, u.nickname
       FROM course_bookings cb
       JOIN users u ON cb.user_id = u.id
       WHERE cb.schedule_id = ? AND cb.status = 'completed'`,
      [id]
    );

    // 为每个学员发送系统消息提醒（课程已结束，请填写评价）
    if (bookings.length > 0) {
      for (const booking of bookings) {
        await connection.query(
          `INSERT INTO system_messages (user_id, type, title, content, published, created_at) 
           VALUES (?, ?, ?, ?, 1, NOW())`,
          [
            booking.user_id,
            'evaluation_reminder',
            '课程评价提醒',
            `您参加的课程"${schedule.course_title}"已结束，请填写课程评价问卷。`
          ]
        );
      }
      console.log(`已为 ${bookings.length} 位学员发送评价提醒消息`);
    }

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `课后评价已触发，已通知 ${bookings.length} 位学员填写评价问卷`
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('触发课后打卡错误:', error);
    res.status(500).json({ error: '触发失败', details: error.message });
  }
});

// 获取用户已上课程（已完成的课程）
router.get('/completed', async (req, res) => {
  try {
    const { user_id, limit = 100 } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }
    
    // 获取用户状态为"已完成"的课程预订（与管理后台课程预定表中的状态一致）
    const [bookings] = await db.query(
      `SELECT cb.*, cb.booked_at, cb.cancelled_at,
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
              cs.schedule_date, cs.time_slot, cs.start_time, cs.end_time,
              cs.current_students, cs.max_students, cs.status as schedule_status, cs.location,
              c.id as course_id, c.title, c.subtitle, c.course_code,
              ct.name as theme_name,
              u.nickname as instructor_name, u.avatar_url as instructor_avatar,
              t.id as ticket_id, t.ticket_code, t.used_at as ticket_used_at,
              e.id as evaluation_id
       FROM course_bookings cb
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       JOIN courses c ON cs.course_id = c.id
       JOIN course_themes ct ON c.theme_id = ct.id
       JOIN users u ON c.instructor_id = u.id
       LEFT JOIN tickets t ON cb.ticket_id = t.id
       LEFT JOIN evaluations e ON e.user_id = cb.user_id AND e.schedule_id = cs.id
       WHERE cb.user_id = ? 
         AND cb.status = 'completed'
       ORDER BY cs.schedule_date DESC
       LIMIT ?`,
      [user_id, parseInt(limit)]
    );

    const processedBookings = bookings.map(booking => {
      // 明确指定日期格式，避免时区问题
      let dateTimeText = '';
      if (booking.schedule_date_formatted) {
        dateTimeText = booking.schedule_date_formatted;
      } else if (booking.schedule_date) {
        const dateStr = booking.schedule_date.toString();
        if (dateStr.includes('T')) {
          dateTimeText = dateStr.split('T')[0];
        } else if (dateStr.includes(' ')) {
          dateTimeText = dateStr.split(' ')[0];
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateTimeText = dateStr;
        } else {
          dateTimeText = moment(booking.schedule_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        }
      }
      let timeText = '';
      
      if (booking.time_slot === 'full_day') {
        timeText = '全天';
      } else if (booking.time_slot === 'morning') {
        timeText = '上午';
      } else if (booking.time_slot === 'afternoon') {
        timeText = '下午';
      }

      if (booking.start_time && booking.end_time) {
        // 格式化为 HH:mm-HH:mm
        const start = moment(booking.start_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
        const end = moment(booking.end_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
        timeText += ` ${start}-${end}`;
      } else {
        // 默认时间格式
        const defaultTimes = {
          'morning': '09:00-12:00',
          'afternoon': '14:00-17:00',
          'full_day': '09:00-17:00'
        };
        timeText += ` ${defaultTimes[booking.time_slot] || '09:00-17:00'}`;
      }

      return {
        ...booking,
        date_time_text: `${dateTimeText} ${timeText}`,
        location: booking.location || null, // 明确包含location字段
        evaluation_status: booking.evaluation_id ? 'evaluated' : 'pending',
        booked_at_formatted: booking.booked_at ? moment(booking.booked_at).format('YYYY-MM-DD HH:mm:ss') : null,
        ticket_used_at_formatted: booking.ticket_used_at ? moment(booking.ticket_used_at).format('YYYY-MM-DD HH:mm:ss') : null
      };
    });

    res.json({ success: true, data: processedBookings });
  } catch (error) {
    console.error('获取已上课程错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取用户已预订课程
router.get('/bookings', async (req, res) => {
  try {
    const { user_id, limit = 10 } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    const [bookings] = await db.query(
      `SELECT cb.*, 
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
              cs.schedule_date, cs.time_slot, cs.start_time, cs.end_time,
              cs.current_students, cs.max_students, cs.location,
              c.id as course_id, c.title, c.subtitle,
              ct.name as theme_name,
              u.nickname as instructor_name, u.avatar_url as instructor_avatar,
              t.ticket_code
       FROM course_bookings cb
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       JOIN courses c ON cs.course_id = c.id
       JOIN course_themes ct ON c.theme_id = ct.id
       JOIN users u ON c.instructor_id = u.id
       LEFT JOIN tickets t ON cb.ticket_id = t.id
       WHERE cb.user_id = ? AND cb.status = 'booked'
       ORDER BY cs.schedule_date ASC
       LIMIT ?`,
      [user_id, parseInt(limit)]
    );

    const todayDate = today();
    
    const processedBookings = bookings.map(booking => {
      // 明确指定日期格式，避免时区问题
      let dateTimeText = '';
      if (booking.schedule_date_formatted) {
        dateTimeText = booking.schedule_date_formatted;
      } else if (booking.schedule_date) {
        const dateStr = booking.schedule_date.toString();
        if (dateStr.includes('T')) {
          dateTimeText = dateStr.split('T')[0];
        } else if (dateStr.includes(' ')) {
          dateTimeText = dateStr.split(' ')[0];
        } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateTimeText = dateStr;
        } else {
          // 如果格式不匹配，使用 moment 解析并格式化
          const parsed = moment.tz(booking.schedule_date, 'Asia/Shanghai');
          dateTimeText = parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
        }
      }
      const scheduleDate = moment.tz(dateTimeText, 'YYYY-MM-DD', 'Asia/Shanghai');
      const isPast = scheduleDate.isBefore(todayDate);
      let timeText = '';
      
      if (booking.time_slot === 'full_day') {
        timeText = '全天';
      } else if (booking.time_slot === 'morning') {
        timeText = '上午';
      } else if (booking.time_slot === 'afternoon') {
        timeText = '下午';
      }

      if (booking.start_time && booking.end_time) {
        // 格式化为 HH:mm-HH:mm
        const start = moment(booking.start_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
        const end = moment(booking.end_time, 'HH:mm:ss', 'Asia/Shanghai').format('HH:mm');
        timeText += ` ${start}-${end}`;
      } else {
        // 默认时间格式
        const defaultTimes = {
          'morning': '09:00-12:00',
          'afternoon': '14:00-17:00',
          'full_day': '09:00-17:00'
        };
        timeText += ` ${defaultTimes[booking.time_slot] || '09:00-17:00'}`;
      }

      // 判断是否可以取消（开课前3天，在开课前第三天的23:59:59之前）
      let canCancel = false;
      if (!isPast) {
        const cancelDeadline = scheduleDate.clone().subtract(3, 'days').startOf('day');
        // 允许在开课前3天（含）之前取消，即今天 <= cancelDeadline
        canCancel = todayDate.isBefore(cancelDeadline) || todayDate.isSame(cancelDeadline, 'day');
      }

      // 使用 Object.assign 替代展开运算符，确保兼容性
      const processedBooking = Object.assign({}, booking, {
        booking_id: booking.id, // 确保返回 booking_id 字段
        date_time_text: dateTimeText + ' ' + timeText,
        location: booking.location || null, // 明确包含location字段
        is_past: isPast,
        can_cancel: canCancel,
        course_image: null // 可以后续添加课程图片
      });
      return processedBooking;
    });

    res.json({ success: true, data: processedBookings });
  } catch (error) {
    console.error('获取已预订课程错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 预订课程
router.post('/book', async (req, res) => {
  try {
    const { user_id, schedule_id } = req.body;

    // 检查课程是否存在且可预订
    // 允许 scheduled 和 completed 状态的课程（completed 状态的课程如果还没开始，也应该允许预订）
    const [schedules] = await db.query(
      `SELECT cs.*, cs.questionnaire_url, cs.questionnaire_id, c.instructor_id, c.id as course_id, c.title as course_title
       FROM course_schedules cs
       JOIN courses c ON cs.course_id = c.id
       WHERE cs.id = ? AND cs.status IN ('scheduled', 'completed')`,
      [schedule_id]
    );

    if (schedules.length === 0) {
      return res.status(404).json({ error: '课程不存在或已取消' });
    }

    const schedule = schedules[0];

    // 检查是否是教练自己的课程
    if (schedule.instructor_id && parseInt(user_id) === parseInt(schedule.instructor_id)) {
      return res.status(400).json({ error: '不能预订自己的课程' });
    }

    // 检查是否是历史课程（使用统一的日期格式化逻辑）
    let scheduleDateStr = '';
    if (schedule.schedule_date_formatted) {
      scheduleDateStr = schedule.schedule_date_formatted;
    } else if (schedule.schedule_date) {
      const dateStr = schedule.schedule_date.toString();
      if (dateStr.includes('T')) {
        scheduleDateStr = dateStr.split('T')[0];
      } else if (dateStr.includes(' ')) {
        scheduleDateStr = dateStr.split(' ')[0];
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        scheduleDateStr = dateStr;
      } else {
        scheduleDateStr = moment(schedule.schedule_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
      }
    }
    const scheduleDate = moment.tz(scheduleDateStr, 'YYYY-MM-DD', 'Asia/Shanghai');
    const todayDate = today();
    
    // 检查是否是历史课程（已过去的日期）
    if (scheduleDate.isBefore(todayDate)) {
      return res.status(400).json({ error: '历史课程不可预订' });
    }

    // 检查课程是否已经开始（当前时间已经超过课程开始时间）
    const now = getNow();
    const startTime = schedule.start_time || '09:00:00';
    
    // 构建完整的开始时间（日期 + 时间）
    const startDateTimeStr = `${scheduleDateStr} ${startTime}`;
    const startDateTime = moment.tz(startDateTimeStr, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
    
    if (startDateTime.isValid() && (now.isAfter(startDateTime) || now.isSame(startDateTime))) {
      return res.status(400).json({ error: '课程已开始，不可预订' });
    }

    // 检查课程状态（允许 scheduled 和 completed 状态的课程预订，只要还没开始）
    // 注意：即使状态是 completed，只要课程还没开始，也应该允许预订
    if (schedule.status !== 'scheduled' && schedule.status !== 'completed') {
      return res.status(400).json({ error: '课程状态不允许预订' });
    }

    // 检查是否已满员
    if (schedule.current_students >= schedule.max_students) {
      return res.status(400).json({ error: '课程已满员' });
    }

    // 检查是否已预订（只检查状态为 'booked' 的预订记录，不包括已取消的）
    const [existing] = await db.query(
      'SELECT id FROM course_bookings WHERE user_id = ? AND schedule_id = ? AND status = ?',
      [user_id, schedule_id, 'booked']
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: '您已预订该课程' });
    }

    // 计算需要的课券数量
    const tickets_needed = schedule.time_slot === 'full_day' ? 2 : 1;

    // 获取课程的模块和主题ID
    const [courseInfo] = await db.query(
      `SELECT c.id as course_id, c.theme_id, ct.module_id 
       FROM courses c
       JOIN course_themes ct ON c.theme_id = ct.id
       WHERE c.id = ?`,
      [schedule.course_id]
    );
    
    if (courseInfo.length === 0) {
      return res.status(404).json({ error: '课程信息不存在' });
    }
    
    const courseModuleId = courseInfo[0].module_id;
    const courseThemeId = courseInfo[0].theme_id;
    const targetCourseId = courseInfo[0].course_id;

    // 查找可用课券（优先使用受限制的课券，如果受限制的课券不能预订该课程，再使用不受限制的课券）
    // 逻辑：课券可以使用如果：
    // 1. 限制了课程，且课程ID匹配（restrict_course_id = courseId）
    // 2. 只限制了模块，且课程模块匹配（restrict_module_id = courseModuleId AND restrict_theme_id IS NULL AND restrict_course_id IS NULL）
    // 3. 只限制了主题，且课程主题匹配（restrict_module_id IS NULL AND restrict_theme_id = courseThemeId AND restrict_course_id IS NULL）
    // 4. 同时限制了模块和主题，且都匹配（restrict_module_id = courseModuleId AND restrict_theme_id = courseThemeId AND restrict_course_id IS NULL）
    // 5. 无限制的课券（restrict_module_id IS NULL AND restrict_theme_id IS NULL AND restrict_course_id IS NULL）- 作为补充
    
    // 第一步：优先查询限制课程的课券
    const [courseRestrictedTickets] = await db.query(
      `SELECT id, restrict_module_id, restrict_theme_id, restrict_course_id FROM tickets 
       WHERE user_id = ? AND status = ? 
       AND (expiry_date IS NULL OR expiry_date > ?)
         AND restrict_course_id = ?
       ORDER BY ISNULL(expiry_date), expiry_date ASC 
       LIMIT ?`,
      [
        user_id, 
        'unused', 
        moment().format('YYYY-MM-DD'),
        targetCourseId,
        tickets_needed
      ]
    );
    
    // 第二步：如果限制课程的课券不够，查询限制模块/主题且符合条件的课券
    let tickets = courseRestrictedTickets;
    if (tickets.length < tickets_needed) {
      const remainingNeeded = tickets_needed - tickets.length;
      const [restrictedTickets] = await db.query(
        `SELECT id, restrict_module_id, restrict_theme_id, restrict_course_id FROM tickets 
         WHERE user_id = ? AND status = ? 
         AND (expiry_date IS NULL OR expiry_date > ?)
         AND restrict_course_id IS NULL
         AND (restrict_module_id IS NOT NULL OR restrict_theme_id IS NOT NULL)
         AND (
           (restrict_module_id = ? AND restrict_theme_id IS NULL) OR
           (restrict_module_id IS NULL AND restrict_theme_id = ?) OR
           (restrict_module_id = ? AND restrict_theme_id = ?)
         )
         ORDER BY ISNULL(expiry_date), expiry_date ASC 
         LIMIT ?`,
        [
          user_id, 
          'unused', 
          moment().format('YYYY-MM-DD'),
          courseModuleId,      // 只限制模块的情况
          courseThemeId,       // 只限制主题的情况
          courseModuleId,      // 同时限制模块和主题的情况
          courseThemeId,
          remainingNeeded
        ]
      );
      tickets = [...tickets, ...restrictedTickets];
    }
    
    // 第三步：如果还不够，再查询不受限制的课券作为补充
    if (tickets.length < tickets_needed) {
      const remainingNeeded = tickets_needed - tickets.length;
      const [unrestrictedTickets] = await db.query(
        `SELECT id, restrict_module_id, restrict_theme_id, restrict_course_id FROM tickets 
         WHERE user_id = ? AND status = ? 
         AND (expiry_date IS NULL OR expiry_date > ?)
         AND restrict_module_id IS NULL AND restrict_theme_id IS NULL AND restrict_course_id IS NULL
         ORDER BY ISNULL(expiry_date), expiry_date ASC 
         LIMIT ?`,
        [
          user_id, 
          'unused', 
          moment().format('YYYY-MM-DD'),
          remainingNeeded
        ]
      );
      // 合并所有类型的课券
      tickets = [...tickets, ...unrestrictedTickets];
    }

    if (tickets.length < tickets_needed) {
      // 检查未过期且未使用的课券总数
      const [unusedValidTickets] = await db.query(
        `SELECT COUNT(*) as count FROM tickets 
         WHERE user_id = ? AND status = ? AND (expiry_date IS NULL OR expiry_date > ?)`,
        [user_id, 'unused', moment().format('YYYY-MM-DD')]
      );
      const unusedValidCount = unusedValidTickets[0].count;
      
      // 检查是否有任何未使用的课券（包括已过期的）
      const [unusedTickets] = await db.query(
        'SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND status = ?',
        [user_id, 'unused']
      );
      const unusedCount = unusedTickets[0].count;
      
      // 如果没有任何未使用的课券，提示购买
      if (unusedCount === 0) {
        return res.status(400).json({ error: '您还没有可用课券，请先购买课券' });
      }
      
      // 检查是否有受限制但不符合条件的课券
      const [restrictedInvalidTickets] = await db.query(
        `SELECT COUNT(*) as count FROM tickets 
         WHERE user_id = ? AND status = ? 
         AND (expiry_date IS NULL OR expiry_date > ?)
         AND (restrict_module_id IS NOT NULL OR restrict_theme_id IS NOT NULL)
         AND NOT (
           (restrict_module_id = ? AND restrict_theme_id IS NULL) OR
           (restrict_module_id IS NULL AND restrict_theme_id = ?) OR
           (restrict_module_id = ? AND restrict_theme_id = ?)
         )`,
        [
          user_id, 
          'unused', 
          moment().format('YYYY-MM-DD'),
          targetCourseId,        // 限制课程的情况
          courseModuleId,  // 只限制模块的情况
          courseThemeId,   // 只限制主题的情况
          courseModuleId,  // 同时限制模块和主题的情况
          courseThemeId
        ]
      );
      const restrictedInvalidCount = restrictedInvalidTickets[0].count;
      
      // 检查是否有不受限制的课券
      const [unrestrictedCountResult] = await db.query(
        `SELECT COUNT(*) as count FROM tickets 
         WHERE user_id = ? AND status = ? 
         AND (expiry_date IS NULL OR expiry_date > ?)
         AND restrict_module_id IS NULL AND restrict_theme_id IS NULL`,
        [user_id, 'unused', moment().format('YYYY-MM-DD')]
      );
      const unrestrictedCount = unrestrictedCountResult[0].count;
      
      // 如果所有课券都受限制，且均不能预订该课程
      if (unusedValidCount > 0 && restrictedInvalidCount === unusedValidCount) {
        // 查询受限课券的具体限制信息（模块和主题名称）
        const [restrictedTicketsDetails] = await db.query(
          `SELECT DISTINCT t.restrict_module_id, t.restrict_theme_id,
                  cm.name as restrict_module_name,
                  ct.name as restrict_theme_name
           FROM tickets t
           LEFT JOIN course_modules cm ON t.restrict_module_id = cm.id
           LEFT JOIN course_themes ct ON t.restrict_theme_id = ct.id
           WHERE t.user_id = ? AND t.status = ? 
           AND (t.expiry_date IS NULL OR t.expiry_date > ?)
           AND (t.restrict_module_id IS NOT NULL OR t.restrict_theme_id IS NOT NULL)
           AND NOT (
             (t.restrict_module_id = ? AND t.restrict_theme_id IS NULL) OR
             (t.restrict_module_id IS NULL AND t.restrict_theme_id = ?) OR
             (t.restrict_module_id = ? AND t.restrict_theme_id = ?)
           )
           LIMIT 5`,
          [
            user_id, 
            'unused', 
            moment().format('YYYY-MM-DD'),
            courseModuleId,
            courseThemeId,
            courseModuleId,
            courseThemeId
          ]
        );
        
        // 构建限制信息文本
        let restrictionText = '';
        if (restrictedTicketsDetails.length > 0) {
          const restrictions = [];
          restrictedTicketsDetails.forEach(ticket => {
            const parts = [];
            if (ticket.restrict_module_name) {
              parts.push(`模块：${ticket.restrict_module_name}`);
            }
            if (ticket.restrict_theme_name) {
              parts.push(`主题：${ticket.restrict_theme_name}`);
            }
            if (parts.length > 0) {
              restrictions.push(parts.join('、'));
            }
          });
          
          // 去重并构建文本
          const uniqueRestrictions = [...new Set(restrictions)];
          if (uniqueRestrictions.length > 0) {
            restrictionText = `\n\n受限条件：${uniqueRestrictions.join('；')}`;
          }
        }
        
        return res.status(400).json({ 
          error: `您的课券受限于只能预订某些课程，无法预订当前课程。${restrictionText}` 
        });
      } else if (unusedValidCount === 0) {
        // 所有课券都已过期
        return res.status(400).json({ 
          error: `您的课券已过期，无法预订此课程` 
        });
      } else {
        // 课券数量不足（包括受限制和不受限制的课券都不够）
        return res.status(400).json({ 
          error: `课券不足，需要${tickets_needed}张课券，您有${unusedValidCount}张可用课券` 
        });
      }
    }

    // 使用事务确保数据一致性
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // 占用课券
      const ticket_ids = tickets.map(t => t.id);
      if (ticket_ids.length > 0) {
        await connection.query(
          `UPDATE tickets SET status = ? WHERE id IN (${ticket_ids.map(() => '?').join(',')})`,
          ['booked', ...ticket_ids]
        );
      }

      // 创建预订记录（全天课程使用第一张课券ID，其他课券通过关联表记录）
      const [result] = await connection.query(
        'INSERT INTO course_bookings (user_id, schedule_id, ticket_id, status) VALUES (?, ?, ?, ?)',
        [user_id, schedule_id, ticket_ids[0] || null, 'booked']
      );

      // 如果全天课程使用了多张课券，需要记录额外的课券关联
      // 注意：当前数据库设计只支持一个ticket_id，如果需要支持多张课券，需要创建关联表
      // 暂时只记录第一张课券ID

      // 更新课程报名人数
      await connection.query(
        'UPDATE course_schedules SET current_students = current_students + 1 WHERE id = ?',
        [schedule_id]
      );

      // 创建系统消息提醒用户（无论是否有问卷链接都创建）
      let messageContent = `您已成功预订课程"${schedule.course_title}"！\n\n温馨提示：开课前3天内不可取消，如需取消请提前3天操作。`;
      
      if (schedule.questionnaire_url) {
        messageContent += `\n\n请填写课前问卷（选填）：\n${schedule.questionnaire_url}`;
        if (schedule.questionnaire_id) {
          messageContent += `\n问卷ID：${schedule.questionnaire_id}`;
        }
        messageContent += `\n\n请复制链接前往填写课前问卷，帮助我们更好地为您准备课程内容。`;
      }
      
      await connection.query(
        `INSERT INTO system_messages (user_id, type, schedule_id, title, content, published, created_at)
         VALUES (?, 'system', ?, ?, ?, 1, NOW())`,
        [
          user_id,
          schedule_id,
          '预订成功',
          messageContent
        ]
      );
      console.log(`[预订成功] 已为用户 ${user_id} 创建系统消息提醒${schedule.questionnaire_url ? '（包含课前问卷链接）' : ''}`);

      await connection.commit();
      connection.release();
      res.json({ 
        success: true, 
        booking_id: result.insertId,
        questionnaire_url: schedule.questionnaire_url || null,
        questionnaire_id: schedule.questionnaire_id || null,
        course_title: schedule.course_title
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error('预订课程错误:', error);
    console.error('错误详情:', error.stack);
    res.status(500).json({ 
      error: '预订失败', 
      details: error.message,
      message: '系统错误，请稍后重试或联系客服'
    });
  }
});

// 取消预订
router.post('/cancel-booking', async (req, res) => {
  try {
    const { user_id, booking_id } = req.body;

    // 查找预订记录
    const [bookings] = await db.query(
      `SELECT cb.*, 
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
              cs.schedule_date, cs.time_slot, cs.start_time
       FROM course_bookings cb
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       WHERE cb.id = ? AND cb.user_id = ?`,
      [booking_id, user_id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: '预订记录不存在' });
    }

    const booking = bookings[0];

    // 检查是否是历史课程（使用统一的日期格式化逻辑）
    let scheduleDateStr = '';
    if (booking.schedule_date_formatted) {
      scheduleDateStr = booking.schedule_date_formatted;
    } else if (booking.schedule_date) {
      const dateStr = booking.schedule_date.toString();
      if (dateStr.includes('T')) {
        scheduleDateStr = dateStr.split('T')[0];
      } else if (dateStr.includes(' ')) {
        scheduleDateStr = dateStr.split(' ')[0];
      } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        scheduleDateStr = dateStr;
      } else {
        scheduleDateStr = moment(booking.schedule_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
      }
    }
    const scheduleDate = moment(scheduleDateStr, 'YYYY-MM-DD');
    if (scheduleDate.isBefore(moment().startOf('day'))) {
      return res.status(400).json({ error: '历史课程不可取消' });
    }

    // 检查是否可以取消（开课前3天，在开课前第三天的23:59:59之前）
    // 例如：12-12开课，12-09是开课前第3天，12-08是开课前第4天
    // 规则：可以在开课前3天（含）之前取消，即今天 <= 开课前第3天的00:00
    const cancelDeadline = scheduleDate.clone().subtract(3, 'days').startOf('day');
    const todayDate = today();
    
    // 如果今天已经超过了开课前第3天的00:00，则不能取消
    if (todayDate.isAfter(cancelDeadline)) {
      return res.status(400).json({ error: '开课前3天内不可取消' });
    }

    // 释放课券
    await db.query(
      'UPDATE tickets SET status = ? WHERE id = ?',
      ['unused', booking.ticket_id]
    );

    // 更新预订状态
    await db.query(
      'UPDATE course_bookings SET status = ?, cancelled_at = NOW() WHERE id = ?',
      ['cancelled', booking_id]
    );

    // 更新课程报名人数
    await db.query(
      'UPDATE course_schedules SET current_students = current_students - 1 WHERE id = ?',
      [booking.schedule_id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('取消预订错误:', error);
    res.status(500).json({ error: '取消失败', details: error.message });
  }
});

// 获取课程统计数据和评价建议（必须在 /:id 之前）
router.get('/:id/statistics', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取课程统计数据
    const [statsResults] = await db.query(
      `SELECT 
        COUNT(DISTINCT cs.id) as schedule_count,
        COUNT(DISTINCT e.id) as evaluation_count,
        COUNT(DISTINCT cb.id) as booking_count,
        AVG(CASE 
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q1')) = 'A' THEN 5
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q1')) = 'B' THEN 3
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q1')) = 'C' THEN 1
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q1')) = 'D' THEN 4
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q1')) = 'E' THEN 2
          ELSE NULL
        END) as avg_q1_score,
        AVG(CASE 
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q2')) = 'A' THEN 5
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q2')) = 'B' THEN 3
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q2')) = 'C' THEN 1
          ELSE NULL
        END) as avg_q2_score,
        AVG(CASE 
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q3')) = 'A' THEN 5
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q3')) = 'B' THEN 3
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q3')) = 'C' THEN 1
          ELSE NULL
        END) as avg_q3_score,
        AVG(CASE 
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q4')) = 'A' THEN 5
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q4')) = 'B' THEN 3
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q4')) = 'C' THEN 1
          ELSE NULL
        END) as avg_q4_score,
        AVG(CASE 
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q9')) = 'A' THEN 5
          WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q9')) = 'B' THEN 2
          ELSE NULL
        END) as avg_q9_score,
        (SELECT AVG(case_score)
         FROM (
           SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(value, '$')) AS DECIMAL(3,2)) as case_score
           FROM evaluations e2
           CROSS JOIN JSON_TABLE(
             JSON_EXTRACT(e2.answers, '$.q6'),
             '$.*' COLUMNS (value JSON PATH '$')
           ) AS jt
           WHERE e2.course_id = ? 
             AND e2.status = 'submitted'
             AND JSON_EXTRACT(e2.answers, '$.q6') IS NOT NULL
         ) as case_scores
         WHERE case_score IS NOT NULL AND case_score >= 1 AND case_score <= 5
        ) as avg_case_score
       FROM courses c
       LEFT JOIN course_schedules cs ON cs.course_id = c.id
       LEFT JOIN evaluations e ON e.course_id = c.id AND e.status = 'submitted'
       LEFT JOIN course_bookings cb ON cb.schedule_id = cs.id AND cb.status IN ('booked', 'completed')
       WHERE c.id = ?`,
      [id, id]
    );

    // 获取用户评价建议（q7反馈和建议）
    const [feedbacks] = await db.query(
      `SELECT e.id, e.answers, e.feedback, e.submitted_at,
              u.nickname as user_name
       FROM evaluations e
       JOIN users u ON e.user_id = u.id
       WHERE e.course_id = ? 
         AND e.status = 'submitted'
         AND (e.feedback IS NOT NULL AND e.feedback != '' OR JSON_EXTRACT(e.answers, '$.q7') IS NOT NULL)
       ORDER BY e.submitted_at DESC
       LIMIT 10`,
      [id]
    );

    // 处理反馈数据
    const feedbackList = feedbacks.map(eval => {
      let answers = {};
      let feedbackText = '';
      
      // 从 answers 中提取 q7（反馈和建议）
      try {
        if (eval.answers) {
          if (typeof eval.answers === 'string') {
            answers = JSON.parse(eval.answers);
          } else if (typeof eval.answers === 'object') {
            answers = eval.answers;
          }
        }
        if (answers && answers.q7) {
          feedbackText = answers.q7;
        }
      } catch (e) {
        console.error('解析答案失败:', e);
      }

      // 优先使用 feedback 字段，其次使用 answers.q7
      feedbackText = eval.feedback || feedbackText || '';

      const feedbackItem = {
        id: eval.id, // 添加evaluation_id用于跳转
        feedback: feedbackText,
        user_name: eval.user_name || '匿名',
        submitted_at: moment(eval.submitted_at).format('YYYY-MM-DD')
      };
      
      // 调试日志：确认id是否正确
      if (!feedbackItem.id) {
        console.error('[课程统计] feedback项缺少id字段, eval:', eval);
      }
      
      return feedbackItem;
    }).filter(item => item.feedback && item.feedback.trim() !== '');
    
    // 调试日志：确认返回的数据结构
    console.log('[课程统计] feedbackList示例（前2项）:', feedbackList.slice(0, 2).map(f => ({ id: f.id, user_name: f.user_name })));

    const stats = statsResults[0] || {};

    res.json({
      success: true,
      data: {
        schedule_count: parseInt(stats.schedule_count) || 0,
        evaluation_count: parseInt(stats.evaluation_count) || 0,
        booking_count: parseInt(stats.booking_count) || 0,
        avg_q1_score: stats.avg_q1_score ? parseFloat(stats.avg_q1_score).toFixed(2) : null,
        avg_q2_score: stats.avg_q2_score ? parseFloat(stats.avg_q2_score).toFixed(2) : null,
        avg_q3_score: stats.avg_q3_score ? parseFloat(stats.avg_q3_score).toFixed(2) : null,
        avg_q4_score: stats.avg_q4_score ? parseFloat(stats.avg_q4_score).toFixed(2) : null,
        avg_q9_score: stats.avg_q9_score ? parseFloat(stats.avg_q9_score).toFixed(2) : null,
        avg_case_score: stats.avg_case_score ? parseFloat(stats.avg_case_score).toFixed(2) : null,
        feedbacks: feedbackList
      }
    });
  } catch (error) {
    console.error('获取课程统计数据错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取课程详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [courses] = await db.query(
      `SELECT c.*, u.nickname as instructor_name, ct.name as theme_name, ct.description as theme_description
       FROM courses c
       JOIN users u ON c.instructor_id = u.id
       JOIN course_themes ct ON c.theme_id = ct.id
       WHERE c.id = ?`,
      [id]
    );

    if (courses.length === 0) {
      return res.status(404).json({ error: '课程不存在' });
    }

    res.json({ success: true, data: courses[0] });
  } catch (error) {
    console.error('获取课程详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

module.exports = router;
