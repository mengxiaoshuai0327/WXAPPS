// pages/ticket-list/ticket-list.js
const app = getApp();

Page({
  data: {
    tickets: [],
    currentTab: 'unused', // unused, booked, used, expired, gifted
    loading: false
  },

  onLoad() {
    this.loadTickets();
  },

  async loadTickets() {
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      const res = await app.request({
        url: '/tickets/list',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          status: this.data.currentTab === 'all' ? null : this.data.currentTab
        }
      });

      if (res.success) {
        console.log('[课券列表] API响应成功，数据:', res.data);
        console.log('[课券列表] 当前标签页:', this.data.currentTab);
        // 调试：打印课券的详细信息
        if (res.data && res.data.length > 0) {
          res.data.forEach((ticket, index) => {
            if (this.data.currentTab === 'unused') {
              console.log(`[课券列表] 未使用课券${index + 1}:`, {
                ticket_id: ticket.id,
                ticket_code: ticket.ticket_code,
                purchased_at: ticket.purchased_at,
                purchased_at_formatted: ticket.purchased_at_formatted,
                start_date: ticket.start_date,
                expiry_date: ticket.expiry_date,
                expiry_date_range: ticket.expiry_date_range,
                created_at: ticket.created_at,
                source: ticket.source
              });
              
              // 检查数据完整性
              if (!ticket.purchased_at_formatted || ticket.purchased_at_formatted === '暂无购买时间') {
                console.warn(`[课券列表] 警告：课券${ticket.ticket_code}缺少购买时间`, {
                  purchased_at: ticket.purchased_at,
                  created_at: ticket.created_at
                });
              }
              if (!ticket.expiry_date_range || ticket.expiry_date_range === '暂无有效期') {
                console.warn(`[课券列表] 警告：课券${ticket.ticket_code}缺少有效期`, {
                  start_date: ticket.start_date,
                  expiry_date: ticket.expiry_date,
                  purchased_at: ticket.purchased_at
                });
              }
            } else if (this.data.currentTab === 'booked') {
              console.log(`[课券列表] 已预订课券${index + 1}:`, {
                ticket_code: ticket.ticket_code,
                course_title: ticket.course_title,
                course_date_time: ticket.course_date_time,
                booked_at_formatted: ticket.booked_at_formatted,
                booking_id: ticket.booking_id
              });
            }
          });
        } else {
          console.log('[课券列表] 没有课券数据');
        }
        this.setData({
          tickets: res.data || [],
          loading: false
        });
      } else {
        console.error('[课券列表] API返回失败:', res.error);
        this.setData({ loading: false });
      }
    } catch (error) {
      console.error('加载课券列表失败', error);
      this.setData({ loading: false });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadTickets();
  },

  // 查看课券详情
  viewTicketDetail(e) {
    const ticketId = e.currentTarget.dataset.id;
    console.log('[课券列表] 查看课券详情，ID:', ticketId);
    if (!ticketId) {
      wx.showToast({
        title: '课券ID缺失',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/ticket-detail/ticket-detail?id=' + ticketId,
      success: function() {
        console.log('[课券列表] 跳转成功');
      },
      fail: function(err) {
        console.error('[课券列表] 跳转失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  }
});

