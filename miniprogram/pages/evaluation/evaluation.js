// pages/evaluation/evaluation.js
const app = getApp();

Page({
  data: {
    pendingCourses: [],
    completedEvaluations: [],
    currentTab: 'pending',
    loading: false
  },

  onLoad(options) {
    // 如果从首页点击待评价课程进入，可以传递course_id参数
    if (options.course_id) {
      this.setData({ selectedCourseId: options.course_id });
    }
    this.loadEvaluations();
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadEvaluations();
  },

  async loadEvaluations() {
    console.log('[课程评价] 开始加载数据');
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
        console.log('[课程评价] 用户未登录');
        this.setData({ 
          pendingCourses: [],
          completedEvaluations: [],
          loading: false 
        });
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

      console.log('[课程评价] 请求参数:', { user_id: userInfo.id });
      // 加载待评价课程
      const pendingRes = await app.request({
        url: '/evaluations/pending',
        method: 'GET',
        data: { user_id: userInfo.id }
      });

      console.log('[课程评价] 待评价课程API响应:', pendingRes);
      const courses = pendingRes.data || [];
      console.log('待评价课程列表:', courses);
      
      // 格式化课程日期和时间段
      const formattedCourses = courses.map(course => {
        let formattedDate = course.schedule_date;
        let timeSlotText = '';
        
        // 格式化日期，只保留 YYYY-MM-DD 格式，去除时分秒
        if (course.schedule_date) {
          const dateStr = course.schedule_date;
          // 处理 ISO 8601 格式 (如: 2025-12-06T16:00:00.000Z)
          if (dateStr.includes('T')) {
            formattedDate = dateStr.split('T')[0];
          }
          // 处理普通日期时间格式 (如: 2025-12-06 16:00:00)
          else if (dateStr.includes(' ')) {
            formattedDate = dateStr.split(' ')[0];
          }
        }
        
        // 格式化时间段
        if (course.time_slot) {
          const timeSlot = course.time_slot.toString().toLowerCase().trim();
          if (timeSlot === 'morning') {
            timeSlotText = '上午';
          } else if (timeSlot === 'afternoon') {
            timeSlotText = '下午';
          } else if (timeSlot === 'full_day' || timeSlot === 'fullday') {
            timeSlotText = '全天';
          }
        }
        
        const dateDisplay = timeSlotText ? formattedDate + ' ' + timeSlotText : formattedDate;
        return Object.assign({}, course, {
          schedule_date: formattedDate,
          time_slot_text: timeSlotText,
          schedule_date_display: dateDisplay
        });
      });
      
      // 验证数据结构
      formattedCourses.forEach((course, index) => {
        console.log(`课程${index + 1}:`, {
          id: course.id,
          course_id: course.course_id,
          schedule_id: course.schedule_id,
          title: course.title,
          schedule_date: course.schedule_date,
          time_slot_text: course.time_slot_text,
          schedule_date_display: course.schedule_date_display
        });
      });

      // 加载已评价课程
      const completedRes = await app.request({
        url: '/evaluations/completed',
        method: 'GET',
        data: { user_id: userInfo.id }
      });

      console.log('已评价课程API响应:', completedRes);
      const completedList = completedRes.data || [];
      console.log('已评价课程列表:', completedList);

      console.log('[课程评价] 待评价课程数量:', formattedCourses.length);
      console.log('[课程评价] 已评价课程数量:', completedList.length);
      this.setData({
        pendingCourses: formattedCourses,
        completedEvaluations: completedList,
        loading: false
      });
    } catch (error) {
      console.error('[课程评价] 加载失败:', error);
      this.setData({ 
        pendingCourses: [],
        completedEvaluations: [],
        loading: false 
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none',
        duration: 2000
      });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadEvaluations();
  },

  // 开始评价课程
  startEvaluation(e) {
    // 从dataset中获取参数（更可靠的方式）
    const { courseId, scheduleId, bookingId, index } = e.currentTarget.dataset;
    
    console.log('开始评价，点击数据:', { courseId, scheduleId, bookingId, index });
    
    // 如果dataset中没有数据，尝试从pendingCourses中获取
    let courseIdFinal = courseId;
    let scheduleIdFinal = scheduleId;
    let bookingIdFinal = bookingId;
    
    if (!courseIdFinal || !scheduleIdFinal) {
      // 从pendingCourses数组中获取
      if (index !== undefined && this.data.pendingCourses[index]) {
        const course = this.data.pendingCourses[index];
        courseIdFinal = courseIdFinal || course.course_id;
        scheduleIdFinal = scheduleIdFinal || course.schedule_id;
        bookingIdFinal = bookingIdFinal || course.id;
        console.log('从数组获取数据:', { courseIdFinal, scheduleIdFinal, bookingIdFinal });
      }
    }
    
    // 验证必要参数
    if (!courseIdFinal || !scheduleIdFinal) {
      console.error('缺少必要参数:', {
        courseId: courseIdFinal,
        scheduleId: scheduleIdFinal,
        bookingId: bookingIdFinal,
        dataset: e.currentTarget.dataset,
        pendingCourses: this.data.pendingCourses
      });
      wx.showToast({
        title: '课程信息不完整',
        icon: 'none',
        duration: 3000
      });
      return;
    }
    
    // 确保参数是字符串或数字
    const courseIdStr = String(courseIdFinal);
    const scheduleIdStr = String(scheduleIdFinal);
    const bookingIdStr = bookingIdFinal ? String(bookingIdFinal) : '';
    
    console.log('跳转参数:', { courseIdStr, scheduleIdStr, bookingIdStr });
    
    // 构建URL，确保参数正确编码
    // 注意：路径必须与app.json中注册的路径完全一致
    let url = `/pages/evaluation/submit/submit?course_id=${encodeURIComponent(courseIdStr)}&schedule_id=${encodeURIComponent(scheduleIdStr)}`;
    if (bookingIdStr) {
      url += `&booking_id=${encodeURIComponent(bookingIdStr)}`;
    }
    
    console.log('跳转URL:', url);
    
    wx.navigateTo({
      url: url,
      success: () => {
        console.log('跳转成功');
      },
      fail: (err) => {
        console.error('跳转失败:', err);
        console.error('错误详情:', {
          errMsg: err.errMsg,
          url: url,
          courseId: courseIdStr,
          scheduleId: scheduleIdStr,
          bookingId: bookingIdStr
        });
        
        // 显示更详细的错误信息
        let errorMsg = '跳转失败，请重试';
        if (err.errMsg) {
          if (err.errMsg.includes('not found')) {
            errorMsg = '页面不存在，请检查配置';
          } else if (err.errMsg.includes('fail')) {
            errorMsg = '跳转失败，请重试';
          } else {
            errorMsg = err.errMsg;
          }
        }
        
        wx.showToast({
          title: errorMsg,
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  // 查看评价详情
  viewEvaluationDetail(e) {
    const { evaluationId } = e.currentTarget.dataset;
    
    if (!evaluationId) {
      console.error('缺少评价ID');
      wx.showToast({
        title: '评价信息不完整',
        icon: 'none'
      });
      return;
    }
    
    console.log('查看评价详情，评价ID:', evaluationId);
    
    wx.navigateTo({
      url: `/pages/evaluation/detail/detail?id=${encodeURIComponent(evaluationId)}`,
      success: () => {
        console.log('跳转到评价详情页成功');
      },
      fail: (err) => {
        console.error('跳转失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  }
});

