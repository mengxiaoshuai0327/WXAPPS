// 插入已上过课的课程示例数据
const mysql = require('mysql2/promise');
require('dotenv').config();
const moment = require('moment');

async function insertCompletedCourse() {
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

    await connection.beginTransaction();

    // 1. 查找或创建测试用户
    let [users] = await connection.query("SELECT id, nickname, member_id FROM users WHERE role = 'member' LIMIT 1");
    let testUserId;

    if (users.length === 0) {
      console.log('\n创建测试会员用户...');
      const memberId = `M${moment().format('YYYYMMDD')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const [userResult] = await connection.query(
        `INSERT INTO users (openid, nickname, real_name, phone, role, member_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [`test_user_${Date.now()}`, '测试会员', '测试用户', `138${Date.now().toString().slice(-8)}`, 'member', memberId]
      );
      testUserId = userResult.insertId;
      console.log(`✓ 创建了测试用户 (ID: ${testUserId}, 会员ID: ${memberId})`);
    } else {
      testUserId = users[0].id;
      console.log(`\n使用现有用户: ${users[0].nickname} (ID: ${testUserId}, 会员ID: ${users[0].member_id})`);
    }

    // 2. 查找现有课程
    const [courses] = await connection.query('SELECT id, title, course_code FROM courses LIMIT 1');
    
    if (courses.length === 0) {
      console.log('✗ 没有找到课程，请先运行 npm run insert-sample 插入示例课程');
      await connection.rollback();
      await connection.end();
      process.exit(1);
    }

    const course = courses[0];
    console.log(`\n使用课程: ${course.title} (ID: ${course.id})`);

    // 3. 创建过去的课程排期（7天前）
    console.log('\n创建已完成的课程排期...');
    const pastDate = moment().subtract(7, 'days').format('YYYY-MM-DD');
    const bookedDate = moment().subtract(10, 'days').format('YYYY-MM-DD HH:mm:ss');
    const usedDate = moment().subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss');

    const [scheduleResult] = await connection.query(
      `INSERT INTO course_schedules (course_id, schedule_date, time_slot, start_time, end_time, max_students, current_students, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [course.id, pastDate, 'morning', '09:00:00', '12:00:00', 20, 1, 'completed']
    );
    const scheduleId = scheduleResult.insertId;
    console.log(`✓ 创建了课程排期 (ID: ${scheduleId}, 日期: ${pastDate}, 状态: completed)`);

    // 4. 创建已使用的课券
    console.log('\n创建已使用的课券...');
    const ticketCode = `T${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const ticketStartDate = moment().subtract(90, 'days').format('YYYY-MM-DD');
    const ticketExpiryDate = moment().add(90, 'days').format('YYYY-MM-DD');

    const [ticketResult] = await connection.query(
      `INSERT INTO tickets (user_id, ticket_code, source, purchase_amount, actual_amount, start_date, expiry_date, purchased_at, used_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testUserId, ticketCode, 'purchase', 1500, 1500, ticketStartDate, ticketExpiryDate, bookedDate, usedDate, 'used']
    );
    const ticketId = ticketResult.insertId;
    console.log(`✓ 创建了已使用的课券 (ID: ${ticketId}, 课券码: ${ticketCode}, 状态: used)`);

    // 5. 创建已完成的课程预定
    console.log('\n创建已完成的课程预定...');
    const [bookingResult] = await connection.query(
      `INSERT INTO course_bookings (user_id, schedule_id, ticket_id, status, booked_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [testUserId, scheduleId, ticketId, 'completed', bookedDate]
    );
    const bookingId = bookingResult.insertId;
    console.log(`✓ 创建了已完成的课程预定 (ID: ${bookingId}, 状态: completed)`);

    await connection.commit();
    console.log('\n✓ 已上过课的课程示例数据创建成功！');
    console.log('\n数据摘要：');
    console.log(`- 用户ID: ${testUserId}`);
    console.log(`- 课程: ${course.title} (${course.course_code})`);
    console.log(`- 排期ID: ${scheduleId} (日期: ${pastDate}, 状态: completed)`);
    console.log(`- 课券ID: ${ticketId} (课券码: ${ticketCode}, 状态: used)`);
    console.log(`- 预定ID: ${bookingId} (状态: completed)`);
    console.log(`- 预订时间: ${bookedDate}`);
    console.log(`- 使用时间: ${usedDate}`);
    
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 插入数据失败:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    if (connection) {
      await connection.rollback();
      await connection.end();
    }
    process.exit(1);
  }
}

insertCompletedCourse();






























































