// pages/messages/detail/detail.js
const app = getApp();

Page({
  data: {
    message: {
      id: null,
      title: '',
      content: '',
      created_at_formatted: ''
    },
    loading: false
  },

  onLoad(options) {
    const { id } = options;
    if (id) {
      this.loadMessageDetail(id);
      // 标记消息为已读
      this.markAsRead(id);
    } else {
      wx.showToast({
        title: '消息ID缺失',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onUnload() {
    // 页面卸载时，通知首页刷新消息列表
    const pages = getCurrentPages();
    if (pages.length > 1) {
      const prevPage = pages[pages.length - 2];
      if (prevPage && prevPage.loadSystemMessages) {
        prevPage.loadSystemMessages();
      }
    }
  },

  // 加载消息详情
  async loadMessageDetail(messageId) {
    console.log('[消息详情] 开始加载，messageId:', messageId);
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
        console.log('[消息详情] 用户未登录');
        this.setData({ loading: false });
        wx.showModal({
          title: '提示',
          content: '请先登录',
          showCancel: false,
          success: function() {
            wx.switchTab({
              url: '/pages/index/index'
            });
          }
        });
        return;
      }

      console.log('[消息详情] 请求参数:', { user_id: userInfo.id, limit: 100 });
      // 从消息列表中获取消息详情
      const res = await app.request({
        url: '/messages/list',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          limit: 100
        }
      });

      console.log('[消息详情] API响应:', res);
      if (res && res.success && res.data) {
        const messageList = res.data || [];
        console.log('[消息详情] 消息列表数量:', messageList.length);
        
        let message = null;
        for (let i = 0; i < messageList.length; i++) {
          if (messageList[i].id == messageId) {
            message = messageList[i];
            break;
          }
        }
        
        if (message) {
          console.log('[消息详情] 找到消息:', message);
          // 使用手动复制对象，避免 Object.assign 可能的问题
          const formattedMessage = {
            id: message.id,
            title: message.title || '',
            content: message.content || '',
            created_at: message.created_at || '',
            created_at_formatted: this.formatDateTime(message.created_at)
          };
          this.setData({
            message: formattedMessage,
            loading: false
          });
          console.log('[消息详情] 数据设置完成');
        } else {
          console.error('[消息详情] 消息不存在，messageId:', messageId);
          this.setData({ 
            message: { id: null, title: '', content: '', created_at_formatted: '' },
            loading: false 
          });
          wx.showToast({
            title: '消息不存在',
            icon: 'none',
            duration: 2000
          });
        }
      } else {
        console.error('[消息详情] API返回失败:', res);
        this.setData({ 
          message: { id: null, title: '', content: '', created_at_formatted: '' },
          loading: false 
        });
        wx.showToast({
          title: res ? (res.error || '加载失败') : '加载失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('[消息详情] 加载失败:', error);
      this.setData({ 
        message: { id: null, title: '', content: '', created_at_formatted: '' },
        loading: false 
      });
      wx.showToast({
        title: error.error || error.message || '加载失败',
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 标记消息为已读
  async markAsRead(messageId) {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) return;

      await app.request({
        url: '/messages/read',
        method: 'POST',
        data: {
          message_id: messageId,
          user_id: userInfo.id
        }
      });
    } catch (error) {
      console.error('标记已读失败', error);
      // 静默失败，不影响用户体验
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
  }
});


