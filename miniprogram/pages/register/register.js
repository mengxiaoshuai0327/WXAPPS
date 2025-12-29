// pages/register/register.js
const app = getApp();

Page({
  data: {
    nickname: '',
    company: '',
    phone: '',
    password: '',
    confirmPassword: '',
    inviteCode: '',
    agreeProtocol: false,
    agreePrivacy: false,
    gettingCode: false,
    countdown: 0,
    code: '',
    countdownTimer: null, // 倒计时定时器
    avatarUrl: '', // 头像URL
    lastCodePhone: '', // 记录上次获取验证码的手机号
    showProtocolModal: false, // 显示协议弹窗
    protocolTitle: '', // 协议标题
    protocolContent: '', // 协议内容
    loadingProtocol: false // 加载协议中
  },

  onLoad(options) {
    // 如果有邀请码，自动填入
    if (options.invite_code) {
      this.setData({ inviteCode: options.invite_code });
    }
  },

  // 输入密码
  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  // 输入确认密码
  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value });
  },

  // 输入机构/公司
  onCompanyInput(e) {
    this.setData({ company: e.detail.value });
  },

  // 输入手机号
  onPhoneInput(e) {
    const newPhone = e.detail.value;
    const oldPhone = this.data.phone;
    
    // 如果手机号改变了，清除验证码相关状态
    if (oldPhone && newPhone !== oldPhone) {
      // 清除倒计时
      if (this.data.countdownTimer) {
        clearInterval(this.data.countdownTimer);
      }
      // 重置验证码状态
      this.setData({
        phone: newPhone,
        code: '', // 清除已输入的验证码
        countdown: 0, // 重置倒计时
        gettingCode: false,
        countdownTimer: null,
        lastCodePhone: '' // 清除上次获取验证码的手机号记录
      });
    } else {
      this.setData({ phone: newPhone });
    }
  },

  // 输入邀请码
  onInviteCodeInput(e) {
    this.setData({ inviteCode: e.detail.value });
  },

  // 输入验证码
  onCodeInput(e) {
    this.setData({ code: e.detail.value });
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['original'], // 使用原图，但前端会检查大小
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        // 检查文件大小
        wx.getFileInfo({
          filePath: tempFilePath,
          success: (fileInfo) => {
            const fileSizeMB = fileInfo.size / (1024 * 1024);
            if (fileSizeMB > 8) {
              wx.showModal({
                title: '提示',
                content: `图片大小 ${fileSizeMB.toFixed(2)}MB，超过 8MB 限制，请选择较小的图片`,
                showCancel: false
              });
              return;
            }
            this.uploadAvatar(tempFilePath);
          },
          fail: () => {
            // 如果获取文件信息失败，直接上传（由后端验证）
            this.uploadAvatar(tempFilePath);
          }
        });
      },
      fail: (err) => {
        console.error('选择图片失败', err);
      }
    });
  },

  // 上传头像
  async uploadAvatar(filePath) {
    wx.showLoading({
      title: '上传中...'
    });

    try {
      // 构建上传URL（小程序上传文件需要使用完整URL）
      const baseUrl = app.globalData.apiBaseUrl.replace('/api', '');
      const uploadUrl = `${baseUrl}/api/users/upload-avatar`;
      
      console.log('[注册] 上传头像URL:', uploadUrl);
      console.log('[注册] 文件路径:', filePath);
      
      // 上传图片到服务器
      const uploadRes = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: uploadUrl,
          filePath: filePath,
          name: 'avatar',
          header: {
            'Content-Type': 'multipart/form-data'
          },
          success: (res) => {
            console.log('[注册] 上传响应状态码:', res.statusCode);
            console.log('[注册] 上传响应数据:', res.data);
            try {
              const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
              if (res.statusCode === 200) {
                resolve(data);
              } else {
                reject(new Error(data.error || `上传失败: ${res.statusCode}`));
              }
            } catch (e) {
              console.error('[注册] 解析响应失败:', e, res.data);
              reject(new Error('服务器响应格式错误: ' + res.data));
            }
          },
          fail: (err) => {
            console.error('[注册] 上传失败:', err);
            reject(new Error(err.errMsg || '网络错误，请检查网络连接'));
          }
        });
      });

      if (uploadRes.success && uploadRes.data && uploadRes.data.avatar_url) {
        this.setData({ avatarUrl: uploadRes.data.avatar_url });
        wx.hideLoading();
        wx.showToast({
          title: '上传成功',
          icon: 'success'
        });
        console.log('[注册] 头像上传成功:', uploadRes.data.avatar_url);
      } else {
        throw new Error(uploadRes.error || '上传失败，未返回头像URL');
      }
    } catch (error) {
      console.error('[注册] 上传头像错误:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || error.error || '上传失败',
        icon: 'none',
        duration: 2000
      });
    }
  },


  // 获取验证码
  async getVerificationCode() {
    const phone = this.data.phone;
    
    // 如果手机号改变了，允许重新获取验证码（即使倒计时还在进行）
    const phoneChanged = this.data.lastCodePhone && this.data.lastCodePhone !== phone;
    
    // 如果正在倒计时且手机号没有改变，不允许再次获取
    if (this.data.countdown > 0 && !phoneChanged) {
      wx.showToast({
        title: `请${this.data.countdown}秒后再试`,
        icon: 'none'
      });
      return;
    }
    
    // 如果手机号改变了，清除之前的倒计时
    if (phoneChanged && this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer);
      this.setData({
        countdown: 0,
        countdownTimer: null,
        gettingCode: false
      });
    }

    if (!phone) {
      wx.showToast({
        title: '请先输入手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 检查手机号是否已被注册（可选，不影响发送验证码）
    try {
      const checkRes = await app.request({
        url: '/auth/check-phone',
        method: 'POST',
        data: { phone }
      });
      
      if (checkRes.exists) {
        wx.showModal({
          title: '提示',
          content: '该手机号已被注册，您可以直接登录',
          showCancel: true,
          cancelText: '取消',
          confirmText: '去登录',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({
                url: '/pages/login/login'
              });
            }
          }
        });
        // 不发送验证码
        this.setData({ gettingCode: false });
        return;
      }
    } catch (error) {
      // 如果检查接口不存在或失败，继续发送验证码（不影响注册流程）
      console.log('检查手机号接口调用失败，继续发送验证码:', error);
    }

    this.setData({ gettingCode: true });

    try {
      // 调用后端发送验证码接口
      const res = await app.request({
        url: '/auth/send-code',
        method: 'POST',
        data: { phone }
      });

      if (res.success) {
        wx.showToast({
          title: '验证码已发送',
          icon: 'success',
          duration: 2000
        });
        
        // 开发环境下显示验证码（方便测试）
        if (res.code) {
          console.log(`[开发环境] 验证码: ${res.code}`);
          wx.showModal({
            title: '验证码（仅开发环境）',
            content: `验证码: ${res.code}`,
            showCancel: false,
            confirmText: '知道了'
          });
        }
        
        // 记录本次获取验证码的手机号
        this.setData({ lastCodePhone: phone });
        
        // 开始60秒倒计时
        this.startCountdown(60);
      } else {
        wx.showToast({
          title: res.error || '发送失败',
          icon: 'none',
          duration: 2000
        });
        this.setData({ gettingCode: false });
      }
    } catch (error) {
      console.error('发送验证码失败:', error);
      wx.showToast({
        title: error.error || error.message || '发送失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
      this.setData({ gettingCode: false });
    }
  },

  // 倒计时
  startCountdown(seconds = 60) {
    // 清除之前的定时器
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

  // 页面卸载时清除定时器
  onUnload() {
    if (this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer);
    }
  },

  // 同意用户协议
  toggleAgreeProtocol() {
    this.setData({ agreeProtocol: !this.data.agreeProtocol });
  },

  // 同意隐私条款
  toggleAgreePrivacy() {
    this.setData({ agreePrivacy: !this.data.agreePrivacy });
  },

  // 查看用户协议
  async viewProtocol(e) {
    console.log('[注册页面] 点击用户协议链接', e);
    await this.loadProtocolContent('user', '用户协议');
  },

  // 查看隐私条款
  async viewPrivacy(e) {
    console.log('[注册页面] 点击隐私条款链接', e);
    await this.loadProtocolContent('privacy', '隐私条款');
  },

  // 加载协议内容
  async loadProtocolContent(type, title) {
    console.log('[注册页面] 开始加载协议内容', type, title);
    this.setData({
      showProtocolModal: true,
      protocolTitle: title,
      protocolContent: '',
      loadingProtocol: true
    });
    console.log('[注册页面] 弹窗状态已设置为显示');

    try {
      const res = await app.request({
        url: `/protocols/${type}`,
        method: 'GET'
      });

      console.log('[注册页面] 协议内容API响应', res);

      if (res && res.success && res.data) {
        this.setData({
          protocolContent: res.data.content || '',
          protocolTitle: res.data.title || title,
          loadingProtocol: false
        });
        console.log('[注册页面] 协议内容加载成功，内容长度:', (res.data.content || '').length);
      } else {
        throw new Error('获取协议内容失败');
      }
    } catch (error) {
      console.error('[注册页面] 加载协议内容失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
      this.setData({
        loadingProtocol: false,
        protocolContent: '加载失败，请稍后重试'
      });
    }
  },

  // 关闭协议弹窗
  closeProtocolModal() {
    console.log('[注册页面] 关闭协议弹窗');
    this.setData({
      showProtocolModal: false,
      protocolContent: '',
      protocolTitle: ''
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 提交注册
  async submitRegister() {
    const { nickname, company, phone, password, confirmPassword, inviteCode, code, agreeProtocol, agreePrivacy } = this.data;

    // 验证
    if (!nickname) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return;
    }

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

    if (!code) {
      wx.showToast({
        title: '请输入验证码',
        icon: 'none'
      });
      return;
    }

    if (!password) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none'
      });
      return;
    }

    if (password.length < 6) {
      wx.showToast({
        title: '密码长度至少6位',
        icon: 'none'
      });
      return;
    }

    if (password !== confirmPassword) {
      wx.showToast({
        title: '两次输入的密码不一致',
        icon: 'none'
      });
      return;
    }

    if (!agreeProtocol) {
      wx.showToast({
        title: '请同意用户协议',
        icon: 'none'
      });
      return;
    }

    if (!agreePrivacy) {
      wx.showToast({
        title: '请同意隐私条款',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '注册中...'
    });

    try {
      const res = await app.request({
        url: '/auth/register',
        method: 'POST',
        data: {
          nickname,
          real_name: nickname,
          company: company || null,
          phone,
          password,
          invite_code: inviteCode,
          verification_code: code,
          avatar_url: this.data.avatarUrl
        }
      });

      wx.hideLoading();

      if (res.success) {
        wx.showToast({
          title: '注册成功',
          icon: 'success'
        });

        // 自动登录
        const loginRes = await app.request({
          url: '/auth/login-password',
          method: 'POST',
          data: {
            phone: phone,
            password: password
          }
        });

        if (loginRes.success && loginRes.user) {
          // 保存用户信息到全局数据和本地存储
          app.globalData.userInfo = loginRes.user;
          wx.setStorageSync('userInfo', loginRes.user);
          console.log('[注册] 自动登录成功，用户信息已保存:', loginRes.user);
        } else {
          console.warn('[注册] 自动登录失败，但注册已成功');
        }

        // 跳转到首页
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index'
          });
        }, 1500);
      } else {
        const errorMsg = res.error || res.message || res.details || '注册失败';
        
        // 如果手机号已被注册，显示友好提示并提供跳转登录选项
        if (res.error === '该手机号已被注册' || errorMsg.includes('已被注册')) {
          wx.showModal({
            title: '提示',
            content: res.message || '您已经注册过账号，请直接登录',
            showCancel: true,
            cancelText: '继续注册',
            confirmText: '去登录',
            success: (modalRes) => {
              if (modalRes.confirm) {
                // 跳转到登录页面
                wx.navigateTo({
                  url: '/pages/login/login'
                });
              }
            }
          });
        } else {
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 3000
          });
        }
      }
    } catch (error) {
      wx.hideLoading();
      const errorMsg = error.error || error.message || error.details || '注册失败，请稍后重试';
      
      // 如果手机号已被注册，显示友好提示
      if (errorMsg.includes('已被注册') || error.error === '该手机号已被注册') {
        wx.showModal({
          title: '提示',
          content: '您已经注册过账号，请直接登录',
          showCancel: true,
          cancelText: '继续注册',
          confirmText: '去登录',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.navigateTo({
                url: '/pages/login/login'
              });
            }
          }
        });
      } else {
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 3000
        });
      }
      console.error('注册失败:', error);
    }
  }
});

