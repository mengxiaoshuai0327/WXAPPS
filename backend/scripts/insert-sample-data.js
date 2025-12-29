// 插入示例课程数据
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

async function insertSampleData() {
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

    // 1. 创建课程模块
    console.log('\n1. 创建课程模块...');
    const [modules] = await connection.query(
      'INSERT INTO course_modules (name, description, sort_order) VALUES ?',
      [[
        ['商务沟通', '提升商务场景下的沟通能力', 1],
        ['领导力', '培养团队管理和领导技能', 2],
        ['个人成长', '提升个人职业素养和能力', 3]
      ]]
    );
    const moduleIds = [modules.insertId, modules.insertId + 1, modules.insertId + 2];
    console.log(`✓ 创建了 ${moduleIds.length} 个课程模块`);

    // 2. 创建课程主题
    console.log('\n2. 创建课程主题...');
    const [themes] = await connection.query(
      'INSERT INTO course_themes (module_id, name, description) VALUES ?',
      [[
        [moduleIds[0], '高效沟通', '学习如何在商务场景中高效表达和倾听'],
        [moduleIds[0], '公众演讲', '掌握公众演讲技巧，提升表达自信'],
        [moduleIds[1], '团队管理', '学习如何有效管理和激励团队'],
        [moduleIds[1], '决策力', '提升在复杂情况下的决策能力'],
        [moduleIds[2], '时间管理', '掌握高效时间管理方法，提升工作效率'],
        [moduleIds[2], '职业规划', '制定清晰的职业发展路径']
      ]]
    );
    const themeIds = Array.from({ length: 6 }, (_, i) => themes.insertId + i);
    console.log(`✓ 创建了 ${themeIds.length} 个课程主题`);

    // 3. 创建授课人用户
    console.log('\n3. 创建授课人...');
    const [instructors] = await connection.query(
      `INSERT INTO users (openid, nickname, real_name, role) VALUES ?`,
      [[
        ['instructor_001', '张教授', '张明', 'instructor'],
        ['instructor_002', '李老师', '李华', 'instructor'],
        ['instructor_003', '王导师', '王强', 'instructor']
      ]]
    );
    const instructorUserIds = [instructors.insertId, instructors.insertId + 1, instructors.insertId + 2];
    console.log(`✓ 创建了 ${instructorUserIds.length} 位授课人`);

    // 4. 创建授课人信息
    console.log('\n4. 添加授课人详细信息...');
    await connection.query(
      `INSERT INTO instructors (user_id, bio, background) VALUES ?`,
      [[
        [instructorUserIds[0], '资深商务沟通专家', '拥有15年企业培训经验，曾为500强企业提供沟通培训，擅长商务谈判和团队协作'],
        [instructorUserIds[1], '领导力发展顾问', '10年管理咨询经验，专注于团队管理和组织发展，帮助数百位管理者提升领导力'],
        [instructorUserIds[2], '职业发展导师', '8年职业规划咨询经验，擅长帮助职场人士制定职业发展路径，实现职业目标']
      ]]
    );
    console.log('✓ 授课人信息已添加');

    // 5. 创建课程
    console.log('\n5. 创建课程...');
    const courses = [
      {
        theme_id: themeIds[0],
        instructor_id: instructorUserIds[0],
        course_code: 'COMM001',
        title: '高效商务沟通技巧',
        subtitle: '提升职场沟通能力，建立良好工作关系',
        instructor_intro: '张教授拥有15年企业培训经验，专注于商务沟通领域，曾为多家知名企业提供培训服务。擅长将理论知识与实际案例相结合，帮助学员快速提升沟通能力。',
        course_intro: '本课程将帮助您掌握商务沟通的核心技巧，包括有效倾听、清晰表达、非语言沟通等。通过案例分析、角色扮演等互动方式，让您在实际工作中能够自信地进行商务沟通。'
      },
      {
        theme_id: themeIds[1],
        instructor_id: instructorUserIds[0],
        course_code: 'SPEAK001',
        title: '公众演讲与表达',
        subtitle: '克服演讲恐惧，成为自信的演讲者',
        instructor_intro: '张教授在公众演讲领域有丰富经验，曾指导数百位学员提升演讲能力。擅长帮助学员克服紧张情绪，建立演讲自信。',
        course_intro: '本课程将系统讲解公众演讲的技巧和方法，包括演讲稿撰写、肢体语言运用、声音控制等。通过大量练习，帮助您成为自信、有影响力的演讲者。'
      },
      {
        theme_id: themeIds[2],
        instructor_id: instructorUserIds[1],
        course_code: 'LEAD001',
        title: '高效团队管理',
        subtitle: '打造高效协作团队，提升团队绩效',
        instructor_intro: '李老师拥有10年管理咨询经验，专注于团队管理和组织发展。曾帮助多家企业建立高效团队管理体系，提升团队协作效率。',
        course_intro: '本课程将深入探讨团队管理的核心要素，包括目标设定、任务分配、激励方法、冲突处理等。通过实际案例和工具方法，帮助您打造高效协作的团队。'
      },
      {
        theme_id: themeIds[3],
        instructor_id: instructorUserIds[1],
        course_code: 'DECIS001',
        title: '战略决策力提升',
        subtitle: '在复杂环境中做出明智决策',
        instructor_intro: '李老师在决策力培训方面有丰富经验，擅长帮助管理者在复杂情况下做出明智决策。曾为多家企业提供决策力培训。',
        course_intro: '本课程将教授决策分析的方法和工具，包括问题分析、方案评估、风险评估等。通过案例分析和实战演练，提升您在复杂环境中的决策能力。'
      },
      {
        theme_id: themeIds[4],
        instructor_id: instructorUserIds[2],
        course_code: 'TIME001',
        title: '高效时间管理',
        subtitle: '掌握时间管理方法，提升工作效率',
        instructor_intro: '王导师在时间管理领域有深入研究，擅长帮助职场人士建立高效的时间管理体系。曾帮助数百位学员提升工作效率。',
        course_intro: '本课程将系统介绍时间管理的核心方法和工具，包括优先级设定、任务规划、时间分配等。通过实践练习，帮助您建立高效的时间管理习惯。'
      },
      {
        theme_id: themeIds[5],
        instructor_id: instructorUserIds[2],
        course_code: 'CAREER001',
        title: '职业规划与发展',
        subtitle: '制定清晰的职业发展路径',
        instructor_intro: '王导师拥有8年职业规划咨询经验，擅长帮助职场人士制定职业发展路径。曾指导数百位学员实现职业目标。',
        course_intro: '本课程将帮助您深入了解自己的职业兴趣和能力，制定清晰的职业发展目标。通过职业规划工具和方法，为您的职业发展指明方向。'
      }
    ];

    const courseValues = courses.map(c => [
      c.theme_id,
      c.instructor_id,
      c.course_code,
      c.title,
      c.subtitle,
      c.instructor_intro,
      c.course_intro
    ]);

    const [courseResult] = await connection.query(
      `INSERT INTO courses (theme_id, instructor_id, course_code, title, subtitle, instructor_intro, course_intro) VALUES ?`,
      [courseValues]
    );
    const courseIds = Array.from({ length: courses.length }, (_, i) => courseResult.insertId + i);
    console.log(`✓ 创建了 ${courses.length} 门课程`);

    // 6. 创建排课（未来30天的课程）
    console.log('\n6. 创建排课...');
    const today = new Date();
    const schedules = [];
    
    // 为每门课程创建多个排课
    courseIds.forEach((courseId, index) => {
      const course = courses[index];
      
      // 创建未来30天内的排课
      for (let i = 1; i <= 5; i++) {
        const scheduleDate = new Date(today);
        scheduleDate.setDate(today.getDate() + i * 5); // 每5天一个课程
        
        // 随机选择时间段
        const timeSlots = ['morning', 'afternoon', 'full_day'];
        const timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];
        
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
        
        schedules.push([
          courseId,
          scheduleDate.toISOString().split('T')[0],
          timeSlot,
          startTime,
          endTime,
          20, // max_students
          Math.floor(Math.random() * 10), // current_students (0-10)
          'scheduled'
        ]);
      }
    });

    await connection.query(
      `INSERT INTO course_schedules (course_id, schedule_date, time_slot, start_time, end_time, max_students, current_students, status) VALUES ?`,
      [schedules]
    );
    console.log(`✓ 创建了 ${schedules.length} 个排课`);

    // 8. 创建示例排行榜数据
    console.log('\n8. 创建示例排行榜数据...');
    const rankingData = [];
    
    // 主题排行榜
    themeIds.forEach((themeId, index) => {
      rankingData.push([
        'theme',
        themeId,
        (100 - index * 5).toFixed(2), // score
        index + 1, // rank
        JSON.stringify({ name: ['高效沟通', '公众演讲', '团队管理', '决策力', '时间管理', '职业规划'][index] }),
        'all',
        1 // published
      ]);
    });
    
    // 课程排行榜
    courseIds.forEach((courseId, index) => {
      rankingData.push([
        'course',
        courseId,
        (95 - index * 3).toFixed(2), // score
        index + 1, // rank
        JSON.stringify({ title: courses[index].title }),
        'all',
        1 // published
      ]);
    });
    
    // 授课人排行榜
    instructorUserIds.forEach((instructorId, index) => {
      rankingData.push([
        'instructor',
        instructorId,
        (90 - index * 2).toFixed(2), // score
        index + 1, // rank
        JSON.stringify({ name: ['李老师', '张教授', '王老师'][index] }),
        'all',
        1 // published
      ]);
    });

    await connection.query(
      'INSERT INTO rankings (type, target_id, score, `rank`, data, time_range, published) VALUES ?',
      [rankingData]
    );
    console.log(`✓ 创建了 ${rankingData.length} 条排行榜数据`);

    console.log('\n✓ 示例数据插入完成！');
    console.log('\n课程列表：');
    courses.forEach((course, index) => {
      console.log(`  ${index + 1}. ${course.title} (${course.course_code})`);
    });
    
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 插入示例数据失败:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n请检查：');
      console.error('1. MySQL 服务是否已启动');
      console.error('2. .env 文件中的数据库配置是否正确');
      console.error('3. 数据库是否已初始化（运行 npm run init-db）');
      console.error('\n提示：');
      console.error('- 启动 MySQL: brew services start mysql (macOS)');
      console.error('- 测试连接: npm run test-db');
      console.error('- 初始化数据库: npm run init-db');
    }
    
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

insertSampleData();

