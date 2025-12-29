// pages/index/index.js
const app = getApp();

Page({
  data: {
    userRole: 'visitor',
    userInfo: null,
    banners: [],
    modules: [], // 从后端获取的模块列表
    popularInstructors: [], // 热门教练列表
    bookedCourses: [],
    ticketCount: 0,
    pendingEvaluations: [],
    pendingCheckins: [],
    systemMessages: [],
    inviteReward: 0,
    isListenBtnPressed: false,
    isChannelSales: false, // 是否为渠道销售
    couponStats: {
      unused: 0,
      unused_amount: 0,
      used: 0,
      expired: 0
    }
  },

  onLoad() {
    console.log('[首页] onLoad 触发');
    // 初始化时检查用户信息
    const storedUserInfo = wx.getStorageSync('userInfo');
    if (storedUserInfo) {
      app.globalData.userInfo = storedUserInfo;
    }
    const userRole = storedUserInfo ? (storedUserInfo.role || 'visitor') : 'visitor';
    
    // 如果是渠道方，跳转到【我的】页面
    if (userRole === 'channel') {
      wx.switchTab({
        url: '/pages/profile/profile'
      });
      return;
    }
    
    const isChannelSales = storedUserInfo ? (storedUserInfo.is_channel_sales || (storedUserInfo.role === 'member' && storedUserInfo.channel_user_id && storedUserInfo.channel_partner_name)) : false;
    this.setData({ 
      userRole: userRole,
      userInfo: storedUserInfo || null,
      isChannelSales: isChannelSales
    });
    this.loadData();
  },

  onShow() {
    console.log('[首页] onShow 触发');
    
    // 检查本地存储和全局数据，确保数据一致性
    const storedUserInfo = wx.getStorageSync('userInfo');
    const globalUserInfo = app.globalData.userInfo;
    
    // 如果本地存储和全局数据都没有用户信息，说明已退出登录
    if (!storedUserInfo && !globalUserInfo) {
      console.log('[首页] 检测到已退出登录，切换到游客模式');
      this.setData({
        userRole: 'visitor',
        userInfo: null,
        bookedCourses: [],
        ticketCount: 0,
        pendingEvaluations: [],
        pendingCheckins: [],
        systemMessages: [],
        inviteReward: 0,
        couponStats: { unused: 0, unused_amount: 0, used: 0, expired: 0 },
        isListenBtnPressed: false,
        couponStats: { unused: 0, unused_amount: 0, used: 0, expired: 0 }
      });
      this.loadVisitorData();
      return;
    }
    
    // 如果本地存储有但全局数据没有，同步全局数据
    if (storedUserInfo && !globalUserInfo) {
      app.globalData.userInfo = storedUserInfo;
      console.log('[首页] 从本地存储同步用户信息到全局数据');
    }
    
    // 如果全局数据有但本地存储没有，清除全局数据（说明已退出登录）
    if (!storedUserInfo && globalUserInfo) {
      console.log('[首页] 检测到本地存储已清除，清除全局数据');
      app.globalData.userInfo = null;
      this.setData({
        userRole: 'visitor',
        userInfo: null,
        bookedCourses: [],
        ticketCount: 0,
        pendingEvaluations: [],
        pendingCheckins: [],
        systemMessages: [],
        inviteReward: 0,
        couponStats: { unused: 0, unused_amount: 0, used: 0, expired: 0 },
        isListenBtnPressed: false,
        couponStats: { unused: 0, unused_amount: 0, used: 0, expired: 0 }
      });
      this.loadVisitorData();
      return;
    }
    
    // 获取最终的用户信息（优先使用全局数据）
    const userInfo = globalUserInfo || storedUserInfo;
    
    if (userInfo && userInfo.id) {
      // 确保页面数据与用户信息同步
      const currentUserRole = this.data.userRole;
      const expectedRole = userInfo.role || 'visitor';
      
      // 如果角色不匹配，需要重新加载
      if (currentUserRole !== expectedRole || !this.data.userInfo || this.data.userInfo.id !== userInfo.id) {
        console.log('[首页] 检测到用户信息变化，重新加载数据');
        const isChannelSales = userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name);
        this.setData({
          userInfo: userInfo,
          userRole: expectedRole,
          isChannelSales: isChannelSales
        });
        
        // 重新检查用户角色并加载数据
        this.checkUserRole().then(() => {
          const userRole = this.data.userRole;
          // 如果是渠道方，跳转到【我的】页面
          if (userRole === 'channel') {
            wx.switchTab({
              url: '/pages/profile/profile'
            });
            return;
          }
          if (userRole === 'member' || userRole === 'instructor') {
            console.log('[首页] onShow 重新加载会员数据');
            this.loadMemberData();
          } else {
            // 如果不是会员或教练，加载游客数据
            this.loadVisitorData();
          }
        }).catch(err => {
          console.error('[首页] onShow 检查用户角色失败:', err);
          this.loadVisitorData();
        });
      } else {
        // 如果用户信息和角色没有变化，仅刷新数据（可能在登录后需要刷新）
        console.log('[首页] 用户信息未变化，刷新数据');
        if (expectedRole === 'member' || expectedRole === 'instructor') {
          this.loadMemberData();
        } else {
          this.loadVisitorData();
        }
      }
    } else {
      // 如果没有用户信息，加载游客数据
      console.log('[首页] 没有用户信息，加载游客数据');
      this.setData({
        userRole: 'visitor',
        userInfo: null
      });
      this.loadVisitorData();
    }
  },

  async checkUserRole() {
    try {
      const cachedUserInfo = app.globalData.userInfo;
      if (!cachedUserInfo || !cachedUserInfo.id) {
        this.setData({ userRole: 'visitor', userInfo: null });
        return;
      }

      const res = await app.request({
        url: '/users/' + cachedUserInfo.id,
        method: 'GET'
      });

      if (res.success && res.data) {
        app.globalData.userInfo = res.data;
        wx.setStorageSync('userInfo', res.data);
        this.setData({ 
          userRole: res.data.role || 'visitor',
          userInfo: res.data
        });
      } else {
        const userInfo = app.globalData.userInfo;
        if (userInfo) {
          this.setData({ 
            userRole: userInfo.role || 'visitor',
            userInfo: userInfo
          });
        } else {
          this.setData({ userRole: 'visitor', userInfo: null });
        }
      }
    } catch (error) {
      console.error('检查用户角色失败:', error);
      const userInfo = app.globalData.userInfo;
      if (userInfo) {
        this.setData({ 
          userRole: userInfo.role || 'visitor',
          userInfo: userInfo
        });
      } else {
        this.setData({ userRole: 'visitor', userInfo: null });
      }
    }
  },

  async loadData() {
    console.log('[首页] 开始加载数据');
    try {
      await this.checkUserRole();
      const userRole = this.data.userRole;
      console.log('[首页] 当前用户角色:', userRole);
      
      if (userRole === 'visitor') {
        await this.loadVisitorData();
      } else if (userRole === 'member' || userRole === 'instructor') {
        await this.loadMemberData();
      } else {
        await this.loadVisitorData();
      }
      console.log('[首页] 数据加载完成');
    } catch (error) {
      console.error('[首页] 加载数据失败:', error);
      await this.loadVisitorData();
    }
  },

  async loadVisitorData() {
    try {
      console.log('[首页] 加载游客数据');
      const results = await Promise.all([
        this.getBanners(),
        this.getThemes(),
        this.getPopularInstructors()
      ]);
      const banners = results[0] || [];
      const themes = results[1] || [];
      // 清除所有会员相关数据，确保切换到游客模式
      this.setData({
        banners: banners,
        modules: themes, // 使用 themes 数据填充 modules 字段以保持兼容
        userRole: 'visitor',
        userInfo: null,
        bookedCourses: [],
        ticketCount: 0,
        pendingEvaluations: [],
        pendingCheckins: [],
        systemMessages: [],
        inviteReward: 0,
        couponStats: { unused: 0, unused_amount: 0, used: 0, expired: 0 }
      });
      console.log('[首页] 游客数据加载完成，主题数量:', themes.length);
    } catch (error) {
      console.error('[首页] 加载游客数据失败:', error);
      this.setData({ 
        banners: [], 
        modules: [],
        popularInstructors: [],
        userRole: 'visitor',
        userInfo: null,
        bookedCourses: [],
        ticketCount: 0,
        pendingEvaluations: [],
        pendingCheckins: [],
        systemMessages: [],
        inviteReward: 0,
        couponStats: { unused: 0, unused_amount: 0, used: 0, expired: 0 }
      });
    }
  },

  // 获取热门教练列表
  async getPopularInstructors() {
    try {
      const res = await app.request({
        url: '/users/instructors/popular',
        method: 'GET',
        data: { limit: 6 }
      });

      if (res.success && res.data) {
        this.setData({
          popularInstructors: res.data || []
        });
        console.log('[首页] 获取热门教练成功:', res.data.length);
        return res.data || [];
      }
      return [];
    } catch (error) {
      console.error('[首页] 获取热门教练失败:', error);
      this.setData({
        popularInstructors: []
      });
      return [];
    }
  },

  // 查看教练资料
  viewInstructorProfile(e) {
    const instructorId = e.currentTarget.dataset.id;
    if (instructorId) {
      wx.navigateTo({
        url: `/pages/instructor-profile/instructor-profile?id=${instructorId}`
      });
    }
  },

  // 获取主题列表
  async getThemes() {
    try {
      const res = await app.request({
        url: '/courses/themes',
        method: 'GET'
      });
      if (res.success && res.data) {
        // 为每个主题生成图标和颜色
        const themesWithStyle = res.data.map(theme => {
          return {
            id: theme.id,
            name: theme.name,
            description: theme.description,
            module_id: theme.module_id,
            module_name: theme.module_name,
            status: theme.status || 'active',
            icon: this.getThemeIcon(theme.name),
            color: this.getThemeColor(theme.name),
            subtitle: '' // 不显示描述
          };
        });
        return themesWithStyle;
      }
      return [];
    } catch (error) {
      console.error('获取主题列表失败', error);
      return [];
    }
  },

  // 获取模块列表（保留用于其他功能）
  async getModules() {
    try {
      const res = await app.request({
        url: '/courses/modules',
        method: 'GET'
      });
      if (res.success && res.data) {
        // 为每个模块生成图标和颜色
        const modulesWithStyle = res.data.map(module => {
          return {
            id: module.id,
            name: module.name,
            description: module.description,
            created_at: module.created_at,
            updated_at: module.updated_at,
            icon: this.getModuleIcon(module.name),
            color: this.getModuleColor(module.name),
            subtitle: module.description || ''
          };
        });
        return modulesWithStyle;
      }
      return [];
    } catch (error) {
      console.error('获取模块列表失败', error);
      return [];
    }
  },

  // 根据主题名称生成图标
  getThemeIcon(themeName) {
    const iconMap = {
      // 领导力相关
      '领导力': '🏆',
      'CFO领导力': '👑',
      '避险避坑': '🛡️',
      'CFO之后': '🚀',
      
      // 职业发展相关
      '职业发展': '📈',
      '财经BP': '💼',
      
      // 业财融合相关
      '业财融合': '🔗',
      '业财系统': '⚙️',
      '架构': '🏗️',
      
      // 财务运营相关
      '财务运营': '💰',
      '会计': '🧮',  // 算盘，更独特
      '合规': '⚖️',  // 天平，代表合规审查
      '税务': '📄',  // 税务文件，区别于其他
      
      // 资本运作相关
      '资本运作': '💎',
      '债务融资': '💳',
      '司库': '🏦',
      '股权融资': '📈',
      '上市': '📢',
      '并购投资': '🤝',
      
      // 前瞻热点相关
      '前瞻热点': '🌟',
      '数转智改': '🤖',
      '数字化': '💻',
      '大模型': '🧠',
      '出海': '🌊',
      
      // 其他通用主题
      '沟通': '💬',
      '表达': '🎤',
      '管理': '☰',
      '创新': '💡',
      '谈判': '🤝',
      '人际关系': '👥',
      '心理学': '🧠',
      '时间管理': '⏰',
      '财务': '💰',
      '市场营销': '📢',
      '职业规划': '🗺️',
      '写作': '✍️',
      '数据分析': '📊',
      '外语': '🌐',
      '自我提升': '⭐',
      '工作坊': '🔧',
      '培训': '📚',
      '课程': '📖'
    };
    
    // 如果直接匹配，返回对应图标
    if (iconMap[themeName]) {
      return iconMap[themeName];
    }
    
    // 尝试部分匹配（主题名称包含关键词）
    for (const [key, icon] of Object.entries(iconMap)) {
      if (themeName.includes(key) || key.includes(themeName)) {
        return icon;
      }
    }
    
    // 根据主题名称长度和字符生成不同图标（确保每个主题都有不同的图标）
    const defaultIcons = ['📚', '📖', '📝', '📋', '📄', '📑', '📃', '📜', '📗', '📘', '📙', '📕', '📓', '📔', '📒'];
    const hash = themeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return defaultIcons[hash % defaultIcons.length];
  },

  // 根据主题名称生成颜色
  getThemeColor(themeName) {
    const colorMap = {
      // 领导力相关 - 红色系
      '领导力': '#E74C3C',
      'CFO领导力': '#C0392B',
      '避险避坑': '#E67E22',
      'CFO之后': '#D35400',
      
      // 职业发展相关 - 绿色系
      '职业发展': '#2ECC71',
      '财经BP': '#27AE60',
      
      // 业财融合相关 - 蓝色系
      '业财融合': '#3498DB',
      '业财系统': '#2980B9',
      '架构': '#5DADE2',
      
      // 财务运营相关 - 橙色系
      '财务运营': '#F39C12',
      '会计': '#E67E22',
      '合规': '#F1C40F',
      '税务': '#D68910',
      
      // 资本运作相关 - 紫色系
      '资本运作': '#9B59B6',
      '债务融资': '#8E44AD',
      '司库': '#7D3C98',
      '股权融资': '#A569BD',
      '上市': '#BB8FCE',
      '并购投资': '#9B59B6',
      
      // 前瞻热点相关 - 渐变色系
      '前瞻热点': '#E67E22',
      '数转智改': '#1ABC9C',
      '数字化': '#16A085',
      '大模型': '#138D75',
      '出海': '#117A65',
      
      // 其他通用主题
      '沟通': '#4A90E2',
      '表达': '#50C878',
      '管理': '#FF8C42',
      '创新': '#9B59B6',
      '谈判': '#34495E',
      '人际关系': '#3498DB',
      '心理学': '#2ECC71',
      '时间管理': '#F39C12',
      '财务': '#E74C3C',
      '市场营销': '#3498DB',
      '职业规划': '#2ECC71',
      '写作': '#34495E',
      '数据分析': '#3498DB',
      '外语': '#2ECC71',
      '自我提升': '#FF8C42',
      '工作坊': '#E74C3C',
      '培训': '#3498DB',
      '课程': '#9B59B6'
    };
    
    // 如果直接匹配，返回对应颜色
    if (colorMap[themeName]) {
      return colorMap[themeName];
    }
    
    // 尝试部分匹配（主题名称包含关键词）
    for (const [key, color] of Object.entries(colorMap)) {
      if (themeName.includes(key) || key.includes(themeName)) {
        return color;
      }
    }
    
    // 如果没有匹配，使用丰富的默认颜色数组，基于主题名称哈希分配
    const defaultColors = [
      '#4A90E2', '#50C878', '#FF8C42', '#E74C3C', '#9B59B6', '#34495E',
      '#1ABC9C', '#16A085', '#F39C12', '#E67E22', '#3498DB', '#2980B9',
      '#8E44AD', '#7D3C98', '#C0392B', '#D35400', '#27AE60', '#138D75'
    ];
    const hash = themeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return defaultColors[hash % defaultColors.length];
  },

  // 根据模块名称生成图标（保留用于其他功能）
  getModuleIcon(moduleName) {
    const iconMap = {
      '领导力': '🏆',
      '职业发展': '📈',
      '业财融合': '💼',
      '财务运营': '💰',
      '沟通': '💬',
      '表达': '✓',
      '管理': '☰',
      '创新': '💡',
      '谈判': '👍',
      '人际关系': '👤',
      '心理学': '❓',
      '时间管理': '⏰',
      '财务': '💰',
      '市场营销': '🎁',
      '职业规划': '📈',
      '写作': '✍️',
      '数据分析': '📊',
      '外语': '💬',
      '自我提升': '⭐'
    };
    return iconMap[moduleName] || '📚';
  },

  // 根据模块名称生成颜色
  getModuleColor(moduleName) {
    const colorMap = {
      '领导力': '#E74C3C',
      '职业发展': '#2ECC71',
      '业财融合': '#3498DB',
      '财务运营': '#F39C12',
      '沟通': '#4A90E2',
      '表达': '#50C878',
      '管理': '#FF8C42',
      '创新': '#9B59B6',
      '谈判': '#34495E',
      '人际关系': '#3498DB',
      '心理学': '#2ECC71',
      '时间管理': '#F39C12',
      '财务': '#E74C3C',
      '市场营销': '#3498DB',
      '职业规划': '#2ECC71',
      '写作': '#34495E',
      '数据分析': '#3498DB',
      '外语': '#2ECC71',
      '自我提升': '#FF8C42'
    };
    // 如果没有匹配的颜色，使用默认颜色数组循环分配
    const defaultColors = ['#4A90E2', '#50C878', '#FF8C42', '#E74C3C', '#9B59B6', '#34495E'];
    return colorMap[moduleName] || defaultColors[moduleName.length % defaultColors.length];
  },

  async loadMemberData() {
    try {
      console.log('[首页] 开始加载会员数据');
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        console.log('[首页] 用户信息不存在，加载游客数据');
        await this.loadVisitorData();
        return;
      }
      
      console.log('[首页] 用户ID:', userInfo.id);
      
      // 并行加载所有数据，提高性能
      const promises = [
        this.getBookedCourses(),
        this.getTicketCount(),
        this.getPendingEvaluations(),
        this.getPendingCheckins(),
        this.getSystemMessages(),
        this.getInviteStats(),
        this.getInviteRewardCoupons(),
        this.getCouponStats()
      ];
      
      const results = await Promise.all(promises);
      const bookedCourses = results[0] || [];
      const ticketCount = results[1] || 0;
      const pendingEvaluations = results[2] || [];
      const pendingCheckins = results[3] || [];
      const systemMessages = results[4] || [];
      const inviteStats = results[5] || null;
      const inviteReward = results[6] || 0;
      const couponStats = results[7] || { unused: 0, unused_amount: 0, used: 0, expired: 0 };
      
      console.log('[首页] 准备设置数据:');
      console.log('  - 已预订课程数量:', bookedCourses.length);
      console.log('  - 课券余额:', ticketCount);
      console.log('  - 待评价数量:', pendingEvaluations.length);
      console.log('  - 待签到数量:', pendingCheckins.length);
      console.log('  - 系统消息数量:', systemMessages.length);
      console.log('  - 邀请奖励（基于实际折扣券）:', inviteReward);
      console.log('  - 优惠券统计:', couponStats);
      console.log('  - 未使用优惠券金额:', couponStats.unused_amount);
      
      // 判断是否为渠道销售
      const isChannelSales = userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name);
      console.log('  - 是否为渠道销售:', isChannelSales);
      
      this.setData({
        bookedCourses: bookedCourses,
        ticketCount: ticketCount,
        pendingEvaluations: pendingEvaluations,
        pendingCheckins: pendingCheckins,
        systemMessages: systemMessages,
        inviteReward: inviteReward,
        isChannelSales: isChannelSales,
        couponStats: couponStats
      }, () => {
        // 检查是否有schedule_available类型的未读消息，如果有则弹出提示框
        this.checkAndShowScheduleAvailablePopup(systemMessages);
      });
      
      console.log('[首页] 数据设置完成');
      console.log('[首页] 验证数据 - ticketCount:', this.data.ticketCount);
      console.log('[首页] 验证数据 - bookedCourses.length:', this.data.bookedCourses.length);
    } catch (error) {
      console.error('[首页] 加载会员数据失败:', error);
      // 即使出错也设置默认值，避免页面空白
      this.setData({
        bookedCourses: [],
        ticketCount: 0,
        pendingEvaluations: [],
        pendingCheckins: [],
        systemMessages: [],
        inviteReward: 0,
        couponStats: { unused: 0, unused_amount: 0, used: 0, expired: 0 }
      });
    }
  },

  async getBanners() {
    try {
      const res = await app.request({
        url: '/banners/list',
        method: 'GET'
      });
      return res.data || [];
    } catch (error) {
      console.error('获取Banner失败', error);
      return [];
    }
  },

  async getBookedCourses() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        console.log('[首页] 获取已预订课程：用户信息不存在');
        return [];
      }
      
      console.log('[首页] 获取已预订课程，user_id:', userInfo.id);
      const res = await app.request({
        url: '/courses/bookings',
        method: 'GET',
        data: { 
          user_id: userInfo.id,
          limit: 10
        }
      });
      
      console.log('[首页] 已预订课程API响应:', res);
      if (res && res.success && res.data) {
        const bookings = Array.isArray(res.data) ? res.data : [];
        console.log('[首页] 已预订课程数量:', bookings.length);
        if (bookings.length > 0) {
          console.log('[首页] 已预订课程详情:', bookings[0]);
        }
        return bookings;
      }
      console.log('[首页] 已预订课程API返回失败或数据为空');
      return [];
    } catch (error) {
      console.error('[首页] 获取已预订课程失败:', error);
      return [];
    }
  },

  async getTicketCount() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        console.log('[首页] 获取课券数量：用户信息不存在');
        return 0;
      }
      
      console.log('[首页] 获取课券数量，user_id:', userInfo.id);
      const res = await app.request({
        url: '/tickets/stats',
        method: 'GET',
        data: { user_id: userInfo.id }
      });
      
      console.log('[首页] 课券统计API完整响应:', JSON.stringify(res));
      
      if (!res) {
        console.error('[首页] 课券统计API返回null或undefined');
        return 0;
      }
      
      if (!res.success) {
        console.error('[首页] 课券统计API返回失败:', res.error);
        return 0;
      }
      
      if (!res.data) {
        console.error('[首页] 课券统计API返回数据为空');
        return 0;
      }
      
      // 确保 unused 字段存在
      let unusedCount = 0;
      if (res.data.unused !== undefined && res.data.unused !== null) {
        unusedCount = parseInt(res.data.unused);
        if (isNaN(unusedCount)) {
          unusedCount = 0;
        }
      }
      
      console.log('[首页] 未使用课券数量 (最终):', unusedCount);
      console.log('[首页] res.data 完整内容:', JSON.stringify(res.data));
      
      return unusedCount;
    } catch (error) {
      console.error('[首页] 获取课券数量异常:', error);
      console.error('[首页] 错误堆栈:', error.stack);
      return 0;
    }
  },

  async getPendingEvaluations() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        return [];
      }
      
      const res = await app.request({
        url: '/evaluations/pending',
        method: 'GET',
        data: { user_id: userInfo.id }
      });
      
      return res.data || [];
    } catch (error) {
      console.error('获取待评价课程失败', error);
      return [];
    }
  },

  async getPendingCheckins() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        return [];
      }
      
      const res = await app.request({
        url: '/courses/pending-checkins',
        method: 'GET',
        data: { user_id: userInfo.id }
      });
      
      return res.data || [];
    } catch (error) {
      console.error('获取待签到课程失败', error);
      return [];
    }
  },

  async getSystemMessages() {
    try {
      const res = await app.request({
        url: '/messages/list',
        method: 'GET',
        data: { 
          user_id: app.globalData.userInfo.id,
          limit: 5
        }
      });
      const messages = res.data || [];
      const formattedMessages = [];
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        formattedMessages.push({
          id: msg.id,
          title: msg.title || '',
          content: msg.content || '',
          type: msg.type || '',
          schedule_id: msg.schedule_id || null,
          created_at: this.formatDateTime(msg.created_at)
        });
      }
      return formattedMessages;
    } catch (error) {
      return [];
    }
  },

  async getInviteStats() {
    try {
      const res = await app.request({
        url: '/users/' + app.globalData.userInfo.id,
        method: 'GET'
      });
      return res.data.invite_stats || null;
    } catch (error) {
      return null;
    }
  },

  // 获取邀请奖励折扣券的总金额（基于实际折扣券数量）
  async getInviteRewardCoupons() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        return 0;
      }

      // 查询所有邀请相关的折扣券（注册奖励和购券奖励）
      const res = await app.request({
        url: '/discounts/list',
        method: 'GET',
        data: {
          user_id: userInfo.id
        }
      });

      if (res.success && res.data) {
        // 只统计邀请相关的折扣券（排除管理员发放和授课奖励）
        const inviteCoupons = res.data.filter(coupon => 
          coupon.source === 'invite_register' || coupon.source === 'invite_purchase'
        );
        
        // 计算总金额
        const totalAmount = inviteCoupons.reduce((sum, coupon) => {
          return sum + (parseFloat(coupon.amount) || 0);
        }, 0);

        console.log('[首页] 邀请奖励折扣券统计:');
        console.log('  - 注册奖励折扣券数量:', inviteCoupons.filter(c => c.source === 'invite_register').length);
        console.log('  - 购券奖励折扣券数量:', inviteCoupons.filter(c => c.source === 'invite_purchase').length);
        console.log('  - 总金额:', totalAmount);

        return totalAmount;
      }

      return 0;
    } catch (error) {
      console.error('[首页] 获取邀请奖励折扣券失败:', error);
      return 0;
    }
  },

  formatDateTime(dateTime) {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = this.padZero(date.getMonth() + 1);
    const day = this.padZero(date.getDate());
    const hours = this.padZero(date.getHours());
    const minutes = this.padZero(date.getMinutes());
    const seconds = this.padZero(date.getSeconds());
    return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds;
  },
  
  padZero(num) {
    const str = String(num);
    return str.length < 2 ? '0' + str : str;
  },

  viewCourseDetail(e) {
    const courseId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/course-detail/course-detail?id=' + courseId
    });
  },

  viewMessage(e) {
    const messageId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/messages/detail/detail?id=' + messageId
    });
  },

  goToMessages() {
    wx.navigateTo({
      url: '/pages/messages/list/list'
    });
  },

  goToSchedule() {
    wx.switchTab({
      url: '/pages/schedule/schedule'
    });
  },

  goToMyBookings() {
    wx.navigateTo({
      url: '/pages/my-bookings/my-bookings'
    });
  },

  goToCheckin() {
    console.log('[首页] 点击去签到按钮');
    try {
    wx.navigateTo({
        url: '/pages/checkin/checkin',
        success: () => {
          console.log('[首页] 跳转到打卡页面成功');
        },
        fail: (err) => {
          console.error('[首页] 跳转到打卡页面失败:', err);
          wx.showToast({
            title: '页面不存在，请检查配置',
            icon: 'none',
            duration: 2000
          });
        }
      });
    } catch (error) {
      console.error('[首页] goToCheckin 错误:', error);
      wx.showToast({
        title: '跳转失败',
        icon: 'none',
        duration: 2000
    });
    }
  },

  goToEvaluation() {
    wx.navigateTo({
      url: '/pages/evaluation/evaluation'
    });
  },

  goToTickets() {
    wx.navigateTo({
      url: '/pages/ticket-list/ticket-list'
    });
  },

  goToInvitation() {
    wx.navigateTo({
      url: '/pages/invitation/invitation'
    });
  },

  goToDiscountCoupons() {
    wx.navigateTo({
      url: '/pages/discount-coupons/discount-coupons'
    });
  },

  goToInvitation() {
    wx.navigateTo({
      url: '/pages/invitation/invitation'
    });
  },

  async getCouponStats() {
    try {
      const userInfo = app.globalData.userInfo;
      if (!userInfo || !userInfo.id) {
        console.log('[首页] 用户信息不存在，返回默认优惠券统计');
        return { unused: 0, unused_amount: 0, used: 0, expired: 0 };
      }

      console.log('[首页] 开始获取优惠券统计，用户ID:', userInfo.id);
      const res = await app.request({
        url: '/discounts/stats',
        method: 'GET',
        data: { user_id: userInfo.id }
      });

      console.log('[首页] 优惠券统计API返回:', res);
      if (res && res.success && res.data) {
        const stats = {
          unused: res.data.unused || 0,
          unused_amount: parseFloat(res.data.unused_amount || 0),
          used: res.data.used || 0,
          expired: res.data.expired || 0
        };
        console.log('[首页] 解析后的优惠券统计:', stats);
        return stats;
      }

      console.log('[首页] API返回数据格式不正确，返回默认值');
      return { unused: 0, unused_amount: 0, used: 0, expired: 0 };
    } catch (error) {
      console.error('[首页] 获取优惠券统计失败:', error);
      return { unused: 0, unused_amount: 0, used: 0, expired: 0 };
    }
  },

  goToCourseIntention(e) {
    console.log('[首页] 点击倾听按钮，准备跳转到课程意向页面', e);
    // 先恢复按钮状态
    this.setData({ isListenBtnPressed: false });
    
    wx.navigateTo({
      url: '/pages/course-intention/course-intention',
      success: () => {
        console.log('[首页] 跳转成功');
      },
      fail: (err) => {
        console.error('[首页] 跳转失败:', err);
        wx.showToast({
          title: err.errMsg || '跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  onListenBtnTouchStart(e) {
    console.log('[首页] 触摸开始');
    this.setData({ isListenBtnPressed: true });
    // 阻止事件冒泡，但不阻止默认行为
    return false;
  },

  onListenBtnTouchEnd(e) {
    console.log('[首页] 触摸结束');
    // 延迟恢复按钮状态，但不要阻止 tap 事件
    const self = this;
    setTimeout(() => {
      self.setData({ isListenBtnPressed: false });
    }, 150);
    // 不阻止事件，让 tap 事件能够正常触发
    return true;
  },

  showRegisterModal() {
    wx.navigateTo({
      url: '/pages/register/register'
    });
  },

  viewModule(e) {
    // 点击主题卡片
    const themeId = e.currentTarget.dataset.id;
    const userInfo = app.globalData.userInfo;
    
    // 如果是游客（未登录），跳转到主题详情页面
    if (!userInfo || this.data.userRole === 'visitor') {
      wx.navigateTo({
        url: `/pages/theme-detail/theme-detail?id=${themeId}`
      });
      return;
    }
    
    // 如果是已登录用户，跳转到课程表页面并筛选
    const themeItem = this.data.modules.find(m => m.id === themeId);
    if (themeItem) {
      // 传递主题ID（如果课程表支持按主题筛选）
      app.globalData.selectedThemeId = themeId;
      // 传递模块ID（用于兼容现有的模块筛选逻辑）
      if (themeItem.module_id) {
        app.globalData.selectedModuleId = themeItem.module_id;
      }
    }
    wx.switchTab({
      url: '/pages/schedule/schedule'
    });
  },

  onBannerError(e) {
    console.error('Banner 图片加载失败:', e.detail);
    // 如果图片加载失败，可以尝试隐藏该banner或使用占位图
    // 这里只记录错误，不进行额外处理，避免影响用户体验
  },

  handleLogout() {
    const self = this;
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？退出后将进入游客模式',
      confirmText: '退出',
      cancelText: '取消',
      confirmColor: '#ff4444',
      success: function(res) {
        if (res.confirm) {
          // 清除所有本地存储
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('openid');
          wx.removeStorageSync('session_key');
          wx.removeStorageSync('token');
          
          // 清除全局数据
          app.globalData.userInfo = null;
          app.globalData.openid = null;
          
          // 立即重置首页数据为游客模式
          self.setData({
            userRole: 'visitor',
            userInfo: null,
            bookedCourses: [],
            ticketCount: 0,
            pendingEvaluations: [],
            systemMessages: [],
            inviteReward: 0
          });
          
          // 加载游客数据
          self.loadVisitorData();
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });
          
          // 不需要跳转，因为已经在首页了
          console.log('[首页] 已退出登录，切换到游客模式');
        }
      }
    });
  },

  loadSystemMessages() {
    var self = this;
    this.getSystemMessages().then(function(messages) {
      self.setData({ systemMessages: messages }, () => {
        // 检查是否有schedule_available类型的未读消息，如果有则弹出提示框
        self.checkAndShowScheduleAvailablePopup(messages);
      });
    }).catch(function(error) {
      console.error('加载系统消息失败', error);
    });
  },

  loadPendingEvaluationsList() {
    var self = this;
    this.getPendingEvaluations().then(function(evaluations) {
      self.setData({ pendingEvaluations: evaluations });
    }).catch(function(error) {
      console.error('加载待评价课程失败', error);
    });
  },

  // 检查并显示课程开课通知弹窗（只弹出一次）
  // 注意：后端API只返回未读消息，一旦消息被标记为已读，就不会再出现在消息列表中
  // 因此弹窗只会显示一次
  checkAndShowScheduleAvailablePopup(messages) {
    if (!messages || messages.length === 0) {
      return;
    }

    // 查找schedule_available类型的未读消息（API已经过滤了已读消息）
    const scheduleAvailableMsg = messages.find(msg => msg.type === 'schedule_available' && msg.schedule_id);
    if (!scheduleAvailableMsg) {
      return;
    }

    // 显示弹窗（只会弹出一次，因为未读消息只会出现一次）
    wx.showModal({
      title: scheduleAvailableMsg.title || '课程已开课',
      content: scheduleAvailableMsg.content || '您关注的课程已正式开课，快去预订吧！',
      showCancel: true,
      cancelText: '稍后再说',
      confirmText: '立即报名',
      success: (res) => {
        if (res.confirm) {
          // 用户点击了"立即报名"，直接进行报名操作
          // 报名成功后会标记消息为已读，确保不会再次弹出
          this.bookScheduleFromMessage(scheduleAvailableMsg.schedule_id, scheduleAvailableMsg.id);
        } else {
          // 用户点击了"稍后再说"，立即标记消息为已读
          // 标记为已读后，该消息不会再出现在未读消息列表中，弹窗不会再次弹出
          this.markMessageAsRead(scheduleAvailableMsg.id);
        }
      },
      fail: () => {
        // 如果弹窗显示失败（比如用户快速离开页面），也标记为已读，避免下次再次弹出
        this.markMessageAsRead(scheduleAvailableMsg.id);
      }
    });
  },

  // 从消息弹窗中直接报名
  async bookScheduleFromMessage(scheduleId, messageId) {
    const userInfo = app.globalData.userInfo;
    
    if (!userInfo || !userInfo.id) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false
      });
      return;
    }

    // 显示确认对话框
    wx.showModal({
      title: '确认报名',
      content: '确定要预订该课程吗？',
      showCancel: true,
      cancelText: '取消',
      confirmText: '确定',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({
              title: '报名中...',
              mask: true
            });

            const result = await app.request({
              url: '/courses/book',
              method: 'POST',
              data: {
                user_id: userInfo.id,
                schedule_id: scheduleId
              }
            });

            wx.hideLoading();

            if (result.success) {
              // 报名成功后，标记消息为已读
              // 标记为已读后，该消息不会再出现在未读消息列表中，弹窗不会再次弹出
              await this.markMessageAsRead(messageId);
              
              // 获取问卷链接
              const questionnaireUrl = result.questionnaire_url || result.data?.questionnaire_url || null;
              
              // 显示报名成功提示，并提醒取消规则和课前问卷
              // 始终显示取消规则提示（无论是否有问卷链接）
              let content = '您已成功预订该课程！\n\n温馨提示：开课前3天内不可取消，如需取消请提前3天操作。';
              
              // 如果有问卷链接，添加问卷提示和链接
              if (questionnaireUrl) {
                content += '\n\n请填写课前问卷（选填）：\n' + questionnaireUrl + '\n点击下方按钮复制链接，粘贴到浏览器中填写问卷。';
              }
              
              // 注意：confirmText 最多只能4个中文字符
              const confirmText = questionnaireUrl ? '复制链接' : '我知道了';
              wx.showModal({
                title: '报名成功',
                content: content,
                showCancel: false,
                confirmText: confirmText,
                success: (res) => {
                  if (res.confirm && questionnaireUrl) {
                    // 复制链接到剪贴板
                    wx.setClipboardData({
                      data: questionnaireUrl,
                      success: () => {
                        wx.showToast({
                          title: '链接已复制，请在浏览器中粘贴打开',
                          icon: 'success',
                          duration: 3000
                        });
                      },
                      fail: (err) => {
                        console.error('[首页] 链接复制失败:', err);
                        wx.showToast({
                          title: '复制失败，请手动复制链接',
                          icon: 'none',
                          duration: 2000
                        });
                      }
                    });
                  }
                  // 刷新首页数据（刷新后不会再次弹出弹窗，因为消息已标记为已读）
                  this.loadMemberData();
                }
              });
            } else {
              throw new Error(result.error || '报名失败');
            }
          } catch (error) {
            wx.hideLoading();
            console.error('报名失败:', error);
            let errorMessage = '报名失败';
            if (error.error) {
              errorMessage = error.error;
            } else if (error.message) {
              errorMessage = error.message;
            }
            wx.showModal({
              title: '报名失败',
              content: errorMessage,
              showCancel: false,
              confirmText: '我知道了'
            });
          }
        }
      }
    });
  },

  // 标记消息为已读
  async markMessageAsRead(messageId) {
    try {
      await app.request({
        url: '/messages/read',
        method: 'POST',
        data: {
          message_id: messageId,
          user_id: app.globalData.userInfo.id
        }
      });
    } catch (error) {
      console.error('标记消息已读失败:', error);
    }
  }
});
