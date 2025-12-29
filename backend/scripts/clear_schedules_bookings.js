// 清除排课列表和课程预定列表的示例数据
const db = require('../config/database');

async function clearSchedulesAndBookings() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    console.log('开始清除排课和预订数据...');
    
    // 1. 删除评价数据
    const [evaluationResult] = await connection.query('DELETE FROM evaluations');
    console.log(`✓ 已删除 ${evaluationResult.affectedRows} 条评价数据`);
    
    // 2. 删除课程预订数据
    const [bookingResult] = await connection.query('DELETE FROM course_bookings');
    console.log(`✓ 已删除 ${bookingResult.affectedRows} 条预订数据`);
    
    // 3. 删除排课数据
    const [scheduleResult] = await connection.query('DELETE FROM course_schedules');
    console.log(`✓ 已删除 ${scheduleResult.affectedRows} 条排课数据`);
    
    await connection.commit();
    console.log('\n✓ 清除完成！');
    console.log(`  总计删除：`);
    console.log(`  - 评价数据: ${evaluationResult.affectedRows} 条`);
    console.log(`  - 预订数据: ${bookingResult.affectedRows} 条`);
    console.log(`  - 排课数据: ${scheduleResult.affectedRows} 条`);
    
  } catch (error) {
    await connection.rollback();
    console.error('清除失败:', error);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

// 执行清除
clearSchedulesAndBookings();

