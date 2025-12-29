// pages/protocol/protocol.js
const app = getApp();

Page({
  data: {
    type: 'user', // user 或 privacy
    title: '用户协议',
    content: '',
    loading: true
  },

  onLoad(options) {
    const type = options.type || 'user';
    this.setData({
      type,
      title: type === 'user' ? '用户协议' : '隐私条款'
    });
    this.loadContent();
  },

  async loadContent() {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: `/protocols/${this.data.type}`,
        method: 'GET'
      });

      if (res && res.success && res.data) {
        this.setData({
          content: res.data.content || '',
          title: res.data.title || this.data.title,
          loading: false
        });
      } else {
        throw new Error('获取协议内容失败');
      }
    } catch (error) {
      console.error('加载协议内容失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
      this.setData({
        loading: false,
        content: '加载失败，请稍后重试'
      });
    }
  }
});

