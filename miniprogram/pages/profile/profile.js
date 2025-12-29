// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    userInfo: null,
    ticketStats: {
      unused: 0,
      booked: 0,
      used: 0
    },
    couponStats: {
      unused: 0,
      used: 0,
      expired: 0
    },
    inviteStats: {
      total: 0,
      registered: 0,
      purchased: 0
    },
    inviteCode: '',
    qrCodeUrl: '',
    isInstructor: false,
    isChannel: false, // 是否为渠道方
    isChannelSales: false, // 是否为渠道销售
    channelPartnerName: null, // 渠道方名称
    inviteBadge: null // 邀请达人徽章
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
    this.loadTicketStats();
    this.loadCouponStats();
    this.loadInviteBadge();
    this.loadInviteInfo();
  },

  onPullDownRefresh() {
    this.loadUserInfo();
    this.loadTicketStats();
    this.loadCouponStats();
    this.loadInviteBadge();
    this.loadInviteInfo();
    wx.stopPullDownRefresh();
  },

  // 加载用户信息（从服务器获取最新信息）
  async loadUserInfo() {
    try {
      const cachedUserInfo = app.globalData.userInfo;
      const storedUserInfo = wx.getStorageSync('userInfo');
      
      // 检查登录状态：如果全局数据和本地存储都没有用户信息，说明已退出登录
      // 不再依赖openid，因为手机号登录不需要openid
      if (!cachedUserInfo || !cachedUserInfo.id) {
        // 尝试从本地存储恢复
        if (storedUserInfo && storedUserInfo.id) {
          app.globalData.userInfo = storedUserInfo;
        } else {
          // 清除页面数据，显示未登录状态
          this.setData({
            userInfo: null,
            isInstructor: false,
            isChannel: false,
            isChannelSales: false,
            channelPartnerName: null,
            ticketStats: {
              unused: 0,
              booked: 0,
              used: 0
            },
            couponStats: {
              unused: 0,
              used: 0,
              expired: 0
            },
            inviteBadge: null
          });
          return;
        }
      }

      // 从服务器获取最新的用户信息
      const res = await app.request({
        url: `/users/${cachedUserInfo.id}`,
        method: 'GET'
      });

      if (res.success && res.data) {
        // 更新全局用户信息和本地缓存
        app.globalData.userInfo = res.data;
        wx.setStorageSync('userInfo', res.data);
        
        // 判断是否为渠道销售
        const isChannelSales = res.data.is_channel_sales || (res.data.role === 'member' && res.data.channel_user_id && res.data.channel_partner_name);
        
        // 保存邀请统计数据
        if (res.data.invite_stats) {
          this.setData({
            inviteStats: res.data.invite_stats
          });
        }
        
        this.setData({ 
          userInfo: res.data,
          isInstructor: res.data.role === 'instructor',
          isChannel: res.data.role === 'channel',
          isChannelSales: isChannelSales,
          channelPartnerName: res.data.channel_partner_name || null
        });
      } else {
        // 如果服务器获取失败，使用缓存
        const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
        if (userInfo && userInfo.id) {
          const isChannelSales = userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name);
          this.setData({ 
            userInfo,
            isInstructor: userInfo.role === 'instructor',
            isChannel: userInfo.role === 'channel',
            isChannelSales: isChannelSales,
            channelPartnerName: userInfo.channel_partner_name || null
          });
        } else {
          // 没有用户信息，清除数据
          this.setData({
            userInfo: null,
            isInstructor: false,
            isChannel: false,
            isChannelSales: false,
            channelPartnerName: null,
            ticketStats: {
              unused: 0,
              booked: 0,
              used: 0
            },
            inviteBadge: null
          });
          app.globalData.userInfo = null;
        }
      }
    } catch (error) {
      console.error('加载用户信息失败:', error);
      // 使用缓存
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      if (userInfo && userInfo.id) {
        const isChannelSales = userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name);
        this.setData({ 
          userInfo,
          isInstructor: userInfo.role === 'instructor',
          isChannelSales: isChannelSales,
          channelPartnerName: userInfo.channel_partner_name || null
        });
      } else {
        // 没有用户信息，清除数据
        this.setData({
          userInfo: null,
          isInstructor: false,
          isChannel: false,
          isChannelSales: false,
          channelPartnerName: null,
          ticketStats: {
            unused: 0,
            booked: 0,
            used: 0
          },
          couponStats: {
            unused: 0,
            used: 0,
            expired: 0
          },
          inviteBadge: null
        });
        app.globalData.userInfo = null;
      }
    }
  },

  // 加载课券统计
  async loadTicketStats() {
    try {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      
      // 检查登录状态（不再依赖openid）
      if (!userInfo || !userInfo.id) {
        console.log('用户未登录，清除课券统计');
        this.setData({
          ticketStats: {
            unused: 0,
            booked: 0,
            used: 0
          }
        });
        return;
      }

      console.log('加载课券统计，user_id:', userInfo.id);
      const res = await app.request({
        url: '/tickets/stats',
        method: 'GET',
        data: { user_id: userInfo.id }
      });

      console.log('课券统计API响应:', res);
      if (res && res.success && res.data) {
        this.setData({ ticketStats: res.data });
        console.log('课券统计加载成功:', res.data);
      } else {
        console.error('课券统计API返回失败:', res);
        // 设置默认值
        this.setData({ 
          ticketStats: {
            unused: 0,
            booked: 0,
            used: 0
          }
        });
      }
    } catch (error) {
      console.error('加载课券统计失败', error);
      // 设置默认值
      this.setData({ 
        ticketStats: {
          unused: 0,
          booked: 0,
          used: 0
        }
      });
    }
  },

  // 加载优惠券统计
  async loadCouponStats() {
    try {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      
      // 检查登录状态
      if (!userInfo || !userInfo.id) {
        console.log('用户未登录，清除优惠券统计');
        this.setData({
          couponStats: {
            unused: 0,
            used: 0,
            expired: 0
          }
        });
        return;
      }

      console.log('加载优惠券统计，user_id:', userInfo.id);
      const res = await app.request({
        url: '/discounts/stats',
        method: 'GET',
        data: { user_id: userInfo.id }
      });

      console.log('优惠券统计API响应:', res);
      if (res && res.success && res.data) {
        this.setData({ couponStats: res.data });
        console.log('优惠券统计加载成功:', res.data);
      } else {
        console.error('优惠券统计API返回失败:', res);
        // 设置默认值
        this.setData({ 
          couponStats: {
            unused: 0,
            used: 0,
            expired: 0
          }
        });
      }
    } catch (error) {
      console.error('加载优惠券统计失败', error);
      // 设置默认值
      this.setData({ 
        couponStats: {
          unused: 0,
          used: 0,
          expired: 0
        }
      });
    }
  },

  // 加载邀请达人徽章
  async loadInviteBadge() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) return;

      const res = await app.request({
        url: `/users/${userInfo.id}`,
        method: 'GET'
      });

      if (res.success && res.data.invite_stats) {
        const registered = res.data.invite_stats.registered || 0;
        let badge = null;
        
        // 根据邀请人数计算徽章等级
        if (registered >= 27) {
          badge = '钻石';
        } else if (registered >= 9) {
          badge = '黄金';
        } else if (registered >= 3) {
          badge = '白银';
        } else if (registered >= 1) {
          badge = '青铜';
        }

        this.setData({ inviteBadge: badge });
      }
    } catch (error) {
      console.error('加载邀请徽章失败', error);
    }
  },

  // 加载邀请信息（二维码和统计数据）
  async loadInviteInfo() {
    try {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      
      // 检查登录状态
      if (!userInfo || !userInfo.id) {
        this.setData({
          inviteCode: '',
          qrCodeUrl: '',
          inviteStats: {
            total: 0,
            registered: 0,
            purchased: 0
          }
        });
        return;
      }

      // 根据角色选择邀请码：会员使用 member_id，教练使用 instructor_id，渠道方使用 channel_id
      let inviteCode = '';
      if (userInfo.role === 'instructor' && userInfo.instructor_id) {
        inviteCode = userInfo.instructor_id;
      } else if (userInfo.role === 'channel' && userInfo.channel_id) {
        inviteCode = userInfo.channel_id;
      } else if (userInfo.role === 'member' && userInfo.member_id) {
        inviteCode = userInfo.member_id;
      }

      // 加载邀请统计数据（如果还没有加载）
      if (!this.data.inviteStats || (this.data.inviteStats.total === 0 && this.data.inviteStats.registered === 0 && this.data.inviteStats.purchased === 0)) {
        try {
          const statsRes = await app.request({
            url: `/users/${userInfo.id}`,
            method: 'GET'
          });
          
          if (statsRes.success && statsRes.data.invite_stats) {
            this.setData({
              inviteStats: statsRes.data.invite_stats
            });
          }
        } catch (error) {
          console.error('[个人中心] 加载邀请统计失败:', error);
        }
      }

      // 加载二维码
      if (inviteCode) {
        const baseUrl = app.globalData.apiBaseUrl.replace('/api', '');
        const qrCodeUrl = `${baseUrl}/api/invitations/qrcode/${inviteCode}`;
        
        this.setData({
          inviteCode: inviteCode,
          qrCodeUrl: qrCodeUrl
        });
      } else {
        this.setData({
          inviteCode: '',
          qrCodeUrl: ''
        });
      }
    } catch (error) {
      console.error('[个人中心] 加载邀请信息失败:', error);
      this.setData({
        inviteCode: '',
        qrCodeUrl: ''
      });
    }
  },

  // 跳转到个人信息详情
  goToUserDetail() {
    wx.navigateTo({
      url: '/pages/user-detail/user-detail'
    });
  },

  // 跳转到徽章页面
  goToBadges() {
    wx.navigateTo({
      url: '/pages/badges/badges'
    });
  },

  // 跳转到讲师资料
  goToInstructorProfile() {
    wx.navigateTo({
      url: '/pages/instructor-profile/instructor-profile'
    });
  },

  // 跳转到授课列表
  goToInstructorCourses() {
    wx.navigateTo({
      url: '/pages/instructor-courses/instructor-courses'
    });
  },

  // 跳转到讲师课程评价
  goToInstructorEvaluations() {
    wx.navigateTo({
      url: '/pages/instructor-evaluations/instructor-evaluations'
    });
  },

  goToPromotion() {
    wx.navigateTo({
      url: '/pages/promotion/promotion'
    });
  },

  // 跳转到课券列表
  goToTicketList() {
    wx.navigateTo({
      url: '/pages/ticket-list/ticket-list'
    });
  },

  // 跳转到购买课券
  goToPurchaseTicket() {
    wx.navigateTo({
      url: '/pages/ticket-purchase/ticket-purchase'
    });
  },

  // 跳转到赠予课券
  goToGiftTicket() {
    wx.navigateTo({
      url: '/pages/ticket-gift/ticket-gift'
    });
  },

  // 跳转到开发票
  goToInvoice() {
    wx.navigateTo({
      url: '/pages/invoice/invoice'
    });
  },

  // 跳转到折扣券
  goToDiscountCoupons() {
    wx.navigateTo({
      url: '/pages/discount-coupons/discount-coupons'
    });
  },

  // 保存二维码到相册（使用海报模板）
  async saveQRCode() {
    const { qrCodeUrl, inviteCode } = this.data;
    
    if (!qrCodeUrl) {
      wx.showToast({
        title: '二维码加载中，请稍候',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '生成海报中...',
      mask: true
    });

    try {
      // 1. 获取激活的海报模板
      const postersRes = await app.request({
        url: '/posters/list',
        method: 'GET'
      });

      if (!postersRes.success || !postersRes.data || postersRes.data.length === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '暂无可用海报模板',
          icon: 'none'
        });
        return;
      }

      // 选择第一个激活的海报模板
      const posterTemplate = postersRes.data[0];

      // 2. 调用后端生成海报
      const generateRes = await app.request({
        url: '/posters/generate',
        method: 'POST',
        data: {
          poster_id: posterTemplate.id,
          qr_code_url: qrCodeUrl,
          invite_code: inviteCode || ''
        }
      });

      if (!generateRes.success || !generateRes.data || !generateRes.data.image_url) {
        throw new Error('生成海报失败');
      }

      const posterImageUrl = generateRes.data.image_url;

      // 3. 下载生成的海报图片
      const downloadRes = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: posterImageUrl,
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.tempFilePath);
            } else {
              reject(new Error('下载海报失败'));
            }
          },
          fail: reject
        });
      });

      // 4. 保存到相册
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: downloadRes,
          success: () => {
            resolve();
          },
          fail: (err) => {
            reject(err);
          }
        });
      });

      wx.hideLoading();
      wx.showToast({
        title: '海报已保存到相册',
        icon: 'success'
      });
    } catch (error) {
      wx.hideLoading();
      console.error('保存海报失败:', error);
      
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '需要授权',
          content: '需要您授权保存图片到相册',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      } else {
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        });
      }
    }
  },

  // 分享小程序（用于分享二维码）
  async onShareAppMessage() {
    const { inviteCode, userInfo, qrCodeUrl } = this.data;
    const inviteCodeToUse = inviteCode || (userInfo && (userInfo.member_id || userInfo.instructor_id || userInfo.channel_id));
    
    // 尝试生成海报作为分享图片
    let shareImageUrl = '';
    if (qrCodeUrl) {
      try {
        const postersRes = await app.request({
          url: '/posters/list',
          method: 'GET'
        });
        
        if (postersRes.success && postersRes.data && postersRes.data.length > 0) {
          const posterTemplate = postersRes.data[0];
          const generateRes = await app.request({
            url: '/posters/generate',
            method: 'POST',
            data: {
              poster_id: posterTemplate.id,
              qr_code_url: qrCodeUrl,
              invite_code: inviteCodeToUse || ''
            }
          });
          
          if (generateRes.success && generateRes.data && generateRes.data.image_url) {
            shareImageUrl = generateRes.data.image_url;
          }
        }
      } catch (error) {
        console.error('生成分享图片失败:', error);
      }
    }
    
    return {
      title: '邀请您加入CFO高手私教小班课',
      path: `/pages/register/register?invite_code=${inviteCodeToUse || ''}`,
      imageUrl: shareImageUrl
    };
  },

  // 分享到朋友圈
  async onShareTimeline() {
    const { inviteCode, userInfo, qrCodeUrl } = this.data;
    const inviteCodeToUse = inviteCode || (userInfo && (userInfo.member_id || userInfo.instructor_id || userInfo.channel_id));
    
    // 尝试生成海报作为分享图片
    let shareImageUrl = '';
    if (qrCodeUrl) {
      try {
        const postersRes = await app.request({
          url: '/posters/list',
          method: 'GET'
        });
        
        if (postersRes.success && postersRes.data && postersRes.data.length > 0) {
          const posterTemplate = postersRes.data[0];
          const generateRes = await app.request({
            url: '/posters/generate',
            method: 'POST',
            data: {
              poster_id: posterTemplate.id,
              qr_code_url: qrCodeUrl,
              invite_code: inviteCodeToUse || ''
            }
          });
          
          if (generateRes.success && generateRes.data && generateRes.data.image_url) {
            shareImageUrl = generateRes.data.image_url;
          }
        }
      } catch (error) {
        console.error('生成分享图片失败:', error);
      }
    }
    
    return {
      title: '邀请您加入CFO高手私教小班课',
      query: `invite_code=${inviteCodeToUse || ''}`,
      imageUrl: shareImageUrl
    };
  },

  // 跳转到已预订课程
  goToBookedCourses() {
    wx.navigateTo({
      url: '/pages/my-bookings/my-bookings'
    });
  },

  // 跳转到已上课程
  goToCompletedCourses() {
    wx.navigateTo({
      url: '/pages/completed-courses/completed-courses'
    });
  },

  // 跳转到评价
  goToEvaluation() {
    wx.navigateTo({
      url: '/pages/evaluation/evaluation'
    });
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？退出后将进入游客模式',
      confirmText: '退出',
      cancelText: '取消',
      confirmColor: '#ff4444',
      success: (res) => {
        if (res.confirm) {
          // 清除所有本地存储
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('openid');
          wx.removeStorageSync('session_key');
          wx.removeStorageSync('token');
          
          // 清除全局数据
          app.globalData.userInfo = null;
          app.globalData.openid = null;
          
          // 重置页面数据
          this.setData({
            userInfo: null,
            isInstructor: false,
            isChannel: false,
            isChannelSales: false,
            channelPartnerName: null,
            ticketStats: {
              unused: 0,
              booked: 0,
              used: 0
            },
            inviteBadge: null
          });
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1000
          });
          
          // 跳转到首页（游客模式）- 使用更可靠的跳转方式
          setTimeout(() => {
            // 先尝试 switchTab，如果失败则使用 reLaunch
            wx.switchTab({
              url: '/pages/index/index',
              success: () => {
                console.log('[Profile] 已退出登录，切换到首页游客模式');
              },
              fail: (err) => {
                console.warn('[Profile] switchTab 失败，尝试使用 reLaunch:', err);
                // 如果 switchTab 失败，使用 reLaunch 重新启动应用
                wx.reLaunch({
                  url: '/pages/index/index',
                  success: () => {
                    console.log('[Profile] 使用 reLaunch 成功跳转到首页');
                  },
                  fail: (reLaunchErr) => {
                    console.error('[Profile] reLaunch 也失败:', reLaunchErr);
                    // 最后的回退方案：提示用户手动返回首页
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
        }
      }
    });
  },

  // 登录流程（获取微信信息和手机号）
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    });
  },

  async goToIndex() {
    wx.showLoading({
      title: '登录中...'
    });

    try {
      // 1. 微信登录获取code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      if (!loginRes.code) {
        wx.hideLoading();
        wx.showToast({
          title: '微信登录失败',
          icon: 'none'
        });
        return;
      }

      // 2. 获取用户信息（昵称、头像）
      let userProfile = null;
      try {
        const profileRes = await new Promise((resolve, reject) => {
          wx.getUserProfile({
            desc: '用于完善用户资料',
            success: resolve,
            fail: reject
          });
        });
        userProfile = profileRes.userInfo;
      } catch (err) {
        console.log('用户取消授权或获取信息失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '需要授权才能登录',
          icon: 'none'
        });
        return;
      }

      // 3. 先调用后端登录接口，获取session_key（用于后续解密手机号）
      const loginApiRes = await app.request({
        url: '/auth/wxlogin',
        method: 'POST',
        data: {
          code: loginRes.code,
          userInfo: {
            nickname: userProfile.nickName,
            avatar_url: userProfile.avatarUrl
          }
        }
      });

      if (!loginApiRes.success) {
        wx.hideLoading();
        wx.showToast({
          title: loginApiRes.error || '登录失败',
          icon: 'none'
        });
        return;
      }

      // 保存登录信息
      wx.setStorageSync('openid', loginApiRes.user.openid);
      wx.setStorageSync('userInfo', loginApiRes.user);
      app.globalData.openid = loginApiRes.user.openid;
      app.globalData.userInfo = loginApiRes.user;

      wx.hideLoading();

      // 4. 检查是否需要获取手机号
      if (!loginApiRes.user.phone) {
        // 如果用户还没有手机号，提示获取手机号
        wx.showModal({
          title: '提示',
          content: '为了完成登录，请授权获取您的手机号',
          confirmText: '授权',
          cancelText: '稍后',
          success: async (modalRes) => {
            if (modalRes.confirm) {
              // 跳转到注册页面，在那里可以获取手机号
              wx.navigateTo({
                url: '/pages/register/register'
              });
            } else {
              // 即使不授权手机号，也更新页面状态（游客模式）
              this.loadUserInfo();
              wx.showToast({
                title: '登录成功（游客模式）',
                icon: 'success'
              });
            }
          }
        });
      } else {
        // 如果已有手机号，直接刷新页面
        this.loadUserInfo();
        wx.showToast({
          title: '登录成功',
          icon: 'success'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('登录失败:', error);
      wx.showToast({
        title: error.message || error.error || '登录失败',
        icon: 'none',
        duration: 3000
      });
    }
  }
});
