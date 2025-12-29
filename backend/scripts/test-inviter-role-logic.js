// 测试邀请人角色判断逻辑

function testInviterRoleLogic(channelUserId, inviterRole, memberId) {
  // 模拟从数据库查询到的数据（可能是字符串或数字）
  const inviterChannelUserId = channelUserId;
  
  // 判断逻辑
  const channelUserIdNum = Number(inviterChannelUserId);
  const hasChannelUserId = inviterChannelUserId != null && 
                           inviterChannelUserId !== '' && 
                           !isNaN(channelUserIdNum) &&
                           channelUserIdNum > 0;
  const isInviterChannelSales = inviterRole === 'member' && hasChannelUserId;
  
  let inviter_role_text;
  if (isInviterChannelSales) {
    inviter_role_text = '渠道方';
  } else if (inviterRole === 'instructor') {
    inviter_role_text = '授课人';
  } else if (inviterRole === 'member') {
    inviter_role_text = '会员';
  } else {
    inviter_role_text = inviterRole || null;
  }
  
  console.log(`测试 ${memberId}:`);
  console.log(`  channel_user_id: ${inviterChannelUserId} (${typeof inviterChannelUserId})`);
  console.log(`  inviter_role: ${inviterRole}`);
  console.log(`  channelUserIdNum: ${channelUserIdNum}`);
  console.log(`  hasChannelUserId: ${hasChannelUserId}`);
  console.log(`  isInviterChannelSales: ${isInviterChannelSales}`);
  console.log(`  结果: inviter_role_text = "${inviter_role_text}"`);
  console.log('');
  
  return inviter_role_text;
}

// 测试用例
console.log('=== 测试邀请人角色判断逻辑 ===\n');

// 测试1：财销一（channel_user_id = 6，可能是数字）
testInviterRoleLogic(6, 'member', 'M85101163');

// 测试2：财销一（channel_user_id = 6，可能是字符串）
testInviterRoleLogic('6', 'member', 'M85101163');

// 测试3：联想1（channel_user_id = 7，可能是数字）
testInviterRoleLogic(7, 'member', 'M96143951');

// 测试4：联想1（channel_user_id = 7，可能是字符串）
testInviterRoleLogic('7', 'member', 'M96143951');

// 测试5：普通会员（channel_user_id = null）
testInviterRoleLogic(null, 'member', 'M12345678');

// 测试6：授课人（channel_user_id = null）
testInviterRoleLogic(null, 'instructor', 'I12345678');

