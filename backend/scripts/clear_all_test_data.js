const mysql = require('mysql2/promise');
require('dotenv').config();

async function clearAllTestData() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'xiaocx_db',
      timezone: '+08:00',
      multipleStatements: true
    });

    console.log('✓ 数据库连接成功');
    console.log('⚠️  警告：即将清空所有测试数据！');
    console.log('');

    // 按照外键依赖顺序删除
    const tables = [
      { name: 'operation_logs', desc: '操作日志' },
      { name: 'system_messages', desc: '系统消息' },
      { name: 'evaluations', desc: '课程评价' },
      { name: 'course_bookings', desc: '课程预订' },
      { name: 'course_schedules', desc: '排课' },
      { name: 'course_intentions', desc: '课程意向' },
      { name: 'invoices', desc: '发票' },
      { name: 'tickets', desc: '课券' },
      { name: 'discount_coupons', desc: '折扣券' },
      { name: 'invitations', desc: '邀请记录' },
      { name: 'courses', desc: '课程' }
    ];

    console.log('开始清空数据...');
    console.log('');

    for (const table of tables) {
      try {
        // 检查表是否存在
        const [tables] = await connection.query(
          `SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = ? AND table_name = ?`,
          [process.env.DB_NAME || 'xiaocx_db', table.name]
        );

        if (tables[0].count > 0) {
          const [result] = await connection.query(`DELETE FROM ${table.name}`);
          console.log(`✓ 已清空 ${table.desc} (${table.name}): ${result.affectedRows} 条记录`);
        } else {
          console.log(`⚠ 表 ${table.name} 不存在，跳过`);
        }
      } catch (error) {
        console.error(`✗ 清空 ${table.desc} (${table.name}) 失败:`, error.message);
      }
    }

    console.log('');
    console.log('✅ 所有测试数据已清空完成！');
    console.log('');
    console.log('注意：以下表的数据未清空（通常包含配置数据）：');
    console.log('  - course_themes (主题)');
    console.log('  - course_modules (模块)');
    console.log('  - users (用户)');

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ 清空数据失败:', error.message);
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

clearAllTestData();

