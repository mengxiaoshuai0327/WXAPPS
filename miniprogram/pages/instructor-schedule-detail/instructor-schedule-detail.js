// pages/instructor-schedule-detail/instructor-schedule-detail.js
const app = getApp();

Page({
  data: {
    scheduleId: null,
    schedule: null,
    enrolledUsers: [],
    loading: false,
    checkInLoading: false
  },

  onLoad(options) {
    console.log('[排课详情] 页面加载, options:', options);
    // 初始化数据，确保页面能显示
    this.setData({
      scheduleId: null,
      schedule: null,
      enrolledUsers: [],
      loading: false,
      checkInLoading: false
    });
    if (options.id) {
      this.setData({ scheduleId: options.id });
      this.loadScheduleDetail();
    } else {
      console.error('[排课详情] 缺少排课ID');
      wx.showToast({
        title: '缺少排课信息',
        icon: 'none'
      });
    }
  },

  onShow() {
    console.log('[排课详情] 页面显示');
    if (this.data.scheduleId) {
      this.loadScheduleDetail();
    }
  },

  // 加载排课详情
  async loadScheduleDetail() {
    console.log('[排课详情] 开始加载数据, scheduleId:', this.data.scheduleId);
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
        console.log('[排课详情] 用户未登录');
        this.setData({
          schedule: null,
          enrolledUsers: [],
          loading: false
        });
        return;
      }

      if (userInfo.role !== 'instructor') {
        console.log('[排课详情] 用户不是教练, role:', userInfo.role);
        // 不阻止页面显示，只是显示空数据
        this.setData({
          schedule: null,
          enrolledUsers: [],
          loading: false
        });
        return;
      }

      console.log('[排课详情] 获取排课详情, scheduleId:', this.data.scheduleId, 'instructor_id:', userInfo.id);
      const res = await app.request({
        url: `/courses/schedules/${this.data.scheduleId}/detail`,
        method: 'GET',
        data: { instructor_id: userInfo.id }
      });

      console.log('[排课详情] API响应:', res);

      if (res.success) {
        const schedule = res.data.schedule || null;
        const enrolledUsers = res.data.enrolled_users || [];
        console.log('[排课详情] 排课信息:', schedule);
        console.log('[排课详情] 报名人数:', enrolledUsers.length);
        this.setData({
          schedule: schedule,
          enrolledUsers: enrolledUsers,
          loading: false
        });
      } else {
        console.error('[排课详情] API返回失败:', res);
        this.setData({
          schedule: null,
          enrolledUsers: [],
          loading: false
        });
        // 不显示错误提示，让页面正常显示
        console.log('[排课详情] 错误已处理，页面可以正常显示');
      }
    } catch (error) {
      console.error('[排课详情] 加载失败:', error);
      // 即使出错也显示页面，只是没有数据
      this.setData({
        schedule: null,
        enrolledUsers: [],
        loading: false
      });
      console.log('[排课详情] 错误已处理，页面可以正常显示');
    }
  },

  // 触发签到
  async triggerCheckIn() {
    const userInfo = app.globalData.userInfo;
    
    wx.showModal({
      title: '确认触发签到',
      content: '确认触发签到打卡？\n\n此操作将：\n1. 开启该课程的签到功能\n2. 通知所有报名学员进行签到\n\n此操作不可撤销，请确认后继续。',
      confirmText: '确认触发',
      cancelText: '取消',
      confirmColor: '#4A90E2',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ checkInLoading: true });
          
          try {
            const result = await app.request({
              url: `/courses/schedules/${this.data.scheduleId}/trigger-checkin`,
              method: 'POST',
              data: { instructor_id: userInfo.id }
            });

            if (result.success) {
              wx.showToast({
                title: '签到已触发',
                icon: 'success',
                duration: 2000
              });
              
              // 刷新详情页面
              setTimeout(() => {
                this.loadScheduleDetail();
              }, 1500);
            } else {
              wx.showToast({
                title: result.error || '触发失败',
                icon: 'none',
                duration: 3000
              });
            }
          } catch (error) {
            // 判断是否是业务逻辑错误（400状态码通常是业务逻辑错误）
            const isBusinessError = error.statusCode === 400;
            if (isBusinessError) {
              console.log('[排课详情] 触发签到业务限制:', error.error || error.message || '触发失败');
            } else {
              console.error('[排课详情] 触发签到系统错误:', error);
            }
            wx.showToast({
              title: error.message || error.error || '触发失败',
              icon: 'none',
              duration: 3000
            });
          } finally {
            this.setData({ checkInLoading: false });
          }
        }
      }
    });
  },

  // 触发课后评价
  async triggerEvaluation() {
    const userInfo = app.globalData.userInfo;
    
    wx.showModal({
      title: '确认触发课后评价',
      content: '确认触发课后评价？\n\n此操作将：\n1. 标记课程为已完成\n2. 通知所有报名学员填写评价问卷\n\n此操作不可撤销，请确认后继续。',
      confirmText: '确认触发',
      cancelText: '取消',
      confirmColor: '#4A90E2',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ checkInLoading: true });
          
          try {
            const result = await app.request({
              url: `/courses/schedules/${this.data.scheduleId}/check-in`,
              method: 'POST',
              data: { instructor_id: userInfo.id }
            });

            if (result.success) {
              wx.showToast({
                title: '已触发课后评价',
                icon: 'success',
                duration: 2000
              });
              
              // 刷新详情页面
              setTimeout(() => {
                this.loadScheduleDetail();
              }, 1500);
            } else {
              wx.showToast({
                title: result.error || '触发失败',
                icon: 'none',
                duration: 3000
              });
            }
          } catch (error) {
            // 判断是否是业务逻辑错误（400状态码通常是业务逻辑错误）
            const isBusinessError = error.statusCode === 400;
            if (isBusinessError) {
              console.log('[排课详情] 触发课后评价业务限制:', error.error || error.message || '触发失败');
            } else {
              console.error('[排课详情] 触发课后评价系统错误:', error);
            }
            wx.showToast({
              title: error.message || error.error || '触发失败',
              icon: 'none',
              duration: 3000
            });
          } finally {
            this.setData({ checkInLoading: false });
          }
        }
      }
    });
  }
});

