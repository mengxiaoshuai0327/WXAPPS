// pages/course-intention/course-intention.js
const app = getApp();

Page({
  data: {
    themes: [],
    courses: [],
    instructors: [],
    selectedThemeIds: [],
    selectedCourseIds: [],
    otherCourses: '',
    preferredTime: '',
    preferredInstructorId: null,
    preferredInstructorName: '',
    preferredInstructorDisplayName: '请选择老师（可选）',
    loading: false,
    submitting: false
  },

  onLoad() {
    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      // 并行加载主题、课程和教练列表
      const results = await Promise.all([
        app.request({ url: '/courses/themes', method: 'GET' }),
        app.request({ url: '/courses/list', method: 'GET' })
      ]);
      const themesRes = results[0] || { data: [] };
      const coursesRes = results[1] || { data: [] };

      // 获取教练列表（使用课程接口来获取，避免权限问题）
      let instructorsRes = { data: [] };
      try {
        // 从课程列表中提取唯一的教练信息
        const instructorMap = new Map();
        if (coursesRes.data && coursesRes.data.length > 0) {
          coursesRes.data.forEach(course => {
            if (course.instructor_user_id && !instructorMap.has(course.instructor_user_id)) {
              instructorMap.set(course.instructor_user_id, {
                id: course.instructor_user_id,
                user_id: course.instructor_user_id,
                nickname: course.instructor_name,
                real_name: course.instructor_name
              });
            }
          });
        }
        instructorsRes.data = Array.from(instructorMap.values());
      } catch (error) {
        console.error('获取教练列表失败:', error);
      }

      const instructors = instructorsRes.data || [];
      
      // 为每个instructor添加显示用的属性
      const processedInstructors = instructors.map(inst => {
        return {
          id: inst.id,
          user_id: inst.user_id || inst.id,
          nickname: inst.nickname,
          real_name: inst.real_name,
          displayName: inst.nickname || inst.real_name || '未知老师'
        };
      });

      // 计算当前选择的instructor索引
      let preferredInstructorIndex = -1;
      if (this.data.preferredInstructorId) {
        preferredInstructorIndex = processedInstructors.findIndex(inst => 
          (inst.user_id || inst.id) === this.data.preferredInstructorId
        );
      }

      // 处理主题数据，添加 checked 属性
      const themes = (themesRes.data || []).map(theme => {
        return {
          id: theme.id,
          name: theme.name,
          description: theme.description,
          module_id: theme.module_id,
          module_name: theme.module_name,
          checked: this.data.selectedThemeIds.indexOf(theme.id) > -1
        };
      });

      // 处理课程数据，添加 checked 属性
      const courses = (coursesRes.data || []).map(course => {
        return {
          id: course.id,
          title: course.title,
          subtitle: course.subtitle,
          course_code: course.course_code,
          instructor_user_id: course.instructor_user_id,
          theme_name: course.theme_name,
          instructor_name: course.instructor_name,
          checked: this.data.selectedCourseIds.indexOf(course.id) > -1
        };
      });

      this.setData({
        themes: themes,
        courses: courses,
        instructors: processedInstructors,
        preferredInstructorIndex: preferredInstructorIndex,
        loading: false
      });
      
      // 更新显示名称
      this.updateInstructorDisplayName();
    } catch (error) {
      console.error('加载数据失败:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 切换主题选择状态
  toggleTheme(e) {
    const themeId = parseInt(e.currentTarget.dataset.id);
    const selectedThemeIds = this.data.selectedThemeIds.slice();
    const index = selectedThemeIds.indexOf(themeId);
    
    if (index > -1) {
      selectedThemeIds.splice(index, 1);
    } else {
      selectedThemeIds.push(themeId);
    }
    
    // 更新主题列表的 checked 状态
    const themes = this.data.themes.map(theme => {
      return {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        module_id: theme.module_id,
        module_name: theme.module_name,
        checked: selectedThemeIds.indexOf(theme.id) > -1
      };
    });
    
    this.setData({
      selectedThemeIds: selectedThemeIds,
      themes: themes
    });
  },

  // 选择主题（checkbox-group 事件）
  onThemeChange(e) {
    console.log('[课程意向] 主题选择变化:', e.detail);
    const value = e.detail.value || [];
    const themeIds = value.map(v => parseInt(v)).filter(id => !isNaN(id));
    console.log('[课程意向] 更新主题ID列表:', themeIds);
    
    // 更新主题列表的 checked 状态
    const themes = this.data.themes.map(theme => {
      return {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        module_id: theme.module_id,
        module_name: theme.module_name,
        checked: themeIds.indexOf(theme.id) > -1
      };
    });
    
    this.setData({
      selectedThemeIds: themeIds,
      themes: themes
    });
  },

  // 切换课程选择状态
  toggleCourse(e) {
    const courseId = parseInt(e.currentTarget.dataset.id);
    const selectedCourseIds = this.data.selectedCourseIds.slice();
    const index = selectedCourseIds.indexOf(courseId);
    
    if (index > -1) {
      selectedCourseIds.splice(index, 1);
    } else {
      selectedCourseIds.push(courseId);
    }
    
    // 更新课程列表的 checked 状态
    const courses = this.data.courses.map(course => {
      return {
        id: course.id,
        title: course.title,
        subtitle: course.subtitle,
        course_code: course.course_code,
        instructor_user_id: course.instructor_user_id,
        theme_name: course.theme_name,
        instructor_name: course.instructor_name,
        checked: selectedCourseIds.indexOf(course.id) > -1
      };
    });
    
    this.setData({
      selectedCourseIds: selectedCourseIds,
      courses: courses
    });
  },

  // 选择课程（checkbox-group 事件）
  onCourseChange(e) {
    console.log('[课程意向] 课程选择变化:', e.detail);
    const value = e.detail.value || [];
    const courseIds = value.map(v => parseInt(v)).filter(id => !isNaN(id));
    console.log('[课程意向] 更新课程ID列表:', courseIds);
    
    // 更新课程列表的 checked 状态
    const courses = this.data.courses.map(course => {
      return {
        id: course.id,
        title: course.title,
        subtitle: course.subtitle,
        course_code: course.course_code,
        instructor_user_id: course.instructor_user_id,
        theme_name: course.theme_name,
        instructor_name: course.instructor_name,
        checked: courseIds.indexOf(course.id) > -1
      };
    });
    
    this.setData({
      selectedCourseIds: courseIds,
      courses: courses
    });
  },

  // 输入其他课程
  onOtherCoursesInput(e) {
    this.setData({ otherCourses: e.detail.value });
  },

  // 输入期望时间
  onPreferredTimeInput(e) {
    this.setData({ preferredTime: e.detail.value });
  },

  // 选择意向老师
  onInstructorChange(e) {
    const index = parseInt(e.detail.value);
    const instructor = this.data.instructors[index];
    if (instructor) {
      // 选择现有老师时，清空自定义输入的老师姓名
      this.setData({
        preferredInstructorId: instructor.user_id || instructor.id,
        preferredInstructorName: '', // 清空其他老师输入框
        preferredInstructorDisplayName: instructor.displayName,
        preferredInstructorIndex: index
      });
    } else {
      // 如果选择的是"请选择"或无效选项
      this.setData({
        preferredInstructorId: null,
        preferredInstructorName: '', // 保持清空状态
        preferredInstructorDisplayName: '请选择老师（可选）',
        preferredInstructorIndex: -1
      });
    }
  },

  // 更新意向老师显示名称
  updateInstructorDisplayName() {
    const { preferredInstructorId, preferredInstructorIndex, instructors } = this.data;
    if (preferredInstructorId && preferredInstructorIndex >= 0 && instructors.length > preferredInstructorIndex) {
      const instructor = instructors[preferredInstructorIndex];
      this.setData({ 
        preferredInstructorDisplayName: instructor ? instructor.displayName : '请选择老师（可选）'
      });
    } else {
      this.setData({ preferredInstructorDisplayName: '请选择老师（可选）' });
    }
  },

  // 输入意向老师姓名（如果不在系统中）
  onInstructorNameInput(e) {
    const inputValue = e.detail.value || '';
    // 如果输入了自定义姓名，清空选择的老师ID和显示名称
    if (inputValue.trim()) {
      this.setData({
        preferredInstructorName: inputValue,
        preferredInstructorId: null, // 清空选中的老师ID
        preferredInstructorDisplayName: '请选择老师（可选）', // 重置显示名称
        preferredInstructorIndex: -1 // 重置索引
      });
    } else {
      // 如果输入框被清空，只更新输入值
      this.setData({ preferredInstructorName: inputValue });
    }
  },

  // 提交表单
  async submit() {
    const { selectedThemeIds, selectedCourseIds, otherCourses, preferredTime, preferredInstructorId, preferredInstructorName } = this.data;
    const userInfo = app.globalData.userInfo;

    if (!userInfo || !userInfo.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    // 验证：至少选择了一个主题或课程，或填写了其他课程
    if (selectedThemeIds.length === 0 && selectedCourseIds.length === 0 && !otherCourses) {
      wx.showToast({
        title: '请至少选择一个主题、课程或填写其他课程',
        icon: 'none'
      });
      return;
    }

    this.setData({ submitting: true });

    try {
      const res = await app.request({
        url: '/intentions',
        method: 'POST',
        data: {
          user_id: userInfo.id,
          selected_theme_ids: selectedThemeIds.length > 0 ? selectedThemeIds : null,
          selected_course_ids: selectedCourseIds.length > 0 ? selectedCourseIds : null,
          other_courses: otherCourses || null,
          preferred_time: preferredTime || null,
          preferred_instructor_id: preferredInstructorId || null,
          preferred_instructor_name: preferredInstructorName || null
        }
      });

      if (res.success) {
        wx.showToast({
          title: '提交成功',
          icon: 'success'
        });
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(res.error || '提交失败');
      }
    } catch (error) {
      console.error('提交课程意向失败:', error);
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});

