// pages/my-bookings/my-bookings.js
const app = getApp();

Page({
  data: {
    bookings: [],
    loading: false,
    userRole: 'visitor', // 用户角色：visitor/member/instructor
    isChannelSales: false // 是否为渠道销售
  },

  onLoad() {
    // 获取用户角色信息
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo) {
      const userRole = userInfo.role || 'visitor';
      const isChannelSales = userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name);
      this.setData({
        userRole: userRole,
        isChannelSales: isChannelSales
      });
    }
    this.loadBookings();
  },

  onShow() {
    // 每次显示页面时刷新数据，并更新用户角色信息
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo) {
      const userRole = userInfo.role || 'visitor';
      const isChannelSales = userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name);
      this.setData({
        userRole: userRole,
        isChannelSales: isChannelSales
      });
    }
    this.loadBookings();
  },

  // 加载已预订课程
  async loadBookings() {
    console.log('[已预订课程] 开始加载数据');
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || userInfo.role === 'visitor') {
        console.log('[已预订课程] 用户未登录或为游客');
        this.setData({ loading: false });
        wx.showModal({
          title: '提示',
          content: '请先登录成为会员',
          showCancel: false,
          success: () => {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        });
        return;
      }

      console.log('[已预订课程] 请求参数:', { user_id: userInfo.id });
      const res = await app.request({
        url: '/courses/bookings',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          limit: 100 // 获取所有已预订课程
        }
      });

      console.log('[已预订课程] API响应:', res);
      if (res.success) {
        // 处理数据，添加状态信息
        // 如果后端已经返回了 can_cancel 和 is_past，直接使用；否则在前端计算
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const processedBookings = res.data.map(booking => {
          // 优先使用后端返回的字段
          let isPast = booking.is_past;
          let canCancel = booking.can_cancel;
          
          // 如果后端没有返回，则在前端计算
          if (isPast === undefined) {
            const scheduleDate = new Date(booking.schedule_date + 'T00:00:00');
            isPast = scheduleDate < today;
          }
          
          if (canCancel === undefined && !isPast) {
            const scheduleDate = new Date(booking.schedule_date + 'T00:00:00');
            // 判断是否可以取消（开课前3天，在开课前第三天的23:59:59之前）
            // 例如：12-12开课，12-09是开课前第3天，12-08是开课前第4天
            // 规则：可以在开课前3天（含）之前取消，即今天 <= 开课前第3天的00:00
            const cancelDeadline = new Date(scheduleDate);
            cancelDeadline.setDate(cancelDeadline.getDate() - 3);
            cancelDeadline.setHours(0, 0, 0, 0);
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            // 允许在开课前3天（含）之前取消，即今天 <= cancelDeadline
            canCancel = now <= cancelDeadline;
            console.log('前端计算取消状态:', {
              schedule_date: booking.schedule_date,
              scheduleDate: scheduleDate.toISOString(),
              cancelDeadline: cancelDeadline.toISOString(),
              now: now.toISOString(),
              canCancel
            });
          } else if (canCancel !== undefined) {
            console.log('使用后端返回的can_cancel:', canCancel, 'schedule_date:', booking.schedule_date);
          }

          return Object.assign({}, booking, {
            is_past: isPast,
            has_booking: true,
            can_cancel: canCancel !== undefined ? canCancel : false
          });
        });

        console.log('[已预订课程] 处理后的课程数量:', processedBookings.length);
        this.setData({ 
          bookings: processedBookings,
          loading: false
        });
      } else {
        console.warn('[已预订课程] API返回失败:', res);
        this.setData({ 
          bookings: [],
          loading: false 
        });
      }
    } catch (error) {
      console.error('[已预订课程] 加载失败:', error);
      this.setData({ 
        bookings: [],
        loading: false 
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 显示取消提示（不可取消时）
  showCancelTip(e) {
    wx.showModal({
      title: '课程取消限制',
      content: '开课前三天内课程不可取消',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 取消预订
  async cancelBooking(e) {
    const bookingId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消预订吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await app.request({
              url: '/courses/cancel-booking',
              method: 'POST',
              data: {
                user_id: app.globalData.userInfo.id,
                booking_id: bookingId
              }
            });

            if (result.success) {
              wx.showToast({
                title: '取消成功',
                icon: 'success',
                duration: 2000
              });
              // 延迟刷新，让用户看到成功提示
              setTimeout(() => {
                this.loadBookings();
              }, 500);
            } else {
              throw new Error(result.error || '取消失败');
            }
          } catch (error) {
            console.error('取消预订错误:', error);
            let errorMessage = '取消失败';
            if (error.error) {
              errorMessage = error.error;
            } else if (error.message) {
              errorMessage = error.message;
            }
            
            // 如果是取消限制的错误，显示限制提示
            if (errorMessage.includes('三天内') || errorMessage.includes('不可取消') || errorMessage.includes('取消限制')) {
              wx.showModal({
                title: '课程取消限制',
                content: errorMessage.includes('三天内') ? '开课前三天内课程不可取消' : errorMessage,
                showCancel: false,
                confirmText: '我知道了'
              });
            } else {
              wx.showToast({
                title: errorMessage,
                icon: 'none',
                duration: 3000
              });
            }
          }
        }
      }
    });
  },

  // 查看课程详情
  viewCourseDetail(e) {
    const courseId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${courseId}`
    });
  },

  // 跳转到课程表
  goToSchedule() {
    wx.switchTab({
      url: '/pages/schedule/schedule'
    });
  }
});

