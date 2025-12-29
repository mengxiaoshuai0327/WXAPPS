// pages/instructor-evaluations/instructor-evaluations.js
const app = getApp();

Page({
  data: {
    courses: [],
    loading: false
  },

  onLoad() {
    this.loadInstructorCourses();
  },

  async loadInstructorCourses() {
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || userInfo.role !== 'instructor') {
        wx.showModal({
          title: '提示',
          content: '您不是教练',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
        return;
      }

      // 获取教练的课程评价列表（包含本期评分和近3期平均）
      const res = await app.request({
        url: '/evaluations/instructor/courses',
        method: 'GET',
        data: { instructor_id: userInfo.id }
      });

      console.log('教练课程评价API响应:', res);

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
      console.error('加载课程评价失败', error);
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

  viewCourseEvaluation(e) {
    const courseId = e.currentTarget.dataset.id;
    // 跳转到课程详情页面（显示统计数据和评价建议）
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${courseId}`
    });
  }
});
