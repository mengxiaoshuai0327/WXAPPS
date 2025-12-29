// 插入测试数据：过期课程和已预订课程
const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertTestData() {
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
    const [courses] = await connection.query('SELECT id, title FROM courses LIMIT 6');
    
    if (courses.length === 0) {
      console.log('✗ 没有找到课程，请先运行 npm run insert-sample 插入示例课程');
      await connection.end();
      process.exit(1);
    }

    // 查找或创建测试用户
    let [users] = await connection.query("SELECT id, nickname FROM users WHERE role = 'member' LIMIT 1");
    let testUserId;

    if (users.length === 0) {
      console.log('\n创建测试会员用户...');
      // 创建一个测试会员用户
      const [userResult] = await connection.query(
        `INSERT INTO users (openid, nickname, real_name, phone, role, member_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [`test_user_${Date.now()}`, '测试会员', '测试用户', `138${Date.now().toString().slice(-8)}`, 'member', `M${Date.now().toString().slice(-8)}`]
      );
      testUserId = userResult.insertId;
      console.log(`✓ 创建了测试用户 (ID: ${testUserId})`);
    } else {
      testUserId = users[0].id;
      console.log(`\n使用测试用户: ${users[0].nickname} (ID: ${testUserId})`);
    }

    // 2. 创建过期课程（7天前、3天前、1天前）
    console.log('\n1. 创建过期课程...');
    const pastDates = [
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7天前
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3天前
      new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)  // 1天前
    ];

    const pastSchedules = [];
    for (let i = 0; i < Math.min(3, courses.length); i++) {
      const course = courses[i];
      const pastDate = pastDates[i];
      
      pastSchedules.push([
        course.id,
        pastDate.toISOString().split('T')[0],
        'morning',
        '09:00:00',
        '12:00:00',
        20,
        Math.floor(Math.random() * 15) + 5, // 5-20人
        'completed'
      ]);
    }

    const [pastResult] = await connection.query(
      `INSERT INTO course_schedules (course_id, schedule_date, time_slot, start_time, end_time, max_students, current_students, status) VALUES ?`,
      [pastSchedules]
    );
    console.log(`✓ 创建了 ${pastSchedules.length} 个过期课程`);

    // 3. 创建未来课程（5天后、10天后、15天后）
    console.log('\n2. 创建未来课程...');
    const futureDates = [
      new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),  // 5天后
      new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10天后
      new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)  // 15天后
    ];

    const futureSchedules = [];
    for (let i = 0; i < Math.min(3, courses.length); i++) {
      const course = courses[i];
      const futureDate = futureDates[i];
      
      futureSchedules.push([
        course.id,
        futureDate.toISOString().split('T')[0],
        i === 0 ? 'full_day' : (i === 1 ? 'morning' : 'afternoon'),
        i === 0 ? '09:00:00' : (i === 1 ? '09:00:00' : '14:00:00'),
        i === 0 ? '17:00:00' : (i === 1 ? '12:00:00' : '17:00:00'),
        20,
        Math.floor(Math.random() * 10) + 5, // 5-15人
        'scheduled'
      ]);
    }

    const [futureResult] = await connection.query(
      `INSERT INTO course_schedules (course_id, schedule_date, time_slot, start_time, end_time, max_students, current_students, status) VALUES ?`,
      [futureSchedules]
    );
    console.log(`✓ 创建了 ${futureSchedules.length} 个未来课程`);

    // 4. 为用户创建课券（用于预订）
    console.log('\n3. 创建测试课券...');
    const ticketCodes = [];
    for (let i = 0; i < 5; i++) {
      ticketCodes.push([
        testUserId,
        `T${Date.now()}${i}`,
        'admin',
        null,
        'unused',
        null,
        0,
        0,
        new Date().toISOString().split('T')[0],
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date(),
        null,
        null,
        'unissued',
        null
      ]);
    }

    const [ticketResult] = await connection.query(
      `INSERT INTO tickets (user_id, ticket_code, source, source_user_id, status, gift_status, purchase_amount, actual_amount, start_date, expiry_date, purchased_at, used_at, gifted_at, invoice_status, invoice_amount) VALUES ?`,
      [ticketCodes]
    );
    console.log(`✓ 创建了 ${ticketCodes.length} 张课券`);

    // 5. 预订未来课程（包括可取消和不可取消的）
    console.log('\n4. 创建预订记录...');
    const futureScheduleIds = Array.from({ length: futureSchedules.length }, (_, i) => futureResult.insertId + i);
    const ticketIds = Array.from({ length: ticketCodes.length }, (_, i) => ticketResult.insertId + i);

    const bookings = [];
    
    // 预订第一个未来课程（5天后，可取消）
    bookings.push([
      testUserId,
      futureScheduleIds[0],
      ticketIds[0],
      'booked'
    ]);

    // 预订第二个未来课程（10天后，可取消）
    bookings.push([
      testUserId,
      futureScheduleIds[1],
      ticketIds[1],
      'booked'
    ]);

    // 预订第三个未来课程（15天后，可取消）
    bookings.push([
      testUserId,
      futureScheduleIds[2],
      ticketIds[2],
      'booked'
    ]);

    // 预订一个过期课程（已完成的课程）
    const pastScheduleIds = Array.from({ length: pastSchedules.length }, (_, i) => pastResult.insertId + i);
    bookings.push([
      testUserId,
      pastScheduleIds[0],
      ticketIds[3],
      'completed'
    ]);

    const [bookingResult] = await connection.query(
      `INSERT INTO course_bookings (user_id, schedule_id, ticket_id, status) VALUES ?`,
      [bookings]
    );
    console.log(`✓ 创建了 ${bookings.length} 个预订记录`);

    // 6. 更新课程报名人数
    console.log('\n5. 更新课程报名人数...');
    for (const booking of bookings) {
      await connection.query(
        'UPDATE course_schedules SET current_students = current_students + 1 WHERE id = ?',
        [booking[1]]
      );
    }
    console.log('✓ 报名人数已更新');

    // 7. 更新课券状态为已预订
    for (let i = 0; i < bookings.length; i++) {
      await connection.query(
        'UPDATE tickets SET status = ? WHERE id = ?',
        ['booked', bookings[i][2]]
      );
    }
    console.log('✓ 课券状态已更新');

    console.log('\n✓ 测试数据插入完成！');
    console.log('\n数据摘要：');
    console.log(`- 过期课程: ${pastSchedules.length} 个`);
    console.log(`- 未来课程: ${futureSchedules.length} 个`);
    console.log(`- 预订记录: ${bookings.length} 个`);
    console.log(`- 其中过期课程预订: 1 个（显示"已取消"）`);
    console.log(`- 其中未来课程预订: 3 个（可测试取消功能）`);
    
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 插入测试数据失败:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

insertTestData();

