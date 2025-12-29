// pages/promotion-detail/promotion-detail.js
const app = getApp();

Page({
  data: {
    type: '', // 'all', 'registered', 'purchased'
    title: '',
    invitations: [],
    loading: false,
    emptyText: '暂无数据'
  },

  onLoad(options) {
    const { type } = options;
    let title = '推广详情';
    
    if (type === 'all') {
      title = '总邀请人数';
      this.data.emptyText = '暂无邀请记录';
    } else if (type === 'registered') {
      title = '已注册用户';
      this.data.emptyText = '暂无已注册用户';
    } else if (type === 'purchased') {
      title = '已购券用户';
      this.data.emptyText = '暂无已购券用户';
    }
    
    wx.setNavigationBarTitle({ title });
    
    this.setData({
      type: type || 'all',
      title,
      emptyText: this.data.emptyText
    });
    
    this.loadInvitations();
  },

  async loadInvitations() {
    try {
      this.setData({ loading: true });
      
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

      // 构建查询参数
      const params = {
        inviter_id: userInfo.id
      };
      
      // 根据类型设置status参数
      if (this.data.type === 'registered') {
        params.status = 'registered';
      } else if (this.data.type === 'purchased') {
        params.status = 'purchased';
      }
      // type === 'all' 时不传status，获取所有

      const res = await app.request({
        url: '/invitations/list',
        method: 'GET',
        data: params
      });

      if (res.success) {
        // 格式化数据
        const invitations = (res.data || []).map(item => ({
          ...item,
          registered_at_formatted: item.registered_at ? this.formatDateTime(item.registered_at) : '-',
          purchased_at_formatted: item.purchased_at ? this.formatDateTime(item.purchased_at) : '-',
          created_at_formatted: item.created_at ? this.formatDateTime(item.created_at) : '-'
        }));
        
        this.setData({ invitations });
      } else {
        wx.showToast({
          title: res.error || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('[推广详情] 加载失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ loading: false });
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

  onPullDownRefresh() {
    this.loadInvitations().finally(() => {
      wx.stopPullDownRefresh();
    });
  }
});

