const http = require('http');

// 测试用户列表API
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/users?page=1&pageSize=20',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.success && result.data) {
        // 查找邀请人编码为 M85101163 或 M96143951 的用户
        const targetUsers = result.data.filter(user => 
          user.inviter_code === 'M85101163' || 
          user.inviter_code === 'M96143951' ||
          user.inviter_code === '163570958'
        );
        
        console.log(`找到 ${targetUsers.length} 个相关用户:\n`);
        targetUsers.forEach((user, index) => {
          console.log(`${index + 1}. 用户: ${user.real_name || user.nickname} (ID: ${user.id})`);
          console.log(`   邀请人编码: ${user.inviter_code}`);
          console.log(`   邀请人姓名: ${user.inviter_name}`);
          console.log(`   邀请人角色: ${user.inviter_role}`);
          console.log(`   邀请人角色文本: ${user.inviter_role_text}`);
          console.log('');
        });
      } else {
        console.log('API返回错误:', result);
      }
    } catch (error) {
      console.error('解析响应失败:', error);
      console.log('原始响应:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('请求失败:', error);
});

req.end();

