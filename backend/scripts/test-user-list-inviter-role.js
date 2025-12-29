const db = require('../config/database');

async function testUserListInviterRole() {
  try {
    console.log('=== 测试用户列表API的邀请人角色逻辑 ===\n');
    
    // 模拟用户列表API的查询
    const query = `
      SELECT u.*, 
             (SELECT COUNT(*) FROM course_bookings WHERE user_id = u.id) as booking_count,
             (SELECT COUNT(*) FROM tickets WHERE user_id = u.id) as ticket_count,
             u_inviter.real_name as inviter_real_name,
             u_inviter.nickname as inviter_nickname,
             u_inviter.member_id as inviter_member_id,
             u_inviter.instructor_id as inviter_instructor_id,
             u_inviter.channel_id as inviter_channel_id,
             u_inviter.role as inviter_role,
             u_inviter.channel_user_id as inviter_channel_user_id,
             c.channel_name as channel_partner_name,
             c.channel_code as channel_partner_code,
             c.id as channel_table_id
      FROM users u
      LEFT JOIN users u_inviter ON u.inviter_id = u_inviter.id
      LEFT JOIN channels c ON u.channel_user_id = c.id
      WHERE u.role = 'member'
      ORDER BY u.created_at DESC
      LIMIT 10
    `;
    
    const [users] = await db.query(query);
    
    console.log(`找到 ${users.length} 个用户\n`);
    
    // 处理用户数据（模拟API逻辑）
    const processedUsers = users.map((user) => {
      const result = { ...user };
      
      if (user.inviter_id) {
        // 判断邀请人是否为渠道销售
        const inviterChannelUserId = user.inviter_channel_user_id;
        const channelUserIdNum = Number(inviterChannelUserId);
        const hasChannelUserId = inviterChannelUserId != null && 
                                 inviterChannelUserId !== '' && 
                                 !isNaN(channelUserIdNum) &&
                                 channelUserIdNum > 0;
        const isInviterChannelSales = user.inviter_role === 'member' && hasChannelUserId;
        
        // 设置邀请人角色
        if (isInviterChannelSales) {
          result.inviter_role = 'channel';
          result.inviter_role_text = '渠道方';
        } else if (user.inviter_role === 'instructor') {
          result.inviter_role = 'instructor';
          result.inviter_role_text = '授课人';
        } else if (user.inviter_role === 'member') {
          result.inviter_role = 'member';
          result.inviter_role_text = '会员';
        } else {
          result.inviter_role = user.inviter_role || null;
          result.inviter_role_text = user.inviter_role || null;
        }
        
        // 输出关键用户的详细信息
        if (user.inviter_member_id && (user.inviter_member_id === 'M85101163' || user.inviter_member_id === 'M96143951')) {
          console.log(`用户 ID: ${user.id}, 姓名: ${user.real_name}`);
          console.log(`  邀请人编码: ${user.inviter_member_id}`);
          console.log(`  邀请人姓名: ${user.inviter_real_name || user.inviter_nickname}`);
          console.log(`  邀请人原始role: ${user.inviter_role}`);
          console.log(`  邀请人channel_user_id: ${inviterChannelUserId} (${typeof inviterChannelUserId})`);
          console.log(`  channelUserIdNum: ${channelUserIdNum}`);
          console.log(`  hasChannelUserId: ${hasChannelUserId}`);
          console.log(`  isInviterChannelSales: ${isInviterChannelSales}`);
          console.log(`  处理后 inviter_role: ${result.inviter_role}`);
          console.log(`  处理后 inviter_role_text: ${result.inviter_role_text}`);
          console.log('');
        }
      }
      
      return result;
    });
    
    // 统计结果
    const channelSalesInviterCount = processedUsers.filter(u => u.inviter_role === 'channel').length;
    console.log(`\n统计结果:`);
    console.log(`  总用户数: ${processedUsers.length}`);
    console.log(`  邀请人是渠道方的用户数: ${channelSalesInviterCount}`);
    console.log(`  邀请人是会员的用户数: ${processedUsers.filter(u => u.inviter_role === 'member').length}`);
    console.log(`  邀请人是授课人的用户数: ${processedUsers.filter(u => u.inviter_role === 'instructor').length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testUserListInviterRole();

