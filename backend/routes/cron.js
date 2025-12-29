// 定时任务：课程当天自动更新状态并发送评价提醒
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const moment = require('moment');
const { autoUseTickets } = require('../utils/scheduler');

// 每日定时任务：检查当天课程并发送评价提醒
// 这个接口可以由外部定时任务服务（如cron job）调用
router.post('/daily-course-evaluation', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const today = moment().format('YYYY-MM-DD');
    
    // 1. 查找当天已预订的课程
    const [todayBookings] = await connection.query(
      `SELECT cb.id as booking_id, cb.user_id, cb.schedule_id, cs.schedule_date, c.id as course_id, c.title
       FROM course_bookings cb
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       JOIN courses c ON cs.course_id = c.id
       WHERE cb.status = 'booked'
       AND DATE(cs.schedule_date) = ?
       AND NOT EXISTS (
         SELECT 1 FROM evaluations e 
         WHERE e.user_id = cb.user_id AND e.schedule_id = cs.id
       )`,
      [today]
    );

    console.log(`找到 ${todayBookings.length} 个当天课程需要发送评价提醒`);

    // 2. 为每个用户发送系统消息
    const messages = [];
    const userIds = new Set();
    
    todayBookings.forEach(booking => {
      userIds.add(booking.user_id);
      messages.push([
        booking.user_id,
        'evaluation_reminder',
        '课程评价提醒',
        `您今天参加的课程"${booking.title}"已结束，快来为课程打分吧！`,
        false
      ]);
    });

    if (messages.length > 0) {
      await connection.query(
        `INSERT INTO system_messages (user_id, type, title, content, \`read\`) VALUES ?`,
        [messages]
      );
      console.log(`已发送 ${messages.length} 条评价提醒消息`);
    }

    await connection.commit();
    res.json({ 
      success: true, 
      message: `已处理 ${todayBookings.length} 个课程，发送 ${messages.length} 条消息` 
    });
  } catch (error) {
    await connection.rollback();
    console.error('定时任务执行错误:', error);
    res.status(500).json({ error: '执行失败', details: error.message });
  } finally {
    connection.release();
  }
});

// 自动核销课券定时任务
// 这个接口应该被定时任务服务频繁调用（建议每5-10分钟调用一次）
// 例如：使用 cron 表达式 "*/5 * * * *" 每5分钟执行一次
router.post('/auto-use-tickets', async (req, res) => {
  try {
    const result = await autoUseTickets();
    res.json({
      success: true,
      message: `自动核销完成，处理了 ${result.processed} 个预订`,
      ...result
    });
  } catch (error) {
    console.error('自动核销任务执行错误:', error);
    res.status(500).json({ 
      success: false,
      error: '执行失败', 
      details: error.message 
    });
  }
});

module.exports = router;

