// pages/promotion/promotion.js
const app = getApp();

Page({
  data: {
    instructorId: '',
    qrCodeUrl: '',
    showPoster: false,
    posterImage: '',
    stats: {
      invited_count: 0,
      registered_count: 0,
      purchased_count: 0
    },
    loading: false
  },

  onLoad() {
    this.loadInstructorInfo();
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  // 加载用户信息（教练、渠道方或渠道销售）
  async loadInstructorInfo() {
    try {
      const userInfo = app.globalData.userInfo;
      
      // 判断是否为渠道销售
      const isChannelSales = userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name);
      
      // 检查权限：只有教练和渠道销售可以访问
      if (!userInfo || (userInfo.role !== 'instructor' && !isChannelSales)) {
        wx.showToast({
          title: '只有教练和渠道销售可以访问推广专区',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        return;
      }

      let inviteCode = '';
      if (userInfo.role === 'instructor') {
        if (!userInfo.instructor_id) {
          wx.showToast({
            title: '教练编码不存在，请联系管理员',
            icon: 'none'
          });
          return;
        }
        inviteCode = userInfo.instructor_id;
      } else if (isChannelSales) {
        // 渠道销售使用 member_id 作为邀请码
        if (!userInfo.member_id) {
          wx.showToast({
            title: '会员编码不存在，请联系管理员',
            icon: 'none'
          });
          return;
        }
        inviteCode = userInfo.member_id;
      }

      this.setData({
        instructorId: inviteCode
      });

      // 加载二维码
      this.loadQRCode(inviteCode);
    } catch (error) {
      console.error('[推广专区] 加载用户信息失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    }
  },

  // 加载二维码
  loadQRCode(instructorId) {
    try {
      if (!instructorId) {
        this.setData({
          qrCodeUrl: ''
        });
        return;
      }
      
      // 生成小程序路径，携带邀请码参数
      const baseUrl = app.globalData.apiBaseUrl.replace('/api', '');
      const qrCodeUrl = `${baseUrl}/api/invitations/qrcode/${instructorId}`;
      
      console.log('[推广专区] 二维码URL:', qrCodeUrl);
      
      this.setData({
        qrCodeUrl: qrCodeUrl
      });
    } catch (error) {
      console.error('[推广专区] 加载二维码URL失败:', error);
      this.setData({
        qrCodeUrl: ''
      });
    }
  },

  // 生成海报
  async generatePoster() {
    const { instructorId, qrCodeUrl } = this.data;
    
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
      // 1. 获取海报模板列表
      const postersRes = await app.request({
        url: '/posters/list',
        method: 'GET'
      });

      let posterTemplate = null;
      if (postersRes.success && postersRes.data && postersRes.data.length > 0) {
        // 随机选择一个激活的海报模板
        const activePosters = postersRes.data;
        posterTemplate = activePosters[Math.floor(Math.random() * activePosters.length)];
      }

      // 2. 下载二维码图片
      const qrImagePath = await this.downloadImage(qrCodeUrl);
      if (!qrImagePath) {
        wx.hideLoading();
        wx.showToast({
          title: '二维码下载失败',
          icon: 'none'
        });
        return;
      }

      // 3. 创建canvas上下文
      const ctx = wx.createCanvasContext('posterCanvas', this);
      
      // 画布尺寸（默认750x1334，如果使用模板则根据模板尺寸调整）
      const canvasWidth = 750;
      const canvasHeight = 1334;

      if (posterTemplate && posterTemplate.image_url) {
        // 使用管理员上传的海报模板
        // 下载海报模板图片
        const posterImagePath = await this.downloadImage(posterTemplate.image_url);
        if (posterImagePath) {
          // 绘制海报模板（铺满画布）
          ctx.drawImage(posterImagePath, 0, 0, canvasWidth, canvasHeight);
          
          // 在指定位置绘制二维码
          const qrX = posterTemplate.qr_code_position_x || (canvasWidth - (posterTemplate.qr_code_size || 300)) / 2;
          const qrY = posterTemplate.qr_code_position_y || 450;
          const qrSize = posterTemplate.qr_code_size || 300;
          
          ctx.drawImage(qrImagePath, qrX, qrY, qrSize, qrSize);
        } else {
          // 如果模板下载失败，使用默认样式
          this.generateDefaultPoster(ctx, canvasWidth, canvasHeight, instructorId, qrImagePath);
        }
      } else {
        // 没有海报模板，使用默认样式
        this.generateDefaultPoster(ctx, canvasWidth, canvasHeight, instructorId, qrImagePath);
      }

      // 4. 绘制完成
      ctx.draw(false, () => {
        // 等待绘制完成后再转换为图片
        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvasId: 'posterCanvas',
            width: canvasWidth,
            height: canvasHeight,
            destWidth: canvasWidth,
            destHeight: canvasHeight,
            success: (res) => {
              this.setData({
                posterImage: res.tempFilePath,
                showPoster: true
              });
              wx.hideLoading();
            },
            fail: (err) => {
              console.error('生成海报失败', err);
              wx.hideLoading();
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
      console.error('[推广专区] 生成海报失败:', error);
      wx.showToast({
        title: '生成海报失败',
        icon: 'none'
      });
    }
  },

  // 生成默认海报（与邀请页面保持一致）
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

  // 下载图片
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
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  // 保存海报到相册
  savePoster() {
    const { posterImage } = this.data;
    
    if (!posterImage) {
      wx.showToast({
        title: '海报不存在',
        icon: 'none'
      });
      return;
    }

    wx.saveImageToPhotosAlbum({
      filePath: posterImage,
      success: () => {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        this.setData({
          showPoster: false
        });
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

  // 关闭海报预览
  closePoster() {
    this.setData({
      showPoster: false
    });
  },

  // 加载统计信息
  async loadStats() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        return;
      }

      // 使用邀请统计API
      const res = await app.request({
        url: '/invitations/stats',
        method: 'GET',
        data: {
          inviter_id: userInfo.id
        }
      });

      if (res.success && res.data) {
        this.setData({
          stats: {
            invited_count: res.data.total_invitations || 0,
            registered_count: res.data.registered_count || 0,
            purchased_count: res.data.purchased_count || 0
          }
        });
      }
    } catch (error) {
      console.error('[推广专区] 加载统计信息失败:', error);
    }
  },

  // 查看总邀请人数详情
  viewAllInvitations() {
    wx.navigateTo({
      url: '/pages/promotion-detail/promotion-detail?type=all'
    });
  },

  // 查看已注册用户详情
  viewRegistered() {
    wx.navigateTo({
      url: '/pages/promotion-detail/promotion-detail?type=registered'
    });
  },

  // 查看已购券用户详情
  viewPurchased() {
    wx.navigateTo({
      url: '/pages/promotion-detail/promotion-detail?type=purchased'
    });
  },

  // 保存二维码
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
    return {
      title: '邀请您加入CFO高手私教小班课',
      path: `/pages/register/register?invite_code=${this.data.instructorId}`,
      imageUrl: this.data.qrCodeUrl || ''
    };
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '邀请您加入CFO高手私教小班课',
      query: `invite_code=${this.data.instructorId}`,
      imageUrl: this.data.qrCodeUrl || ''
    };
  }
});

