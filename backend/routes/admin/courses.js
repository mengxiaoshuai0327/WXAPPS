const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { moment, now, today, normalizeDateString, isBefore, isSame } = require('../../utils/dateHelper');

// 生成唯一的课程编号（格式：C + 8位数字）
async function generateCourseCode() {
  let attempts = 0;
  const maxAttempts = 20; // 增加尝试次数
  
  // 方法1：使用随机数生成
  while (attempts < maxAttempts) {
    const randomNum = crypto.randomInt(10000000, 99999999);
    const courseCode = `C${randomNum}`;
    
    const [existing] = await db.query(
      'SELECT id FROM courses WHERE course_code = ?',
      [courseCode]
    );
    
    if (existing.length === 0) {
      return courseCode;
    }
    
    attempts++;
  }
  
  // 方法2：如果随机生成失败，使用时间戳+随机数
  attempts = 0;
  while (attempts < maxAttempts) {
    const timestamp = Date.now().toString().slice(-6); // 取后6位
    const randomSuffix = crypto.randomInt(10, 99); // 2位随机数
    const courseCode = `C${timestamp}${randomSuffix}`;
    
    const [existing] = await db.query(
      'SELECT id FROM courses WHERE course_code = ?',
      [courseCode]
    );
    
    if (existing.length === 0) {
      return courseCode;
    }
    
    attempts++;
  }
  
  // 方法3：最后的后备方案 - 使用完整时间戳+随机数
  const timestamp = Date.now().toString();
  const randomSuffix = crypto.randomInt(100, 999);
  return `C${timestamp.slice(-5)}${randomSuffix}`;
}

