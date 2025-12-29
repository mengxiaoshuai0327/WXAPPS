// 显示待评价课程示例
const db = require('../config/database');
const moment = require('moment');

async function showPendingEvaluations() {
  try {
    console.log('正在查询待评价课程...\n');
    
    // 查找所有有待评价课程的用户
    const [users] = await db.query(
      `SELECT DISTINCT cb.user_id, u.nickname, u.member_id
       FROM course_bookings cb
       JOIN users u ON cb.user_id = u.id
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       WHERE cb.status IN ('booked', 'completed')
       AND (cs.questionnaire_triggered = 1 OR cs.questionnaire_triggered = TRUE)
       AND DATE(cs.schedule_date) <= DATE(NOW())
       AND NOT EXISTS (
         SELECT 1 FROM evaluations e 
         WHERE e.user_id = cb.user_id AND e.schedule_id = cs.id
       )
       LIMIT 5`
    );

    if (users.length === 0) {
      console.log('未找到有待评价课程的用户');
      process.exit(0);
    }

    console.log(`找到 ${users.length} 个用户有待评价课程\n`);
    console.log('='.repeat(60));

    for (const user of users) {
      const [bookings] = await db.query(
        `SELECT cb.*, 
                cs.schedule_date, 
                cs.id as schedule_id, 
                cs.time_slot,
                c.id as course_id, 
                c.title as course_title,
                cs.questionnaire_triggered
         FROM course_bookings cb
         JOIN course_schedules cs ON cb.schedule_id = cs.id
         JOIN courses c ON cs.course_id = c.id
         WHERE cb.user_id = ? 
         AND cb.status IN ('booked', 'completed')
         AND (cs.questionnaire_triggered = 1 OR cs.questionnaire_triggered = TRUE)
         AND DATE(cs.schedule_date) <= DATE(NOW())
         AND NOT EXISTS (
           SELECT 1 FROM evaluations e 
           WHERE e.user_id = ? AND e.schedule_id = cs.id
         )
         ORDER BY cs.schedule_date DESC
         LIMIT 10`,
        [user.user_id, user.user_id]
      );

      if (bookings.length > 0) {
        console.log(`\n用户: ${user.nickname} (${user.member_id || 'N/A'}) - ID: ${user.user_id}`);
        console.log(`待评价课程数量: ${bookings.length}`);
        console.log('-'.repeat(60));
        
        bookings.forEach((booking, index) => {
          const date = moment(booking.schedule_date).format('YYYY-MM-DD');
          const timeSlotText = booking.time_slot === 'morning' ? '上午' : 
                              booking.time_slot === 'afternoon' ? '下午' : '全天';
          
          console.log(`\n${index + 1}. ${booking.course_title}`);
          console.log(`   课程ID: ${booking.course_id}`);
          console.log(`   排课ID: ${booking.schedule_id}`);
          console.log(`   预订ID: ${booking.id}`);
          console.log(`   上课日期: ${date}`);
          console.log(`   时间段: ${timeSlotText}`);
          console.log(`   问卷已触发: ${booking.questionnaire_triggered ? '是' : '否'}`);
          console.log(`   预订状态: ${booking.status}`);
        });
        console.log('\n' + '='.repeat(60));
      }
    }

    console.log('\n✓ 查询完成！');
    console.log('\n提示：');
    console.log('- 在小程序中，使用上述用户ID登录即可看到待评价课程');
    console.log('- 或者调用 API: GET /api/evaluations/pending?user_id=<用户ID>');
    
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

showPendingEvaluations();

