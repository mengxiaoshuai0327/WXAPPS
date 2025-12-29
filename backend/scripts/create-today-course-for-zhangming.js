// 为张明创建今天的课程示例，包含报名学员
// 使用方法: node scripts/create-today-course-for-zhangming.js

const db = require('../config/database');
const moment = require('moment');

async function createTodayCourse() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    console.log('开始创建今天的课程示例...\n');

    // 1. 确认张明的账号（ID=1）
    const [instructors] = await connection.query('SELECT id, nickname, real_name FROM users WHERE id = 1 AND role = "instructor"');
    if (instructors.length === 0) {
      throw new Error('张明账号不存在或不是授课人');
    }
    const instructor = instructors[0];
    console.log(`✓ 授课人: ${instructor.real_name} (${instructor.nickname})`);

    // 2. 获取课程主题（如果不存在则创建一个）
    let [themes] = await connection.query('SELECT id FROM course_themes LIMIT 1');
    let themeId;
    if (themes.length === 0) {
      const [result] = await connection.query(
        'INSERT INTO course_themes (name, description) VALUES (?, ?)',
        ['管理培训', '企业管理培训主题']
      );
      themeId = result.insertId;
      console.log(`✓ 创建了课程主题: ID=${themeId}`);
    } else {
      themeId = themes[0].id;
      console.log(`✓ 使用课程主题: ID=${themeId}`);
    }

    // 3. 创建课程
    const today = moment().format('YYYY-MM-DD');
    const courseCode = `ZM${moment().format('YYYYMMDD')}001`;
    
    const [courseResult] = await connection.query(
      `INSERT INTO courses (instructor_id, theme_id, title, subtitle, course_code) 
       VALUES (?, ?, ?, ?, ?)`,
      [
        instructor.id,
        themeId,
        '高效团队管理实战',
        '提升团队协作效率的管理技巧',
        courseCode
      ]
    );
    const courseId = courseResult.insertId;
    console.log(`✓ 创建了课程: ID=${courseId}, 课程编号=${courseCode}`);

    // 4. 创建今天的排课（上午场）
    const [scheduleResult] = await connection.query(
      `INSERT INTO course_schedules 
       (course_id, schedule_date, time_slot, start_time, end_time, max_students, current_students, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        courseId,
        today,
        'morning',
        '09:00:00',
        '12:00:00',
        20,
        0,
        'scheduled'
      ]
    );
    const scheduleId = scheduleResult.insertId;
    console.log(`✓ 创建了排课: ID=${scheduleId}, 日期=${today}, 时间段=上午(9-12)`);

    // 5. 获取可报名的会员用户（排除授课人自己）
    const [members] = await connection.query(
      'SELECT id, nickname, real_name FROM users WHERE role = ? AND id != ? ORDER BY id LIMIT 5',
      ['member', instructor.id]
    );

    if (members.length === 0) {
      console.log('\n⚠️  警告: 没有找到可用的会员用户');
      console.log('正在创建测试会员用户...');
      
      // 创建测试会员
      const testMembers = [];
      for (let i = 1; i <= 3; i++) {
        const [memberResult] = await connection.query(
          `INSERT INTO users (openid, nickname, real_name, role, member_id) 
           VALUES (?, ?, ?, ?, ?)`,
          [
            `test_member_zhangming_${Date.now()}_${i}`,
            `测试学员${i}`,
            `学员${i}`,
            'member',
            `M${Date.now()}${i}`
          ]
        );
        testMembers.push({
          id: memberResult.insertId,
          nickname: `测试学员${i}`,
          real_name: `学员${i}`
        });
      }
      console.log(`✓ 创建了 ${testMembers.length} 个测试会员用户`);
      members.push(...testMembers);
    }

    console.log(`\n找到 ${members.length} 个会员用户，开始报名...`);

    // 6. 为会员用户报名课程
    let bookingCount = 0;
    for (const member of members.slice(0, 4)) { // 最多4个学员报名
      try {
        // 检查会员是否有可用的课券（未使用的）
        const [tickets] = await connection.query(
          'SELECT id FROM tickets WHERE user_id = ? AND status = ? LIMIT 1',
          [member.id, 'unused']
        );

        let ticketId = null;
        if (tickets.length === 0) {
          // 如果没有课券，创建一个
          const ticketCode = `T${Date.now()}${Math.floor(Math.random() * 10000)}`;
          const [ticketResult] = await connection.query(
            `INSERT INTO tickets (user_id, ticket_code, status, source, expiry_date, purchased_at) 
             VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 6 MONTH), NOW())`,
            [member.id, ticketCode, 'unused', 'admin']
          );
          ticketId = ticketResult.insertId;
          console.log(`  - 为用户 ${member.real_name || member.nickname} 创建了课券`);
        } else {
          ticketId = tickets[0].id;
        }

        // 创建报名记录
        await connection.query(
          `INSERT INTO course_bookings (user_id, schedule_id, ticket_id, status, booked_at) 
           VALUES (?, ?, ?, ?, NOW())`,
          [member.id, scheduleId, ticketId, 'booked']
        );

        // 更新课券状态为已预订
        await connection.query(
          'UPDATE tickets SET status = ? WHERE id = ?',
          ['booked', ticketId]
        );

        // 更新排课的报名人数
        await connection.query(
          'UPDATE course_schedules SET current_students = current_students + 1 WHERE id = ?',
          [scheduleId]
        );

        bookingCount++;
        console.log(`  ✓ ${member.real_name || member.nickname} 报名成功`);
      } catch (error) {
        console.error(`  ✗ ${member.real_name || member.nickname} 报名失败:`, error.message);
      }
    }

    // 7. 更新排课的最终报名人数
    const [finalSchedule] = await connection.query(
      'SELECT current_students FROM course_schedules WHERE id = ?',
      [scheduleId]
    );

    await connection.commit();
    connection.release();

    console.log(`\n✅ 创建完成!`);
    console.log(`\n课程信息:`);
    console.log(`  - 课程ID: ${courseId}`);
    console.log(`  - 课程名称: 高效团队管理实战`);
    console.log(`  - 课程编号: ${courseCode}`);
    console.log(`  - 排课ID: ${scheduleId}`);
    console.log(`  - 上课日期: ${today}`);
    console.log(`  - 时间段: 上午 9:00-12:00`);
    console.log(`  - 报名人数: ${finalSchedule[0].current_students}/${20}`);
    console.log(`\n现在可以:`);
    console.log(`  1. 在小程序的"授课列表"中查看此课程`);
    console.log(`  2. 点击课程卡片进入详情页面`);
    console.log(`  3. 查看报名人员列表`);
    console.log(`  4. 点击"触发课后评价"按钮测试功能`);

    process.exit(0);
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('创建失败:', error);
    process.exit(1);
  }
}

createTodayCourse();