// 获取课程列表（管理后台）
router.get('/list', async (req, res) => {
  try {
    const { instructor_id } = req.query;
    
    let query = `
      SELECT c.*, 
             ct.name as theme_name,
             ct.module_id,
             cm.name as module_name,
             u.nickname as instructor_name,
             u.id as instructor_user_id,
             u.instructor_id as instructor_number,
             COUNT(cs.id) as schedule_count
      FROM courses c
      JOIN course_themes ct ON c.theme_id = ct.id
      JOIN course_modules cm ON ct.module_id = cm.id
      JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_schedules cs ON cs.course_id = c.id AND cs.status != 'cancelled'
      WHERE 1=1
    `;
    const params = [];
    
    if (instructor_id) {
      query += ' AND c.instructor_id = ?';
      params.push(instructor_id);
    }
    
    query += ' GROUP BY c.id ORDER BY c.created_at DESC';
    
    const [courses] = await db.query(query, params);
    
    // 格式化时间为北京时间
    const formattedCourses = courses.map(course => {
      const formatted = { ...course };
      
      // 处理创建时间：转换为北京时间
      if (course.created_at) {
        // 如果已经是字符串格式（ISO），直接解析；如果是Date对象，moment会自动处理
        formatted.created_at = moment(course.created_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      } else {
        formatted.created_at = null;
      }
      
      // 处理更新时间：转换为北京时间
      if (course.updated_at) {
        formatted.updated_at = moment(course.updated_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      } else {
        formatted.updated_at = null;
      }
      
      return formatted;
    });
    
    res.json({ success: true, data: formattedCourses });
  } catch (error) {
    console.error('获取课程列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 创建课程
router.post('/create', async (req, res) => {
  try {
    const { theme_id, instructor_id, title, subtitle, instructor_intro, course_intro, questionnaire_config } = req.body;

    if (!theme_id || !instructor_id || !title || !course_intro) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    // 验证教练是否存在
    const [instructorCheck] = await db.query(
      'SELECT id FROM users WHERE id = ? AND role = ?',
      [instructor_id, 'instructor']
    );
    
    if (instructorCheck.length === 0) {
      return res.status(400).json({ error: '教练不存在或不是有效的教练' });
    }

    // 自动生成唯一的课程编号
    let course_code = await generateCourseCode();
    
    // 最后检查一次课程编号是否唯一（双重保险）
    const [codeCheck] = await db.query(
      'SELECT id FROM courses WHERE course_code = ?',
      [course_code]
    );
    
    if (codeCheck.length > 0) {
      // 如果仍然冲突，再次生成
      course_code = await generateCourseCode();
    }

    // 处理问卷配置（案例信息）
    const configJson = questionnaire_config ? JSON.stringify(questionnaire_config) : null;

    const [result] = await db.query(
      `INSERT INTO courses (theme_id, instructor_id, course_code, title, subtitle, instructor_intro, course_intro, questionnaire_config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [theme_id, instructor_id, course_code, title, subtitle || null, instructor_intro || null, course_intro, configJson]
    );

    res.json({ success: true, data: { id: result.insertId, course_code: course_code } });
  } catch (error) {
    console.error('创建课程错误:', error);
    res.status(500).json({ error: '创建失败', details: error.message });
  }
});

// 更新课程
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { theme_id, instructor_id, course_code, title, subtitle, instructor_intro, course_intro, questionnaire_config } = req.body;

    // 检查课程是否存在
    const [existing] = await db.query('SELECT id FROM courses WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '课程不存在' });
    }

    // 如果修改了课程编号，检查是否重复
    if (course_code) {
      const [duplicate] = await db.query('SELECT id FROM courses WHERE course_code = ? AND id != ?', [course_code, id]);
      if (duplicate.length > 0) {
        return res.status(400).json({ error: '课程编号已存在' });
      }
    }

    // 处理问卷配置（案例信息）
    const configJson = questionnaire_config ? JSON.stringify(questionnaire_config) : null;

    await db.query(
      `UPDATE courses SET theme_id = ?, instructor_id = ?, course_code = ?, title = ?, subtitle = ?, 
       instructor_intro = ?, course_intro = ?, questionnaire_config = ? WHERE id = ?`,
      [theme_id, instructor_id, course_code, title, subtitle || null, instructor_intro || null, course_intro, configJson, id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('更新课程错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

// 删除课程
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有排课记录
    const [schedules] = await db.query('SELECT COUNT(*) as count FROM course_schedules WHERE course_id = ?', [id]);
    if (schedules[0].count > 0) {
      return res.status(400).json({ error: '该课程已有排课记录，无法删除' });
    }

    await db.query('DELETE FROM courses WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除课程错误:', error);
    res.status(500).json({ error: '删除失败', details: error.message });
  }
});

// 获取排课列表（管理后台）
router.get('/schedules', async (req, res) => {
  try {
    const { course_id, date } = req.query;
    let query = `
      SELECT cs.*, 
             DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
             c.id as course_id, c.title as course_title, c.course_code, c.instructor_id,
             COALESCE((SELECT COUNT(*) FROM schedule_interests WHERE schedule_id = cs.id), 0) as interest_users_count,
             COALESCE(cs.interest_users_notified, 0) as interest_users_notified
      FROM course_schedules cs
      JOIN courses c ON cs.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (course_id) {
      query += ' AND cs.course_id = ?';
      params.push(course_id);
    }

    if (date) {
      query += ' AND DATE(cs.schedule_date) = ?';
      params.push(date);
    }

    query += ' ORDER BY cs.schedule_date DESC, cs.start_time ASC';

    const [schedules] = await db.query(query, params);
    
    // 调试日志：检查返回的数据中是否包含问卷字段
    if (schedules.length > 0) {
      const sampleSchedule = schedules[0];
      console.log('[排课列表API] 示例数据字段:', Object.keys(sampleSchedule));
      if (sampleSchedule.questionnaire_url || sampleSchedule.questionnaire_id) {
        console.log('[排课列表API] 找到问卷数据:', {
          id: sampleSchedule.id,
          questionnaire_url: sampleSchedule.questionnaire_url,
          questionnaire_id: sampleSchedule.questionnaire_id
        });
      }
    }
    
    const todayDate = today();
    
    // 处理数据，统一日期格式和状态显示
    const processedSchedules = schedules.map(schedule => {
      // 使用格式化后的日期，避免时区问题（统一使用东八区）
      const scheduleDateStr = schedule.schedule_date_formatted || schedule.schedule_date;
      const finalDateStr = normalizeDateString(scheduleDateStr);
      
      // 检查课程是否已完成：只有状态是completed且结束时间已过，才显示为已完成
      let displayStatus = schedule.status;
      if (schedule.status === 'completed') {
        // 如果状态是completed，检查结束时间是否已过
        if (schedule.end_time) {
          const endTimeStr = schedule.end_time.toString();
          const endDateTime = moment.tz(`${finalDateStr} ${endTimeStr}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
          const now = moment.tz('Asia/Shanghai');
          // 只有结束时间已过，才显示为已完成
          if (!now.isAfter(endDateTime) && !now.isSame(endDateTime)) {
            // 如果结束时间还没到，即使状态是completed，也显示为scheduled
            displayStatus = 'scheduled';
          }
        }
        // 如果没有结束时间，但状态是completed，保持completed（兼容旧数据）
      }
      // 如果状态是scheduled，无论日期是否已过，都保持scheduled，直到结束时间到了由定时任务更新为completed
      
      return {
        ...schedule,
        schedule_date: finalDateStr, // 统一使用格式化后的日期
        schedule_date_formatted: finalDateStr,
        status: displayStatus, // 显示状态（如果日期已过去，显示为已完成）
        original_status: schedule.status, // 保留原始状态
        checkin_triggered: schedule.checkin_triggered === 1 || schedule.checkin_triggered === true || false,
        questionnaire_triggered: schedule.questionnaire_triggered === 1 || schedule.questionnaire_triggered === true || false,
        interest_users_count: parseInt(schedule.interest_users_count || 0), // 添加意向会员数量
        interest_users_notified: (schedule.interest_users_notified !== undefined && schedule.interest_users_notified !== null) ? (schedule.interest_users_notified === 1 || schedule.interest_users_notified === true) : false, // 添加已通知状态
        questionnaire_url: schedule.questionnaire_url || null, // 明确包含问卷链接
        questionnaire_id: schedule.questionnaire_id || null // 明确包含问卷ID
      };
    });
    
    // 调试日志：检查处理后的数据中是否包含问卷字段
    if (processedSchedules.length > 0) {
      const sampleProcessed = processedSchedules[0];
      if (sampleProcessed.questionnaire_url || sampleProcessed.questionnaire_id) {
        console.log('[排课列表API] 处理后的数据包含问卷字段:', {
          id: sampleProcessed.id,
          questionnaire_url: sampleProcessed.questionnaire_url,
          questionnaire_id: sampleProcessed.questionnaire_id
        });
      }
    }
    
    res.json({ success: true, data: processedSchedules });
  } catch (error) {
    console.error('获取排课列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 导出排课列表到Excel（必须在 /schedules/:id 路由之前）
router.get('/schedules/export/excel', async (req, res) => {
  try {
    const { course_id, date } = req.query;
    
    // 使用与列表查询相同的查询逻辑，但不分页
    let query = `
      SELECT cs.*, 
             DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
             c.id as course_id, c.title as course_title, c.course_code, c.instructor_id,
             COALESCE((SELECT COUNT(*) FROM schedule_interests WHERE schedule_id = cs.id), 0) as interest_users_count,
             COALESCE(cs.interest_users_notified, 0) as interest_users_notified,
             cs.questionnaire_url,
             cs.questionnaire_id
      FROM course_schedules cs
      JOIN courses c ON cs.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (course_id) {
      query += ' AND cs.course_id = ?';
      params.push(course_id);
    }

    if (date) {
      query += ' AND DATE(cs.schedule_date) = ?';
      params.push(date);
    }

    query += ' ORDER BY cs.schedule_date DESC, cs.start_time ASC';

    const [schedules] = await db.query(query, params);
    
    const todayDate = today();
    
    // 格式化数据并准备Excel数据
    const excelData = schedules.map(schedule => {
      const scheduleDateStr = schedule.schedule_date_formatted || schedule.schedule_date;
      const finalDateStr = normalizeDateString(scheduleDateStr);
      
      // 处理状态
      let displayStatus = schedule.status;
      if (schedule.status === 'completed') {
        if (schedule.end_time) {
          const endTimeStr = schedule.end_time.toString();
          const endDateTime = moment.tz(`${finalDateStr} ${endTimeStr}`, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
          const now = moment.tz('Asia/Shanghai');
          if (!now.isAfter(endDateTime) && !now.isSame(endDateTime)) {
            displayStatus = 'scheduled';
          }
        }
      }
      
      // 处理时间段
      const timeSlotText = schedule.time_slot === 'morning' ? '上午' : 
                          schedule.time_slot === 'afternoon' ? '下午' : '全天';
      
      // 处理状态文本
      const statusText = displayStatus === 'draft' ? '待开课' :
                        displayStatus === 'scheduled' ? '已排课' :
                        displayStatus === 'cancelled' ? '已取消' :
                        displayStatus === 'completed' ? '已完成' : displayStatus;

      return {
        '课程编号': schedule.course_code || '-',
        '课程名称': schedule.course_title || '-',
        '上课日期': finalDateStr,
        '时间段': timeSlotText,
        '开始时间': schedule.start_time || '-',
        '结束时间': schedule.end_time || '-',
        '活动地点': schedule.location || '-',
        '最大人数': schedule.max_students || 0,
        '当前报名人数': schedule.current_students || 0,
        '报名情况': `${schedule.current_students || 0}/${schedule.max_students || 0}`,
        '状态': statusText,
        '课前问卷链接': schedule.questionnaire_url || '-',
        '课前问卷ID': schedule.questionnaire_id || '-'
      };
    });

    // 创建工作簿
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // 设置列宽
    const colWidths = [
      { wch: 15 },  // 课程编号
      { wch: 35 },  // 课程名称
      { wch: 12 },  // 上课日期
      { wch: 10 },  // 时间段
      { wch: 12 },  // 开始时间
      { wch: 12 },  // 结束时间
      { wch: 25 },  // 活动地点
      { wch: 12 },  // 最大人数
      { wch: 15 },  // 当前报名人数
      { wch: 15 },  // 报名情况
      { wch: 12 },  // 状态
      { wch: 40 },  // 课前问卷链接
      { wch: 15 }   // 课前问卷ID
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, '排课列表');

    // 生成Excel文件缓冲区
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // 设置响应头
    const filename = `排课列表_${moment().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    
    // 发送文件
    res.send(excelBuffer);
  } catch (error) {
    console.error('导出排课列表Excel错误:', error);
    res.status(500).json({ error: '导出失败', details: error.message });
  }
});

// 创建预排课（必须在 /schedules 之前定义，避免路由冲突）
router.post('/schedules/draft', async (req, res) => {
  try {
    const { course_id } = req.body;

    console.log('[创建预排课] 接收到的数据:', { course_id });

    if (!course_id) {
      return res.status(400).json({ error: '请提供课程ID' });
    }

    // 创建预排课，所有日期、时间、人数字段都设为NULL，状态设为'draft'
    const [result] = await db.query(
      `INSERT INTO course_schedules (course_id, schedule_date, time_slot, start_time, end_time, max_students, current_students, status)
       VALUES (?, NULL, NULL, NULL, NULL, NULL, 0, 'draft')`,
      [course_id]
    );

    console.log('[创建预排课] 插入成功，ID:', result.insertId);

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('创建预排课错误:', error);
    res.status(500).json({ error: '创建失败', details: error.message });
  }
});

// 创建排课
router.post('/schedules', async (req, res) => {
  try {
    const { course_id, schedule_date, time_slot, start_time, end_time, max_students, location, questionnaire_url, questionnaire_id } = req.body;

    console.log('[创建排课] 接收到的完整body:', JSON.stringify(req.body, null, 2));
    console.log('[创建排课] req.body.questionnaire_url:', req.body.questionnaire_url);
    console.log('[创建排课] req.body.questionnaire_id:', req.body.questionnaire_id);
    console.log('[创建排课] questionnaire_url 解构后:', questionnaire_url);
    console.log('[创建排课] questionnaire_id 解构后:', questionnaire_id);
    console.log('[创建排课] location 值:', location, '类型:', typeof location);
    console.log('[创建排课] schedule_date 类型:', typeof schedule_date);
    console.log('[创建排课] schedule_date 原始值:', JSON.stringify(schedule_date));

    if (!course_id || !schedule_date || !time_slot) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    // 处理日期：确保是 YYYY-MM-DD 格式的字符串
    // 对于纯日期字符串（如"2025-12-10"），直接使用，不进行时区转换
    let finalScheduleDate = '';
    if (typeof schedule_date === 'string') {
      const str = schedule_date.trim();
      // 如果已经是正确的日期格式，直接使用
      if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        finalScheduleDate = str;
      } else {
        // 否则使用normalizeDateString处理
        finalScheduleDate = normalizeDateString(schedule_date);
      }
    } else {
      finalScheduleDate = normalizeDateString(schedule_date);
    }
    
    if (!finalScheduleDate || !finalScheduleDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.error('[创建排课] 日期格式不正确:', finalScheduleDate);
      return res.status(400).json({ error: '日期格式不正确，应为 YYYY-MM-DD 格式' });
    }

    console.log('[创建排课] 最终使用的日期:', finalScheduleDate);

    // 设置默认时间
    let finalStartTime = start_time;
    let finalEndTime = end_time;
    if (!finalStartTime || !finalEndTime) {
      if (time_slot === 'morning') {
        finalStartTime = '09:00:00';
        finalEndTime = '12:00:00';
      } else if (time_slot === 'afternoon') {
        finalStartTime = '14:00:00';
        finalEndTime = '17:00:00';
      } else {
        finalStartTime = '09:00:00';
        finalEndTime = '17:00:00';
      }
    }

    // 处理问卷数据
    const finalQuestionnaireUrl = (questionnaire_url && questionnaire_url.trim()) ? questionnaire_url.trim() : null;
    const finalQuestionnaireId = (questionnaire_id && questionnaire_id.trim()) ? questionnaire_id.trim() : null;
    
    console.log('[创建排课] 准备插入的问卷数据:', { 
      questionnaire_url: finalQuestionnaireUrl, 
      questionnaire_id: finalQuestionnaireId,
      raw_questionnaire_url: questionnaire_url,
      raw_questionnaire_id: questionnaire_id
    });

    const insertParams = [
      course_id, 
      finalScheduleDate, 
      time_slot, 
      finalStartTime, 
      finalEndTime, 
      max_students || 20, 
      (location && location.trim()) ? location.trim() : null,
      finalQuestionnaireUrl,
      finalQuestionnaireId
    ];
    
    console.log('[创建排课] INSERT参数:', JSON.stringify(insertParams, null, 2));
    console.log('[创建排课] INSERT参数长度:', insertParams.length);
    console.log('[创建排课] INSERT参数第8个(questionnaire_url):', insertParams[7]);
    console.log('[创建排课] INSERT参数第9个(questionnaire_id):', insertParams[8]);

    const [result] = await db.query(
      `INSERT INTO course_schedules (course_id, schedule_date, time_slot, start_time, end_time, max_students, location, questionnaire_url, questionnaire_id, current_students, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'scheduled')`,
      insertParams
    );

    console.log('[创建排课] 插入成功，ID:', result.insertId);
    console.log('[创建排课] 插入的问卷数据:', { questionnaire_url: finalQuestionnaireUrl, questionnaire_id: finalQuestionnaireId });

    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    console.error('创建排课错误:', error);
    res.status(500).json({ error: '创建失败', details: error.message });
  }
});

// 更新排课
router.put('/schedules/:id', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    let { schedule_date, time_slot, start_time, end_time, max_students, location, questionnaire_url, questionnaire_id, status, notify_interest_users } = req.body;

    console.log('[更新排课] 接收到的数据:', { id, schedule_date, time_slot, start_time, end_time, max_students, location, status, notify_interest_users });
    console.log('[更新排课] schedule_date 类型:', typeof schedule_date);

    // 处理日期：确保是 YYYY-MM-DD 格式的字符串，使用东八区
    if (schedule_date) {
      schedule_date = normalizeDateString(schedule_date);
    }

    console.log('[更新排课] 处理后的日期:', schedule_date);

    await connection.beginTransaction();

    // 获取当前排课信息
    const [currentSchedules] = await connection.query(
      `SELECT cs.*, c.title as course_title, c.course_code
       FROM course_schedules cs
       JOIN courses c ON cs.course_id = c.id
       WHERE cs.id = ?`,
      [id]
    );

    if (currentSchedules.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: '排课不存在' });
    }

    const currentSchedule = currentSchedules[0];
    const oldStatus = currentSchedule.status;
    const newStatus = status || 'scheduled';
    const shouldNotify = notify_interest_users === true || notify_interest_users === 'true' || notify_interest_users === 1;

    // 更新排课
    let interestUsersNotified = currentSchedule.interest_users_notified || false;
    
    // 如果从待开课状态转为已排课状态，且管理员选择了通知意向用户
    if (oldStatus === 'draft' && newStatus === 'scheduled' && shouldNotify) {
      // 获取所有意向用户
      const [interestUsers] = await connection.query(
        'SELECT DISTINCT user_id FROM schedule_interests WHERE schedule_id = ?',
        [id]
      );

      if (interestUsers.length > 0) {
        const userIds = interestUsers.map(u => u.user_id);
        const scheduleDateStr = schedule_date ? moment(schedule_date).format('YYYY-MM-DD') : '待定';
        let timeSlotText = time_slot === 'morning' ? '上午' : time_slot === 'afternoon' ? '下午' : '全天';
        
        // 如果有具体时间，添加到时间段后面
        if (start_time && end_time) {
          const startTimeStr = moment(start_time, 'HH:mm:ss').format('HH:mm');
          const endTimeStr = moment(end_time, 'HH:mm:ss').format('HH:mm');
          timeSlotText += ` ${startTimeStr}-${endTimeStr}`;
        }
        
        const locationText = location ? `\n上课地点：${location}` : '';
        
        // 为每个意向用户创建通知
        for (const userId of userIds) {
          await connection.query(
            `INSERT INTO system_messages (user_id, type, schedule_id, title, content, published, created_at)
             VALUES (?, 'schedule_available', ?, ?, ?, 1, NOW())`,
            [
              userId,
              id, // schedule_id
              '课程已开课',
              `您关注的课程"${currentSchedule.course_title}"已正式开课！\n开课日期：${scheduleDateStr}\n时间段：${timeSlotText}${locationText}\n请及时预订，以免错过。`
            ]
          );
        }
        
        interestUsersNotified = true;
        console.log(`[更新排课] 已为 ${userIds.length} 位意向用户发送开课通知`);
      }
    }
    
    // 构建UPDATE语句，如果interest_users_notified字段不存在，不包含该字段
    let updateFields = [
      'schedule_date = ?',
      'time_slot = ?',
      'start_time = ?',
      'end_time = ?',
      'max_students = ?',
      'location = ?',
      'questionnaire_url = ?',
      'questionnaire_id = ?',
      'status = ?'
    ];
    let updateParams = [
      schedule_date,
      time_slot,
      start_time,
      end_time,
      max_students,
      (location && location.trim()) ? location.trim() : null,
      (questionnaire_url && questionnaire_url.trim()) ? questionnaire_url.trim() : null,
      (questionnaire_id && questionnaire_id.trim()) ? questionnaire_id.trim() : null,
      newStatus
    ];
    
    // 尝试添加interest_users_notified字段（如果表结构支持）
    try {
      // 检查字段是否存在（通过查询表结构）
      const [columns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'course_schedules' 
         AND COLUMN_NAME = 'interest_users_notified'`
      );
      if (columns.length > 0) {
        updateFields.push('interest_users_notified = ?');
        updateParams.push(interestUsersNotified);
      }
    } catch (err) {
      // 如果检查失败，忽略（字段可能不存在，但不影响更新）
      console.warn('[更新排课] 检查interest_users_notified字段失败，跳过该字段更新');
    }
    
    updateParams.push(id);
    await connection.query(
      `UPDATE course_schedules SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    // 如果状态变为取消，发送消息给所有已报名的用户
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      const [bookings] = await connection.query(
        `SELECT cb.user_id, u.real_name, u.nickname, u.member_id
         FROM course_bookings cb
         JOIN users u ON cb.user_id = u.id
         WHERE cb.schedule_id = ? AND cb.status = 'booked'`,
        [id]
      );

      if (bookings.length > 0) {
        // 使用统一的日期格式化逻辑，避免时区问题
        let scheduleDateStr = schedule_date || currentSchedule.schedule_date;
        if (scheduleDateStr) {
          const dateStr = scheduleDateStr.toString();
          if (dateStr.includes('T')) {
            scheduleDateStr = dateStr.split('T')[0];
          } else if (dateStr.includes(' ')) {
            scheduleDateStr = dateStr.split(' ')[0];
          }
        }
        const dateStr = scheduleDateStr; // 直接使用格式化的日期字符串
        
        // 为每个用户创建取消消息
        for (const booking of bookings) {
          await connection.query(
            `INSERT INTO system_messages (user_id, type, title, content, published, created_at) 
             VALUES (?, ?, ?, ?, 1, NOW())`,
            [
              booking.user_id,
              'course_cancelled',
              '课程取消通知',
              `很抱歉，您已报名的课程"${currentSchedule.course_title}"（${dateStr}）已取消，您的课券已自动退还。如有疑问，请联系客服。`
            ]
          );
        }
        
        console.log(`已为 ${bookings.length} 位用户发送课程取消通知`);
      }
    }

    await connection.commit();
    connection.release();

    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('更新排课错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

// 删除排课
router.delete('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有预订记录
    const [bookings] = await db.query('SELECT COUNT(*) as count FROM course_bookings WHERE schedule_id = ?', [id]);
    if (bookings[0].count > 0) {
      return res.status(400).json({ error: '该排课已有预订记录，无法删除' });
    }

    await db.query('DELETE FROM course_schedules WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除排课错误:', error);
    res.status(500).json({ error: '删除失败', details: error.message });
  }
});

// 教师触发问卷（课程结束前）
router.post('/schedules/:id/trigger-questionnaire', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const { instructor_id } = req.body;

    // 检查排课是否存在
    const [schedules] = await connection.query(
      `SELECT cs.*, c.instructor_id, c.title as course_title
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
    if (schedule.instructor_id != instructor_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({ error: '只有该课程的教练才能触发问卷' });
    }

    // 检查是否已经触发过
    if (schedule.questionnaire_triggered) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '问卷已经触发过' });
    }

    // 更新问卷触发状态
    await connection.query(
      'UPDATE course_schedules SET questionnaire_triggered = TRUE WHERE id = ?',
      [id]
    );

    // 获取所有已预订该课程的学员
    const [bookings] = await connection.query(
      `SELECT cb.user_id, u.nickname
       FROM course_bookings cb
       JOIN users u ON cb.user_id = u.id
       WHERE cb.schedule_id = ? AND cb.status IN ('booked', 'completed')`,
      [id]
    );

    // 为每个学员发送系统消息提醒
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
      message: `问卷已触发，已通知 ${bookings.length} 位学员`,
      notified_count: bookings.length
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('触发问卷错误:', error);
    res.status(500).json({ error: '触发失败', details: error.message });
  }
});

module.exports = router;

