const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

// 获取主题的排课统计和教练列表（必须在 /:type 路由之前）
router.get('/theme/:id/detail', async (req, res) => {
  try {
    const { id } = req.params;
    const { time_range = 'all' } = req.query;

    let dateFilter = '';
    const params = [parseInt(id)];

    if (time_range === 'month') {
      dateFilter = 'AND cs.created_at >= ?';
      params.push(moment().startOf('month').format('YYYY-MM-DD HH:mm:ss'));
    } else if (time_range === 'quarter') {
      dateFilter = 'AND cs.created_at >= ?';
      params.push(moment().subtract(3, 'months').startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    // 获取主题基本信息
    const [themes] = await db.query(
      'SELECT id, name, description FROM course_themes WHERE id = ?',
      [id]
    );

    if (themes.length === 0) {
      return res.status(404).json({ error: '主题不存在' });
    }

    const theme = themes[0];

    // 获取该主题下的排课总数（排除已取消的）
    const [scheduleCountResult] = await db.query(
      `SELECT COUNT(cs.id) as schedule_count
       FROM course_schedules cs
       INNER JOIN courses c ON cs.course_id = c.id
       WHERE c.theme_id = ? AND cs.status != 'cancelled' ${dateFilter}`,
      params
    );

    const scheduleCount = scheduleCountResult[0]?.schedule_count || 0;

    // 获取该主题下的课程列表，包括每个课程的排课次数和授课教练
    const [courses] = await db.query(
      `SELECT 
         c.id as course_id,
         c.title as course_title,
         c.subtitle as course_subtitle,
         c.course_code,
         u.id as instructor_id,
         u.nickname as instructor_name,
         u.avatar_url as instructor_avatar,
         COUNT(cs.id) as schedule_count
       FROM course_schedules cs
       INNER JOIN courses c ON cs.course_id = c.id
       INNER JOIN users u ON c.instructor_id = u.id
       WHERE c.theme_id = ? AND cs.status != 'cancelled' ${dateFilter}
       GROUP BY c.id, c.title, c.subtitle, c.course_code, u.id, u.nickname, u.avatar_url
       ORDER BY schedule_count DESC, c.title ASC`,
      params
    );

    // 获取该主题下的教练列表（去重）及每个教练的排课次数
    const [instructors] = await db.query(
      `SELECT 
         u.id as instructor_id,
         u.nickname as instructor_name,
         u.avatar_url as instructor_avatar,
         COUNT(cs.id) as schedule_count
       FROM course_schedules cs
       INNER JOIN courses c ON cs.course_id = c.id
       INNER JOIN users u ON c.instructor_id = u.id
       WHERE c.theme_id = ? AND cs.status != 'cancelled' ${dateFilter}
       GROUP BY u.id, u.nickname, u.avatar_url
       ORDER BY schedule_count DESC`,
      params
    );

    res.json({
      success: true,
      data: {
        theme_id: theme.id,
        theme_name: theme.name,
        theme_description: theme.description,
        schedule_count: scheduleCount,
        courses: courses.map(course => ({
          course_id: course.course_id,
          course_title: course.course_title,
          course_subtitle: course.course_subtitle,
          course_code: course.course_code,
          instructor_id: course.instructor_id,
          instructor_name: course.instructor_name,
          instructor_avatar: course.instructor_avatar,
          schedule_count: course.schedule_count
        })),
        instructors: instructors.map(inst => ({
          instructor_id: inst.instructor_id,
          instructor_name: inst.instructor_name,
          instructor_avatar: inst.instructor_avatar,
          schedule_count: inst.schedule_count
        }))
      }
    });
  } catch (error) {
    console.error('获取主题详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取排行榜
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { time_range = 'all' } = req.query;

    let rankings = [];

    // 根据类型实时统计排行榜
    switch (type) {
      case 'instructor_schedule':
        // 课程排课排行榜（按课程统计排课次数）
        rankings = await getCourseScheduleRanking(time_range);
        break;
      case 'member_study':
        // 会员学习排行榜（上课次数）
        rankings = await getMemberStudyRanking(time_range);
        break;
      case 'theme':
        // 主题排行榜（按主题统计该主题下课程的排课次数）
        rankings = await getThemeScheduleRanking(time_range);
        break;
      case 'course':
        // 评价榜（按课后评价综合得分排名）
        rankings = await getCourseEvaluationRanking(time_range);
        break;
      default:
        // 其他类型从数据库读取
        const [dbRankings] = await db.query(
          'SELECT * FROM rankings WHERE type = ? AND time_range = ? AND published = 1 ORDER BY `rank` ASC LIMIT 50',
          [type, time_range]
        );
        rankings = dbRankings;
        break;
    }

    res.json({ success: true, data: rankings });
  } catch (error) {
    console.error('获取排行榜错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取课程排课排行榜（按课程统计排课次数）
async function getCourseScheduleRanking(timeRange) {
  let dateFilter = '';
  const params = [];

  if (timeRange === 'month') {
    dateFilter = 'AND cs.created_at >= ?';
    params.push(moment().startOf('month').format('YYYY-MM-DD HH:mm:ss'));
  } else if (timeRange === 'quarter') {
    dateFilter = 'AND cs.created_at >= ?';
    params.push(moment().subtract(3, 'months').startOf('day').format('YYYY-MM-DD HH:mm:ss'));
  }

  // 统计所有排课（排除已取消的）
  const [results] = await db.query(
    `SELECT 
      c.id as course_id,
      c.title as course_title,
      c.subtitle as course_subtitle,
      c.course_code,
      u.nickname as instructor_name,
      u.avatar_url as instructor_avatar,
      ct.name as theme_name,
      COUNT(cs.id) as schedule_count
    FROM course_schedules cs
    INNER JOIN courses c ON cs.course_id = c.id
    INNER JOIN users u ON c.instructor_id = u.id
    INNER JOIN course_themes ct ON c.theme_id = ct.id
    WHERE cs.status != 'cancelled' ${dateFilter}
    GROUP BY c.id, c.title, c.subtitle, c.course_code, u.nickname, u.avatar_url, ct.name
    ORDER BY schedule_count DESC
    LIMIT 50`,
    params
  );

  return results.map((item, index) => ({
    rank: index + 1,
    target_id: item.course_id,
    score: item.schedule_count,
    data: {
      name: item.course_title || '未知课程',
      subtitle: item.course_subtitle,
      course_code: item.course_code,
      instructor_name: item.instructor_name,
      avatar: item.instructor_avatar,
      theme_name: item.theme_name,
      count: item.schedule_count
    }
  }));
}

// 获取主题排行榜（按主题统计该主题下课程的排课次数）
async function getThemeScheduleRanking(timeRange) {
  let dateFilter = '';
  const params = [];

  if (timeRange === 'month') {
    dateFilter = 'AND cs.created_at >= ?';
    params.push(moment().startOf('month').format('YYYY-MM-DD HH:mm:ss'));
  } else if (timeRange === 'quarter') {
    dateFilter = 'AND cs.created_at >= ?';
    params.push(moment().subtract(3, 'months').startOf('day').format('YYYY-MM-DD HH:mm:ss'));
  }

  const [results] = await db.query(
    `SELECT 
      ct.id as theme_id,
      ct.name as theme_name,
      ct.description as theme_description,
      COUNT(cs.id) as schedule_count
    FROM course_schedules cs
    INNER JOIN courses c ON cs.course_id = c.id
    INNER JOIN course_themes ct ON c.theme_id = ct.id
    WHERE 1=1 ${dateFilter}
    GROUP BY ct.id, ct.name, ct.description
    ORDER BY schedule_count DESC
    LIMIT 50`,
    params
  );

  return results.map((item, index) => ({
    rank: index + 1,
    target_id: item.theme_id,
    score: item.schedule_count,
    data: {
      name: item.theme_name || '未知主题',
      description: item.theme_description,
      count: item.schedule_count
    }
  }));
}

// 获取会员学习排行榜（课程学习次数，含已预订和已完成）
async function getMemberStudyRanking(timeRange) {
  let dateFilter = '';
  const params = [];

  if (timeRange === 'month') {
    // 本月：根据预订时间或课程日期筛选（任意一个满足即可）
    dateFilter = 'AND (cb.booked_at >= ? OR cs.schedule_date >= ?)';
    const monthStart = moment().startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const monthStartDate = moment().startOf('month').format('YYYY-MM-DD');
    params.push(monthStart, monthStartDate);
  } else if (timeRange === 'quarter') {
    // 近3个月：根据预订时间或课程日期筛选（任意一个满足即可）
    dateFilter = 'AND (cb.booked_at >= ? OR cs.schedule_date >= ?)';
    const quarterStart = moment().subtract(3, 'months').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const quarterStartDate = moment().subtract(3, 'months').startOf('day').format('YYYY-MM-DD');
    params.push(quarterStart, quarterStartDate);
  }
  // timeRange === 'all' 时不添加时间筛选，统计所有数据

  // 统计学员的课程学习次数（含已预订和已完成）
  // 包含状态为'booked'（已预订）和'completed'（已完成）的课程预订
  // 不限制课程日期，已预订但未开课的课程也算在学习次数中
  const [results] = await db.query(
    `SELECT 
      u.id as user_id,
      u.nickname as user_name,
      u.real_name as user_real_name,
      u.avatar_url as user_avatar,
      u.member_id,
      COUNT(DISTINCT cb.id) as study_count
    FROM course_bookings cb
    INNER JOIN users u ON cb.user_id = u.id
    INNER JOIN course_schedules cs ON cb.schedule_id = cs.id
    WHERE u.role = 'member'
      AND cb.status IN ('booked', 'completed')
      AND cs.status != 'cancelled'
      ${dateFilter}
    GROUP BY u.id, u.nickname, u.real_name, u.avatar_url, u.member_id
    ORDER BY study_count DESC
    LIMIT 50`,
    params
  );

  return results.map((item, index) => ({
    rank: index + 1,
    target_id: item.user_id,
    score: item.study_count,
    data: {
      name: item.user_real_name || item.user_name || '未知',
      avatar: item.user_avatar,
      member_id: item.member_id,
      count: item.study_count
    }
  }));
}

// 获取课程评价排行榜（按课后评价综合得分排名）
async function getCourseEvaluationRanking(timeRange) {
  let dateFilter = '';
  const params = [];

  if (timeRange === 'month') {
    dateFilter = 'AND e.submitted_at >= ?';
    params.push(moment().startOf('month').format('YYYY-MM-DD HH:mm:ss'));
  } else if (timeRange === 'quarter') {
    dateFilter = 'AND e.submitted_at >= ?';
    params.push(moment().subtract(3, 'months').startOf('day').format('YYYY-MM-DD HH:mm:ss'));
  }

  // 获取所有有评价的课程及其综合得分
  const [results] = await db.query(
    `SELECT 
      c.id as course_id,
      c.title as course_title,
      c.subtitle as course_subtitle,
      c.course_code,
      u.nickname as instructor_name,
      u.avatar_url as instructor_avatar,
      ct.name as theme_name,
      COUNT(DISTINCT e.id) as evaluation_count,
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
      END) as avg_q9_score
    FROM courses c
    INNER JOIN users u ON c.instructor_id = u.id
    INNER JOIN course_themes ct ON c.theme_id = ct.id
    INNER JOIN evaluations e ON e.course_id = c.id
    WHERE e.status = 'submitted' ${dateFilter}
    GROUP BY c.id, c.title, c.subtitle, c.course_code, u.nickname, u.avatar_url, ct.name
    HAVING evaluation_count > 0
    ORDER BY (avg_q1_score + avg_q2_score + avg_q3_score + avg_q4_score + avg_q9_score) / 5 DESC
    LIMIT 50`,
    params
  );

  return results.map((item, index) => {
    // 计算综合得分（Q1-Q4和Q9的平均值）
    const scores = [
      item.avg_q1_score,
      item.avg_q2_score,
      item.avg_q3_score,
      item.avg_q4_score,
      item.avg_q9_score
    ].filter(s => s !== null);
    
    const avgScore = scores.length > 0 
      ? (scores.reduce((a, b) => parseFloat(a) + parseFloat(b), 0) / scores.length).toFixed(2)
      : 0;

    return {
      rank: index + 1,
      target_id: item.course_id,
      score: parseFloat(avgScore),
      data: {
        name: item.course_title || '未知课程',
        subtitle: item.course_subtitle,
        course_code: item.course_code,
        instructor_name: item.instructor_name,
        avatar: item.instructor_avatar,
        theme_name: item.theme_name,
        count: item.evaluation_count, // 用于小程序前端显示评价次数
        evaluation_count: item.evaluation_count
      }
    };
  });
}

module.exports = router;

