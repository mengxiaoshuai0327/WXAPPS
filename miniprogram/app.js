// app.js
App({
  globalData: {
    userInfo: null,
    // 本地开发环境API地址
    // 如果使用微信开发者工具模拟器，使用 localhost
    // 如果使用手机预览，使用局域网IP: 192.168.124.25
    apiBaseUrl: 'http://localhost:3000/api', // 可以改为 'http://192.168.124.25:3000/api' 用于手机预览
    openid: null,
    selectedModuleId: null, // 从首页跳转到课程表时选择的模块ID
    selectedThemeId: null, // 从排行榜跳转到课程表时选择的主题ID
    // 获取基础URL（用于图片路径处理）
    getBaseUrl() {
      return this.apiBaseUrl.replace('/api', '');
    }
  },

  onLaunch() {
    // 检查是否有已登录的用户信息（不再自动微信登录）
    const cachedUserInfo = wx.getStorageSync('userInfo');
    if (cachedUserInfo && cachedUserInfo.id) {
      this.globalData.userInfo = cachedUserInfo;
      // 从服务器获取最新用户信息
      this.getUserInfo();
    }
    // 如果没有用户信息，保持游客模式，不自动登录
  },

  // 微信登录
  wxLogin() {
    wx.login({
      success: (res) => {
        if (res.code) {
          this.loginWithCode(res.code);
        }
      },
      fail: (err) => {
        console.error('登录失败', err);
      }
    });
  },

  // 使用code登录
  loginWithCode(code) {
    wx.request({
      url: `${this.globalData.apiBaseUrl}/auth/wxlogin`,
      method: 'POST',
      data: { code },
      success: (res) => {
        if (res.data.success) {
          wx.setStorageSync('openid', res.data.user.openid);
          wx.setStorageSync('userInfo', res.data.user);
          // 保存session_key用于解密手机号
          if (res.data.session_key) {
            wx.setStorageSync('session_key', res.data.session_key);
          }
          this.globalData.openid = res.data.user.openid;
          this.globalData.userInfo = res.data.user;
        }
      },
      fail: (err) => {
        console.error('登录请求失败', err);
      }
    });
  },

  // 获取用户信息（从服务器获取最新信息）
  async getUserInfo() {
    const openid = this.globalData.openid;
    if (!openid) {
      const cachedUserInfo = wx.getStorageSync('userInfo');
      if (cachedUserInfo) {
        this.globalData.userInfo = cachedUserInfo;
      }
      return;
    }

    try {
      // 从本地缓存获取用户ID
      const cachedUserInfo = wx.getStorageSync('userInfo');
      if (cachedUserInfo && cachedUserInfo.id) {
        // 从服务器获取最新的用户信息
        const res = await this.request({
          url: `/users/${cachedUserInfo.id}`,
          method: 'GET'
        });

        if (res.success && res.data) {
          // 更新全局用户信息和本地缓存
          this.globalData.userInfo = res.data;
          wx.setStorageSync('userInfo', res.data);
        } else {
          // 如果服务器获取失败，使用缓存
          this.globalData.userInfo = cachedUserInfo;
        }
      } else {
        // 如果没有缓存，使用缓存
        this.globalData.userInfo = cachedUserInfo;
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
      // 如果获取失败，使用本地缓存
      const cachedUserInfo = wx.getStorageSync('userInfo');
      if (cachedUserInfo) {
        this.globalData.userInfo = cachedUserInfo;
      }
    }
  },

  // 请求封装
  request(options) {
    return new Promise((resolve, reject) => {
      const method = options.method || 'GET';
      let url = `${this.globalData.apiBaseUrl}${options.url}`;
      let data = options.data || {};
      
      // GET和DELETE请求将参数拼接到URL中
      if ((method === 'GET' || method === 'DELETE') && data && Object.keys(data).length > 0) {
        const queryString = Object.keys(data)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
          .join('&');
        url += (url.includes('?') ? '&' : '?') + queryString;
        data = {}; // GET和DELETE请求不需要请求体
      }
      
      const headers = {
        'content-type': method === 'GET' ? 'application/json' : 'application/json'
      };
      if (options.header) {
        Object.keys(options.header).forEach(key => {
          headers[key] = options.header[key];
        });
      }
      
      wx.request({
        url: url,
        method: method,
        data: data,
        header: headers,
        timeout: 30000, // 设置超时时间为30秒
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            // 400状态码通常是业务逻辑错误（如验证失败、限制等），不是系统错误
            // 500+状态码才是真正的系统错误
            const isBusinessError = res.statusCode >= 400 && res.statusCode < 500;
            
            // 返回错误信息
            const error = {
              error: res.data?.error || '请求失败',
              message: res.data?.message || res.data?.details || '请求失败',
              statusCode: res.statusCode,
              data: res.data,
              isBusinessError: isBusinessError // 标记是否为业务逻辑错误
            };
            
            // 业务逻辑错误不记录为error，避免控制台显示红色错误
            if (isBusinessError) {
              console.log(`[API] 业务逻辑错误 (${res.statusCode}):`, res.data?.error || res.data?.message || '请求失败');
            } else {
              console.error(`[API] 系统错误 (${res.statusCode}):`, res.data?.error || res.data?.message || '请求失败');
            }
            
            reject(error);
          }
        },
        fail: (err) => {
          console.error('网络请求失败:', err);
          console.error('请求URL:', url);
          const error = {
            error: '网络请求失败',
            message: err.errMsg || '请检查网络连接',
            err: err
          };
          reject(error);
        }
      });
    });
  }
});

