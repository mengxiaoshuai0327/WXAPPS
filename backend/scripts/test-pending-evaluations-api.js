// 测试待评价课程API
const http = require('http');

const userId = 4;
const apiUrl = `http://localhost:3000/api/evaluations/pending?user_id=${userId}`;

console.log('测试API:', apiUrl);
console.log('用户ID:', userId);
console.log('会员ID: M03152922\n');

http.get(apiUrl, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      console.log('API返回结果:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.success && result.data && result.data.length > 0) {
        console.log(`\n✓ 成功！找到 ${result.data.length} 个待评价课程:`);
        result.data.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.title} (排课ID: ${item.schedule_id})`);
        });
      } else {
        console.log('\n✗ API返回空数组');
        console.log('可能的原因:');
        console.log('1. 后端服务未重启，使用了旧代码');
        console.log('2. 需要重启后端服务: cd backend && npm start');
      }
    } catch (e) {
      console.error('解析响应失败:', e);
      console.log('原始响应:', data);
    }
  });
}).on('error', (err) => {
  console.error('请求失败:', err.message);
  console.log('\n请确保后端服务正在运行:');
  console.log('  cd backend');
  console.log('  npm start');
});

