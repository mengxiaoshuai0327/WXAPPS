const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const moment = require('moment');

// 获取待评价列表（按预订人分组）- 必须在 /:id 之前
router.get('/pending-list', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, course_id, instructor_id, has_triggered, has_evaluated } = req.query;
    
    let query = `
      SELECT 
        cs.id as schedule_id,
        cs.schedule_date,
        cs.time_slot,
        cs.start_time,
        cs.end_time,
        cs.questionnaire_triggered,
        CASE 
          WHEN cs.questionnaire_triggered = 1 THEN cs.updated_at 
          ELSE NULL 
        END as trigger_time,
        c.id as course_id,
        c.title as course_title,
        c.course_code,
        u_instructor.id as instructor_id,
        u_instructor.nickname as instructor_name,
        u_instructor.real_name as instructor_real_name,
        cb.id as booking_id,
        cb.user_id,
        cb.status as booking_status,
        u_member.nickname as member_name,
        u_member.real_name as member_real_name,
        u_member.member_id,
        e.id as evaluation_id,
        e.submitted_at as evaluation_time,
        CASE 
          WHEN e.id IS NOT NULL THEN 1
          ELSE 0
        END as has_evaluated
      FROM course_bookings cb
      JOIN course_schedules cs ON cb.schedule_id = cs.id
      JOIN courses c ON cs.course_id = c.id
      JOIN users u_instructor ON c.instructor_id = u_instructor.id
      JOIN users u_member ON cb.user_id = u_member.id
      LEFT JOIN evaluations e ON cb.user_id = e.user_id AND cs.id = e.schedule_id
      WHERE cb.status IN ('booked', 'completed')
    `;
    const params = [];

    if (course_id) {
      query += ' AND c.id = ?';
      params.push(course_id);
    }

    if (instructor_id) {
      query += ' AND c.instructor_id = ?';
      params.push(instructor_id);
    }

    if (has_triggered !== undefined) {
      if (has_triggered === '1' || has_triggered === 'true') {
        query += ' AND cs.questionnaire_triggered = 1';
      } else {
        query += ' AND (cs.questionnaire_triggered = 0 OR cs.questionnaire_triggered IS NULL)';
      }
    }

    if (has_evaluated !== undefined) {
      if (has_evaluated === '1' || has_evaluated === 'true') {
        query += ' AND e.id IS NOT NULL';
      } else {
        query += ' AND e.id IS NULL';
      }
    }

    // 获取总数
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0]?.total || 0;

    // 排序和分页
    query += ' ORDER BY cs.schedule_date DESC, cs.id DESC, cb.id DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [results] = await db.query(query, params);

    // 格式化数据
    const formattedData = results.map(row => ({
      schedule_id: row.schedule_id,
      course_id: row.course_id,
      course_title: row.course_title,
      course_code: row.course_code,
      instructor_id: row.instructor_id,
      instructor_name: row.instructor_name || row.instructor_real_name || '未知',
      booking_id: row.booking_id,
      member_id: row.user_id,
      member_name: row.member_name || row.member_real_name || '未知',
      member_code: row.member_id,
      questionnaire_triggered: row.questionnaire_triggered === 1 || row.questionnaire_triggered === true,
      trigger_time: row.questionnaire_triggered ? (row.trigger_time || null) : null,
      has_evaluated: row.has_evaluated === 1,
      evaluation_id: row.evaluation_id || null,
      evaluation_time: row.evaluation_time || null,
      schedule_date: moment(row.schedule_date).format('YYYY-MM-DD'),
      time_slot_text: row.time_slot === 'morning' ? '上午' : row.time_slot === 'afternoon' ? '下午' : '全天',
      start_time: row.start_time ? moment(row.start_time, 'HH:mm:ss').format('HH:mm') : '',
      end_time: row.end_time ? moment(row.end_time, 'HH:mm:ss').format('HH:mm') : ''
    }));

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
    console.error('获取待评价列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取课程评价跟进列表（排课数据）
router.get('/follow-up', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, course_id, instructor_id, status } = req.query;
    
    let query = `
      SELECT cs.*, 
             c.id as course_id, c.title as course_title, c.course_code,
             u.nickname as instructor_name,
             COUNT(cb.id) as booking_count,
             COUNT(CASE WHEN cb.status IN ('booked', 'completed') THEN 1 END) as active_booking_count,
             COUNT(e.id) as evaluation_count
      FROM course_schedules cs
      JOIN courses c ON cs.course_id = c.id
      JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_bookings cb ON cs.id = cb.schedule_id
      LEFT JOIN evaluations e ON cs.id = e.schedule_id
      WHERE 1=1
    `;
    const params = [];

    if (course_id) {
      query += ' AND cs.course_id = ?';
      params.push(course_id);
    }

    if (instructor_id) {
      query += ' AND c.instructor_id = ?';
      params.push(instructor_id);
    }

    if (status) {
      if (status === 'triggered') {
        query += ' AND cs.questionnaire_triggered = 1';
      } else if (status === 'not_triggered') {
        query += ' AND (cs.questionnaire_triggered = 0 OR cs.questionnaire_triggered IS NULL)';
      }
    }

    // 分组
    query += ' GROUP BY cs.id';

    // 获取总数
    const countQuery = query.replace(/SELECT cs\.\*.*?FROM/, 'SELECT COUNT(DISTINCT cs.id) as total FROM');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0]?.total || 0;

    // 分页
    query += ' ORDER BY cs.schedule_date DESC, cs.start_time ASC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [schedules] = await db.query(query, params);

    // 格式化数据
    const processedSchedules = schedules.map(schedule => {
      const evaluationStatus = schedule.questionnaire_triggered 
        ? '已触发评价' 
        : (schedule.status === 'completed' ? '待触发评价' : '未开始');
      
      return {
        ...schedule,
        evaluation_status: evaluationStatus,
        evaluation_status_code: schedule.questionnaire_triggered ? 'triggered' : (schedule.status === 'completed' ? 'pending' : 'not_started'),
        schedule_date_formatted: moment(schedule.schedule_date).format('YYYY-MM-DD'),
        time_slot_text: schedule.time_slot === 'morning' ? '上午' : 
                        schedule.time_slot === 'afternoon' ? '下午' : '全天'
      };
    });

    res.json({
      success: true,
      data: processedSchedules,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取课程评价跟进列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取评价列表（评价明细）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, course_id, schedule_id } = req.query;
    
    let query = `
      SELECT e.*, 
             u.nickname as user_name, u.member_id as user_member_id,
             c.title as course_title, c.course_code, c.questionnaire_config,
             cs.schedule_date, cs.time_slot
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      JOIN courses c ON e.course_id = c.id
      JOIN course_schedules cs ON e.schedule_id = cs.id
      WHERE 1=1
    `;
    const params = [];

    if (course_id) {
      query += ' AND e.course_id = ?';
      params.push(course_id);
    }

    if (schedule_id) {
      query += ' AND e.schedule_id = ?';
      params.push(schedule_id);
    }

    // 获取总数
    const countQuery = query.replace(/SELECT e\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0]?.total || 0;

    // 分页
    query += ' ORDER BY e.submitted_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [evaluations] = await db.query(query, params);

    // 格式化数据
    const processedEvaluations = evaluations.map(eval => {
      let answers = {};
      try {
        if (eval.answers) {
          answers = typeof eval.answers === 'string' 
            ? JSON.parse(eval.answers) 
            : eval.answers;
        }
      } catch (e) {
        console.error('解析答案失败:', e);
      }

      // 解析课程问卷配置（案例信息）
      let courseCases = [];
      if (eval.questionnaire_config) {
        try {
          const config = typeof eval.questionnaire_config === 'string'
            ? JSON.parse(eval.questionnaire_config)
            : eval.questionnaire_config;
          if (config && config.cases && Array.isArray(config.cases)) {
            courseCases = config.cases;
          }
        } catch (e) {
          console.error('解析课程问卷配置失败:', e);
        }
      }

      return {
        ...eval,
        answers,
        course_cases: courseCases, // 课程的案例列表
        submitted_at_formatted: moment(eval.submitted_at).format('YYYY-MM-DD HH:mm:ss'),
        schedule_date_formatted: moment(eval.schedule_date).format('YYYY-MM-DD'),
        time_slot_text: eval.time_slot === 'morning' ? '上午' : 
                        eval.time_slot === 'afternoon' ? '下午' : '全天'
      };
    });

    res.json({
      success: true,
      data: processedEvaluations,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取评价列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取案例评分明细列表（必须在 /:id 之前）
router.get('/case-details', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, course_id, schedule_id } = req.query;
    
    console.log('[案例评分明细] 查询参数:', { page, pageSize, course_id, schedule_id });
    
    // 获取所有评价数据（包含案例评分）
    let query = `
      SELECT e.id as evaluation_id, e.schedule_id, e.course_id, e.answers, e.submitted_at,
             u.nickname as user_name, u.member_id as user_member_id,
             c.title as course_title, c.course_code, c.questionnaire_config,
             cs.schedule_date, cs.time_slot
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      JOIN courses c ON e.course_id = c.id
      JOIN course_schedules cs ON e.schedule_id = cs.id
      WHERE e.answers IS NOT NULL AND e.answers != '' AND e.answers != '{}'
    `;
    const params = [];

    if (course_id) {
      query += ' AND e.course_id = ?';
      params.push(course_id);
    }

    if (schedule_id) {
      query += ' AND e.schedule_id = ?';
      params.push(schedule_id);
    }

    // 先获取所有评价数据（不分页），因为需要展开为多行
    query += ' ORDER BY e.submitted_at DESC';
    const [evaluations] = await db.query(query, params);
    
    console.log('[案例评分明细] 查询到的评价数量:', evaluations.length);

    // 处理评价数据，将每个案例展开为单独的行
    const caseDetailsList = [];
    
    evaluations.forEach((eval, evalIndex) => {
      let answers = {};
      try {
        if (eval.answers) {
          answers = typeof eval.answers === 'string' 
            ? JSON.parse(eval.answers) 
            : eval.answers;
        }
      } catch (e) {
        console.error(`[案例评分明细] 解析答案失败 (评价${evalIndex + 1}):`, e);
        answers = {};
      }
      
      console.log(`[案例评分明细] 评价${evalIndex + 1} (ID: ${eval.evaluation_id}):`, {
        hasQ6: !!answers.q6,
        q6Type: typeof answers.q6,
        q6Content: answers.q6
      });

      // 解析课程问卷配置（案例信息）
      let courseCases = [];
      if (eval.questionnaire_config) {
        try {
          const config = typeof eval.questionnaire_config === 'string'
            ? JSON.parse(eval.questionnaire_config)
            : eval.questionnaire_config;
          if (config && config.cases && Array.isArray(config.cases)) {
            courseCases = config.cases;
          }
        } catch (e) {
          console.error('解析课程问卷配置失败:', e);
        }
      }

      // 如果没有课程案例配置，使用默认的case1-case6
      if (courseCases.length === 0) {
        for (let i = 1; i <= 6; i++) {
          courseCases.push({ id: `case${i}`, name: `案例${i}` });
        }
      }

      // 提取案例评分，每个案例作为一行
      if (answers.q6 && typeof answers.q6 === 'object') {
        courseCases.forEach(caseItem => {
          const caseId = caseItem.id || caseItem;
          const caseName = caseItem.name || caseItem;
          const score = answers.q6[caseId];

          // 即使没有评分，也显示该案例（评分为null或0）
          caseDetailsList.push({
            evaluation_id: eval.evaluation_id,
            course_id: eval.course_id,
            course_title: eval.course_title,
            course_code: eval.course_code,
            user_name: eval.user_name,
            user_member_id: eval.user_member_id,
            schedule_date: moment(eval.schedule_date).format('YYYY-MM-DD'),
            time_slot: eval.time_slot === 'morning' ? '上午' : (eval.time_slot === 'afternoon' ? '下午' : '全天'),
            submitted_at: moment(eval.submitted_at).format('YYYY-MM-DD HH:mm:ss'),
            case_id: caseId,
            case_name: caseName,
            case_score: (score && typeof score === 'number' && score >= 1 && score <= 5) ? score : null
          });
        });
      } else {
        // 如果没有q6数据，仍然显示所有案例，但评分为null
        courseCases.forEach(caseItem => {
          const caseId = caseItem.id || caseItem;
          const caseName = caseItem.name || caseItem;
          caseDetailsList.push({
            evaluation_id: eval.evaluation_id,
            course_id: eval.course_id,
            course_title: eval.course_title,
            course_code: eval.course_code,
            user_name: eval.user_name,
            user_member_id: eval.user_member_id,
            schedule_date: moment(eval.schedule_date).format('YYYY-MM-DD'),
            time_slot: eval.time_slot === 'morning' ? '上午' : (eval.time_slot === 'afternoon' ? '下午' : '全天'),
            submitted_at: moment(eval.submitted_at).format('YYYY-MM-DD HH:mm:ss'),
            case_id: caseId,
            case_name: caseName,
            case_score: null
          });
        });
      }
    });

    // 手动分页（在展开后）
    const total = caseDetailsList.length;
    const startIndex = (parseInt(page) - 1) * parseInt(pageSize);
    const endIndex = startIndex + parseInt(pageSize);
    const paginatedList = caseDetailsList.slice(startIndex, endIndex);
    
    console.log('[案例评分明细] 处理结果:', {
      评价数量: evaluations.length,
      展开后总行数: total,
      分页后行数: paginatedList.length,
      当前页: parseInt(page),
      每页大小: parseInt(pageSize)
    });

    res.json({
      success: true,
      data: paginatedList,
      pagination: {
        total: total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取案例评分明细列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取未来课程报名反馈列表（必须在 /:id 之前）
router.get('/course-registration-feedback', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, course_id, schedule_id } = req.query;
    
    // 获取所有评价数据（包含Q8未来课程报名反馈）
    let query = `
      SELECT e.id as evaluation_id, e.schedule_id, e.course_id, e.answers, e.submitted_at,
             u.nickname as user_name, u.member_id as user_member_id, u.phone as user_phone,
             c.title as course_title, c.course_code,
             cs.schedule_date, cs.time_slot
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      JOIN courses c ON e.course_id = c.id
      JOIN course_schedules cs ON e.schedule_id = cs.id
      WHERE e.answers IS NOT NULL AND e.answers != ''
      AND JSON_EXTRACT(e.answers, '$.q8') IS NOT NULL
    `;
    const params = [];

    if (course_id) {
      query += ' AND e.course_id = ?';
      params.push(course_id);
    }

    if (schedule_id) {
      query += ' AND e.schedule_id = ?';
      params.push(schedule_id);
    }

    // 先获取所有评价数据（不分页），因为需要过滤出有Q8答案的
    query += ' ORDER BY e.submitted_at DESC';
    const [evaluations] = await db.query(query, params);

    // 处理评价数据，提取Q8未来课程报名反馈
    const feedbackList = [];
    evaluations.forEach(eval => {
      let answers = {};
      try {
        if (eval.answers) {
          answers = typeof eval.answers === 'string' 
            ? JSON.parse(eval.answers) 
            : eval.answers;
        }
      } catch (e) {
        console.error('解析答案失败:', e);
        answers = {};
      }

      // 提取Q8的答案（兼容新旧格式）
      if (answers.q8 && typeof answers.q8 === 'object') {
        // 检查是否有有效的答案（row1, row2, row3）
        const row1Answer = answers.q8.row1;
        const row2Answer = answers.q8.row2;
        const row3Answer = answers.q8.row3;
        const hasValidAnswer = row1Answer || row2Answer || row3Answer;
        
        if (hasValidAnswer) {
          feedbackList.push({
            evaluation_id: eval.evaluation_id,
            course_id: eval.course_id,
            course_title: eval.course_title,
            course_code: eval.course_code,
            user_name: eval.user_name,
            user_member_id: eval.user_member_id,
            user_phone: eval.user_phone,
            schedule_id: eval.schedule_id,
            schedule_date: eval.schedule_date,
            time_slot: eval.time_slot,
            submitted_at: eval.submitted_at,
            // Q8的三个问题答案（兼容新旧格式：col1/col2/col3 或 A/B/C）
            row1_answer: row1Answer || null, // 本次私教在本主题下的延伸课程
            row2_answer: row2Answer || null, // 本次私教在其他主题下的课程
            row3_answer: row3Answer || null  // 本主题下，其他私教的课程
          });
        }
      }
    });

    // 手动分页（在过滤后）
    const total = feedbackList.length;
    const startIndex = (parseInt(page) - 1) * parseInt(pageSize);
    const endIndex = startIndex + parseInt(pageSize);
    const paginatedList = feedbackList.slice(startIndex, endIndex);

    const processedList = paginatedList.map(item => ({
      ...item,
      submitted_at_formatted: moment(item.submitted_at).format('YYYY-MM-DD HH:mm:ss'),
      schedule_date_formatted: moment(item.schedule_date).format('YYYY-MM-DD'),
      time_slot_text: item.time_slot === 'morning' ? '上午' : (item.time_slot === 'afternoon' ? '下午' : '全天')
    }));

    res.json({
      success: true,
      data: processedList,
      pagination: {
        total: total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取未来课程报名反馈列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取课程评价统计表（必须在 /:id 之前，避免路由冲突）
router.get('/statistics', async (req, res) => {
  try {
    const { instructor_id, course_id } = req.query;
    
    let query = `
      SELECT 
        c.id as course_id,
        c.title as course_title,
        c.course_code,
        u.id as instructor_id,
        u.nickname as instructor_name,
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
        -- 案例评分平均值（q6是JSON对象，需要特殊处理）
        -- 使用子查询计算所有案例评分的平均值
        (SELECT AVG(case_score)
         FROM (
           SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(value, '$')) AS DECIMAL(3,2)) as case_score
           FROM evaluations e2
           CROSS JOIN JSON_TABLE(
             JSON_EXTRACT(e2.answers, '$.q6'),
             '$.*' COLUMNS (value JSON PATH '$')
           ) AS jt
           WHERE e2.course_id = c.id 
             AND e2.status = 'submitted'
             AND JSON_EXTRACT(e2.answers, '$.q6') IS NOT NULL
         ) as case_scores
         WHERE case_score IS NOT NULL AND case_score >= 1 AND case_score <= 5
        ) as avg_case_score,
        -- Q1各选项统计
        SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q1')) = 'A' THEN 1 ELSE 0 END) as q1_a_count,
        SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q1')) = 'B' THEN 1 ELSE 0 END) as q1_b_count,
        SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q1')) = 'C' THEN 1 ELSE 0 END) as q1_c_count,
        SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q1')) = 'D' THEN 1 ELSE 0 END) as q1_d_count,
        SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q1')) = 'E' THEN 1 ELSE 0 END) as q1_e_count,
        -- Q9各选项统计
        SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q9')) = 'A' THEN 1 ELSE 0 END) as q9_a_count,
        SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(e.answers, '$.q9')) = 'B' THEN 1 ELSE 0 END) as q9_b_count
      FROM courses c
      JOIN users u ON c.instructor_id = u.id
      LEFT JOIN course_schedules cs ON cs.course_id = c.id
      LEFT JOIN evaluations e ON e.course_id = c.id AND e.status = 'submitted'
      LEFT JOIN course_bookings cb ON cb.schedule_id = cs.id AND cb.status IN ('booked', 'completed')
      WHERE 1=1
    `;
    const params = [];

    if (instructor_id) {
      query += ' AND c.instructor_id = ?';
      params.push(instructor_id);
    }

    if (course_id) {
      query += ' AND c.id = ?';
      params.push(course_id);
    }

    query += ' GROUP BY c.id, c.title, c.course_code, u.id, u.nickname';
    query += ' ORDER BY c.id DESC';

    console.log('[评价统计] 执行SQL查询');
    console.log('[评价统计] SQL:', query.substring(0, 200) + '...');
    console.log('[评价统计] 参数:', params);
    
    const [results] = await db.query(query, params);
    
    console.log('[评价统计] 查询成功，结果数量:', results.length);

    // 格式化数据
    const formattedResults = results.map(row => ({
      course_id: row.course_id,
      course_title: row.course_title,
      course_code: row.course_code,
      instructor_id: row.instructor_id,
      instructor_name: row.instructor_name,
      schedule_count: parseInt(row.schedule_count) || 0,
      evaluation_count: parseInt(row.evaluation_count) || 0,
      booking_count: parseInt(row.booking_count) || 0,
      avg_q1_score: row.avg_q1_score ? parseFloat(row.avg_q1_score).toFixed(2) : null,
      avg_q2_score: row.avg_q2_score ? parseFloat(row.avg_q2_score).toFixed(2) : null,
      avg_q3_score: row.avg_q3_score ? parseFloat(row.avg_q3_score).toFixed(2) : null,
      avg_q4_score: row.avg_q4_score ? parseFloat(row.avg_q4_score).toFixed(2) : null,
      avg_q9_score: row.avg_q9_score ? parseFloat(row.avg_q9_score).toFixed(2) : null,
      avg_case_score: row.avg_case_score ? parseFloat(row.avg_case_score).toFixed(2) : null,
      q1_a_count: parseInt(row.q1_a_count) || 0,
      q1_b_count: parseInt(row.q1_b_count) || 0,
      q1_c_count: parseInt(row.q1_c_count) || 0,
      q1_d_count: parseInt(row.q1_d_count) || 0,
      q1_e_count: parseInt(row.q1_e_count) || 0,
      q9_a_count: parseInt(row.q9_a_count) || 0,
      q9_b_count: parseInt(row.q9_b_count) || 0
    }));

    res.json({ success: true, data: formattedResults });
  } catch (error) {
    console.error('获取课程评价统计错误:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取评价详情（必须在 /statistics 之后）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [evaluations] = await db.query(
      `SELECT e.*, 
              u.nickname as user_name, u.member_id as user_member_id, u.phone,
              c.title as course_title, c.course_code, c.questionnaire_config,
              cs.schedule_date, cs.time_slot
       FROM evaluations e
       JOIN users u ON e.user_id = u.id
       JOIN courses c ON e.course_id = c.id
       JOIN course_schedules cs ON e.schedule_id = cs.id
       WHERE e.id = ?`,
      [id]
    );

    if (evaluations.length === 0) {
      return res.status(404).json({ error: '评价不存在' });
    }

    const evaluation = evaluations[0];
    let answers = {};
    try {
      if (evaluation.answers) {
        answers = typeof evaluation.answers === 'string' 
          ? JSON.parse(evaluation.answers) 
          : evaluation.answers;
      }
    } catch (e) {
      console.error('解析答案失败:', e);
    }

    evaluation.answers = answers;
    
    // 解析课程问卷配置（案例信息）
    let courseCases = [];
    if (evaluation.questionnaire_config) {
      try {
        const config = typeof evaluation.questionnaire_config === 'string'
          ? JSON.parse(evaluation.questionnaire_config)
          : evaluation.questionnaire_config;
        if (config && config.cases && Array.isArray(config.cases)) {
          courseCases = config.cases;
        }
      } catch (e) {
        console.error('解析课程问卷配置失败:', e);
      }
    }
    evaluation.course_cases = courseCases;
    
    evaluation.submitted_at_formatted = moment(evaluation.submitted_at).format('YYYY-MM-DD HH:mm:ss');
    evaluation.schedule_date_formatted = moment(evaluation.schedule_date).format('YYYY-MM-DD');
    evaluation.time_slot_text = evaluation.time_slot === 'morning' ? '上午' : 
                                 evaluation.time_slot === 'afternoon' ? '下午' : '全天';

    res.json({ success: true, data: evaluation });
  } catch (error) {
    console.error('获取评价详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 删除评价
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM evaluations WHERE id = ?', [id]);
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除评价错误:', error);
    res.status(500).json({ error: '删除失败', details: error.message });
  }
});

module.exports = router;
