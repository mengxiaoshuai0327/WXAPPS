// 插入待评价课程的示例数据
const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertPendingEvaluations() {
  let connection;
  
  try {
    // 连接数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'xiaocx_db'
    });

    console.log('✓ 数据库连接成功');

    // 1. 查找现有的课程和用户
    const [courses] = await connection.query(
      'SELECT id, title, instructor_id FROM courses LIMIT 3'
    );
    
    if (courses.length === 0) {
      console.log('✗ 没有找到课程，请先运行 npm run insert-sample 插入示例课程');
      await connection.end();
      process.exit(1);
    }

    // 查找或创建测试会员用户
    let [users] = await connection.query(
      "SELECT id, nickname FROM users WHERE role = 'member' LIMIT 1"
    );
    let testUserId;

    if (users.length === 0) {
      console.log('\n创建测试会员用户...');
      const [userResult] = await connection.query(
        `INSERT INTO users (openid, nickname, real_name, phone, role, member_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `test_user_${Date.now()}`,
          '测试会员',
          '测试用户',
          `138${Date.now().toString().slice(-8)}`,
          'member',
          `M${Date.now().toString().slice(-8)}`
        ]
      );
      testUserId = userResult.insertId;
      console.log(`✓ 创建了测试用户 (ID: ${testUserId})`);
    } else {
      testUserId = users[0].id;
      console.log(`\n使用测试用户: ${users[0].nickname} (ID: ${testUserId})`);
    }

    // 2. 创建已完成的课程排课（今天和昨天）
    console.log('\n2. 创建已完成的课程排课...');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const scheduleDates = [
      yesterday.toISOString().split('T')[0], // 昨天
      twoDaysAgo.toISOString().split('T')[0] // 两天前
    ];

    const schedules = [];
    for (let i = 0; i < Math.min(courses.length, 2); i++) {
      const timeSlots = ['morning', 'afternoon', 'full_day'];
      const timeSlot = timeSlots[i % timeSlots.length];
      
      let startTime, endTime;
      if (timeSlot === 'morning') {
        startTime = '09:00:00';
        endTime = '12:00:00';
      } else if (timeSlot === 'afternoon') {
        startTime = '14:00:00';
        endTime = '17:00:00';
      } else {
        startTime = '09:00:00';
        endTime = '17:00:00';
      }

      const [scheduleResult] = await connection.query(
        `INSERT INTO course_schedules 
         (course_id, schedule_date, time_slot, start_time, end_time, max_students, current_students, status, questionnaire_triggered) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          courses[i].id,
          scheduleDates[i],
          timeSlot,
          startTime,
          endTime,
          20,
          1,
          'completed',
          true // 已触发问卷
        ]
      );
      schedules.push({
        id: scheduleResult.insertId,
        course_id: courses[i].id,
        course_title: courses[i].title,
        schedule_date: scheduleDates[i],
        time_slot: timeSlot
      });
    }
    console.log(`✓ 创建了 ${schedules.length} 个已完成的排课（已触发问卷）`);

    // 3. 为测试用户创建课券
    console.log('\n3. 创建课券...');
    const tickets = [];
    for (let i = 0; i < schedules.length; i++) {
      const ticketCode = `T${Date.now()}${i}`;
      const [ticketResult] = await connection.query(
        `INSERT INTO tickets 
         (user_id, ticket_code, source, purchase_amount, actual_amount, status) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          testUserId,
          ticketCode,
          'admin',
          1500,
          1500,
          'booked' // 已预订状态
        ]
      );
      tickets.push({
        id: ticketResult.insertId,
        ticket_code: ticketCode
      });
    }
    console.log(`✓ 创建了 ${tickets.length} 张课券`);

    // 4. 创建课程预订记录
    console.log('\n4. 创建课程预订记录...');
    const bookings = [];
    for (let i = 0; i < schedules.length; i++) {
      const [bookingResult] = await connection.query(
        `INSERT INTO course_bookings 
         (user_id, schedule_id, ticket_id, status) 
         VALUES (?, ?, ?, ?)`,
        [
          testUserId,
          schedules[i].id,
          tickets[i].id,
          'completed' // 已完成状态
        ]
      );
      bookings.push({
        id: bookingResult.insertId,
        schedule_id: schedules[i].id
      });
    }
    console.log(`✓ 创建了 ${bookings.length} 个预订记录`);

    // 5. 更新课券状态为已使用
    console.log('\n5. 更新课券状态...');
    for (const ticket of tickets) {
      await connection.query(
        'UPDATE tickets SET status = ?, used_at = NOW() WHERE id = ?',
        ['used', ticket.id]
      );
    }
    console.log('✓ 课券状态已更新为已使用');

    console.log('\n✓ 待评价课程示例数据插入完成！');
    console.log('\n创建的待评价课程：');
    schedules.forEach((schedule, index) => {
      const timeSlotText = schedule.time_slot === 'morning' ? '上午' : 
                          schedule.time_slot === 'afternoon' ? '下午' : '全天';
      console.log(`  ${index + 1}. ${schedule.course_title}`);
      console.log(`     日期: ${schedule.schedule_date}`);
      console.log(`     时间段: ${timeSlotText}`);
      console.log(`     排课ID: ${schedule.id}`);
      console.log(`     预订ID: ${bookings[index].id}`);
    });
    
    console.log(`\n测试用户ID: ${testUserId}`);
    console.log('\n现在可以在小程序中查看待评价课程了！');
    
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 插入示例数据失败:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    console.error('错误详情:', error);
    
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

insertPendingEvaluations();

