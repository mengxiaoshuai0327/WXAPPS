// pages/course-detail/course-detail.js
const app = getApp();

Page({
  data: {
    courseId: null,
    courseInfo: null,
    statistics: null,
    feedbacks: [],
    loading: true,
    userRole: 'visitor', // 用户角色：visitor, member, instructor
    isChannelSales: false // 是否为渠道商销售
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ courseId: options.id });
      this.loadUserInfo();
      this.loadCourseDetail();
      this.loadCourseStatistics();
    }
  },

  onShow() {
    // 重新加载用户信息，确保角色正确
    this.loadUserInfo();
  },

  // 加载用户信息，判断角色
  loadUserInfo() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo) {
      const role = userInfo.role || 'visitor';
      const isChannelSales = role === 'member' && userInfo.channel_user_id !== null && userInfo.channel_user_id !== undefined;
      this.setData({
        userRole: role,
        isChannelSales: isChannelSales
      });
    } else {
      this.setData({
        userRole: 'visitor',
        isChannelSales: false
      });
    }
  },

  async loadCourseDetail() {
    try {
      const res = await app.request({
        url: `/courses/${this.data.courseId}`,
        method: 'GET'
      });
      
      if (res.success) {
        this.setData({
          courseInfo: res.data
        });
      }
    } catch (error) {
      console.error('加载课程详情失败', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  async loadCourseStatistics() {
    try {
      const res = await app.request({
        url: `/courses/${this.data.courseId}/statistics`,
        method: 'GET'
      });
      
      if (res.success && res.data) {
        const feedbacks = res.data.feedbacks || [];
        console.log('[课程详情] 加载的feedbacks:', feedbacks);
        console.log('[课程详情] feedbacks中每个项的id:', feedbacks.map(f => ({ id: f.id, user_name: f.user_name })));
        
        // 不再过滤，显示所有 feedbacks（即使没有 id，也能显示评价内容）
        // 在点击时才检查是否有 id
        this.setData({
          statistics: res.data,
          feedbacks: feedbacks,
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (error) {
      console.error('加载课程统计数据失败', error);
      this.setData({ loading: false });
      // 不显示错误提示，允许页面正常显示基本信息
    }
  },

  // 查看评价详情
  viewEvaluationDetail(e) {
    console.log('[课程详情] 点击查看评价详情', e);
    const dataset = e.currentTarget.dataset || {};
    const index = dataset.index;
    
    console.log('[课程详情] dataset:', dataset, 'index:', index);
    
    // 直接通过 index 从 feedbacks 数组获取 evaluationId（最可靠的方式）
    let evaluationId = null;
    
    console.log('[课程详情] feedbacks数组长度:', this.data.feedbacks ? this.data.feedbacks.length : 0);
    console.log('[课程详情] feedbacks数组内容:', JSON.stringify(this.data.feedbacks));
    
    if (index !== undefined && index !== null) {
      console.log('[课程详情] 尝试通过index获取, index:', index);
      if (this.data.feedbacks && this.data.feedbacks[index]) {
        const feedback = this.data.feedbacks[index];
        console.log('[课程详情] 找到feedback项:', JSON.stringify(feedback));
        evaluationId = feedback.id;
        console.log('[课程详情] 从数组获取 evaluationId:', evaluationId, '类型:', typeof evaluationId);
      } else {
        console.error('[课程详情] feedbacks[index] 不存在, index:', index, 'feedbacks长度:', this.data.feedbacks ? this.data.feedbacks.length : 0);
      }
    }
    
    // 如果 index 方式失败，尝试从 dataset.id 获取（备用方案）
    if (!evaluationId || evaluationId === '' || evaluationId === 'undefined') {
      evaluationId = dataset.id;
      console.log('[课程详情] 从dataset.id获取 evaluationId:', evaluationId);
    }
    
    // 转换为数字（如果是字符串且不为空）
    if (evaluationId && evaluationId !== '' && evaluationId !== 'undefined') {
      const parsedId = parseInt(evaluationId);
      if (!isNaN(parsedId)) {
        evaluationId = parsedId;
      }
    } else {
      evaluationId = null;
    }
    
    console.log('[课程详情] 最终 evaluationId:', evaluationId, '类型:', typeof evaluationId);
    
    if (!evaluationId || isNaN(evaluationId)) {
      console.error('[课程详情] 评价ID无效');
      console.error('[课程详情] dataset:', JSON.stringify(dataset));
      console.error('[课程详情] index:', index);
      console.error('[课程详情] feedbacks完整数据:', JSON.stringify(this.data.feedbacks));
      wx.showToast({
        title: '评价ID不存在',
        icon: 'none'
      });
      return;
    }

    // 检查用户角色：只有会员、教练、渠道商销售可以查看评价详情
    const userRole = this.data.userRole;
    const isChannelSales = this.data.isChannelSales;
    
    console.log('[课程详情] 用户角色:', userRole, 'isChannelSales:', isChannelSales);
    
    if (userRole === 'visitor' || (userRole !== 'member' && userRole !== 'instructor' && !isChannelSales)) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false,
        success: () => {
          // 可以跳转到登录页面或首页
        }
      });
      return;
    }

    console.log('[课程详情] 跳转到评价详情页面，id:', evaluationId);
    // 跳转到评价详情页面
    wx.navigateTo({
      url: `/pages/evaluation/detail/detail?id=${evaluationId}`,
      fail: (err) => {
        console.error('[课程详情] 跳转失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  }
});

