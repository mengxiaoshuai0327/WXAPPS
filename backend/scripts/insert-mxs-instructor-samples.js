require('dotenv').config();
const mysql = require('mysql2/promise');

async function insertMXSInstructorSamples() {
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

    await connection.beginTransaction();

    // 1. 查找或创建用户"MXS"
    let [users] = await connection.query(
      "SELECT id, nickname, role FROM users WHERE nickname = 'MXS' OR openid LIKE '%MXS%' LIMIT 1"
    );
    
    let mxsUserId;
    
    if (users.length === 0) {
      console.log('创建授课人用户 MXS...');
      // 创建新用户
      const [userResult] = await connection.query(
        `INSERT INTO users (openid, nickname, real_name, phone, role, member_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `mxs_${Date.now()}`,
          'MXS',
          'MXS',
          `138${Date.now().toString().slice(-8)}`,
          'instructor',
          `M${Date.now().toString().slice(-8)}`
        ]
      );
      mxsUserId = userResult.insertId;
      console.log(`✓ 创建了授课人用户 MXS (ID: ${mxsUserId})\n`);
    } else {
      mxsUserId = users[0].id;
      // 确保用户是授课人角色
      if (users[0].role !== 'instructor') {
        await connection.query(
          'UPDATE users SET role = ? WHERE id = ?',
          ['instructor', mxsUserId]
        );
        console.log(`✓ 已将用户 MXS (ID: ${mxsUserId}) 切换为授课人角色\n`);
      } else {
        console.log(`✓ 使用现有授课人用户 MXS (ID: ${mxsUserId})\n`);
      }
    }

    // 2. 查找课程主题，如果没有则创建
    let [themes] = await connection.query('SELECT id, name FROM course_themes LIMIT 1');
    
    if (themes.length === 0) {
      console.log('创建课程主题...');
      const [themeResult] = await connection.query(
        `INSERT INTO course_themes (name, description, icon) VALUES (?, ?, ?)`,
        ['商务技能', '提升职场商务技能', '💼']
      );
      themes = [{ id: themeResult.insertId, name: '商务技能' }];
      console.log(`✓ 创建了课程主题: ${themes[0].name}\n`);
    } else {
      console.log(`✓ 使用课程主题: ${themes[0].name}\n`);
    }

    const themeId = themes[0].id;

    // 3. 为MXS创建3-4门课程
    console.log('创建MXS的课程...\n');
    const courseData = [
      {
        title: '高效项目管理实战',
        code: 'PM001',
        subtitle: '掌握项目管理核心技能，提升项目成功率',
        intro: '本课程将深入讲解项目管理的核心概念和实践技巧，包括项目规划、进度控制、风险管理等内容。'
      },
      {
        title: '团队协作与沟通',
        code: 'TC001',
        subtitle: '打造高效团队，提升协作效率',
        intro: '学习团队协作的关键要素，掌握有效沟通技巧，建立高效的团队工作机制。'
      },
      {
        title: '数据分析与决策',
        code: 'DA001',
        subtitle: '用数据驱动业务决策',
        intro: '学习数据分析方法，掌握数据可视化技巧，提升基于数据的决策能力。'
      },
      {
        title: '领导力提升训练',
        code: 'LEAD001',
        subtitle: '培养卓越领导力，成为优秀管理者',
        intro: '系统学习领导力理论和实践，提升管理能力和团队影响力。'
      }
    ];

    const courses = [];
    
    // 检查课程是否已存在
    for (const courseInfo of courseData) {
      const [existing] = await connection.query(
        'SELECT id FROM courses WHERE course_code = ? AND instructor_id = ?',
        [courseInfo.code, mxsUserId]
      );
      
      if (existing.length === 0) {
        const [result] = await connection.query(
          `INSERT INTO courses (theme_id, instructor_id, course_code, title, subtitle, course_intro, instructor_intro)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            themeId,
            mxsUserId,
            courseInfo.code,
            courseInfo.title,
            courseInfo.subtitle,
            courseInfo.intro,
            'MXS，资深管理培训师，拥有多年项目管理与团队管理经验。'
          ]
        );
        courses.push({ id: result.insertId, ...courseInfo });
        console.log(`  ✓ 创建课程: ${courseInfo.title} (${courseInfo.code})`);
      } else {
        courses.push({ id: existing[0].id, ...courseInfo });
        console.log(`  - 使用现有课程: ${courseInfo.title} (${courseInfo.code})`);
      }
    }
    console.log(`\n✓ 共 ${courses.length} 门课程\n`);

    // 4. 创建测试会员用户（用于创建预订和评价）
    let [memberUsers] = await connection.query(
      "SELECT id, nickname FROM users WHERE role = 'member' LIMIT 5"
    );
    
    if (memberUsers.length < 5) {
      console.log('创建测试会员用户...');
      const existingCount = memberUsers.length;
      for (let i = existingCount; i < 5; i++) {
        const [result] = await connection.query(
          `INSERT INTO users (openid, nickname, real_name, phone, role, member_id)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            `test_member_mxs_${Date.now()}_${i}`,
            `学员${i + 1}`,
            `测试${i + 1}`,
            `139${Date.now().toString().slice(-7)}${i}`,
            'member',
            `M${Date.now().toString().slice(-8)}${i}`
          ]
        );
        memberUsers.push({ id: result.insertId, nickname: `学员${i + 1}` });
      }
      console.log(`✓ 创建了 ${5 - existingCount} 个测试会员用户\n`);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 5. 为每门课程创建已完成排课和未来排课
    console.log('创建排课数据...\n');
    let totalCompletedSchedules = 0;
    let totalFutureSchedules = 0;
    let totalEvaluations = 0;

    for (let courseIndex = 0; courseIndex < courses.length; courseIndex++) {
      const course = courses[courseIndex];
      console.log(`处理课程: ${course.title}`);

      // 创建已完成的排课（过去）
      const completedSchedules = [];
      const pastDates = [];
      for (let i = 1; i <= 5; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i * 7); // 每7天一期
        pastDates.push(date);
      }

      for (let i = 0; i < pastDates.length; i++) {
        const scheduleDate = pastDates[i];
        const timeSlot = i % 3 === 0 ? 'morning' : (i % 3 === 1 ? 'afternoon' : 'full_day');
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
            course.id,
            scheduleDate.toISOString().split('T')[0],
            timeSlot,
            startTime,
            endTime,
            20,
            4 + Math.floor(Math.random() * 8), // 4-11个学员
            'completed',
            1 // 已触发问卷
          ]
        );

        completedSchedules.push({
          id: scheduleResult.insertId,
          date: scheduleDate,
          timeSlot,
          courseIndex
        });
        totalCompletedSchedules++;
      }

      // 创建未来排课（即将开始的课程）
      const futureSchedules = [];
      const futureDates = [];
      for (let i = 1; i <= 3; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i * 10); // 每10天一期，未来30天内
        futureDates.push(date);
      }

      for (let i = 0; i < futureDates.length; i++) {
        const scheduleDate = futureDates[i];
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
            Math.floor(Math.random() * 8), // 0-7个已报名学员
            'scheduled',
            0 // 未触发问卷
          ]
        );

        futureSchedules.push({
          id: scheduleResult.insertId,
          date: scheduleDate,
          timeSlot
        });
        totalFutureSchedules++;
      }

      console.log(`  ✓ 已完成排课: ${completedSchedules.length} 期`);
      console.log(`  ✓ 未来排课: ${futureSchedules.length} 期`);

      // 6. 为已完成的排课创建预订和评价
      for (let scheduleIndex = 0; scheduleIndex < completedSchedules.length; scheduleIndex++) {
        const schedule = completedSchedules[scheduleIndex];
        const evaluationsPerSchedule = 4 + Math.floor(Math.random() * 3); // 4-6个评价

        for (let evalIndex = 0; evalIndex < evaluationsPerSchedule; evalIndex++) {
          const user = memberUsers[evalIndex % memberUsers.length];
          
          // 创建课券
          const ticketCode = `T${Date.now()}${courseIndex}${scheduleIndex}${evalIndex}`;
          const [ticketResult] = await connection.query(
            `INSERT INTO tickets (user_id, ticket_code, source, purchase_amount, actual_amount, status, used_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [user.id, ticketCode, 'admin', 1500, 1500, 'used', schedule.date]
          );

          // 创建预订
          await connection.query(
            `INSERT INTO course_bookings (user_id, schedule_id, ticket_id, status)
             VALUES (?, ?, ?, ?)`,
            [user.id, schedule.id, ticketResult.insertId, 'completed']
          );

          // 创建评价（评分随期数提升，同时不同课程有不同的平均分）
          const baseScore = 3.8 + (scheduleIndex * 0.25) + (courseIndex * 0.15);
          const variation = (Math.random() - 0.5) * 0.5;
          const avgScore = Math.min(5, Math.max(3.2, baseScore + variation));

          // 根据平均分生成答案
          let q1, q2, q3, q4, q9;
          
          if (avgScore >= 4.5) {
            q1 = 'A'; q2 = 'A'; q3 = 'A'; q4 = 'A'; q9 = 'A';
          } else if (avgScore >= 4.2) {
            q1 = 'A'; q2 = 'A'; q3 = 'B'; q4 = 'A'; q9 = 'A';
          } else if (avgScore >= 4.0) {
            q1 = 'B'; q2 = 'A'; q3 = 'A'; q4 = 'B'; q9 = 'A';
          } else if (avgScore >= 3.8) {
            q1 = 'B'; q2 = 'B'; q3 = 'B'; q4 = 'B'; q9 = 'A';
          } else {
            q1 = 'B'; q2 = 'B'; q3 = 'B'; q4 = 'B'; q9 = 'B';
          }

          // 添加随机性
          if (Math.random() > 0.7) {
            if (q1 === 'A' && Math.random() > 0.5) q1 = 'D';
            if (q1 === 'B' && Math.random() > 0.5) q1 = 'E';
          }

          const feedbackTexts = [
            `课程内容很实用，${course.title}帮助我解决了实际问题。`,
            `MXS老师的讲解很清晰，案例丰富，学到了很多。`,
            `通过这门课程，我对${course.subtitle}有了更深入的理解。`,
            `课程设计合理，理论与实践相结合，受益匪浅。`,
            `MXS老师的教学风格很好，互动性强，推荐学习。`
          ];

          const answers = {
            q1,
            q2,
            q3,
            q4,
            q5: 'A',
            q6: {},
            q7: feedbackTexts[Math.floor(Math.random() * feedbackTexts.length)],
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
              `对${course.title}的评价，整体评分约${avgScore.toFixed(1)}分，${feedbackTexts[Math.floor(Math.random() * feedbackTexts.length)]}`,
              'submitted',
              new Date(schedule.date.getTime() + 24 * 60 * 60 * 1000)
            ]
          );

          totalEvaluations++;
        }
      }

      console.log(`  ✓ 评价数据: ${completedSchedules.length} 期 × 平均4-6个 = 约 ${Math.floor(totalEvaluations / (courseIndex + 1))} 个\n`);
    }

    await connection.commit();

    console.log('\n' + '='.repeat(60));
    console.log('✓ MXS 授课人示例数据创建完成！\n');
    console.log('数据摘要：');
    console.log(`- 授课人: MXS (ID: ${mxsUserId})`);
    console.log(`- 课程数量: ${courses.length} 门`);
    console.log(`- 已完成排课: ${totalCompletedSchedules} 期`);
    console.log(`- 未来排课: ${totalFutureSchedules} 期`);
    console.log(`- 评价数据: ${totalEvaluations} 个\n`);
    console.log('课程列表：');
    courses.forEach((course, index) => {
      console.log(`  ${index + 1}. ${course.title} (${course.code})`);
    });
    console.log('\n评分特点：');
    console.log('- 每门课程评分略有不同（3.8-4.5分范围）');
    console.log('- 早期评分较低，后期评分较高');
    console.log('- 评分包含随机波动，模拟真实评价\n');
    console.log('查看方式：');
    console.log('1. 小程序：【我的】-【授课人专区】-【课程评价】');
    console.log('2. 小程序：【首页】-【课程表】查看未来开课');
    console.log('3. API: GET /api/evaluations/instructor/courses?instructor_id=' + mxsUserId);
    console.log('='.repeat(60) + '\n');
    
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 插入示例数据失败:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    console.error('错误详情:', error);
    if (connection) {
      await connection.rollback();
      await connection.end();
    }
    process.exit(1);
  }
}

insertMXSInstructorSamples();




























































