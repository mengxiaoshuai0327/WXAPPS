const db = require('./config/database');

// 模拟后端API处理逻辑
async function testAPILocation() {
  try {
    console.log('测试后端API对location字段的处理...\n');

    // 模拟前端提交的数据（包含location字段）
    const reqBody = {
      course_id: 29,
      schedule_date: '2025-12-29',
      time_slot: 'afternoon',
      start_time: '14:00:00',
      end_time: '17:00:00',
      max_students: 20,
      location: '北京市中关村街道59号'
    };

    console.log('模拟前端提交的数据:');
    console.log(JSON.stringify(reqBody, null, 2));

    // 模拟后端API的处理逻辑
    const { course_id, schedule_date, time_slot, start_time, end_time, max_students, location } = reqBody;

    console.log(`\n解构后的location值: ${location}`);
    console.log(`location类型: ${typeof location}`);
    console.log(`location是否为空: ${!location}`);
    console.log(`location.trim()后: ${location ? location.trim() : '(null)'}`);

    // 处理location字段（模拟后端代码）
    const finalLocation = (location && location.trim()) ? location.trim() : null;
    console.log(`\n最终保存的location值: ${finalLocation}`);

    // 执行插入
    const [result] = await db.query(
      `INSERT INTO course_schedules (course_id, schedule_date, time_slot, start_time, end_time, max_students, location, current_students, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'scheduled')`,
      [course_id, schedule_date, time_slot, start_time, end_time, max_students || 20, finalLocation]
    );

    const scheduleId = result.insertId;
    console.log(`\n插入成功，排课ID: ${scheduleId}`);

    // 查询验证
    const [savedRecords] = await db.query(
      'SELECT id, location FROM course_schedules WHERE id = ?',
      [scheduleId]
    );

    const savedRecord = savedRecords[0];
    console.log(`\n数据库中的location值: ${savedRecord.location || '(NULL)'}`);

    if (savedRecord.location === '北京市中关村街道59号') {
      console.log('\n✅ API测试通过：location字段已正确保存');
    } else {
      console.log('\n❌ API测试失败：location字段未正确保存');
    }

    // 清理
    await db.query('DELETE FROM course_schedules WHERE id = ?', [scheduleId]);
    console.log(`\n已清理测试数据`);

    // 测试空字符串的情况
    console.log('\n\n测试空字符串的情况:');
    const reqBodyEmpty = {
      course_id: 29,
      schedule_date: '2025-12-30',
      time_slot: 'morning',
      start_time: '09:00:00',
      end_time: '12:00:00',
      max_students: 20,
      location: ''  // 空字符串
    };

    const { location: locationEmpty } = reqBodyEmpty;
    const finalLocationEmpty = (locationEmpty && locationEmpty.trim()) ? locationEmpty.trim() : null;
    console.log(`空字符串处理结果: ${finalLocationEmpty === null ? 'NULL (正确)' : finalLocationEmpty + ' (错误)'}`);

    // 测试undefined的情况
    console.log('\n测试undefined的情况:');
    const reqBodyUndefined = {
      course_id: 29,
      schedule_date: '2025-12-31',
      time_slot: 'afternoon',
      start_time: '14:00:00',
      end_time: '17:00:00',
      max_students: 20
      // location字段不存在
    };

    const { location: locationUndefined } = reqBodyUndefined;
    const finalLocationUndefined = (locationUndefined && locationUndefined.trim()) ? locationUndefined.trim() : null;
    console.log(`undefined处理结果: ${finalLocationUndefined === null ? 'NULL (正确)' : finalLocationUndefined + ' (错误)'}`);

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    process.exit(0);
  }
}

testAPILocation();

