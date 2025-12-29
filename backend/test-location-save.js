const db = require('./config/database');

async function testLocationSave() {
  try {
    console.log('开始测试location字段的保存和显示...\n');

    // 1. 获取一个课程ID用于测试
    const [courses] = await db.query('SELECT id FROM courses ORDER BY id DESC LIMIT 1');
    if (courses.length === 0) {
      console.error('错误：数据库中没有课程，无法测试');
      return;
    }
    const courseId = courses[0].id;
    console.log(`使用课程ID: ${courseId}`);

    // 2. 创建一条测试排课记录，包含location字段
    const testLocation = '北京市中关村街道59号';
    const testDate = '2025-12-28';
    const testTimeSlot = 'afternoon';
    const testStartTime = '14:00:00';
    const testEndTime = '17:00:00';
    const testMaxStudents = 20;

    console.log(`\n插入测试数据:`);
    console.log(`- location: ${testLocation}`);
    console.log(`- schedule_date: ${testDate}`);
    console.log(`- time_slot: ${testTimeSlot}`);

    const [insertResult] = await db.query(
      `INSERT INTO course_schedules (course_id, schedule_date, time_slot, start_time, end_time, max_students, location, current_students, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'scheduled')`,
      [courseId, testDate, testTimeSlot, testStartTime, testEndTime, testMaxStudents, testLocation]
    );

    const scheduleId = insertResult.insertId;
    console.log(`\n插入成功，排课ID: ${scheduleId}`);

    // 3. 查询刚插入的记录，确认location字段已保存
    const [savedRecords] = await db.query(
      'SELECT id, course_id, schedule_date, location FROM course_schedules WHERE id = ?',
      [scheduleId]
    );

    if (savedRecords.length === 0) {
      console.error('错误：查询不到刚插入的记录');
      return;
    }

    const savedRecord = savedRecords[0];
    console.log(`\n查询结果:`);
    console.log(`- id: ${savedRecord.id}`);
    console.log(`- course_id: ${savedRecord.course_id}`);
    console.log(`- schedule_date: ${savedRecord.schedule_date}`);
    console.log(`- location: ${savedRecord.location || '(NULL)'}`);

    if (savedRecord.location === testLocation) {
      console.log('\n✅ 测试通过：location字段已正确保存到数据库');
    } else {
      console.log(`\n❌ 测试失败：location字段未正确保存`);
      console.log(`   期望: ${testLocation}`);
      console.log(`   实际: ${savedRecord.location || '(NULL)'}`);
    }

    // 4. 测试查询列表API使用的SQL（模拟）
    const [listRecords] = await db.query(
      `SELECT cs.*, 
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
              c.id as course_id, c.title as course_title, c.course_code, c.instructor_id
       FROM course_schedules cs
       JOIN courses c ON cs.course_id = c.id
       WHERE cs.id = ?`,
      [scheduleId]
    );

    if (listRecords.length > 0) {
      const listRecord = listRecords[0];
      console.log(`\n模拟列表API查询结果:`);
      console.log(`- id: ${listRecord.id}`);
      console.log(`- location: ${listRecord.location || '(NULL)'}`);
      console.log(`- course_title: ${listRecord.course_title || '(NULL)'}`);

      if (listRecord.location === testLocation) {
        console.log('\n✅ 测试通过：列表API查询能正确返回location字段');
      } else {
        console.log(`\n❌ 测试失败：列表API查询未返回location字段`);
      }
    }

    // 5. 清理测试数据
    await db.query('DELETE FROM course_schedules WHERE id = ?', [scheduleId]);
    console.log(`\n已清理测试数据（删除排课ID: ${scheduleId}）`);

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    process.exit(0);
  }
}

testLocationSave();

