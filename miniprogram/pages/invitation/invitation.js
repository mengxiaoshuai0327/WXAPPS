// pages/invitation/invitation.js
const app = getApp();

Page({
  data: {
    inviteCode: '',
    inviteStats: null,
    inviteCoupons: [],
    totalReward: 0,
    qrCodeUrl: '', // 二维码图片URL
    showPoster: false, // 是否显示海报预览
    posterImage: '' // 生成的海报图片
  },

  onLoad() {
    this.loadInviteInfo();
  },

  onShow() {
    // 每次显示时刷新数据
    this.loadInviteInfo();
  },

  async loadInviteInfo() {
    try {
      const userInfo = app.globalData.userInfo;
      
      // 检查用户是否存在
      if (!userInfo) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        // 即使没有用户信息，也要显示页面结构，避免空白
        this.setData({
          inviteCode: '',
          inviteStats: null,
          inviteCoupons: [],
          totalReward: 0,
          qrCodeUrl: ''
        });
        return;
      }

      // 检查角色（会员、教练或渠道方都可以使用）
      if (userInfo.role !== 'member' && userInfo.role !== 'instructor' && userInfo.role !== 'channel') {
        wx.showToast({
          title: '只有会员、教练和渠道方可以邀请好友',
          icon: 'none'
        });
        this.setData({
          inviteCode: '',
          inviteStats: null,
          inviteCoupons: [],
          totalReward: 0,
          qrCodeUrl: ''
        });
        return;
      }

      // 根据角色选择邀请码：会员使用 member_id，教练使用 instructor_id，渠道方使用 channel_id
      let inviteCode = '';
      if (userInfo.role === 'instructor') {
        if (!userInfo.instructor_id) {
          wx.showToast({
            title: '教练编码不存在，请联系管理员',
            icon: 'none'
          });
          this.setData({
            inviteCode: '',
            inviteStats: null,
            inviteCoupons: [],
            totalReward: 0,
            qrCodeUrl: ''
          });
          return;
        }
        inviteCode = userInfo.instructor_id;
      } else if (userInfo.role === 'channel') {
        if (!userInfo.channel_id) {
          wx.showToast({
            title: '渠道方编码不存在，请联系管理员',
            icon: 'none'
          });
          this.setData({
            inviteCode: '',
            inviteStats: null,
            inviteCoupons: [],
            totalReward: 0,
            qrCodeUrl: ''
          });
          return;
        }
        inviteCode = userInfo.channel_id;
      } else if (userInfo.role === 'member') {
        if (!userInfo.member_id) {
          wx.showToast({
            title: '会员编码不存在，请联系管理员',
            icon: 'none'
          });
          this.setData({
            inviteCode: '',
            inviteStats: null,
            inviteCoupons: [],
            totalReward: 0,
            qrCodeUrl: ''
          });
          return;
        }
        inviteCode = userInfo.member_id;
      }

      // 先设置邀请码，确保页面有内容显示
      this.setData({
        inviteCode: inviteCode
      });

      // 加载二维码
      this.loadQRCode(inviteCode);

      // 并行加载邀请统计和折扣券信息
      try {
        const results = await Promise.all([
          app.request({
            url: `/users/${userInfo.id}`,
            method: 'GET'
          }),
          app.request({
            url: '/discounts/list',
            method: 'GET',
            data: {
              user_id: userInfo.id
            }
          })
        ]);
        const statsRes = results[0] || { success: false };
        const couponsRes = results[1] || { success: false };

        if (statsRes.success && statsRes.data.invite_stats) {
          this.setData({
            inviteStats: statsRes.data.invite_stats
          });
        }

        // 处理邀请奖励折扣券
        if (couponsRes.success && couponsRes.data) {
          const inviteCoupons = couponsRes.data
            .filter(coupon => 
              coupon.source === 'invite_register' || coupon.source === 'invite_purchase'
            )
            .map(coupon => {
              // 格式化时间
              let created_at_formatted = '';
              if (coupon.created_at) {
                const date = new Date(coupon.created_at);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                created_at_formatted = `${year}-${month}-${day} ${hours}:${minutes}`;
              }
              
              return {
                id: coupon.id,
                user_id: coupon.user_id,
                discount_type: coupon.discount_type,
                amount: parseFloat(coupon.amount) || 0,
                min_purchase: coupon.min_purchase,
                valid_from: coupon.valid_from,
                valid_to: coupon.valid_to,
                used_at: coupon.used_at,
                source: coupon.source,
                status: coupon.status,
                created_at: coupon.created_at,
                updated_at: coupon.updated_at,
                created_at_formatted: created_at_formatted
              };
            });

          // 计算总金额
          const totalReward = inviteCoupons.reduce((sum, coupon) => {
            return sum + coupon.amount;
          }, 0);

          this.setData({
            inviteCoupons: inviteCoupons,
            totalReward: totalReward
          });

          console.log('[邀请页] 邀请奖励折扣券:', {
            注册奖励: inviteCoupons.filter(c => c.source === 'invite_register').length,
            购券奖励: inviteCoupons.filter(c => c.source === 'invite_purchase').length,
            总金额: totalReward
          });
        }
      } catch (apiError) {
        console.error('[邀请页] API请求失败:', apiError);
        // API请求失败不影响页面显示，继续显示基本信息
      }
    } catch (error) {
      console.error('[邀请页] 加载邀请信息失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      // 即使出错也设置默认值，确保页面能显示
      this.setData({
        inviteCode: this.data.inviteCode || '',
        inviteStats: this.data.inviteStats || null,
        inviteCoupons: this.data.inviteCoupons || [],
        totalReward: this.data.totalReward || 0
      });
    }
  },

  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.inviteCode,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success'
        });
      }
    });
  },

  // 加载二维码
  loadQRCode(inviteCode) {
    try {
      if (!inviteCode) {
        this.setData({
          qrCodeUrl: ''
        });
        return;
      }
      
      // 生成二维码URL（从后端获取）
      const baseUrl = app.globalData.apiBaseUrl.replace('/api', '');
      const qrCodeUrl = `${baseUrl}/api/invitations/qrcode/${inviteCode}`;
      
      console.log('[邀请页] 二维码URL:', qrCodeUrl);
      
      this.setData({
        qrCodeUrl: qrCodeUrl
      });
    } catch (error) {
      console.error('[邀请页] 加载二维码URL失败:', error);
      this.setData({
        qrCodeUrl: ''
      });
    }
  },

  // 生成海报（使用后端API）
  async generatePoster() {
    const { inviteCode, qrCodeUrl } = this.data;
    
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

      // 4. 显示海报预览
      this.setData({
        posterImage: downloadRes,
        showPoster: true
      });

      wx.hideLoading();
    } catch (error) {
      console.error('生成海报错误:', error);
      wx.hideLoading();
      
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
          title: '生成海报失败，请重试',
          icon: 'none'
        });
      }
    }
  },


  // 保存海报到相册
  async savePoster() {
    const { posterImage } = this.data;
    if (!posterImage) {
      wx.showToast({
        title: '请先生成海报',
        icon: 'none'
      });
      return;
    }

    try {
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: posterImage,
          success: () => {
            resolve();
          },
          fail: (err) => {
            reject(err);
          }
        });
      });

      wx.showToast({
        title: '已保存到相册',
        icon: 'success'
      });
      this.setData({
        showPoster: false
      });
    } catch (err) {
      if (err.errMsg && err.errMsg.includes('auth deny')) {
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

  // 关闭海报预览
  closePoster() {
    this.setData({
      showPoster: false
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 分享到微信
  async onShareAppMessage() {
    const { inviteCode, qrCodeUrl } = this.data;
    
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
              invite_code: inviteCode || ''
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
      path: `/pages/register/register?invite_code=${inviteCode || ''}`,
      imageUrl: shareImageUrl
    };
  },

  // 分享到朋友圈
  async onShareTimeline() {
    const { inviteCode, qrCodeUrl } = this.data;
    
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
              invite_code: inviteCode || ''
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
      query: `invite_code=${inviteCode || ''}`,
      imageUrl: shareImageUrl
    };
  }
});

