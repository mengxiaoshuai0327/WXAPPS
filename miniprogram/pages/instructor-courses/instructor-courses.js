// pages/instructor-courses/instructor-courses.js
const app = getApp();

Page({
  data: {
    currentTab: 'incomplete', // 'incomplete' 或 'completed'
    incompleteCourses: [],
    completedCourses: [],
    loading: false
  },

  onLoad() {
    console.log('[授课列表] 页面加载');
    // 初始化数据，确保页面能显示
    this.setData({
      currentTab: 'incomplete',
      incompleteCourses: [],
      completedCourses: [],
      loading: false
    });
    try {
      this.loadCourses();
    } catch (error) {
      console.error('[授课列表] 页面加载错误:', error);
      this.setData({ loading: false });
    }
  },

  onShow() {
    console.log('[授课列表] 页面显示');
    try {
      this.loadCourses();
    } catch (error) {
      console.error('[授课列表] 页面显示错误:', error);
    }
  },

  // 切换标签页
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  // 加载授课列表
  async loadCourses() {
    console.log('[授课列表] 开始加载数据');
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) {
        console.log('[授课列表] 用户未登录');
        this.setData({
          incompleteCourses: [],
          completedCourses: [],
          loading: false
        });
        return;
      }

      if (userInfo.role !== 'instructor') {
        console.log('[授课列表] 用户不是教练，role:', userInfo.role);
        // 不阻止页面显示，只是显示空列表
        this.setData({
          incompleteCourses: [],
          completedCourses: [],
          loading: false
        });
        return;
      }

      console.log('[授课列表] 获取授课列表，instructor_id:', userInfo.id);
      const res = await app.request({
        url: '/courses/instructor/schedules',
        method: 'GET',
        data: { instructor_id: userInfo.id }
      });

      console.log('[授课列表] API响应:', res);

      if (res.success) {
        const incomplete = res.data.incomplete || [];
        const completed = res.data.completed || [];
        
        // 处理日期显示：确保 date_time_text 格式正确
        const processCourses = (courses) => {
          return courses.map(course => {
            // 如果已经有 date_time_text 且格式正确（包含日期和时间段），直接使用
            if (course.date_time_text && course.date_time_text.match(/^\d{4}-\d{2}-\d{2}\s+(上午|下午|全天)\s+\d{2}:\d{2}-\d{2}:\d{2}$/)) {
              // 格式正确，直接使用，但确保 schedule_date 是字符串
              return {
                ...course,
                schedule_date: course.schedule_date ? String(course.schedule_date).split(' ')[0].split('T')[0] : ''
              };
            }
            
            // 格式化日期
            let dateTimeText = '';
            if (course.schedule_date) {
              const dateStr = String(course.schedule_date);
              // 处理各种日期格式
              if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // 已经是正确格式
                dateTimeText = dateStr;
              } else if (dateStr.includes('T')) {
                // ISO格式：2025-12-17T00:00:00.000Z
                dateTimeText = dateStr.split('T')[0];
              } else if (dateStr.includes(' ')) {
                // 日期时间格式：Wed Dec 17 2025 00:00:00 GM
                // 提取日期部分
                const parts = dateStr.split(' ');
                if (parts.length >= 3) {
                  // 尝试解析 Wed Dec 17 2025
                  const monthMap = {
                    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
                    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
                    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                  };
                  const month = monthMap[parts[1]];
                  const day = parts[2].padStart(2, '0');
                  const year = parts[3];
                  if (month && day && year) {
                    dateTimeText = `${year}-${month}-${day}`;
                  } else {
                    // 如果解析失败，尝试提取前10个字符（如果是日期字符串）
                    dateTimeText = dateStr.substring(0, 10);
                  }
                } else {
                  dateTimeText = dateStr.split(' ')[0];
                }
              } else {
                // 其他格式，尝试提取前10个字符
                dateTimeText = dateStr.substring(0, 10);
              }
            }
            
            // 格式化时间段和时间
            let timeText = '';
            if (course.time_slot) {
              const timeSlot = String(course.time_slot).toLowerCase().trim();
              if (timeSlot === 'morning') {
                timeText = '上午';
              } else if (timeSlot === 'afternoon') {
                timeText = '下午';
              } else if (timeSlot === 'full_day' || timeSlot === 'fullday') {
                timeText = '全天';
              }
            }
            
            // 添加时间范围
            if (course.start_time && course.end_time) {
              const start = String(course.start_time).substring(0, 5); // HH:mm
              const end = String(course.end_time).substring(0, 5); // HH:mm
              timeText += ` ${start}-${end}`;
            } else {
              // 默认时间
              if (course.time_slot === 'morning') {
                timeText += ' 09:00-12:00';
              } else if (course.time_slot === 'afternoon') {
                timeText += ' 14:00-17:00';
              } else {
                timeText += ' 09:00-17:00';
              }
            }
            
            return {
              ...course,
              date_time_text: `${dateTimeText} ${timeText}`.trim(),
              schedule_date: dateTimeText // 确保 schedule_date 是字符串格式
            };
          });
        };
        
        const processedIncomplete = processCourses(incomplete);
        const processedCompleted = processCourses(completed);
        
        console.log('[授课列表] 未完成课程数量:', processedIncomplete.length);
        console.log('[授课列表] 已完成课程数量:', processedCompleted.length);
        this.setData({
          incompleteCourses: processedIncomplete,
          completedCourses: processedCompleted,
          loading: false
        });
      } else {
        console.error('[授课列表] API返回失败:', res);
        this.setData({
          incompleteCourses: [],
          completedCourses: [],
          loading: false
        });
      }
    } catch (error) {
      console.error('[授课列表] 加载失败:', error);
      // 即使出错也显示页面，只是没有数据
      this.setData({
        incompleteCourses: [],
        completedCourses: [],
        loading: false
      });
      console.log('[授课列表] 错误已处理，页面可以正常显示');
    }
  },

  // 查看排课详情（所有课程都可以点击查看详情）
  viewScheduleDetail(e) {
    const scheduleId = e.currentTarget.dataset.id;
    
    if (scheduleId) {
      wx.navigateTo({
        url: `/pages/instructor-schedule-detail/instructor-schedule-detail?id=${scheduleId}`,
        success: () => {
          console.log('[授课列表] 跳转到排课详情页，scheduleId:', scheduleId);
        },
        fail: (err) => {
          console.error('[授课列表] 跳转失败:', err);
          wx.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    } else {
      console.error('[授课列表] 缺少排课ID');
      wx.showToast({
        title: '课程信息错误',
        icon: 'none'
      });
    }
  }
});

