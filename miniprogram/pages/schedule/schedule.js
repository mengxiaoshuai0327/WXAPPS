// pages/schedule/schedule.js
const app = getApp();

Page({
  data: {
    allThemes: [], // 存储所有主题（用于提取模块）
    modules: [],
    themes: [],
    moduleOptions: [{ id: null, name: '全部' }], // 包含"全部"选项
    themeOptions: [{ id: null, name: '全部' }], // 包含"全部"选项
    moduleIndex: 0,
    themeIndex: 0,
    selectedModule: null,
    selectedTheme: null,
    selectedModuleName: '全部',
    selectedThemeName: '全部',
    selectedYearMonth: null, // 年月格式：YYYY-MM
    selectedDate: null, // 保留用于向后兼容
    dateRange: [[], []], // 年月选项：[年份数组, 月份数组]
    dateIndex: [0, 0], // 年月索引
    schedules: [],
    loading: false,
    userRole: 'visitor', // 用户角色：visitor/member/instructor
    isChannelSales: false // 是否为渠道销售
  },

  async onLoad(options) {
    // 检查用户角色，如果是渠道方，跳转到【我的】页面
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo && userInfo.role === 'channel') {
      wx.switchTab({
        url: '/pages/profile/profile'
      });
      return;
    }
    
    // 获取用户角色信息
    const userRole = userInfo ? (userInfo.role || 'visitor') : 'visitor';
    const isChannelSales = userInfo ? (userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name)) : false;
    this.setData({
      userRole: userRole,
      isChannelSales: isChannelSales
    });
    
    // 检查全局变量是否有选择的模块ID（从首页跳转过来）
    let presetModuleId = null;
    if (app.globalData.selectedModuleId) {
      presetModuleId = parseInt(app.globalData.selectedModuleId);
      this.setData({ selectedModule: presetModuleId });
      // 清空全局变量，避免下次进入页面时还使用
      app.globalData.selectedModuleId = null;
    }
    
    // 检查全局变量是否有选择的主题ID（从排行榜跳转过来）
    let presetThemeId = null;
    if (app.globalData.selectedThemeId) {
      presetThemeId = parseInt(app.globalData.selectedThemeId);
      // 清空全局变量，避免下次进入页面时还使用
      app.globalData.selectedThemeId = null;
    }
    
    // 初始化年月选项
    this.initDateRange();
    
    // 先加载所有主题（用于提取模块列表）
    await this.loadAllThemes();
    // 从主题列表中提取模块
    await this.loadModules();
    // 如果预设了模块ID，需要重新设置索引和名称
    if (presetModuleId !== null) {
      const index = this.data.moduleOptions.findIndex(m => m.id === presetModuleId);
      if (index > -1) {
        this.setData({ 
          moduleIndex: index,
          selectedModuleName: this.data.moduleOptions[index].name
        });
      }
    }
    
    // 加载主题列表（根据选择的模块筛选）
    await this.loadThemes();
    
    // 如果预设了主题ID，需要设置主题选择
    if (presetThemeId !== null) {
      // 找到主题所在的模块（如果有）
      const theme = this.data.allThemes.find(t => t.id === presetThemeId);
      if (theme) {
        // 如果主题有模块ID，且当前没有选择模块，则选择该模块
        if (theme.module_id && this.data.selectedModule === null) {
          const moduleIndex = this.data.moduleOptions.findIndex(m => m.id === theme.module_id);
          if (moduleIndex > -1) {
            this.setData({ 
              selectedModule: theme.module_id,
              moduleIndex: moduleIndex,
              selectedModuleName: this.data.moduleOptions[moduleIndex].name
            });
            // 重新加载主题列表（根据模块筛选）
            await this.loadThemes();
          }
        }
        
        // 设置主题选择
        this.setData({ selectedTheme: presetThemeId });
        // 更新主题索引
        const themeIndex = this.data.themeOptions.findIndex(t => t.id === presetThemeId);
        if (themeIndex > -1) {
          this.setData({ themeIndex: themeIndex });
          // 更新显示的主题名称
          this.updateSelectedThemeName();
        }
      }
    }
    
    await this.loadSchedules();
  },

  async onShow() {
    // 检查用户角色，如果是渠道方，跳转到【我的】页面
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo && userInfo.role === 'channel') {
      wx.switchTab({
        url: '/pages/profile/profile'
      });
      return;
    }
    
    // 更新用户角色信息
    const userRole = userInfo ? (userInfo.role || 'visitor') : 'visitor';
    const isChannelSales = userInfo ? (userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name)) : false;
    this.setData({
      userRole: userRole,
      isChannelSales: isChannelSales
    });
    
    // 确保年月选项已初始化
    if (!this.data.dateRange || this.data.dateRange[0].length === 0) {
      this.initDateRange();
    }
    
    // 检查全局变量是否有选择的主题ID（从排行榜跳转过来）
    if (app.globalData.selectedThemeId) {
      const themeId = parseInt(app.globalData.selectedThemeId);
      // 清空全局变量，避免下次进入页面时还使用
      app.globalData.selectedThemeId = null;
      
      // 重新加载所有主题（如果还没有加载）
      if (!this.data.allThemes || this.data.allThemes.length === 0) {
        await this.loadAllThemes();
        await this.loadModules();
        await this.loadThemes();
      }
      
      // 找到主题所在的模块（如果有）
      const theme = this.data.allThemes.find(t => t.id === themeId);
      if (theme) {
        // 如果主题有模块ID，且当前没有选择模块，则选择该模块
        if (theme.module_id && this.data.selectedModule === null) {
          const moduleIndex = this.data.moduleOptions.findIndex(m => m.id === theme.module_id);
          if (moduleIndex > -1) {
            this.setData({ 
              selectedModule: theme.module_id,
              moduleIndex: moduleIndex,
              selectedModuleName: this.data.moduleOptions[moduleIndex].name
            });
            // 重新加载主题列表（根据模块筛选）
            await this.loadThemes();
          }
        }
        
        // 设置主题选择
        this.setData({ selectedTheme: themeId });
        // 更新主题索引
        const themeIndex = this.data.themeOptions.findIndex(t => t.id === themeId);
        if (themeIndex > -1) {
          this.setData({ themeIndex: themeIndex });
          // 更新显示的主题名称
          this.updateSelectedThemeName();
        }
      }
      
      await this.loadSchedules();
      return;
    }
    
    // 检查全局变量是否有选择的模块ID（从首页跳转过来）
    if (app.globalData.selectedModuleId) {
      const moduleId = parseInt(app.globalData.selectedModuleId);
      this.setData({ selectedModule: moduleId });
      // 清空全局变量，避免下次进入页面时还使用
      app.globalData.selectedModuleId = null;
      // 重新加载所有主题
      await this.loadAllThemes();
      // 从主题中提取模块
      await this.loadModules();
      // 设置模块索引和名称
      const index = this.data.moduleOptions.findIndex(m => m.id === moduleId);
      if (index > -1) {
        this.setData({ 
          moduleIndex: index,
          selectedModuleName: this.data.moduleOptions[index].name
        });
      }
      // 加载主题列表
      await this.loadThemes();
      await this.loadSchedules();
    } else {
      // 页面显示时重新加载数据，确保数据最新
      this.loadSchedules();
    }
  },

  // 加载所有主题（用于提取模块列表）
  async loadAllThemes() {
    try {
      const res = await app.request({
        url: '/courses/themes',
        method: 'GET'
      });
      const allThemes = res.data || [];
      this.setData({ allThemes: allThemes });
    } catch (error) {
      console.error('加载所有主题失败', error);
      this.setData({ allThemes: [] });
    }
  },

  // 加载模块列表（从所有主题列表中提取唯一的模块）
  async loadModules() {
    try {
      // 从已加载的所有主题列表中提取唯一的模块（使用管理员后台主题列表中的所属模块列）
      const themes = this.data.allThemes || [];
      const moduleMap = new Map();
      
      themes.forEach(theme => {
        if (theme.module_id && theme.module_name) {
          if (!moduleMap.has(theme.module_id)) {
            moduleMap.set(theme.module_id, {
              id: theme.module_id,
              name: theme.module_name
            });
          }
        }
      });
      
      // 转换为数组并按名称排序
      const modules = Array.from(moduleMap.values()).sort((a, b) => {
        return a.name.localeCompare(b.name);
      });
      
      // 构建选项数组，包含"全部"选项
      const moduleOptions = [{ id: null, name: '全部' }, ...modules];
      
      // 根据当前选择的模块ID找到索引
      let moduleIndex = 0;
      if (this.data.selectedModule !== null) {
        const index = moduleOptions.findIndex(m => m.id === this.data.selectedModule);
        if (index > -1) {
          moduleIndex = index;
        }
      }
      
      this.setData({ 
        modules: modules,
        moduleOptions: moduleOptions,
        moduleIndex: moduleIndex
      });
      
      // 更新显示的模块名称
      this.updateSelectedModuleName();
    } catch (error) {
      console.error('加载模块失败', error);
      this.setData({ 
        modules: [],
        moduleOptions: [{ id: null, name: '全部' }],
        moduleIndex: 0
      });
    }
  },

  // 加载主题列表（使用管理员后台主题列表中的主题名称列）
  async loadThemes() {
    try {
      // 从已加载的所有主题中筛选（如果选择了模块，只显示该模块下的主题）
      let themes = this.data.allThemes || [];
      
      if (this.data.selectedModule) {
        themes = themes.filter(t => t.module_id === this.data.selectedModule);
      }
      
      // 构建选项数组，包含"全部"选项（使用主题名称，即name字段）
      const themeOptions = [{ id: null, name: '全部' }, ...themes.map(t => ({
        id: t.id,
        name: t.name // 使用管理员后台主题列表中的主题名称列
      }))];
      
      // 如果选择了模块，且之前选择的主题不在新列表中，清空主题选择
      let themeIndex = 0;
      let selectedTheme = this.data.selectedTheme;
      if (this.data.selectedModule && this.data.selectedTheme) {
        const themeExists = themes.some(t => t.id === this.data.selectedTheme);
        if (!themeExists) {
          selectedTheme = null;
        }
      }
      
      // 根据当前选择的主题ID找到索引
      if (selectedTheme !== null) {
        const index = themeOptions.findIndex(t => t.id === selectedTheme);
        if (index > -1) {
          themeIndex = index;
        }
      }
      
      this.setData({ 
        themes: themes,
        themeOptions: themeOptions,
        themeIndex: themeIndex,
        selectedTheme: selectedTheme
      });
      
      // 更新显示的主题名称
      this.updateSelectedThemeName();
    } catch (error) {
      console.error('加载主题失败', error);
      this.setData({ 
        themes: [],
        themeOptions: [{ id: null, name: '全部' }],
        themeIndex: 0
      });
    }
  },

  // 加载课程表
  async loadSchedules() {
    console.log('[课程表] 开始加载数据');
    this.setData({ loading: true });
    try {
      const userInfo = app.globalData.userInfo;
      console.log('[课程表] 请求参数:', {
        module_id: this.data.selectedModule,
        theme_id: this.data.selectedTheme,
        year_month: this.data.selectedYearMonth,
        user_id: userInfo ? userInfo.id : null
      });
      
      // 使用年月进行筛选（格式：YYYY-MM）
      const dateParam = this.data.selectedYearMonth || null;
      
      const res = await app.request({
        url: '/courses/schedule',
        method: 'GET',
        data: {
          module_id: this.data.selectedModule || null,
          theme_id: this.data.selectedTheme || null,
          year_month: dateParam, // 传递年月参数
          date: null, // 不再使用精确日期
          user_id: userInfo ? userInfo.id : null
        }
      });
      
      console.log('[课程表] API响应:', res);
      
      if (res && res.success) {
        const schedulesData = res.data || [];
        const schedulesArray = Array.isArray(schedulesData) ? schedulesData : [];
        
        // 调试：打印第一个课程的状态信息
        if (schedulesArray.length > 0) {
          console.log('[课程表] 第一个课程状态:', {
            id: schedulesArray[0].id,
            title: schedulesArray[0].title,
            is_in_progress: schedulesArray[0].is_in_progress,
            is_started: schedulesArray[0].is_started,
            is_past: schedulesArray[0].is_past,
            date_time_text: schedulesArray[0].date_time_text,
            has_booking: schedulesArray[0].has_booking,
            can_book: schedulesArray[0].can_book,
            booking_id: schedulesArray[0].booking_id,
            can_cancel: schedulesArray[0].can_cancel
          });
        }
        
        console.log('[课程表] 加载成功，课程数量:', schedulesArray.length);
        this.setData({ 
          schedules: schedulesArray,
          loading: false
        });
      } else {
        console.warn('[课程表] 响应格式异常或失败:', res);
        this.setData({ 
          schedules: [],
          loading: false
        });
      }
    } catch (error) {
      console.error('[课程表] 加载失败:', error);
      this.setData({ 
        schedules: [],
        loading: false 
      });
      let errorMsg = '加载课程表失败';
      if (error.message) {
        if (error.message.includes('timeout')) {
          errorMsg = '请求超时，请检查网络连接或稍后重试';
        } else if (error.message.includes('fail')) {
          errorMsg = '网络连接失败，请检查后端服务是否运行';
        } else {
          errorMsg = error.message;
        }
      } else if (error.error) {
        errorMsg = error.error;
      }
      console.error('[课程表] 错误信息:', errorMsg);
      wx.showToast({
        title: errorMsg,
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 模块选择改变
  onModuleChange(e) {
    const index = parseInt(e.detail.value);
    const selectedOption = this.data.moduleOptions[index];
    const moduleId = selectedOption ? selectedOption.id : null;
    const moduleName = selectedOption ? selectedOption.name : '全部';
    
    this.setData({ 
      selectedModule: moduleId,
      moduleIndex: index,
      selectedModuleName: moduleName,
      selectedTheme: null, // 切换模块时清空主题选择
      themeIndex: 0,
      selectedThemeName: '全部'
    });
    
    // 重新加载主题列表和课程表
    this.loadThemes();
    this.loadSchedules();
  },

  // 主题选择改变
  onThemeChange(e) {
    const index = parseInt(e.detail.value);
    const selectedOption = this.data.themeOptions[index];
    const themeId = selectedOption ? selectedOption.id : null;
    const themeName = selectedOption ? selectedOption.name : '全部';
    
    this.setData({ 
      selectedTheme: themeId,
      themeIndex: index,
      selectedThemeName: themeName
    });
    
    this.loadSchedules();
  },

  // 更新显示的模块名称
  updateSelectedModuleName() {
    const selectedOption = this.data.moduleOptions.find(m => m.id === this.data.selectedModule);
    const moduleName = selectedOption ? selectedOption.name : '全部';
    this.setData({ selectedModuleName: moduleName });
  },

  // 更新显示的主题名称
  updateSelectedThemeName() {
    const selectedOption = this.data.themeOptions.find(t => t.id === this.data.selectedTheme);
    const themeName = selectedOption ? selectedOption.name : '全部';
    this.setData({ selectedThemeName: themeName });
  },

  // 初始化年月选项
  initDateRange() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    // 生成年份选项（当前年份往前5年，往后2年）
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 2; i++) {
      years.push(i.toString());
    }
    
    // 生成月份选项（1-12月）
    const months = [];
    for (let i = 1; i <= 12; i++) {
      months.push(i.toString().padStart(2, '0'));
    }
    
    // 如果已选择年月，找到对应的索引
    let yearIndex = years.indexOf(currentYear.toString());
    let monthIndex = months.indexOf(currentMonth.toString().padStart(2, '0'));
    if (yearIndex === -1) yearIndex = 0;
    if (monthIndex === -1) monthIndex = 0;
    
    this.setData({
      dateRange: [years, months],
      dateIndex: [yearIndex, monthIndex]
    });
  },

  // 年月选择改变
  onDateChange(e) {
    const values = e.detail.value;
    const yearIndex = values[0];
    const monthIndex = values[1];
    
    const years = this.data.dateRange[0];
    const months = this.data.dateRange[1];
    
    const year = years[yearIndex];
    const month = months[monthIndex];
    
    // 格式化为 YYYY-MM
    const yearMonth = `${year}-${month}`;
    
    this.setData({
      dateIndex: [yearIndex, monthIndex],
      selectedYearMonth: yearMonth,
      selectedDate: yearMonth + '-01' // 向后兼容，设置为该月第一天
    });
    
    this.loadSchedules();
  },

  // 预订课程
  async bookCourse(e) {
    const scheduleId = e.currentTarget.dataset.id;
    const userInfo = app.globalData.userInfo;

    if (!userInfo || userInfo.role === 'visitor') {
      wx.showModal({
        title: '提示',
        content: '预订课程需要先注册成为会员，是否前往注册？',
        confirmText: '去注册',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/register/register'
            });
          }
        }
      });
      return;
    }

    wx.showModal({
      title: '确认预订',
      content: '确定要预订该课程吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await app.request({
              url: '/courses/book',
              method: 'POST',
              data: {
                user_id: userInfo.id,
                schedule_id: scheduleId
              }
            });

            if (result.success) {
              console.log('[课程表] ========== 预订成功开始 ==========');
              console.log('[课程表] 完整返回数据:', JSON.stringify(result, null, 2));
              console.log('[课程表] result.questionnaire_url:', result.questionnaire_url);
              console.log('[课程表] result.data?.questionnaire_url:', result.data?.questionnaire_url);
              
              // 获取问卷链接（尝试多种可能的路径）
              const questionnaireUrl = result.questionnaire_url || result.data?.questionnaire_url || null;
              console.log('[课程表] 最终获取的问卷链接:', questionnaireUrl);
              console.log('[课程表] 问卷链接类型:', typeof questionnaireUrl);
              console.log('[课程表] 问卷链接是否为null:', questionnaireUrl === null);
              console.log('[课程表] 问卷链接是否为空字符串:', questionnaireUrl === '');
              
              // 显示预订成功提示，并提醒取消规则和课前问卷
              // 始终显示取消规则提示（无论是否有问卷链接）
              let successContent = '您已成功预订该课程！\n\n温馨提示：开课前3天内不可取消，如需取消请提前3天操作。';
              
              // 如果有问卷链接，添加问卷提示和链接
              if (questionnaireUrl && questionnaireUrl !== null && questionnaireUrl !== '') {
                successContent += '\n\n请填写课前问卷（选填）：\n' + questionnaireUrl + '\n点击下方按钮复制链接，粘贴到浏览器中填写问卷。';
                console.log('[课程表] 已添加问卷提示和链接到弹窗内容');
              } else {
                console.log('[课程表] 未添加问卷提示（问卷链接为空）');
              }
              
              console.log('[课程表] ========== 弹窗内容构建完成 ==========');
              console.log('[课程表] 弹窗内容（完整）:', successContent);
              console.log('[课程表] 弹窗内容长度:', successContent.length);
              console.log('[课程表] 是否包含取消规则:', successContent.includes('开课前3天内不可取消'));
              console.log('[课程表] 是否包含问卷提示:', successContent.includes('请填写课前问卷'));
              console.log('[课程表] confirmText:', questionnaireUrl && questionnaireUrl !== null && questionnaireUrl !== '' ? '复制问卷链接' : '我知道了');
              
              // 先显示成功弹窗，然后再刷新列表
              console.log('[课程表] ========== 准备显示弹窗 ==========');
              // 注意：confirmText 最多只能4个中文字符
              const confirmText = (questionnaireUrl && questionnaireUrl !== null && questionnaireUrl !== '') ? '复制链接' : '我知道了';
              console.log('[课程表] confirmText（修复后，不超过4个字符）:', confirmText);
              wx.showModal({
                title: '预订成功',
                content: successContent,
                showCancel: false,
                confirmText: confirmText,
                success: (modalRes) => {
                  console.log('[课程表] 弹窗确认回调，confirm:', modalRes.confirm);
                  // 如果有问卷链接，复制到剪贴板
                  if (modalRes.confirm && questionnaireUrl && questionnaireUrl !== null && questionnaireUrl !== '') {
                    console.log('[课程表] 准备复制问卷链接:', questionnaireUrl);
                    wx.setClipboardData({
                      data: questionnaireUrl,
                      success: () => {
                        console.log('[课程表] 链接复制成功');
                        wx.showToast({
                          title: '链接已复制，请在浏览器中粘贴打开',
                          icon: 'success',
                          duration: 3000
                        });
                      },
                      fail: (err) => {
                        console.error('[课程表] 链接复制失败:', err);
                        wx.showToast({
                          title: '复制失败，请手动复制链接',
                          icon: 'none',
                          duration: 2000
                        });
                      }
                    });
                  }
                  // 弹窗关闭后刷新列表，确保状态正确更新
                  this.loadSchedules();
                },
                fail: (err) => {
                  console.error('[课程表] 弹窗显示失败:', err);
                  // 即使弹窗失败，也要刷新列表
                  this.loadSchedules();
                }
              });
              console.log('[课程表] ========== wx.showModal调用完成 ==========');
            } else {
              throw new Error(result.error || '预订失败');
            }
          } catch (error) {
            // 这是业务逻辑错误（如课券限制），不是系统错误，使用log而不是error
            let errorMessage = '预订失败';
            
            // 优先获取error字段，然后是message，最后是字符串
            if (error.error) {
              errorMessage = error.error;
            } else if (error.message) {
              errorMessage = error.message;
            } else if (error.data && error.data.error) {
              errorMessage = error.data.error;
            } else if (typeof error === 'string') {
              errorMessage = error;
            }
            
            // 判断是否是业务逻辑错误（400状态码通常是业务逻辑错误）
            const isBusinessError = error.statusCode === 400;
            
            if (isBusinessError) {
              // 业务逻辑错误，使用log而不是error，避免在控制台显示为错误
              console.log('[课程表] 预订业务限制:', errorMessage);
            } else {
              // 系统错误，使用error记录
              console.error('[课程表] 预订系统错误:', error);
            }
            
            // 针对"没有课券"的情况，显示购买提示
            if (errorMessage.includes('还没有课券') || errorMessage.includes('没有可用课券') || errorMessage.includes('没有课券') || errorMessage.includes('请先购买课券')) {
              wx.showModal({
                title: '提示',
                content: errorMessage + '，是否前往购买？',
                confirmText: '去购买',
                cancelText: '取消',
                success: (res) => {
                  if (res.confirm) {
                    // 跳转到购买课券页面
                    wx.navigateTo({
                      url: '/pages/ticket-purchase/ticket-purchase'
                    });
                  }
                }
              });
            } else if (errorMessage.includes('您已预订该课程') || errorMessage.includes('已预订该课程')) {
              // 如果用户已经预订了该课程，显示友好提示并刷新列表
              wx.showToast({
                title: '您已经预订过该课程了',
                icon: 'none',
                duration: 2000
              });
              // 刷新课程列表以更新状态
              setTimeout(() => {
                this.loadSchedules();
              }, 500);
            } else if (errorMessage.length > 30 || errorMessage.includes('受限条件') || errorMessage.includes('不适用于') || errorMessage.includes('限制')) {
              // 如果错误消息包含限制信息（较长），使用showModal显示
              wx.showModal({
                title: '预订失败',
                content: errorMessage,
                showCancel: false,
                confirmText: '我知道了'
              });
            } else {
              wx.showToast({
                title: errorMessage,
                icon: 'none',
                duration: 3000
              });
            }
          }
        }
      }
    });
  },

  // 显示取消提示（不可取消时）
  showCancelTip(e) {
    wx.showModal({
      title: '课程取消限制',
      content: '开课前三天内课程不可取消',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 取消预订
  async cancelBooking(e) {
    const bookingId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认取消',
      content: '确定要取消预订吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await app.request({
              url: '/courses/cancel-booking',
              method: 'POST',
              data: {
                user_id: app.globalData.userInfo.id,
                booking_id: bookingId
              }
            });

            if (result.success) {
              wx.showToast({
                title: '取消成功',
                icon: 'success'
              });
              this.loadSchedules();
            } else {
              throw new Error(result.error || '取消失败');
            }
          } catch (error) {
            console.error('取消预订错误:', error);
            let errorMessage = '取消失败';
            if (error.error) {
              errorMessage = error.error;
            } else if (error.message) {
              errorMessage = error.message;
            }
            wx.showToast({
              title: errorMessage,
              icon: 'none',
              duration: 3000
            });
          }
        }
      }
    });
  },

  // 查看课程详情
  viewCourseDetail(e) {
    const courseId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/course-detail/course-detail?id=${courseId}`
    });
  },

  // 切换感兴趣状态
  async toggleInterest(e) {
    const scheduleId = e.currentTarget.dataset.id;
    const isInterested = e.currentTarget.dataset.interested === 'true' || e.currentTarget.dataset.interested === true;
    const userInfo = app.globalData.userInfo;

    if (!userInfo || userInfo.role === 'visitor') {
      wx.showModal({
        title: '提示',
        content: '需要先注册成为会员才能关注课程',
        showCancel: false
      });
      return;
    }

    try {
      if (isInterested) {
        // 取消关注
        const result = await app.request({
          url: '/schedule-interests/interest',
          method: 'DELETE',
          data: {
            user_id: userInfo.id,
            schedule_id: scheduleId
          }
        });

        if (result.success) {
          wx.showToast({
            title: '已取消关注',
            icon: 'success'
          });
          // 更新本地数据
          const schedules = this.data.schedules.map(item => {
            if (item.id === scheduleId) {
              return { ...item, is_interested: false };
            }
            return item;
          });
          this.setData({ schedules });
        }
      } else {
        // 添加关注
        const result = await app.request({
          url: '/schedule-interests/interest',
          method: 'POST',
          data: {
            user_id: userInfo.id,
            schedule_id: scheduleId
          }
        });

        if (result.success) {
          // 关注成功，显示提示框
          wx.showModal({
            title: '关注成功',
            content: '您已成功关注该课程！\n\n该课程正式排课后，我们将及时通知您，方便您第一时间预订。',
            showCancel: false,
            confirmText: '我知道了'
          });
          // 更新本地数据
          const schedules = this.data.schedules.map(item => {
            if (item.id === scheduleId) {
              return { ...item, is_interested: true };
            }
            return item;
          });
          this.setData({ schedules });
        }
      }
    } catch (error) {
      console.error('切换感兴趣状态错误:', error);
      wx.showToast({
        title: error.error || '操作失败',
        icon: 'none'
      });
    }
  }
});
