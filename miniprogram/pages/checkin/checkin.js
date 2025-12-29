// pages/checkin/checkin.js
const app = getApp();

Page({
  data: {
    pendingCheckins: [],
    loading: false
  },

  onLoad() {
    this.loadPendingCheckins();
  },

  onShow() {
    this.loadPendingCheckins();
  },

  async loadPendingCheckins() {
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        wx.showModal({
          title: '提示',
          content: '请先登录',
          showCancel: false,
          success: () => {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        });
        return;
      }

      const res = await app.request({
        url: '/courses/pending-checkins',
        method: 'GET',
        data: { user_id: userInfo.id }
      });

      this.setData({
        pendingCheckins: res.data || [],
        loading: false
      });
    } catch (error) {
      console.error('加载待签到列表失败', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  async checkIn(e) {
    const bookingId = e.currentTarget.dataset.id;
    const courseTitle = e.currentTarget.dataset.title;

    wx.showModal({
      title: '确认签到',
      content: `确认签到课程"${courseTitle}"？`,
      confirmText: '确认签到',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            const userInfo = app.globalData.userInfo;
            const result = await app.request({
              url: `/courses/bookings/${bookingId}/checkin`,
              method: 'POST',
              data: { user_id: userInfo.id }
            });

            if (result.success) {
              wx.showToast({
                title: '签到成功',
                icon: 'success'
              });
              
              // 刷新列表
              setTimeout(() => {
                this.loadPendingCheckins();
              }, 1500);
            } else {
              wx.showToast({
                title: result.error || '签到失败',
                icon: 'none',
                duration: 3000
              });
            }
          } catch (error) {
            console.error('签到失败', error);
            wx.showToast({
              title: error.message || error.error || '签到失败',
              icon: 'none',
              duration: 3000
            });
          }
        }
      }
    });
  }
});

