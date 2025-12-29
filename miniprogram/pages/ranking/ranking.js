// pages/ranking/ranking.js
const app = getApp();

Page({
  data: {
    currentTab: 'instructor_schedule', // instructor_schedule, member_study, theme, course, instructor
    timeRange: 'all', // month, quarter, all
    rankings: {
      instructor_schedule: [],
      member_study: [],
      theme: [],
      course: [],
      instructor: []
    },
    loading: false,
    showThemeDetail: false, // 是否显示主题详情弹窗
    themeDetail: {
      theme_name: '',
      schedule_count: 0,
      courses: [], // 课程列表
      instructors: []
    },
    loadingDetail: false
  },

  onLoad() {
    // 检查用户角色，如果是渠道方，跳转到【我的】页面
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo && userInfo.role === 'channel') {
      wx.switchTab({
        url: '/pages/profile/profile'
      });
      return;
    }
    
    this.loadRankings();
  },

  onShow() {
    // 检查用户角色，如果是渠道方，跳转到【我的】页面
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo && userInfo.role === 'channel') {
      wx.switchTab({
        url: '/pages/profile/profile'
      });
      return;
    }
    
    // 如果已经在页面中，刷新数据
    if (this.data.currentTab) {
      this.loadRankings();
    }
  },

  // 切换排行榜类型
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadRankings();
  },

  // 切换时间范围
  switchTimeRange(e) {
    const range = e.currentTarget.dataset.range;
    this.setData({ timeRange: range });
    this.loadRankings();
  },

  // 加载排行榜
  async loadRankings() {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: `/rankings/${this.data.currentTab}`,
        method: 'GET',
        data: { time_range: this.data.timeRange }
      });

      console.log('排行榜API响应:', res);
      console.log('当前Tab:', this.data.currentTab);
      console.log('返回数据:', res.data);

      const rankings = Object.assign({}, this.data.rankings);
      const data = (res.data || []).map(item => {
        // 处理头像文本（取第一个字符）
        const name = item.data?.name || item.data?.title || '未';
        item.data = item.data || {};
        item.data.avatarText = name.charAt(0);
        return item;
      });
      rankings[this.data.currentTab] = data;
      
      console.log('更新后的rankings:', rankings);
      
      this.setData({ 
        rankings: rankings,
        loading: false
      });
    } catch (error) {
      console.error('加载排行榜失败', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
      this.setData({ loading: false });
    }
  },

  // 查看详情
  viewDetail(e) {
    const { type, id } = e.currentTarget.dataset;
    console.log('查看详情:', type, id);
    // 根据类型跳转到不同页面
    if (type === 'course' || type === 'instructor_schedule') {
      // 课程详情或排课榜（按课程统计）
      wx.navigateTo({
        url: `/pages/course-detail/course-detail?id=${id}`
      });
    } else if (type === 'instructor') {
      // 教练详情
      wx.navigateTo({
        url: `/pages/instructor-detail/instructor-detail?id=${id}`
      });
    } else if (type === 'theme') {
      // 主题详情：显示弹窗展示排课统计和教练信息
      this.loadThemeDetail(id);
    }
  },

  // 加载主题详情
  async loadThemeDetail(themeId) {
    this.setData({ loadingDetail: true, showThemeDetail: true });
    try {
      const res = await app.request({
        url: `/rankings/theme/${themeId}/detail`,
        method: 'GET',
        data: { time_range: this.data.timeRange }
      });

      if (res && res.success && res.data) {
        this.setData({
          themeDetail: {
            theme_name: res.data.theme_name || '未知主题',
            schedule_count: res.data.schedule_count || 0,
            courses: res.data.courses || [],
            instructors: res.data.instructors || []
          },
          loadingDetail: false
        });
      } else {
        throw new Error('获取主题详情失败');
      }
    } catch (error) {
      console.error('加载主题详情失败', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
      this.setData({ 
        loadingDetail: false,
        showThemeDetail: false
      });
    }
  },

  // 关闭主题详情弹窗
  closeThemeDetail() {
    this.setData({ showThemeDetail: false });
  },

  // 获取排行榜标题
  getRankingTitle(tab) {
    const titles = {
      'instructor_schedule': '排课数量',
      'member_invite': '邀请数量',
      'member_study': '学习次数',
      'theme': '主题榜',
      'course': '评价榜',
      'instructor': '教练榜'
    };
    return titles[tab] || '排行榜';
  }
});

