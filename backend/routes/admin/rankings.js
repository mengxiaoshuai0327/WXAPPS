const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const moment = require('moment');

// 获取排行榜数据（管理后台）- 支持实时统计和数据库存储的数据
router.get('/', async (req, res) => {
  try {
    const { type, time_range = 'all' } = req.query;

    let rankings = [];

    // 根据类型获取排行榜
    switch (type) {
      case 'instructor_schedule': // 排课榜
        rankings = await getCourseScheduleRanking(time_range);
        break;
      case 'member_study': // 学习榜
        rankings = await getMemberStudyRanking(time_range);
        break;
      case 'theme': // 主题榜
        rankings = await getThemeScheduleRanking(time_range);
        break;
      case 'course': // 评价榜
        rankings = await getCourseEvaluationRanking(time_range);
        break;
      default:
        return res.status(400).json({ error: '无效的排行榜类型' });
    }

    // 从数据库读取自定义排序（如果有）
    const [savedRankings] = await db.query(
      'SELECT * FROM rankings WHERE type = ? AND time_range = ? ORDER BY `rank` ASC',
      [type, time_range]
    );

    // 如果有保存的排序，使用保存的排序；否则使用实时统计的排序
    if (savedRankings.length > 0) {
      // 使用保存的排序，但用实时统计的数据更新score和data
      const rankingMap = new Map();
      rankings.forEach(r => {
        rankingMap.set(r.target_id, r);
      });

      rankings = savedRankings
        .map(saved => {
          const realTimeData = rankingMap.get(saved.target_id);
          if (realTimeData) {
            return {
              ...saved,
              score: realTimeData.score,
              data: typeof saved.data === 'string' ? JSON.parse(saved.data) : (realTimeData.data || saved.data)
            };
          }
          // 如果没有实时数据，解析data字段
          return {
            ...saved,
            data: typeof saved.data === 'string' ? JSON.parse(saved.data) : saved.data
          };
        })
        .filter(r => r !== null);
    }

    res.json({ success: true, data: rankings });
  } catch (error) {
    console.error('获取排行榜错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 保存排行榜排序
router.put('/sort', async (req, res) => {
  try {
    const { type, time_range = 'all', rankings: rankingData } = req.body;

    if (!type || !rankingData || !Array.isArray(rankingData)) {
      return res.status(400).json({ error: '参数错误' });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
      // 删除该类型和时间范围的所有旧数据
      await connection.query(
        'DELETE FROM rankings WHERE type = ? AND time_range = ?',
        [type, time_range]
      );

      // 插入新的排序数据
      for (let i = 0; i < rankingData.length; i++) {
        const item = rankingData[i];
        await connection.query(
          `INSERT INTO rankings (type, target_id, score, rank, data, time_range, published)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            type,
            item.target_id,
            item.score || 0,
            i + 1,
            JSON.stringify(item.data || {}),
            time_range,
            true
          ]
        );
      }

      await connection.commit();
      res.json({ success: true, message: '排序保存成功' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('保存排行榜排序错误:', error);
    res.status(500).json({ error: '保存失败', details: error.message });
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

// 获取会员学习排行榜（上课次数）
async function getMemberStudyRanking(timeRange) {
  let dateFilter = '';
  const params = [];

  if (timeRange === 'month') {
    dateFilter = 'AND (cb.booked_at >= ? OR cs.schedule_date >= ?)';
    const monthStart = moment().startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const monthStartDate = moment().startOf('month').format('YYYY-MM-DD');
    params.push(monthStart, monthStartDate);
  } else if (timeRange === 'quarter') {
    dateFilter = 'AND (cb.booked_at >= ? OR cs.schedule_date >= ?)';
    const quarterStart = moment().subtract(3, 'months').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const quarterStartDate = moment().subtract(3, 'months').startOf('day').format('YYYY-MM-DD');
    params.push(quarterStart, quarterStartDate);
  }

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

// 获取课程评价排行榜（按课后评价综合得分排名）
async function getCourseEvaluationRanking(timeRange) {
  let dateFilter = '';
  const params = [];

  if (timeRange === 'month') {
    dateFilter = 'AND e.created_at >= ?';
    params.push(moment().startOf('month').format('YYYY-MM-DD HH:mm:ss'));
  } else if (timeRange === 'quarter') {
    dateFilter = 'AND e.created_at >= ?';
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
        evaluation_count: item.evaluation_count,
        score: avgScore
      }
    };
  });
}

// 获取课程的评价列表（用于评价榜展开）
router.get('/course/:id/evaluations', async (req, res) => {
  try {
    const { id } = req.params;
    const { time_range = 'all' } = req.query;

    let dateFilter = '';
    const params = [parseInt(id)];

    if (time_range === 'month') {
      dateFilter = 'AND e.submitted_at >= ?';
      params.push(moment().startOf('month').format('YYYY-MM-DD HH:mm:ss'));
    } else if (time_range === 'quarter') {
      dateFilter = 'AND e.submitted_at >= ?';
      params.push(moment().subtract(3, 'months').startOf('day').format('YYYY-MM-DD HH:mm:ss'));
    }

    // 获取该课程的所有评价
    const [evaluations] = await db.query(
      `SELECT 
        e.id as evaluation_id,
        e.user_id,
        e.submitted_at,
        e.answers,
        u.nickname as user_name,
        u.real_name as user_real_name,
        u.member_id,
        cs.schedule_date,
        cs.time_slot
      FROM evaluations e
      INNER JOIN users u ON e.user_id = u.id
      INNER JOIN course_schedules cs ON e.schedule_id = cs.id
      WHERE e.course_id = ? AND e.status = 'submitted' ${dateFilter}
      ORDER BY e.submitted_at DESC`,
      params
    );

    // 处理评价数据，计算每个评价的综合得分
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

      // 计算综合得分（Q1-Q4和Q9的平均值）
      const scores = [];
      
      // Q1评分
      if (answers.q1) {
        const q1Map = { 'A': 5, 'B': 3, 'C': 1, 'D': 4, 'E': 2 };
        if (q1Map[answers.q1] !== undefined) scores.push(q1Map[answers.q1]);
      }
      
      // Q2-Q4评分
      ['q2', 'q3', 'q4'].forEach(q => {
        if (answers[q]) {
          const qMap = { 'A': 5, 'B': 3, 'C': 1 };
          if (qMap[answers[q]] !== undefined) scores.push(qMap[answers[q]]);
        }
      });
      
      // Q9评分
      if (answers.q9) {
        const q9Map = { 'A': 5, 'B': 2 };
        if (q9Map[answers.q9] !== undefined) scores.push(q9Map[answers.q9]);
      }

      const avgScore = scores.length > 0 
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
        : 0;

      return {
        evaluation_id: eval.evaluation_id,
        user_id: eval.user_id,
        user_name: eval.user_real_name || eval.user_name || '未知',
        member_id: eval.member_id,
        submitted_at: moment(eval.submitted_at).format('YYYY-MM-DD HH:mm:ss'),
        schedule_date: moment(eval.schedule_date).format('YYYY-MM-DD'),
        time_slot: eval.time_slot === 'morning' ? '上午' : 
                   eval.time_slot === 'afternoon' ? '下午' : 
                   eval.time_slot === 'full_day' ? '全天' : eval.time_slot,
        score: parseFloat(avgScore),
        answers: answers
      };
    });

    res.json({ success: true, data: processedEvaluations });
  } catch (error) {
    console.error('获取课程评价列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

module.exports = router;

