require('dotenv').config();
const mysql = require('mysql2/promise');

async function insertInstructorEvaluationSamples() {
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

    console.log('✓ 数据库连接成功\n');

    // 1. 查找授课人（ID=3，张教授）
    const [instructors] = await connection.query(
      "SELECT id, nickname FROM users WHERE role = 'instructor' AND id = 3"
    );
    
    if (instructors.length === 0) {
      console.log('✗ 没有找到授课人（ID=3），请先确保有授课人用户');
      await connection.end();
      process.exit(1);
    }

    const instructorId = instructors[0].id;
    console.log(`✓ 使用授课人: ${instructors[0].nickname} (ID: ${instructorId})\n`);

    // 2. 查找该授课人的课程，如果没有则创建
    let [courses] = await connection.query(
      'SELECT id, title, course_code FROM courses WHERE instructor_id = ?',
      [instructorId]
    );

    if (courses.length === 0) {
      console.log('创建示例课程...');
      // 查找主题
      const [themes] = await connection.query('SELECT id FROM course_themes LIMIT 1');
      if (themes.length === 0) {
        console.log('✗ 没有找到课程主题，请先运行 insert-sample-data.js');
        await connection.end();
        process.exit(1);
      }

      const themeId = themes[0].id;
      
      // 创建2个示例课程
      const courseData = [
        ['高效时间管理', 'TIME001', '提升工作效率的时间管理技巧'],
        ['职业规划与发展', 'CAREER001', '制定职业发展路径，实现职业目标']
      ];

      for (const [title, code, subtitle] of courseData) {
        const [result] = await connection.query(
          `INSERT INTO courses (theme_id, instructor_id, course_code, title, subtitle, course_intro)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [themeId, instructorId, code, title, subtitle, `${title}的详细介绍`]
        );
        courses.push({ id: result.insertId, title, course_code: code });
      }
      console.log(`✓ 创建了 ${courses.length} 个课程\n`);
    } else {
      console.log(`✓ 找到 ${courses.length} 个现有课程\n`);
    }

    // 3. 查找测试会员用户（用于创建预订和评价）
    let [users] = await connection.query(
      "SELECT id, nickname FROM users WHERE role = 'member' LIMIT 3"
    );
    
    if (users.length < 3) {
      console.log('创建测试会员用户...');
      const existingCount = users.length;
      for (let i = existingCount; i < 3; i++) {
        const [result] = await connection.query(
          `INSERT INTO users (openid, nickname, real_name, phone, role, member_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `test_member_${Date.now()}_${i}`,
            `测试会员${i + 1}`,
            `测试${i + 1}`,
            `138${Date.now().toString().slice(-8)}${i}`,
            'member',
            `M${Date.now().toString().slice(-8)}${i}`
          ]
        );
        users.push({ id: result.insertId, nickname: `测试会员${i + 1}` });
      }
      console.log(`✓ 创建了 ${3 - existingCount} 个测试会员用户\n`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 4. 为每个课程创建多期已完成排课和评价数据
    console.log('创建排课和评价数据...\n');
    
    for (let courseIndex = 0; courseIndex < courses.length; courseIndex++) {
      const course = courses[courseIndex];
      console.log(`处理课程: ${course.title} (${course.course_code})`);
      
      // 为每个课程创建3-5期已完成的排课（课程日期在过去）
      const scheduleDates = [];
      for (let i = 1; i <= 5; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i * 7); // 每7天一期，从7天前开始
        scheduleDates.push(date);
      }

      const schedules = [];
      
      for (let i = 0; i < scheduleDates.length; i++) {
        const scheduleDate = scheduleDates[i];
        const timeSlot = i % 2 === 0 ? 'morning' : 'afternoon';
        const startTime = timeSlot === 'morning' ? '09:00:00' : '14:00:00';
        const endTime = timeSlot === 'morning' ? '12:00:00' : '17:00:00';

        const [scheduleResult] = await connection.query(
          `INSERT INTO course_schedules 
           (course_id, schedule_date, time_slot, start_time, end_time, max_students, current_students, status, questionnaire_triggered)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            course.id,
            scheduleDate.toISOString().split('T')[0],
            timeSlot,
            startTime,
            endTime,
            20,
            3, // 每期3个学员
            'completed',
            1 // 已触发问卷
          ]
        );

        schedules.push({
          id: scheduleResult.insertId,
          date: scheduleDate,
          timeSlot
        });
      }
      console.log(`  ✓ 创建了 ${schedules.length} 个排课`);

      // 5. 为每期排课创建预订和评价
      let totalEvaluations = 0;
      
      for (let scheduleIndex = 0; scheduleIndex < schedules.length; scheduleIndex++) {
        const schedule = schedules[scheduleIndex];
        const evaluationsPerSchedule = 3; // 每期3个评价

        for (let evalIndex = 0; evalIndex < evaluationsPerSchedule; evalIndex++) {
          const user = users[evalIndex % users.length];
          
          // 创建课券
          const ticketCode = `T${Date.now()}${courseIndex}${scheduleIndex}${evalIndex}`;
          const [ticketResult] = await connection.query(
            `INSERT INTO tickets (user_id, ticket_code, source, purchase_amount, actual_amount, status, used_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user.id, ticketCode, 'admin', 1500, 1500, 'used', schedule.date]
          );

          // 创建预订
          const [bookingResult] = await connection.query(
            `INSERT INTO course_bookings (user_id, schedule_id, ticket_id, status)
             VALUES (?, ?, ?, ?)`,
            [user.id, schedule.id, ticketResult.insertId, 'completed']
          );

          // 创建评价（根据期数生成不同的评分）
          // 早期评分较低，后期评分较高（模拟改进过程）
          const baseScore = 3.5 + (scheduleIndex * 0.3); // 从3.5到4.7递增
          const variation = (Math.random() - 0.5) * 0.4; // ±0.2的随机变化
          const avgScore = Math.min(5, Math.max(1, baseScore + variation));

          // 根据平均分生成Q1-Q4和Q9的答案
          // Q1: A=5, B=3, C=1, D=4, E=2
          // Q2-Q4: A=5, B=3, C=1
          // Q9: A=5, B=2
          
          let q1, q2, q3, q4, q9;
          
          if (avgScore >= 4.5) {
            q1 = 'A'; q2 = 'A'; q3 = 'A'; q4 = 'A'; q9 = 'A';
          } else if (avgScore >= 4.0) {
            q1 = 'A'; q2 = 'A'; q3 = 'B'; q4 = 'A'; q9 = 'A';
          } else if (avgScore >= 3.5) {
            q1 = 'B'; q2 = 'B'; q3 = 'A'; q4 = 'B'; q9 = 'A';
          } else if (avgScore >= 3.0) {
            q1 = 'B'; q2 = 'B'; q3 = 'B'; q4 = 'B'; q9 = 'B';
          } else {
            q1 = 'C'; q2 = 'C'; q3 = 'C'; q4 = 'C'; q9 = 'B';
          }

          // 添加一些随机性
          if (Math.random() > 0.8) {
            if (q1 === 'A' && Math.random() > 0.5) q1 = 'D';
            if (q1 === 'B' && Math.random() > 0.5) q1 = 'E';
          }

          const answers = {
            q1,
            q2,
            q3,
            q4,
            q5: 'A', // 其他题目使用固定答案
            q6: {}, // 案例评分（可选）
            q7: `课程内容很实用，${course.title}帮助我提升了相关技能。`,
            q8: {},
            q9
          };

          // 创建评价记录
          await connection.query(
            `INSERT INTO evaluations (user_id, schedule_id, course_id, answers, feedback, status, submitted_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              user.id,
              schedule.id,
              course.id,
              JSON.stringify(answers),
              `对${course.title}的评价反馈，评分约${avgScore.toFixed(1)}分`,
              'submitted',
              new Date(schedule.date.getTime() + 24 * 60 * 60 * 1000) // 课程后一天提交
            ]
          );

          totalEvaluations++;
        }
      }

      console.log(`  ✓ 创建了 ${totalEvaluations} 个评价数据\n`);
    }

    console.log('\n✓ 授课人课程评价示例数据插入完成！\n');
    console.log('数据摘要：');
    console.log(`- 授课人: ${instructors[0].nickname} (ID: ${instructorId})`);
    console.log(`- 课程数量: ${courses.length}`);
    console.log(`- 每门课程排课期数: 5期`);
    console.log(`- 每期评价数量: 3个`);
    console.log(`- 总评价数量: ${courses.length * 5 * 3}个\n`);
    console.log('评分说明：');
    console.log('- 本期评分：第5期（最近一期）的评价平均分');
    console.log('- 近3期平均：第3-5期的评价平均分');
    console.log('- 评分从早期到后期逐渐提升（3.5 → 4.7）\n');
    console.log('现在可以在小程序中查看：');
    console.log('【我的】-【授课人专区】-【课程评价】\n');
    
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

insertInstructorEvaluationSamples();




























































