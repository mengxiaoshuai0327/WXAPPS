const db = require('../config/database');

async function clearAllData() {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    console.log('开始清空数据...\n');
    
    // 需要清空的表（按外键依赖顺序，从子表到父表）
    const tablesToClear = [
      // 评价相关
      'evaluation_comments',
      'evaluations',
      
      // 课程预订
      'course_bookings',
      
      // 排课
      'course_schedules',
      
      // 课程（不保留，因为依赖users和themes）
      'courses',
      
      // 课券
      'tickets',
      
      // 折扣券
      'discount_coupons_backup',
      'discount_coupons',
      
      // 发票
      'invoices',
      
      // 邀请
      'invitations',
      
      // 排行榜
      'rankings',
      
      // 系统消息
      'user_message_reads',
      'system_messages',
      
      // 操作日志
      'operation_logs',
      
      // 营销统计
      'marketing_campaign_stats',
      
      // 用户推广方案
      'user_promotion_schemes',
      
      // 课程意向
      'course_intentions',
      
      // 授课人信息（需要在users之前清空，因为有外键）
      'instructors',
      
      // 用户（最后清空，因为很多表依赖它）
      'users',
    ];
    
    // 禁用外键检查（临时）
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    for (const table of tablesToClear) {
      try {
        const [result] = await connection.query(`DELETE FROM ${table}`);
        console.log(`✓ 已清空表: ${table} (${result.affectedRows} 条记录)`);
      } catch (error) {
        console.error(`✗ 清空表 ${table} 失败:`, error.message);
      }
    }
    
    // 重新启用外键检查
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    
    await connection.commit();
    
    console.log('\n✅ 数据清空完成！');
    console.log('⚠️  已保留以下表的数据：');
    console.log('   - course_modules (课程模块)');
    console.log('   - course_themes (课程主题)');
    console.log('   - 所有配置表（推广方案、Banner、问卷配置等）');
    
  } catch (error) {
    await connection.rollback();
    console.error('❌ 清空数据失败:', error);
    throw error;
  } finally {
    connection.release();
    process.exit(0);
  }
}

clearAllData();

