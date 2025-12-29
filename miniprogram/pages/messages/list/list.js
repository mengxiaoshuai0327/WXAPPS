// pages/messages/list/list.js
const app = getApp();

Page({
  data: {
    messages: [],
    loading: false
  },

  onLoad() {
    console.log('[消息列表] onLoad 触发');
    this.loadMessages();
  },

  onShow() {
    console.log('[消息列表] onShow 触发');
    this.loadMessages();
  },

  // 加载系统消息列表
  async loadMessages() {
    console.log('[消息列表] 开始加载消息');
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || userInfo.role === 'visitor') {
        console.log('[消息列表] 用户未登录或为游客');
        this.setData({ loading: false, messages: [] });
        wx.showModal({
          title: '提示',
          content: '请先登录成为会员',
          showCancel: false,
          success: function() {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        });
        return;
      }

      console.log('[消息列表] 请求参数:', { user_id: userInfo.id, limit: 100 });
      const res = await app.request({
        url: '/messages/list',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          limit: 100
        }
      });

      console.log('[消息列表] API响应:', res);
      if (res && res.success && res.data) {
        // 格式化时间 - 使用手动复制对象，避免扩展运算符
        const formattedMessages = [];
        for (let i = 0; i < res.data.length; i++) {
          const msg = res.data[i];
          formattedMessages.push({
            id: msg.id,
            title: msg.title || '',
            content: msg.content || '',
            created_at: msg.created_at || '',
          created_at_formatted: this.formatDateTime(msg.created_at)
          });
        }

        console.log('[消息列表] 格式化后的消息数量:', formattedMessages.length);
        this.setData({
          messages: formattedMessages,
          loading: false
        });
      } else {
        console.error('[消息列表] API返回失败:', res);
        this.setData({ 
          messages: [],
          loading: false 
        });
        wx.showToast({
          title: res ? (res.error || '加载失败') : '加载失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('[消息列表] 加载失败:', error);
      this.setData({ 
        messages: [],
        loading: false 
      });
      wx.showToast({
        title: error.error || error.message || '加载失败',
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 格式化日期时间
  formatDateTime(dateTime) {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = this.padZero(date.getMonth() + 1);
    const day = this.padZero(date.getDate());
    const hours = this.padZero(date.getHours());
    const minutes = this.padZero(date.getMinutes());
    const seconds = this.padZero(date.getSeconds());
    return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
  },
  
  // 补零函数（兼容 padStart）
  padZero(num) {
    const str = String(num);
    return str.length < 2 ? '0' + str : str;
  },

  // 查看消息详情
  viewMessageDetail(e) {
    const messageId = e.currentTarget.dataset.id;
    console.log('[消息列表] 查看消息详情，ID:', messageId);
    if (!messageId) {
      wx.showToast({
        title: '消息ID缺失',
        icon: 'none'
      });
      return;
    }
    wx.navigateTo({
      url: '/pages/messages/detail/detail?id=' + messageId,
      success: function() {
        console.log('[消息列表] 跳转成功');
      },
      fail: function(err) {
        console.error('[消息列表] 跳转失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  }
});
