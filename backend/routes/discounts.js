const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');

// 获取用户优惠券统计数据
router.get('/stats', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    const today = moment().format('YYYY-MM-DD');
    console.log('[优惠券统计] 查询用户ID:', user_id, '日期:', today);
    
    // 统计未使用的优惠券（status为unused，且在有效期内，且已生效）
    // 条件：status='unused' 
    //   AND (expiry_date IS NULL OR expiry_date >= today) - 未过期
    //   AND (start_date IS NULL OR start_date <= today) - 已生效
    // 与管理员后台逻辑保持一致
    const [unusedStats] = await db.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
       FROM discount_coupons 
       WHERE user_id = ? AND status = 'unused' 
       AND (expiry_date IS NULL OR expiry_date >= ?)
       AND (start_date IS NULL OR start_date <= ?)`,
      [user_id, today, today]
    );
    
    console.log('[优惠券统计] 未使用优惠券查询结果:', unusedStats);
    console.log('[优惠券统计] 未使用数量:', unusedStats[0]?.count);
    console.log('[优惠券统计] 未使用金额:', unusedStats[0]?.total_amount);
    
    // 统计已使用的优惠券
    const [usedCount] = await db.query(
      `SELECT COUNT(*) as count 
       FROM discount_coupons 
       WHERE user_id = ? AND status = 'used'`,
      [user_id]
    );
    
    // 统计已过期的优惠券（status为unused但expiry_date已过期）
    const [expiredCount] = await db.query(
      `SELECT COUNT(*) as count 
       FROM discount_coupons 
       WHERE user_id = ? AND status = 'unused' 
       AND expiry_date IS NOT NULL AND expiry_date < ?`,
      [user_id, today]
    );

    const result = {
      success: true,
      data: {
        unused: parseInt(unusedStats[0]?.count || 0),
        unused_amount: parseFloat(unusedStats[0]?.total_amount || 0),
        used: parseInt(usedCount[0]?.count || 0),
        expired: parseInt(expiredCount[0]?.count || 0)
      }
    };
    
    console.log('[优惠券统计] 返回结果:', result);
    res.json(result);
  } catch (error) {
    console.error('获取优惠券统计错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取用户折扣券列表
router.get('/list', async (req, res) => {
  try {
    const { user_id, status } = req.query;
    let query = `
      SELECT dc.*,
             u_source.nickname as source_user_name,
             u_source.real_name as source_user_real_name,
             u_source.member_id as source_user_member_id
      FROM discount_coupons dc
      LEFT JOIN users u_source ON dc.source_user_id = u_source.id
      WHERE dc.user_id = ?
    `;
    const params = [user_id];

    if (status) {
      query += ' AND dc.status = ?';
      params.push(status);
    }

    query += ' ORDER BY dc.created_at DESC';

    const [coupons] = await db.query(query, params);
    
    console.log('查询到的折扣券数量:', coupons.length);
    console.log('折扣券数据示例:', coupons.length > 0 ? coupons[0] : '无数据');
    
    // 确保返回的数据包含所有字段（包括start_date）
    const processedCoupons = coupons.map(coupon => {
      // 生成使用期限文本
      let period_text = '';
      if (coupon.start_date && coupon.expiry_date) {
        period_text = `${moment(coupon.start_date).format('YYYY-MM-DD')} 至 ${moment(coupon.expiry_date).format('YYYY-MM-DD')}`;
      } else if (coupon.start_date) {
        period_text = `${moment(coupon.start_date).format('YYYY-MM-DD')} 起`;
      } else if (coupon.expiry_date) {
        period_text = `至 ${moment(coupon.expiry_date).format('YYYY-MM-DD')}`;
      } else {
        period_text = '永久有效';
      }

      return {
        ...coupon,
        start_date: coupon.start_date || null,
        expiry_date: coupon.expiry_date || null,
        // 确保金额是数字类型
        amount: parseFloat(coupon.amount) || 0,
        // 添加使用期限文本
        period_text: period_text,
        // 被邀请人信息（如果是邀请相关的折扣券）
        source_user_name: coupon.source_user_name || null,
        source_user_real_name: coupon.source_user_real_name || null,
        source_user_member_id: coupon.source_user_member_id || null
      };
    });
    
    res.json({ success: true, data: processedCoupons });
  } catch (error) {
    console.error('获取折扣券列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

module.exports = router;

