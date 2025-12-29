// 清除用户登录状态的脚本（用于测试）
// 在小程序控制台执行以下代码可以清除登录状态，进入游客界面

const clearSessionCode = `
// 清除用户登录状态，进入游客界面
const app = getApp();

// 清除本地存储
wx.removeStorageSync('userInfo');
wx.removeStorageSync('openid');
wx.removeStorageSync('token');

// 清除全局数据
app.globalData.userInfo = null;
app.globalData.openid = null;
app.globalData.isLoggedIn = false;

console.log('✓ 已清除登录状态');

// 刷新当前页面
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
if (currentPage && typeof currentPage.onShow === 'function') {
  currentPage.onShow();
}

// 跳转到首页
wx.switchTab({
  url: '/pages/index/index',
  success: () => {
    wx.showToast({
      title: '已切换到游客状态',
      icon: 'success'
    });
  }
});
`;

console.log('=====================================');
console.log('清除用户登录状态 - 进入游客界面');
console.log('=====================================');
console.log('\n在小程序控制台复制并执行以下代码:\n');
console.log(clearSessionCode);
console.log('\n=====================================');
console.log('或者手动操作:');
console.log('=====================================');
console.log('1. 在小程序中点击首页的"退出登录"按钮');
console.log('2. 或者在小程序控制台执行上面的代码');
console.log('\n=====================================');
console.log('测试邀请码功能:');
console.log('=====================================');
console.log('\n可用的邀请码（会员ID）:');

// 获取可用邀请码
const db = require('../config/database');
(async () => {
  try {
    const [users] = await db.query(
      "SELECT id, nickname, real_name, member_id FROM users WHERE role = 'member' AND member_id IS NOT NULL LIMIT 5"
    );
    
    users.forEach(u => {
      console.log(`  - ${u.real_name || u.nickname}: ${u.member_id} (用户ID: ${u.id})`);
    });
    
    console.log('\n测试步骤:');
    console.log('1. 在小程序中切换到游客状态');
    console.log('2. 在首页点击"注册会员"按钮');
    console.log('3. 填写注册信息（昵称、姓名、手机号、验证码）');
    console.log(`4. 在邀请码字段输入: ${users[0]?.member_id || 'M03152922'}`);
    console.log('5. 提交注册');
    console.log('6. 检查邀请管理页面，确认邀请记录已创建');
    console.log('7. 检查邀请人是否收到100元折扣券');
    
    process.exit(0);
  } catch (error) {
    console.error('获取邀请码失败:', error);
    process.exit(1);
  }
})();





























































