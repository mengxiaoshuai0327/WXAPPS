const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

// 获取待评价课程（只显示已触发问卷的课程）- 必须在 /:id 之前
router.get('/pending', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    const userId = parseInt(user_id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: '用户ID格式错误' });
    }

    // 获取已触发问卷且用户已预订但未评价的课程（排除教练自己的课程）
    // 只要已触发问卷就应该显示，不限制日期
    const [bookings] = await db.query(
      `SELECT cb.*, cs.schedule_date, cs.time_slot, cs.id as schedule_id, 
              c.id as course_id, c.title, c.instructor_id,
              cs.questionnaire_triggered,
              u_instructor.nickname as instructor_name
       FROM course_bookings cb
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       JOIN courses c ON cs.course_id = c.id
       JOIN users u_instructor ON c.instructor_id = u_instructor.id
       WHERE cb.user_id = ? 
       AND cb.status IN ('booked', 'completed')
       AND (cs.questionnaire_triggered = 1 OR cs.questionnaire_triggered = TRUE)
       AND c.instructor_id != ?  -- 排除教练自己的课程
       AND NOT EXISTS (
         SELECT 1 FROM evaluations e 
         WHERE e.user_id = ? AND e.schedule_id = cs.id
       )
       ORDER BY cs.schedule_date DESC
       LIMIT 10`,
      [userId, userId, userId]
    );

    console.log(`[待评价课程] 用户ID: ${userId}, 查询结果数量: ${bookings.length}`);
    res.json({ success: true, data: bookings });
  } catch (error) {
    console.error('获取待评价课程错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取已评价课程列表 - 必须在 /:id 之前
router.get('/completed', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    const userId = parseInt(user_id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: '用户ID格式错误' });
    }

    // 获取用户已提交的评价
    const [evaluations] = await db.query(
      `SELECT e.*, 
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date, 
              cs.time_slot, cs.id as schedule_id,
              c.id as course_id, c.title, c.course_code,
              u_instructor.nickname as instructor_name
       FROM evaluations e
       JOIN course_schedules cs ON e.schedule_id = cs.id
       JOIN courses c ON cs.course_id = c.id
       LEFT JOIN users u_instructor ON c.instructor_id = u_instructor.id
       WHERE e.user_id = ?
       ORDER BY e.submitted_at DESC
       LIMIT 50`,
      [userId]
    );

    // 格式化数据（schedule_date已经在SQL中使用DATE_FORMAT格式化为YYYY-MM-DD）
    const formattedEvaluations = evaluations.map(eval => {
      let formattedDate = eval.schedule_date;
      let timeSlotText = '';
      
      // schedule_date已经是YYYY-MM-DD格式，直接使用
      if (eval.schedule_date && typeof eval.schedule_date !== 'string') {
        formattedDate = String(eval.schedule_date);
      }
      
      // 格式化时间段
      if (eval.time_slot) {
        const timeSlot = eval.time_slot.toString().toLowerCase().trim();
        if (timeSlot === 'morning') {
          timeSlotText = '上午';
        } else if (timeSlot === 'afternoon') {
          timeSlotText = '下午';
        } else if (timeSlot === 'full_day' || timeSlot === 'fullday') {
          timeSlotText = '全天';
        }
      }
      
      // 格式化提交时间
      let submittedAtFormatted = '';
      if (eval.submitted_at) {
        const submittedDate = moment(eval.submitted_at);
        submittedAtFormatted = submittedDate.format('YYYY-MM-DD HH:mm');
      }
      
      return {
        ...eval,
        schedule_date: formattedDate,
        time_slot_text: timeSlotText,
        schedule_date_display: timeSlotText ? `${formattedDate} ${timeSlotText}` : formattedDate,
        submitted_at_formatted: submittedAtFormatted
      };
    });

    console.log(`[已评价课程] 用户ID: ${userId}, 查询结果数量: ${formattedEvaluations.length}`);
    res.json({ success: true, data: formattedEvaluations });
  } catch (error) {
    console.error('获取已评价课程错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取问卷模板（支持根据课程动态加载案例）- 必须在 /:id 之前
router.get('/questionnaire-template', async (req, res) => {
  try {
    const { course_id } = req.query;
    const questionnaireTemplate = require('../config/questionnaire-template');
    
    // 如果提供了course_id，动态加载该课程的案例
    if (course_id) {
      const [courses] = await db.query(
        'SELECT questionnaire_config FROM courses WHERE id = ?',
        [course_id]
      );
      
      if (courses.length > 0 && courses[0].questionnaire_config) {
        try {
          const config = typeof courses[0].questionnaire_config === 'string'
            ? JSON.parse(courses[0].questionnaire_config)
            : courses[0].questionnaire_config;
          
          // 如果课程有案例配置，更新q6的ratingItems
          if (config && config.cases && Array.isArray(config.cases) && config.cases.length > 0) {
            const q6Index = questionnaireTemplate.questions.findIndex(q => q.id === 'q6');
            if (q6Index !== -1) {
              questionnaireTemplate.questions[q6Index].ratingItems = config.cases.map((caseItem, index) => ({
                id: caseItem.id || `case${index + 1}`,
                label: caseItem.name || caseItem
              }));
            }
          }
        } catch (e) {
          console.error('解析课程问卷配置失败:', e);
        }
      }
    }
    
    res.json({ success: true, data: questionnaireTemplate });
  } catch (error) {
    console.error('获取问卷模板错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取评价详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: '缺少评价ID' });
    }

    // 获取评价详情
    const [evaluations] = await db.query(
      `SELECT e.*, 
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date, 
              cs.time_slot, cs.id as schedule_id,
              c.id as course_id, c.title, c.course_code, c.questionnaire_config,
              u_instructor.nickname as instructor_name
       FROM evaluations e
       JOIN course_schedules cs ON e.schedule_id = cs.id
       JOIN courses c ON cs.course_id = c.id
       LEFT JOIN users u_instructor ON c.instructor_id = u_instructor.id
       WHERE e.id = ?`,
      [id]
    );

    if (evaluations.length === 0) {
      return res.status(404).json({ error: '评价不存在' });
    }

    const evaluation = evaluations[0];
    
    // 验证用户权限
    if (!user_id) {
      // 如果没有user_id，不允许查看
      return res.status(401).json({ error: '请先登录' });
    }
    
    // 获取用户信息以检查角色
    const [users] = await db.query('SELECT role, channel_user_id FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = users[0];
    const isMember = user.role === 'member';
    const isInstructor = user.role === 'instructor';
    const isChannelSales = user.role === 'member' && user.channel_user_id !== null && user.channel_user_id !== undefined;
    
    // 如果是自己的评价，允许查看
    const isOwnEvaluation = parseInt(evaluation.user_id) === parseInt(user_id);
    
    // 如果不是自己的评价，需要检查角色：会员、教练、渠道商销售可以查看
    if (!isOwnEvaluation && !isMember && !isInstructor && !isChannelSales) {
      return res.status(403).json({ error: '无权查看此评价' });
    }

    // 解析答案
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

    // 格式化数据（schedule_date已经在SQL中使用DATE_FORMAT格式化为YYYY-MM-DD）
    let formattedDate = evaluation.schedule_date;
    let timeSlotText = '';
    
    // schedule_date已经是YYYY-MM-DD格式，直接使用
    if (evaluation.schedule_date && typeof evaluation.schedule_date !== 'string') {
      formattedDate = String(evaluation.schedule_date);
    }
    
    if (evaluation.time_slot) {
      const timeSlot = evaluation.time_slot.toString().toLowerCase().trim();
      if (timeSlot === 'morning') {
        timeSlotText = '上午';
      } else if (timeSlot === 'afternoon') {
        timeSlotText = '下午';
      } else if (timeSlot === 'full_day' || timeSlot === 'fullday') {
        timeSlotText = '全天';
      }
    }
    
    let submittedAtFormatted = '';
    if (evaluation.submitted_at) {
      const submittedDate = moment(evaluation.submitted_at);
      submittedAtFormatted = submittedDate.format('YYYY-MM-DD HH:mm');
    }

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

    const result = {
      ...evaluation,
      answers,
      course_cases: courseCases,
      schedule_date: formattedDate,
      time_slot_text: timeSlotText,
      schedule_date_display: timeSlotText ? `${formattedDate} ${timeSlotText}` : formattedDate,
      submitted_at_formatted: submittedAtFormatted
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取评价详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 提交评价
router.post('/submit', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const { user_id, schedule_id, course_id, answers, feedback, questionnaire_data } = req.body;

    // 检查课程是否已触发问卷
    const [schedules] = await connection.query(
      'SELECT questionnaire_triggered FROM course_schedules WHERE id = ?',
      [schedule_id]
    );

    if (schedules.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: '课程不存在' });
    }

    if (!schedules[0].questionnaire_triggered) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '该课程尚未触发问卷' });
    }

    // 检查是否已评价
    const [existing] = await connection.query(
      'SELECT id FROM evaluations WHERE user_id = ? AND schedule_id = ?',
      [user_id, schedule_id]
    );

    if (existing.length > 0) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ error: '您已评价过该课程' });
    }

    // 合并答案数据（兼容旧格式）
    const finalAnswers = questionnaire_data || answers || {};
    
    // 验证Q8答案格式
    console.log('提交评价 - 接收到的答案数据:', JSON.stringify(finalAnswers, null, 2));
    if (finalAnswers.q8) {
      console.log('提交评价 - Q8答案详情:', JSON.stringify(finalAnswers.q8, null, 2));
      console.log('提交评价 - Q8答案类型:', typeof finalAnswers.q8);
      console.log('提交评价 - Q8答案键:', Object.keys(finalAnswers.q8));
    } else {
      console.warn('提交评价 - 警告: Q8答案不存在');
    }

    // 创建评价记录
    const [result] = await connection.query(
      `INSERT INTO evaluations (user_id, schedule_id, course_id, answers, feedback, status) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, schedule_id, course_id, JSON.stringify(finalAnswers), feedback || '', 'submitted']
    );
    
    console.log('提交评价 - 评价记录已创建，ID:', result.insertId);

    // 更新 course_bookings 表的问卷状态
    await connection.query(
      `UPDATE course_bookings 
       SET evaluation_status = 'submitted', evaluation_time = NOW() 
       WHERE user_id = ? AND schedule_id = ?`,
      [user_id, schedule_id]
    );

    await connection.commit();
    connection.release();

    res.json({ success: true, evaluation_id: result.insertId });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('提交评价错误:', error);
    res.status(500).json({ error: '提交失败', details: error.message });
  }
});

// 获取教练的课程评价列表（包含本期评分和近3期平均）
router.get('/instructor/courses', async (req, res) => {
  try {
    const { instructor_id } = req.query;
    
    if (!instructor_id) {
      return res.status(400).json({ error: '缺少教练ID' });
    }

    // 获取该教练的所有课程
    const [courses] = await db.query(
      `SELECT c.id, c.title, c.course_code, c.created_at
       FROM courses c
       WHERE c.instructor_id = ?
       ORDER BY c.created_at DESC`,
      [instructor_id]
    );

    // 为每个课程计算评分
    const coursesWithRatings = await Promise.all(courses.map(async (course) => {
      // 获取本期评分（最近一次排课的评价平均分）
      const [latestSchedule] = await db.query(
        `SELECT cs.id, cs.schedule_date
         FROM course_schedules cs
         WHERE cs.course_id = ?
           AND DATE(cs.schedule_date) <= DATE(NOW())
         ORDER BY cs.schedule_date DESC
         LIMIT 1`,
        [course.id]
      );

      let currentRating = null;
      if (latestSchedule.length > 0) {
        const scheduleId = latestSchedule[0].id;
        // 计算本期平均分（该期所有评价的平均分，每个评价是Q1-Q4和Q9的平均值）
        const [currentEvals] = await db.query(
          `SELECT e.answers
           FROM evaluations e
           WHERE e.course_id = ? AND e.schedule_id = ? AND e.status = 'submitted'`,
          [course.id, scheduleId]
        );

        if (currentEvals.length > 0) {
          const evaluationScores = [];
          currentEvals.forEach(eval => {
            try {
              const answers = typeof eval.answers === 'string' ? JSON.parse(eval.answers) : eval.answers;
              const questionScores = [];
              
              // Q1评分
              if (answers.q1) {
                const q1Map = { 'A': 5, 'B': 3, 'C': 1, 'D': 4, 'E': 2 };
                if (q1Map[answers.q1] !== undefined) questionScores.push(q1Map[answers.q1]);
              }
              // Q2-Q4评分
              ['q2', 'q3', 'q4'].forEach(q => {
                if (answers[q]) {
                  const qMap = { 'A': 5, 'B': 3, 'C': 1 };
                  if (qMap[answers[q]] !== undefined) questionScores.push(qMap[answers[q]]);
                }
              });
              // Q9评分
              if (answers.q9) {
                const q9Map = { 'A': 5, 'B': 2 };
                if (q9Map[answers.q9] !== undefined) questionScores.push(q9Map[answers.q9]);
              }
              
              // 计算该评价的平均分（Q1-Q4和Q9的平均值）
              if (questionScores.length > 0) {
                const evalAvg = questionScores.reduce((a, b) => a + b, 0) / questionScores.length;
                evaluationScores.push(evalAvg);
              }
            } catch (e) {
              console.error('解析评价答案失败:', e);
            }
          });
          
          // 计算所有评价的平均分
          if (evaluationScores.length > 0) {
            currentRating = (evaluationScores.reduce((a, b) => a + b, 0) / evaluationScores.length).toFixed(1);
          }
        }
      }

      // 获取近3期平均分（最近3次排课的评价平均分）
      const [recentSchedules] = await db.query(
        `SELECT cs.id
         FROM course_schedules cs
         WHERE cs.course_id = ?
           AND DATE(cs.schedule_date) <= DATE(NOW())
         ORDER BY cs.schedule_date DESC
         LIMIT 3`,
        [course.id]
      );

      let avgRating = null;
      if (recentSchedules.length > 0) {
        const scheduleIds = recentSchedules.map(s => s.id);
        const [recentEvals] = await db.query(
          `SELECT e.answers
           FROM evaluations e
           WHERE e.course_id = ? AND e.schedule_id IN (${scheduleIds.map(() => '?').join(',')}) AND e.status = 'submitted'`,
          [course.id, ...scheduleIds]
        );

        if (recentEvals.length > 0) {
          const evaluationScores = [];
          recentEvals.forEach(eval => {
            try {
              const answers = typeof eval.answers === 'string' ? JSON.parse(eval.answers) : eval.answers;
              const questionScores = [];
              
              // Q1评分
              if (answers.q1) {
                const q1Map = { 'A': 5, 'B': 3, 'C': 1, 'D': 4, 'E': 2 };
                if (q1Map[answers.q1] !== undefined) questionScores.push(q1Map[answers.q1]);
              }
              // Q2-Q4评分
              ['q2', 'q3', 'q4'].forEach(q => {
                if (answers[q]) {
                  const qMap = { 'A': 5, 'B': 3, 'C': 1 };
                  if (qMap[answers[q]] !== undefined) questionScores.push(qMap[answers[q]]);
                }
              });
              // Q9评分
              if (answers.q9) {
                const q9Map = { 'A': 5, 'B': 2 };
                if (q9Map[answers.q9] !== undefined) questionScores.push(q9Map[answers.q9]);
              }
              
              // 计算该评价的平均分（Q1-Q4和Q9的平均值）
              if (questionScores.length > 0) {
                const evalAvg = questionScores.reduce((a, b) => a + b, 0) / questionScores.length;
                evaluationScores.push(evalAvg);
              }
            } catch (e) {
              console.error('解析评价答案失败:', e);
            }
          });
          
          // 计算所有评价的平均分
          if (evaluationScores.length > 0) {
            avgRating = (evaluationScores.reduce((a, b) => a + b, 0) / evaluationScores.length).toFixed(1);
          }
        }
      }

      return {
        id: course.id,
        title: course.title,
        course_code: course.course_code,
        current_rating: currentRating,
        avg_rating: avgRating
      };
    }));

    res.json({ success: true, data: coursesWithRatings });
  } catch (error) {
    console.error('获取教练课程评价错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取课程评价统计
router.get('/stats/:course_id', async (req, res) => {
  try {
    const { course_id } = req.params;
    const { schedule_id } = req.query;

    let query = `
      SELECT e.answers, e.feedback, u.nickname, e.submitted_at
      FROM evaluations e
      JOIN users u ON e.user_id = u.id
      WHERE e.course_id = ? AND e.status = ?
    `;
    const params = [course_id, 'submitted'];

    if (schedule_id) {
      query += ' AND e.schedule_id = ?';
      params.push(schedule_id);
    }

    const [evaluations] = await db.query(query, params);

    // 统计选择题答案
    const stats = {};
    evaluations.forEach(eval => {
      const answers = JSON.parse(eval.answers);
      Object.keys(answers).forEach(questionId => {
        if (!stats[questionId]) {
          stats[questionId] = {};
        }
        const answer = answers[questionId];
        stats[questionId][answer] = (stats[questionId][answer] || 0) + 1;
      });
    });

    res.json({ 
      success: true, 
      stats,
      evaluations: evaluations.map(e => ({
        ...e,
        answers: JSON.parse(e.answers)
      }))
    });
  } catch (error) {
    console.error('获取评价统计错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 添加评论
router.post('/comment', async (req, res) => {
  try {
    const { evaluation_id, user_id, parent_id, content } = req.body;

    const [result] = await db.query(
      `INSERT INTO evaluation_comments (evaluation_id, user_id, parent_id, content) 
       VALUES (?, ?, ?, ?)`,
      [evaluation_id, user_id, parent_id || null, content]
    );

    res.json({ success: true, comment_id: result.insertId });
  } catch (error) {
    console.error('添加评论错误:', error);
    res.status(500).json({ error: '添加失败', details: error.message });
  }
});

module.exports = router;

