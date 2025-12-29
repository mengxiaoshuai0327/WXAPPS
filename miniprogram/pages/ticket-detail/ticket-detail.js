// pages/ticket-detail/ticket-detail.js
const app = getApp();

Page({
  data: {
    ticketId: null,
    ticketInfo: null,
    loading: true,
    error: null
  },

  onLoad(options) {
    console.log('[课券详情] onLoad, options:', options);
    if (options.id) {
      this.setData({ ticketId: options.id });
      this.loadTicketDetail();
    } else {
      this.setData({
        loading: false,
        error: '缺少课券ID'
      });
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
    }
  },

  onShow() {
    // 如果已有数据，重新加载以确保数据最新
    if (this.data.ticketId && this.data.ticketInfo) {
      this.loadTicketDetail();
    }
  },

  async loadTicketDetail() {
    this.setData({ loading: true, error: null });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        return;
      }

      console.log('[课券详情] 加载课券详情，ticketId:', this.data.ticketId, 'userId:', userInfo.id);
      
      const res = await app.request({
        url: '/tickets/' + this.data.ticketId,
        method: 'GET',
        data: {
          user_id: userInfo.id
        }
      });

      console.log('[课券详情] API响应:', res);

      if (res && res.success && res.data) {
        const ticket = res.data;
        console.log('[课券详情] 课券数据:', ticket);
        console.log('[课券详情] discount_coupon_id:', ticket.discount_coupon_id);
        console.log('[课券详情] 优惠券信息:', ticket.coupon_info);
        console.log('[课券详情] coupon_info是否存在:', !!ticket.coupon_info);
        if (ticket.coupon_info) {
          console.log('[课券详情] coupon_info.amount:', ticket.coupon_info.amount);
        }
        
        this.setData({
          ticketInfo: ticket,
          loading: false
        });
      } else {
        const errorMsg = res && res.error ? res.error : '获取课券详情失败';
        console.error('[课券详情] API返回失败:', errorMsg);
        this.setData({
          loading: false,
          error: errorMsg
        });
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('[课券详情] 加载失败:', error);
      this.setData({
        loading: false,
        error: '加载失败：' + (error.message || '未知错误')
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 查看课程详情
  viewCourseDetail() {
    const courseInfo = this.data.ticketInfo && this.data.ticketInfo.course_info;
    if (courseInfo && courseInfo.course_id) {
      wx.navigateTo({
        url: '/pages/course-detail/course-detail?id=' + courseInfo.course_id
      });
    }
  },

  // 返回
  goBack() {
    wx.navigateBack();
  }
});

