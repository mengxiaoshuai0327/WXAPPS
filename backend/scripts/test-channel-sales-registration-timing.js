const db = require('../config/database');

async function testChannelSalesRegistrationTiming() {
  try {
    console.log('=== 测试渠道销售注册时序问题 ===\n');
    
    // 模拟场景：创建一个渠道销售，然后立即查询
    console.log('1. 创建渠道销售...');
    const testMemberId = 'M' + Date.now().toString().slice(-8);
    const testPhone = '188' + Date.now().toString().slice(-8);
    
    // 假设channel_user_id = 9（百度有限公司）
    const channelUserId = 9;
    
    const [createResult] = await db.query(
      `INSERT INTO users (nickname, real_name, phone, password, role, member_id, channel_user_id, avatar_url) 
       VALUES (?, ?, ?, ?, 'member', ?, ?, ?)`,
      ['测试渠道销售', '测试渠道销售', testPhone, '$2a$10$test', testMemberId, channelUserId, null]
    );
    
    const newChannelSalesId = createResult.insertId;
    console.log(`  创建成功: user_id=${newChannelSalesId}, member_id=${testMemberId}`);
    
    // 立即查询（模拟注册时的查询）
    console.log(`\n2. 立即查询渠道销售（member_id=${testMemberId}）...`);
    const [queryResult] = await db.query(
      'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE member_id = ? AND role = ?',
      [testMemberId, 'member']
    );
    
    console.log(`  查询结果: 找到 ${queryResult.length} 条记录`);
    if (queryResult.length > 0) {
      console.log(`  找到渠道销售: id=${queryResult[0].id}, member_id=${queryResult[0].member_id}, channel_user_id=${queryResult[0].channel_user_id}`);
    } else {
      console.log(`  ✗ 未找到渠道销售！这可能就是问题所在。`);
    }
    
    // 等待一小段时间后再查询
    console.log(`\n3. 等待100ms后再次查询...`);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const [queryResult2] = await db.query(
      'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE member_id = ? AND role = ?',
      [testMemberId, 'member']
    );
    
    console.log(`  查询结果: 找到 ${queryResult2.length} 条记录`);
    if (queryResult2.length > 0) {
      console.log(`  找到渠道销售: id=${queryResult2[0].id}, member_id=${queryResult2[0].member_id}, channel_user_id=${queryResult2[0].channel_user_id}`);
    }
    
    // 清理测试数据
    console.log(`\n4. 清理测试数据...`);
    await db.query('DELETE FROM users WHERE id = ?', [newChannelSalesId]);
    console.log(`  已删除测试用户`);
    
    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testChannelSalesRegistrationTiming();

