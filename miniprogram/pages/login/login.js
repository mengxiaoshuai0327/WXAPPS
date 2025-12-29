// pages/login/login.js
const app = getApp();

Page({
  data: {
    loginType: 'password', // 'password' 或 'code'
    phone: '',
    password: '',
    code: '',
    gettingCode: false,
    countdown: 0,
    countdownTimer: null
  },

  onLoad() {
    // 检查是否已登录（同时检查全局数据和本地存储）
    const globalUserInfo = app.globalData.userInfo;
    const storedUserInfo = wx.getStorageSync('userInfo');
    const userInfo = globalUserInfo || storedUserInfo;
    
    // 如果找到有效的用户信息，直接跳转到首页（包含会员、教练和渠道方）
    if (userInfo && (userInfo.role === 'member' || userInfo.role === 'instructor' || userInfo.role === 'channel')) {
      // 确保全局数据和本地存储同步
      if (storedUserInfo && !globalUserInfo) {
        app.globalData.userInfo = storedUserInfo;
      }
      
      wx.switchTab({
        url: '/pages/index/index',
        success: () => {
          console.log('[登录页] 检测到已登录，已跳转到首页');
        },
        fail: (err) => {
          console.warn('[登录页] switchTab 失败，尝试 reLaunch:', err);
          wx.reLaunch({
            url: '/pages/index/index'
          });
        }
      });
    } else {
      // 如果全局数据存在但本地存储不存在，说明可能刚退出登录，清除全局数据
      if (globalUserInfo && !storedUserInfo) {
        app.globalData.userInfo = null;
        console.log('[登录页] 检测到不一致状态，已清除全局数据');
      }
    }
  },
  
  onShow() {
    // 每次显示页面时也检查登录状态（防止从其他页面返回时状态已变化）
    const globalUserInfo = app.globalData.userInfo;
    const storedUserInfo = wx.getStorageSync('userInfo');
    const userInfo = globalUserInfo || storedUserInfo;
    
    if (userInfo && (userInfo.role === 'member' || userInfo.role === 'instructor')) {
      // 确保全局数据和本地存储同步
      if (storedUserInfo && !globalUserInfo) {
        app.globalData.userInfo = storedUserInfo;
      }
      
      // 直接跳转，不需要延迟
      wx.switchTab({
        url: '/pages/index/index',
        fail: () => {
          wx.reLaunch({
            url: '/pages/index/index'
          });
        }
      });
    }
  },

  onUnload() {
    // 清除倒计时
    if (this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer);
    }
  },

  // 切换登录方式
  switchLoginType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ 
      loginType: type,
      password: '',
      code: ''
    });
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  // 输入密码
  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  // 输入验证码
  onCodeInput(e) {
    this.setData({ code: e.detail.value });
  },

  // 获取验证码
  async getVerificationCode() {
    const phone = this.data.phone;
    
    if (this.data.countdown > 0) {
      wx.showToast({
        title: `请${this.data.countdown}秒后再试`,
        icon: 'none'
      });
      return;
    }

    if (!phone) {
      wx.showToast({
        title: '请先输入手机号',
        icon: 'none'
      });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    this.setData({ gettingCode: true });

    try {
      const res = await app.request({
        url: '/auth/send-code',
        method: 'POST',
        data: { phone }
      });

      if (res.success) {
        wx.showToast({
          title: '验证码已发送',
          icon: 'success'
        });
        this.startCountdown(60);
      } else {
        wx.showToast({
          title: res.error || '发送失败',
          icon: 'none'
        });
        this.setData({ gettingCode: false });
      }
    } catch (error) {
      wx.showToast({
        title: error.error || '发送失败',
        icon: 'none'
      });
      this.setData({ gettingCode: false });
    }
  },

  // 倒计时
  startCountdown(seconds = 60) {
    if (this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer);
    }

    let countdown = seconds;
    this.setData({ countdown, gettingCode: true });

    const timer = setInterval(() => {
      countdown--;
      this.setData({ countdown, countdownTimer: timer });

      if (countdown <= 0) {
        clearInterval(timer);
        this.setData({ 
          gettingCode: false, 
          countdown: 0,
          countdownTimer: null
        });
      }
    }, 1000);
  },

  // 登录
  async doLogin() {
    const { phone, password, code, loginType } = this.data;

    if (!phone) {
      wx.showToast({
        title: '请输入手机号',
        icon: 'none'
      });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    if (loginType === 'password') {
      if (!password) {
        wx.showToast({
          title: '请输入密码',
          icon: 'none'
        });
        return;
      }
    } else {
      if (!code) {
        wx.showToast({
          title: '请输入验证码',
          icon: 'none'
        });
        return;
      }
    }

    wx.showLoading({
      title: '登录中...'
    });

    try {
      const url = loginType === 'password' ? '/auth/login-password' : '/auth/login-code';
      const data = loginType === 'password' 
        ? { phone, password }
        : { phone, code };

      const res = await app.request({
        url: url,
        method: 'POST',
        data: data
      });

      wx.hideLoading();

      if (res.success && res.user) {
        // 保存用户信息
        app.globalData.userInfo = res.user;
        wx.setStorageSync('userInfo', res.user);

        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 1000
        });

        // 跳转到首页 - 使用更可靠的跳转方式
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index',
            success: () => {
              console.log('[登录] 登录成功，已跳转到首页');
            },
            fail: (err) => {
              console.warn('[登录] switchTab 失败，尝试 reLaunch:', err);
              wx.reLaunch({
                url: '/pages/index/index',
                success: () => {
                  console.log('[登录] 使用 reLaunch 成功跳转到首页');
                },
                fail: (reLaunchErr) => {
                  console.error('[登录] reLaunch 也失败:', reLaunchErr);
                  wx.showToast({
                    title: '请手动返回首页',
                    icon: 'none',
                    duration: 2000
                  });
                }
              });
            }
          });
        }, 1000);
      } else {
        wx.showToast({
          title: res.error || '登录失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.error || '登录失败',
        icon: 'none',
        duration: 2000
      });
      console.error('登录失败:', error);
    }
  },

  // 去注册
  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  }
});

