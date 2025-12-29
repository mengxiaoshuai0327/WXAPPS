const db = require('../config/database');

async function testImmediateQuery() {
  try {
    console.log('=== 测试创建渠道销售后立即查询的时序问题 ===\n');
    
    // 模拟场景：创建渠道销售后，在不同时间点查询
    const testMemberId = 'M' + Date.now().toString().slice(-8);
    const testPhone = '188' + Date.now().toString().slice(-8);
    const channelUserId = 9; // 百度有限公司
    
    console.log('1. 创建渠道销售...');
    console.log(`   member_id: ${testMemberId}`);
    console.log(`   phone: ${testPhone}`);
    
    const [createResult] = await db.query(
      `INSERT INTO users (nickname, real_name, phone, password, role, member_id, channel_user_id, avatar_url) 
       VALUES (?, ?, ?, ?, 'member', ?, ?, ?)`,
      ['测试渠道销售', '测试渠道销售', testPhone, '$2a$10$test', testMemberId, channelUserId, null]
    );
    
    const newChannelSalesId = createResult.insertId;
    console.log(`  创建成功: user_id=${newChannelSalesId}`);
    
    // 测试1：立即查询（使用相同的连接池）
    console.log(`\n2. 立即查询（相同连接池）...`);
    const [query1] = await db.query(
      'SELECT id, member_id, channel_user_id FROM users WHERE member_id = ? AND role = ?',
      [testMemberId, 'member']
    );
    console.log(`  结果: ${query1.length} 条记录 ${query1.length > 0 ? '✓' : '✗'}`);
    
    // 测试2：使用不同的查询方式（模拟注册时的查询）
    console.log(`\n3. 使用注册时的查询方式...`);
    const [query2] = await db.query(
      'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE member_id = ? AND role = ?',
      [testMemberId, 'member']
    );
    console.log(`  结果: ${query2.length} 条记录 ${query2.length > 0 ? '✓' : '✗'}`);
    if (query2.length > 0) {
      console.log(`  找到: id=${query2[0].id}, member_id=${query2[0].member_id}, channel_user_id=${query2[0].channel_user_id}`);
    }
    
    // 测试3：验证member_id的唯一性
    console.log(`\n4. 验证member_id唯一性...`);
    const [query3] = await db.query(
      'SELECT id, member_id FROM users WHERE member_id = ?',
      [testMemberId]
    );
    console.log(`  结果: ${query3.length} 条记录`);
    if (query3.length !== 1) {
      console.log(`  ⚠️  警告：member_id应该有唯一性，但找到了${query3.length}条记录！`);
    }
    
    // 清理
    console.log(`\n5. 清理测试数据...`);
    await db.query('DELETE FROM users WHERE id = ?', [newChannelSalesId]);
    console.log(`  已删除`);
    
    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testImmediateQuery();

