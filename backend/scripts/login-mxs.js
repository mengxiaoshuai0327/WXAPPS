// 快速登录孟小帅账号的脚本
// 使用方法: 在小程序控制台复制并执行以下代码

const loginCode = `
// 快速登录孟小帅账号
(async function() {
  const app = getApp();
  const code = await new Promise((resolve) => {
    wx.login({ success: (res) => resolve(res.code) });
  });
  
  // 调用登录接口
  const loginRes = await new Promise((resolve, reject) => {
    wx.request({
      url: '${process.env.API_BASE_URL || 'http://localhost:3000'}/api/auth/wxlogin',
      method: 'POST',
      data: { code },
      success: (res) => resolve(res.data),
      fail: (err) => reject(err)
    });
  });
  
  if (loginRes.success) {
    // 保存用户信息
    wx.setStorageSync('token', loginRes.token);
    wx.setStorageSync('openid', loginRes.openid);
    wx.setStorageSync('userInfo', loginRes.user);
    app.globalData.userInfo = loginRes.user;
    app.globalData.openid = loginRes.openid;
    app.globalData.isLoggedIn = true;
    
    console.log('✓ 登录成功！');
    console.log('用户信息:', loginRes.user);
    
    // 刷新当前页面
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage && typeof currentPage.onShow === 'function') {
      currentPage.onShow();
    }
    
    wx.showToast({
      title: '登录成功',
      icon: 'success'
    });
  } else {
    console.error('登录失败:', loginRes.error);
    wx.showToast({
      title: loginRes.error || '登录失败',
      icon: 'none'
    });
  }
})();
`;

console.log('=====================================');
console.log('快速登录孟小帅账号');
console.log('=====================================');
console.log('\n在小程序控制台复制并执行以下代码:\n');
console.log(loginCode);
console.log('\n=====================================');
console.log('或者使用简化版本:');
console.log('=====================================\n');

const simpleCode = `
// 简化版 - 直接设置用户信息（需要先绑定OpenID）
const app = getApp();
const userInfo = {
  id: 4,
  nickname: 'MXS',
  real_name: '孟小帅',
  role: 'member',
  member_id: 'M03152922',
  phone: '13323471107'
};
app.globalData.userInfo = userInfo;
app.globalData.openid = 'oTi2A132I7XQx-yP3guM0LbqoCtg';
app.globalData.isLoggedIn = true;
wx.setStorageSync('userInfo', userInfo);
wx.setStorageSync('openid', 'oTi2A132I7XQx-yP3guM0LbqoCtg');
console.log('✓ 已设置为孟小帅账号');
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
if (currentPage && typeof currentPage.onShow === 'function') {
  currentPage.onShow();
}
`;

console.log(simpleCode);
console.log('\n注意: 如果使用简化版本，需要先运行绑定脚本:');
console.log('  node scripts/bind-mxs.js <你的OpenID>');





























































