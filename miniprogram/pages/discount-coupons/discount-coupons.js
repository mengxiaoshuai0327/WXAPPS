// pages/discount-coupons/discount-coupons.js
const app = getApp();

Page({
  data: {
    coupons: [],
    currentTab: 'unused',
    loading: false,
    couponStats: {
      unused: 0,
      unused_amount: 0,
      used: 0,
      expired: 0
    },
    inviteCode: '',
    qrCodeUrl: '',
    showPoster: false,
    posterImage: ''
  },

  onLoad() {
    console.log('[折扣券] 页面加载');
    try {
      this.loadCouponStats();
      this.loadCoupons();
    } catch (error) {
      console.error('[折扣券] 页面加载错误:', error);
      wx.showToast({
        title: '页面加载失败',
        icon: 'none'
      });
    }
  },

  onShow() {
    console.log('[折扣券] 页面显示');
    try {
      this.loadCouponStats();
      this.loadCoupons();
    } catch (error) {
      console.error('[折扣券] 页面显示错误:', error);
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadCoupons();
  },

  async loadCouponStats() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        return;
      }

      const res = await app.request({
        url: '/discounts/stats',
        method: 'GET',
        data: { user_id: userInfo.id }
      });

      if (res && res.success && res.data) {
        this.setData({
          couponStats: res.data
        });
      }
    } catch (error) {
      console.error('[折扣券] 加载统计失败:', error);
    }
  },

  async loadCoupons() {
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
        console.error('[折扣券] 用户未登录');
        // 不阻止页面显示，允许用户看到页面结构
        this.setData({ 
          coupons: [],
          loading: false 
        });
        return;
      }

      const res = await app.request({
        url: '/discounts/list',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          status: this.data.currentTab === 'unused' ? 'unused' : 
                  this.data.currentTab === 'used' ? 'used' : 'expired'
        }
      });

      if (res.success) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const processedCoupons = res.data.map(coupon => {
          // 格式化时间
          const created_at_formatted = coupon.created_at 
            ? this.formatDateTime(coupon.created_at)
            : '';
          const expiry_date_formatted = coupon.expiry_date
            ? this.formatDate(coupon.expiry_date)
            : null;
          const used_at_formatted = coupon.used_at
            ? this.formatDateTime(coupon.used_at)
            : null;

          // 获得方式文本（根据source字段）
          let source_text = '未知来源';
          if (coupon.source === 'invite_register') {
            source_text = '会员邀请注册奖励';
          } else if (coupon.source === 'invite_purchase') {
            source_text = '会员邀请购买奖励';
          } else if (coupon.source === 'instructor_invite') {
            source_text = '教练邀请注册奖励';
          } else if (coupon.source === 'channel_invite') {
            source_text = '渠道邀请注册奖励';
          } else if (coupon.source === 'admin_special') {
            source_text = '管理员特殊发放';
          } else if (coupon.source === 'admin') {
            source_text = '管理员发放';
          } else if (coupon.source === 'instructor_reward') {
            source_text = '授课奖励';
          } else {
            source_text = coupon.source || '未知来源';
          }

          // 生成使用期限文本（如果后端没有返回 period_text）
          let period_text = coupon.period_text;
          if (!period_text) {
            if (coupon.start_date && coupon.expiry_date) {
              const startDate = this.formatDate(coupon.start_date);
              const expiryDate = this.formatDate(coupon.expiry_date);
              period_text = `${startDate} 至 ${expiryDate}`;
            } else if (coupon.start_date) {
              period_text = `${this.formatDate(coupon.start_date)} 起`;
            } else if (coupon.expiry_date) {
              period_text = `至 ${this.formatDate(coupon.expiry_date)}`;
            } else {
              period_text = '永久有效';
            }
          }

          // 使用 Object.assign 替代扩展运算符
          return Object.assign({}, coupon, {
            created_at_formatted,
            expiry_date_formatted,
            used_at_formatted,
            source_text,
            period_text
          });
        });

        this.setData({
          coupons: processedCoupons,
          loading: false
        });
      }
    } catch (error) {
      console.error('加载折扣券失败', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  formatDateTime(dateTime) {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  showPolicy() {
    wx.showModal({
      title: '优惠券政策说明',
      content: '优惠券使用注意事项：\n\n1. 优惠券有效期：请在使用期限内使用，过期作废。\n\n2. 优惠券不可转让：优惠券仅限本人使用，不得转让给他人。\n\n3. 退课不退优惠券：如发生退课，已使用的优惠券不予退还。\n\n4. 使用限制：每笔订单仅可使用一张优惠券，不可叠加使用。\n\n5. 优惠券解释权归平台所有。',
      showCancel: true,
      confirmText: '我知道了',
      cancelText: '关闭'
    });
  },


  async loadInviteInfo() {
    try {
      console.log('[优惠券] 开始加载邀请信息');
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
        console.log('[优惠券] 用户信息不存在');
        this.setData({ qrCodeUrl: '' });
        return;
      }

      console.log('[优惠券] 用户信息:', userInfo);
      console.log('[优惠券] 用户角色:', userInfo.role);

      // 根据角色选择邀请码
      let inviteCode = '';
      if (userInfo.role === 'instructor' && userInfo.instructor_id) {
        inviteCode = userInfo.instructor_id;
        console.log('[优惠券] 使用教练ID:', inviteCode);
      } else if (userInfo.role === 'channel' && userInfo.channel_id) {
        inviteCode = userInfo.channel_id;
        console.log('[优惠券] 使用渠道ID:', inviteCode);
      } else if (userInfo.role === 'member' && userInfo.member_id) {
        inviteCode = userInfo.member_id;
        console.log('[优惠券] 使用会员ID:', inviteCode);
      }

      if (inviteCode) {
        this.setData({ inviteCode });
        await this.loadQRCode(inviteCode);
      } else {
        console.log('[优惠券] 未找到邀请码');
        this.setData({ qrCodeUrl: '' });
      }
    } catch (error) {
      console.error('[优惠券] 加载邀请信息失败:', error);
      this.setData({ qrCodeUrl: '' });
    }
  },

  async loadQRCode(inviteCode) {
    try {
      if (!inviteCode) {
        console.log('[优惠券] 邀请码为空');
        this.setData({ qrCodeUrl: '' });
        return;
      }
      
      console.log('[优惠券] 开始加载二维码，邀请码:', inviteCode);
      
      // 生成二维码URL（从后端获取）
      // 使用与邀请页面相同的逻辑
      if (!app.globalData.apiBaseUrl) {
        console.error('[优惠券] API Base URL 未设置');
        this.setData({ qrCodeUrl: '' });
        return;
      }
      
      const baseUrl = app.globalData.apiBaseUrl.replace('/api', '');
      const qrCodeUrl = `${baseUrl}/api/invitations/qrcode/${inviteCode}`;
      
      console.log('[优惠券] API Base URL:', app.globalData.apiBaseUrl);
      console.log('[优惠券] Base URL (去除/api):', baseUrl);
      console.log('[优惠券] 二维码URL:', qrCodeUrl);
      
      // 先设置URL，然后验证
      this.setData({ qrCodeUrl });
      
      // 延迟验证，确保URL已设置
      setTimeout(() => {
        wx.getImageInfo({
          src: qrCodeUrl,
          success: (res) => {
            console.log('[优惠券] 二维码图片加载成功，尺寸:', res.width, 'x', res.height);
          },
          fail: (err) => {
            console.error('[优惠券] 二维码图片加载失败:', err);
            // 不立即清除，可能是网络问题，让用户看到加载状态
          }
        });
      }, 100);
    } catch (error) {
      console.error('[优惠券] 加载二维码失败:', error);
      this.setData({ qrCodeUrl: '' });
    }
  },

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
      // 下载二维码图片
      const qrImagePath = await this.downloadImage(qrCodeUrl);
      if (!qrImagePath) {
        wx.hideLoading();
        wx.showToast({
          title: '二维码下载失败',
          icon: 'none'
        });
        return;
      }

      // 创建canvas上下文
      const ctx = wx.createCanvasContext('posterCanvas', this);
      
      const canvasWidth = 750;
      const canvasHeight = 1334;

      // 绘制默认海报
      this.generateDefaultPoster(ctx, canvasWidth, canvasHeight, inviteCode, qrImagePath);

      // 绘制完成
      ctx.draw(false, () => {
        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvasId: 'posterCanvas',
            success: (res) => {
              wx.hideLoading();
              this.setData({
                posterImage: res.tempFilePath,
                showPoster: true
              });
            },
            fail: (err) => {
              wx.hideLoading();
              console.error('生成海报失败:', err);
              wx.showToast({
                title: '生成海报失败',
                icon: 'none'
              });
            }
          }, this);
        }, 500);
      });
    } catch (error) {
      wx.hideLoading();
      console.error('生成海报错误:', error);
      wx.showToast({
        title: '生成海报失败',
        icon: 'none'
      });
    }
  },

  generateDefaultPoster(ctx, canvasWidth, canvasHeight, inviteCode, qrImagePath) {
    // 背景色
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // 标题
    ctx.setFillStyle('#1a1a1a');
    ctx.setFontSize(48);
    ctx.setTextAlign('center');
    ctx.fillText('邀请您加入', canvasWidth / 2, 200);
    ctx.fillText('CFO高手私教小班课', canvasWidth / 2, 280);
    
    // 二维码
    const qrSize = 400;
    const qrX = (canvasWidth - qrSize) / 2;
    const qrY = 400;
    ctx.drawImage(qrImagePath, qrX, qrY, qrSize, qrSize);
    
    // 邀请码提示
    ctx.setFillStyle('#666666');
    ctx.setFontSize(32);
    ctx.fillText('邀请码：' + inviteCode, canvasWidth / 2, qrY + qrSize + 80);
    ctx.fillText('扫描二维码立即注册', canvasWidth / 2, qrY + qrSize + 140);
  },

  downloadImage(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url: url,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.tempFilePath);
          } else {
            reject(new Error('下载失败'));
          }
        },
        fail: reject
      });
    });
  },

  closePoster() {
    this.setData({
      showPoster: false,
      posterImage: ''
    });
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  onQRCodeLoad() {
    console.log('[优惠券] 二维码图片加载成功');
  },

  onQRCodeError(e) {
    console.error('[优惠券] 二维码图片加载错误:', e);
    const { inviteCode } = this.data;
    if (inviteCode) {
      // 尝试重新加载
      console.log('[优惠券] 尝试重新加载二维码');
      setTimeout(() => {
        this.loadQRCode(inviteCode);
      }, 1000);
    } else {
      wx.showToast({
        title: '二维码加载失败',
        icon: 'none'
      });
    }
  },

  savePoster() {
    const { posterImage } = this.data;
    if (!posterImage) {
      return;
    }

    wx.saveImageToPhotosAlbum({
      filePath: posterImage,
      success: () => {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        this.closePoster();
      },
      fail: (err) => {
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '提示',
            content: '需要授权保存图片到相册',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting();
              }
            }
          });
        } else {
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          });
        }
      }
    });
  },

  saveQRCode() {
    const { qrCodeUrl } = this.data;
    if (!qrCodeUrl) {
      wx.showToast({
        title: '二维码未加载',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '下载中...',
      mask: true
    });

    // 下载二维码图片
    wx.downloadFile({
      url: qrCodeUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          // 保存到相册
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              wx.hideLoading();
              wx.showToast({
                title: '保存成功',
                icon: 'success'
              });
            },
            fail: (err) => {
              wx.hideLoading();
              if (err.errMsg.includes('auth deny')) {
                wx.showModal({
                  title: '提示',
                  content: '需要授权保存图片到相册',
                  confirmText: '去设置',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      wx.openSetting();
                    }
                  }
                });
              } else {
                wx.showToast({
                  title: '保存失败',
                  icon: 'none'
                });
              }
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('下载二维码失败:', err);
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        });
      }
    });
  },

  // 分享到微信
  onShareAppMessage() {
    const { inviteCode } = this.data;
    return {
      title: '邀请您加入CFO高手私教小班课，注册即送优惠券',
      path: `/pages/register/register?invite_code=${inviteCode}`,
      imageUrl: this.data.qrCodeUrl || '' // 使用二维码图片作为分享图片
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { inviteCode } = this.data;
    return {
      title: '邀请您加入CFO高手私教小班课，注册即送优惠券',
      query: `invite_code=${inviteCode}`,
      imageUrl: this.data.qrCodeUrl || ''
    };
  }
});
