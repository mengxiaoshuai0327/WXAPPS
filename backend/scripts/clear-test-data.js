// 清空测试数据脚本
// 注意：此脚本会删除所有用户数据、邀请记录、优惠券、预订等业务数据
// 但会保留系统配置表（如课程模块、课程主题、营销方案配置等）

const db = require('../config/database');

async function clearTestData() {
  const connection = await db.getConnection();
  
  try {
    console.log('开始清空测试数据...\n');
    await connection.beginTransaction();

    // 1. 清空业务数据表（按依赖关系顺序删除）
    
    // 1.1 清空预订记录
    console.log('清空课程预订记录...');
    const [bookingResult] = await connection.query('DELETE FROM course_bookings');
    console.log(`  已删除 ${bookingResult.affectedRows} 条预订记录`);

    // 1.2 清空评价数据
    console.log('清空评价评论...');
    const [commentResult] = await connection.query('DELETE FROM evaluation_comments');
    console.log(`  已删除 ${commentResult.affectedRows} 条评论记录`);
    
    console.log('清空评价记录...');
    const [evaluationResult] = await connection.query('DELETE FROM evaluations');
    console.log(`  已删除 ${evaluationResult.affectedRows} 条评价记录`);

    // 1.3 清空课券数据
    console.log('清空课券记录...');
    const [ticketResult] = await connection.query('DELETE FROM tickets');
    console.log(`  已删除 ${ticketResult.affectedRows} 条课券记录`);

    // 1.4 清空优惠券数据
    console.log('清空优惠券记录...');
    const [couponResult] = await connection.query('DELETE FROM discount_coupons');
    console.log(`  已删除 ${couponResult.affectedRows} 条优惠券记录`);

    // 1.5 清空邀请记录
    console.log('清空邀请记录...');
    const [invitationResult] = await connection.query('DELETE FROM invitations');
    console.log(`  已删除 ${invitationResult.affectedRows} 条邀请记录`);

    // 1.6 清空营销统计数据
    console.log('清空营销统计数据...');
    const [statsResult] = await connection.query('DELETE FROM marketing_campaign_stats');
    console.log(`  已删除 ${statsResult.affectedRows} 条营销统计记录`);

    // 1.7 清空发票数据
    console.log('清空发票记录...');
    const [invoiceResult] = await connection.query('DELETE FROM invoices');
    console.log(`  已删除 ${invoiceResult.affectedRows} 条发票记录`);

    // 1.8 清空系统消息
    console.log('清空系统消息...');
    const [messageResult] = await connection.query('DELETE FROM system_messages');
    console.log(`  已删除 ${messageResult.affectedRows} 条系统消息`);

    // 1.9 清空排行榜数据
    console.log('清空排行榜数据...');
    const [rankingResult] = await connection.query('DELETE FROM rankings');
    console.log(`  已删除 ${rankingResult.affectedRows} 条排行榜记录`);

    // 2. 清空用户相关数据（需要先清空关联表）
    
    // 2.1 清空授课人信息
    console.log('清空授课人信息...');
    const [instructorResult] = await connection.query('DELETE FROM instructors');
    console.log(`  已删除 ${instructorResult.affectedRows} 条授课人记录`);

    // 2.2 清空用户数据（会级联删除相关数据）
    console.log('清空用户数据...');
    // 注意：保留角色为 'visitor' 的用户，只删除 'member' 和 'instructor' 角色
    const [userResult] = await connection.query("DELETE FROM users WHERE role IN ('member', 'instructor')");
    console.log(`  已删除 ${userResult.affectedRows} 条用户记录`);

    // 3. 重置自增ID（可选，如果需要从1开始）
    console.log('\n重置自增ID...');
    await connection.query('ALTER TABLE users AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE invitations AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE discount_coupons AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE tickets AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE course_bookings AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE evaluations AUTO_INCREMENT = 1');
    await connection.query('ALTER TABLE instructors AUTO_INCREMENT = 1');
    console.log('  自增ID已重置');

    // 提交事务
    await connection.commit();
    console.log('\n✓ 测试数据清空完成！');

    // 显示保留的数据统计
    console.log('\n保留的系统数据：');
    const [moduleCount] = await connection.query('SELECT COUNT(*) as count FROM course_modules');
    const [themeCount] = await connection.query('SELECT COUNT(*) as count FROM course_themes');
    const [courseCount] = await connection.query('SELECT COUNT(*) as count FROM courses');
    const [scheduleCount] = await connection.query('SELECT COUNT(*) as count FROM course_schedules');
    const [schemeCount] = await connection.query('SELECT COUNT(*) as count FROM coupon_schemes');
    const [channelCount] = await connection.query('SELECT COUNT(*) as count FROM channels');
    const [visitorCount] = await connection.query("SELECT COUNT(*) as count FROM users WHERE role = 'visitor'");

    console.log(`  课程模块: ${moduleCount[0].count} 个`);
    console.log(`  课程主题: ${themeCount[0].count} 个`);
    console.log(`  课程: ${courseCount[0].count} 个`);
    console.log(`  课程排期: ${scheduleCount[0].count} 个`);
    console.log(`  优惠券方案: ${schemeCount[0].count} 个`);
    console.log(`  渠道方: ${channelCount[0].count} 个`);
    console.log(`  游客用户: ${visitorCount[0].count} 个`);

  } catch (error) {
    await connection.rollback();
    console.error('清空数据时发生错误:', error);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

// 确认提示
console.log('⚠️  警告：此脚本将清空以下数据：');
console.log('  - 所有会员和授课人用户');
console.log('  - 所有邀请记录');
console.log('  - 所有优惠券');
console.log('  - 所有课券');
console.log('  - 所有预订记录');
console.log('  - 所有评价数据');
console.log('  - 所有发票记录');
console.log('\n将保留：');
console.log('  - 课程模块和主题');
console.log('  - 课程和排期');
console.log('  - 优惠券方案配置');
console.log('  - 渠道方配置');
console.log('  - 游客用户');
console.log('\n5秒后开始执行...\n');

setTimeout(() => {
  clearTestData();
}, 5000);
