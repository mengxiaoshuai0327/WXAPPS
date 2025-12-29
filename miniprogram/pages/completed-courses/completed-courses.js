// pages/completed-courses/completed-courses.js
const app = getApp();

Page({
  data: {
    courses: [],
    loading: false,
    expandedCourses: {} // 记录展开的课程ID
  },

  onLoad() {
    this.loadCompletedCourses();
  },

  onShow() {
    this.loadCompletedCourses();
  },

  async loadCompletedCourses() {
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
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

      // 获取已上课程（使用专门的接口）
      const res = await app.request({
        url: '/courses/completed',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          limit: 100
        }
      });

      console.log('已上课程API响应:', res);

      if (res.success) {
        this.setData({
          courses: res.data || [],
          loading: false
        });
      } else {
        this.setData({ 
          courses: [],
          loading: false 
        });
      }
    } catch (error) {
      console.error('加载已上课程失败', error);
      this.setData({ 
        courses: [],
        loading: false 
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 切换课程展开/收起
  toggleCourse(e) {
    const bookingId = e.currentTarget.dataset.id;
    const expandedCourses = { ...this.data.expandedCourses };
    expandedCourses[bookingId] = !expandedCourses[bookingId];
    this.setData({ expandedCourses });
  },

  // 查看评价
  viewEvaluation(e) {
    const evaluationId = e.currentTarget.dataset.id;
    const scheduleId = e.currentTarget.dataset.scheduleId;
    const courseId = e.currentTarget.dataset.courseId;
    
    // 如果有评价ID，跳转到评价详情
    if (evaluationId) {
      wx.navigateTo({
        url: `/pages/evaluation/detail/detail?id=${evaluationId}`
      });
    } else {
      // 如果还没有评价，跳转到评价列表页面
      wx.navigateTo({
        url: '/pages/evaluation/evaluation'
      });
    }
  },

  // 查看课程详情
  viewCourseDetail(e) {
    const courseId = e.currentTarget.dataset.courseId;
    if (courseId) {
      wx.navigateTo({
        url: `/pages/course-detail/course-detail?id=${courseId}`
      });
    }
  }
});
