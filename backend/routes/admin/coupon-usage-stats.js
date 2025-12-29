const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { moment } = require('../../utils/dateHelper');

// 获取折扣券使用情况统计
router.get('/stats', async (req, res) => {
  try {
    const { start_date, end_date, source, user_id } = req.query;

    // 构建时间范围
    let dateCondition = '';
    const params = [];
    
    if (start_date && end_date) {
      dateCondition = 'AND dc.created_at >= ? AND dc.created_at <= ?';
      params.push(start_date, end_date + ' 23:59:59');
    } else if (start_date) {
      dateCondition = 'AND dc.created_at >= ?';
      params.push(start_date);
    } else if (end_date) {
      dateCondition = 'AND dc.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }

    // 来源筛选
    let sourceCondition = '';
    if (source && source !== 'all') {
      sourceCondition = 'AND dc.source = ?';
      params.push(source);
    }

    // 用户筛选
    let userCondition = '';
    if (user_id) {
      userCondition = 'AND dc.user_id = ?';
      params.push(user_id);
    }

    // 总体统计
    const [totalStats] = await db.query(
      `SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN dc.status = 'unused' THEN 1 END) as unused_count,
        COUNT(CASE WHEN dc.status = 'used' THEN 1 END) as used_count,
        COUNT(CASE WHEN dc.status = 'expired' OR (dc.status = 'unused' AND dc.expiry_date < CURDATE()) THEN 1 END) as expired_count,
        SUM(dc.amount) as total_amount,
        SUM(CASE WHEN dc.status = 'used' THEN dc.amount ELSE 0 END) as used_amount,
        SUM(CASE WHEN dc.status = 'unused' AND (dc.expiry_date IS NULL OR dc.expiry_date >= CURDATE()) THEN dc.amount ELSE 0 END) as unused_amount
       FROM discount_coupons dc
       WHERE 1=1 ${dateCondition} ${sourceCondition} ${userCondition}`,
      params
    );

    // 按来源统计
    const [sourceStats] = await db.query(
      `SELECT 
        dc.source,
        COUNT(*) as count,
        SUM(dc.amount) as total_amount,
        SUM(CASE WHEN dc.status = 'used' THEN dc.amount ELSE 0 END) as used_amount,
        COUNT(CASE WHEN dc.status = 'used' THEN 1 END) as used_count
       FROM discount_coupons dc
       WHERE 1=1 ${dateCondition} ${sourceCondition} ${userCondition}
       GROUP BY dc.source
       ORDER BY count DESC`,
      params
    );

    // 来源文本映射
    const sourceTexts = {
      'invite_register': '邀请注册奖励',
      'invite_purchase': '邀请购券奖励',
      'instructor_reward': '授课奖励',
      'channel_invite': '渠道推广奖励',
      'instructor_invite': '教练推广奖励',
      'admin': '管理员发放'
    };

    const formattedSourceStats = sourceStats.map(stat => ({
      ...stat,
      source_text: sourceTexts[stat.source] || stat.source,
      total_amount: parseFloat(stat.total_amount) || 0,
      used_amount: parseFloat(stat.used_amount) || 0
    }));

    // 按日期统计（最近30天）
    const [dailyStats] = await db.query(
      `SELECT 
        DATE(dc.created_at) as date,
        COUNT(*) as count,
        SUM(dc.amount) as total_amount,
        COUNT(CASE WHEN dc.status = 'used' THEN 1 END) as used_count
       FROM discount_coupons dc
       WHERE dc.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ${sourceCondition} ${userCondition}
       GROUP BY DATE(dc.created_at)
       ORDER BY date DESC`,
      params.filter((p, i) => !dateCondition || (i >= (dateCondition.match(/\?/g) || []).length))
    );

    res.json({
      success: true,
      data: {
        total: {
          total_count: parseInt(totalStats[0].total_count) || 0,
          unused_count: parseInt(totalStats[0].unused_count) || 0,
          used_count: parseInt(totalStats[0].used_count) || 0,
          expired_count: parseInt(totalStats[0].expired_count) || 0,
          total_amount: parseFloat(totalStats[0].total_amount) || 0,
          used_amount: parseFloat(totalStats[0].used_amount) || 0,
          unused_amount: parseFloat(totalStats[0].unused_amount) || 0
        },
        by_source: formattedSourceStats,
        by_date: dailyStats.map(stat => ({
          ...stat,
          date: moment(stat.date).format('YYYY-MM-DD'),
          total_amount: parseFloat(stat.total_amount) || 0
        }))
      }
    });
  } catch (error) {
    console.error('获取折扣券使用情况统计错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

module.exports = router;

