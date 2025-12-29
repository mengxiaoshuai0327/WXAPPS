// pages/ticket-gift/ticket-gift.js
const app = getApp();

Page({
  data: {
    unusedTickets: [],
    unusedCount: 0,
    purchasedCount: 0,
    selectedTicketId: null,
    receiverMemberId: '',
    giftMessage: '',
    giftHistory: [],
    loading: false,
    // 模块、主题和课程限制
    allThemes: [],
    allCourses: [],
    modules: [],
    themes: [],
    courses: [],
    moduleOptions: [{ id: null, name: '不限定' }],
    themeOptions: [{ id: null, name: '不限定' }],
    courseOptions: [{ id: null, name: '不限定' }],
    selectedModuleId: null,
    selectedThemeId: null,
    selectedCourseId: null,
    moduleIndex: 0,
    themeIndex: 0,
    courseIndex: 0,
    showRestrictions: false // 是否显示限制选项
  },

  onLoad() {
    this.loadTickets();
    this.loadGiftHistory();
    this.loadModulesAndThemes();
    this.loadCourses();
  },

  // 加载模块和主题列表
  async loadModulesAndThemes() {
    try {
      const res = await app.request({
        url: '/courses/themes',
        method: 'GET'
      });
      const allThemes = res.data || [];
      this.setData({ allThemes: allThemes });
      
      // 提取模块列表
      const moduleMap = new Map();
      allThemes.forEach(theme => {
        if (theme.module_id && theme.module_name) {
          if (!moduleMap.has(theme.module_id)) {
            moduleMap.set(theme.module_id, {
              id: theme.module_id,
              name: theme.module_name
            });
          }
        }
      });
      
      const modules = Array.from(moduleMap.values()).sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
      
      // 初始化主题选项（包含所有主题）
      const themeOptions = [{ id: null, name: '不限定' }, ...allThemes.map(t => ({
        id: t.id,
        name: t.name
      }))];
      
      this.setData({
        modules: modules,
        moduleOptions: [{ id: null, name: '不限定' }, ...modules],
        themeOptions: themeOptions
      });
    } catch (error) {
      console.error('加载模块和主题失败', error);
    }
  },

  // 模块选择改变
  onModuleChange(e) {
    const index = parseInt(e.detail.value);
    const selectedOption = this.data.moduleOptions[index];
    const moduleId = selectedOption ? selectedOption.id : null;
    
    this.setData({
      selectedModuleId: moduleId,
      moduleIndex: index,
      selectedThemeId: null, // 切换模块时清空主题选择
      themeIndex: 0,
      themeOptions: [{ id: null, name: '不限定' }]
    });
    
    // 如果选择了模块，加载该模块下的主题
    if (moduleId) {
      const themes = this.data.allThemes.filter(t => t.module_id === moduleId);
      const themeOptions = [{ id: null, name: '不限定' }, ...themes.map(t => ({
        id: t.id,
        name: t.name
      }))];
      this.setData({ themeOptions: themeOptions });
    } else {
      // 如果没有选择模块，显示所有主题
      const themeOptions = [{ id: null, name: '不限定' }, ...this.data.allThemes.map(t => ({
        id: t.id,
        name: t.name
      }))];
      this.setData({ themeOptions: themeOptions });
    }
  },

  // 主题选择改变
  onThemeChange(e) {
    const index = parseInt(e.detail.value);
    const selectedOption = this.data.themeOptions[index];
    const themeId = selectedOption ? selectedOption.id : null;
    
    this.setData({
      selectedThemeId: themeId,
      themeIndex: index,
      selectedCourseId: null, // 切换主题时清空课程选择
      courseIndex: 0
    });
    
    // 如果选择了主题，更新课程列表（只显示该主题下的课程）
    if (themeId) {
      const courses = this.data.allCourses.filter(c => c.theme_id === themeId);
      const courseOptions = [{ id: null, name: '不限定' }, ...courses.map(c => ({
        id: c.id,
        name: c.title || c.course_code
      }))];
      this.setData({ courseOptions: courseOptions });
    } else {
      // 如果没有选择主题，显示所有课程
      const courseOptions = [{ id: null, name: '不限定' }, ...this.data.allCourses.map(c => ({
        id: c.id,
        name: c.title || c.course_code
      }))];
      this.setData({ courseOptions: courseOptions });
    }
  },

  // 加载课程列表
  async loadCourses() {
    try {
      const res = await app.request({
        url: '/courses/list',
        method: 'GET'
      });
      if (res.success) {
        const courses = res.data || [];
        this.setData({ 
          allCourses: courses,
          courseOptions: [{ id: null, name: '不限定' }, ...courses.map(c => ({
            id: c.id,
            name: c.title || c.course_code
          }))]
        });
      }
    } catch (error) {
      console.error('加载课程列表失败', error);
    }
  },

  // 课程选择改变
  onCourseChange(e) {
    const index = parseInt(e.detail.value);
    const selectedOption = this.data.courseOptions[index];
    const courseId = selectedOption ? selectedOption.id : null;
    
    this.setData({
      selectedCourseId: courseId,
      courseIndex: index
    });
  },

  // 切换是否显示限制选项
  toggleRestrictions() {
    this.setData({
      showRestrictions: !this.data.showRestrictions
    });
  },

  async loadTickets() {
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

      // 获取未使用的课券
      const res = await app.request({
        url: '/tickets/list',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          status: 'unused'
        }
      });

      if (res.success) {
        const tickets = res.data || [];
        // 过滤掉不能赠予的课券：他人赠予的课券和授课奖励的课券不能再次转赠
        const giftableTickets = tickets.filter(t => t.source !== 'gift' && t.source !== 'instructor_reward');
        const purchasedTickets = giftableTickets.filter(t => t.source === 'purchase');
        
        const processedTickets = giftableTickets.map(ticket => {
          const sourceTexts = {
            'purchase': '自行购买',
            'gift': '他人赠予',
            'admin': '管理员发放',
            'instructor_reward': '授课奖励'
          };
          // 使用 Object.assign 替代扩展运算符
          return Object.assign({}, ticket, {
            source_text: sourceTexts[ticket.source] || ticket.source,
            created_at_formatted: this.formatDateTime(ticket.created_at || ticket.purchased_at)
          });
        });

        this.setData({
          unusedTickets: processedTickets,
          unusedCount: processedTickets.length,
          purchasedCount: purchasedTickets.length,
          loading: false
        });
      }
    } catch (error) {
      console.error('加载课券失败', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  async loadGiftHistory() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo) return;

      // 获取赠予历史（需要后端API支持）
      // 暂时使用课券列表中的已赠予课券
      const res = await app.request({
        url: '/tickets/list',
        method: 'GET',
        data: {
          user_id: userInfo.id,
          status: 'gifted'
        }
      });

      if (res.success) {
        const history = (res.data || []).map(ticket => {
          const statusTexts = {
            'waiting': '等待领取',
            'unused': '未使用',
            'booked': '已预订',
            'used': '已使用',
            'expired': '已过期'
          };
          // 使用 Object.assign 替代扩展运算符
          return Object.assign({}, ticket, {
            status_text: statusTexts[ticket.gift_status] || ticket.gift_status,
            gifted_at_formatted: this.formatDateTime(ticket.gifted_at)
          });
        });
        this.setData({ giftHistory: history });
      }
    } catch (error) {
      console.error('加载赠予历史失败', error);
    }
  },

  selectTicket(e) {
    const ticketId = e.currentTarget.dataset.id;
    this.setData({
      selectedTicketId: this.data.selectedTicketId === ticketId ? null : ticketId
    });
  },

  onMemberIdInput(e) {
    this.setData({ receiverMemberId: e.detail.value });
  },

  onMessageInput(e) {
    this.setData({ giftMessage: e.detail.value });
  },

  async giftTicket() {
    const { selectedTicketId, receiverMemberId, selectedModuleId, selectedThemeId, selectedCourseId } = this.data;

    if (!selectedTicketId) {
      wx.showToast({
        title: '请选择要赠予的课券',
        icon: 'none'
      });
      return;
    }

    if (!receiverMemberId || receiverMemberId.trim() === '') {
      wx.showToast({
        title: '请输入受赠人的会员编号',
        icon: 'none'
      });
      return;
    }

    // 构建确认信息
    let confirmContent = `确定要将课券赠予会员编号 ${receiverMemberId} 吗？`;
    if (selectedModuleId || selectedThemeId || selectedCourseId) {
      confirmContent += '\n\n限制条件：';
      if (selectedModuleId) {
        const module = this.data.moduleOptions.find(m => m.id === selectedModuleId);
        confirmContent += `\n- 限定模块：${module ? module.name : '未知'}`;
      }
      if (selectedThemeId) {
        const theme = this.data.themeOptions.find(t => t.id === selectedThemeId);
        confirmContent += `\n- 限定主题：${theme ? theme.name : '未知'}`;
      }
      if (selectedCourseId) {
        const course = this.data.courseOptions.find(c => c.id === selectedCourseId);
        confirmContent += `\n- 限定课程：${course ? course.name : '未知'}`;
      }
    } else {
      confirmContent += '\n\n无报课限制';
    }

    wx.showModal({
      title: '确认赠予',
      content: confirmContent,
      success: async (res) => {
        if (res.confirm) {
          try {
            const userInfo = app.globalData.userInfo;
            // 构建请求数据，确保正确处理 null 值
            const requestData = {
              ticket_id: selectedTicketId,
              giver_id: userInfo.id,
              receiver_member_id: receiverMemberId.trim(),
              message: this.data.giftMessage
            };
            
            // 只有当值不为 null 时才添加到请求中
            if (selectedModuleId) {
              requestData.restrict_module_id = selectedModuleId;
            }
            if (selectedThemeId) {
              requestData.restrict_theme_id = selectedThemeId;
            }
            if (selectedCourseId) {
              requestData.restrict_course_id = selectedCourseId;
            }

            const result = await app.request({
              url: '/tickets/gift',
              method: 'POST',
              data: requestData
            });

            if (result.success) {
              wx.showToast({
                title: '赠予成功',
                icon: 'success'
              });
              this.setData({
                selectedTicketId: null,
                receiverMemberId: '',
                giftMessage: '',
                selectedModuleId: null,
                selectedThemeId: null,
                selectedCourseId: null,
                moduleIndex: 0,
                themeIndex: 0,
                courseIndex: 0,
                showRestrictions: false
              });
              this.loadTickets();
              this.loadGiftHistory();
            }
          } catch (error) {
            console.error('赠予课券失败', error);
            wx.showToast({
              title: error.error || error.message || '赠予失败',
              icon: 'none',
              duration: 3000
            });
          }
        }
      }
    });
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
  }
});

