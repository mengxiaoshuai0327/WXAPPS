// pages/theme-detail/theme-detail.js
const app = getApp();

Page({
  data: {
    themeId: null,
    themeName: '',
    themeFullName: '',
    themeDescription: '',
    moduleName: '',
    themeIcon: '📚',
    themeColor: '#4A90E2',
    schedules: [],
    loading: false,
    userInfo: null
  },

  onShow() {
    // 每次显示页面时检查用户登录状态
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const userRole = userInfo ? (userInfo.role || 'visitor') : 'visitor';
    const isChannelSales = userInfo ? (userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name)) : false;
    this.setData({ 
      userInfo: userInfo,
      userRole: userRole,
      isChannelSales: isChannelSales
    });
  },

  onLoad(options) {
    const themeId = options.id || options.theme_id;
    if (!themeId) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    this.setData({ themeId: parseInt(themeId) });
    
    // 检查用户登录状态
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const userRole = userInfo ? (userInfo.role || 'visitor') : 'visitor';
    const isChannelSales = userInfo ? (userInfo.is_channel_sales || (userInfo.role === 'member' && userInfo.channel_user_id && userInfo.channel_partner_name)) : false;
    this.setData({ 
      userInfo: userInfo,
      userRole: userRole,
      isChannelSales: isChannelSales
    });
    
    this.loadThemeDetail();
    this.loadSchedules();
  },

  // 加载主题详情
  async loadThemeDetail() {
    try {
      const res = await app.request({
        url: '/courses/themes',
        method: 'GET',
        data: { module_id: null }
      });

      if (res.success && res.data) {
        // 确保themeId类型匹配（可能是字符串或数字）
        const themeId = parseInt(this.data.themeId);
        const theme = res.data.find(t => parseInt(t.id) === themeId);
        console.log('[主题详情] 查找主题，themeId:', themeId, '找到的主题:', theme);
        if (theme) {
          // 生成图标和颜色
          const icon = this.getThemeIcon(theme.name);
          const color = this.getThemeColor(theme.name);
          
          console.log('[主题详情] 主题数据:', theme);
          console.log('[主题详情] full_name:', theme.full_name);
          this.setData({
            themeName: theme.name,
            themeFullName: theme.full_name ? theme.full_name : '',
            themeDescription: theme.description || '',
            moduleName: theme.module_name || '',
            themeIcon: icon,
            themeColor: color
          });

          // 设置页面标题（优先使用全称，没有则使用简称）
          wx.setNavigationBarTitle({
            title: theme.full_name || theme.name
          });
        }
      }
    } catch (error) {
      console.error('加载主题详情失败', error);
    }
  },

  // 加载排课数据
  async loadSchedules() {
    this.setData({ loading: true });
    try {
      const res = await app.request({
        url: '/courses/schedule',
        method: 'GET',
        data: {
          theme_id: this.data.themeId,
          module_id: null,
          year_month: null,
          date: null,
          user_id: null
        }
      });

      if (res && res.success) {
        const schedulesData = res.data || [];
        const schedulesArray = Array.isArray(schedulesData) ? schedulesData : [];
        this.setData({
          schedules: schedulesArray,
          loading: false
        });
      } else {
        this.setData({
          schedules: [],
          loading: false
        });
      }
    } catch (error) {
      console.error('加载排课数据失败', error);
      this.setData({
        schedules: [],
        loading: false
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 根据主题名称生成图标
  getThemeIcon(themeName) {
    const iconMap = {
      '领导力': '🏆',
      'CFO领导力': '👑',
      '避险避坑': '🛡️',
      'CFO之后': '🚀',
      '职业发展': '📈',
      '财经BP': '💼',
      '业财融合': '🔗',
      '业财系统': '⚙️',
      '架构': '🏗️',
      '财务运营': '💰',
      '会计': '🧮',
      '合规': '⚖️',
      '税务': '📄',
      '资本运作': '💎',
      '债务融资': '💳',
      '司库': '🏦',
      '股权融资': '📈',
      '上市': '📢',
      '并购投资': '🤝',
      '前瞻热点': '🌟',
      '数转智改': '🤖',
      '数字化': '💻',
      '大模型': '🧠',
      '出海': '🌊'
    };
    
    if (iconMap[themeName]) {
      return iconMap[themeName];
    }
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (themeName.includes(key) || key.includes(themeName)) {
        return icon;
      }
    }
    
    const defaultIcons = ['📚', '📖', '📝', '📋', '📄'];
    const hash = themeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return defaultIcons[hash % defaultIcons.length];
  },

  // 根据主题名称生成颜色
  getThemeColor(themeName) {
    const colorMap = {
      '领导力': '#E74C3C',
      'CFO领导力': '#C0392B',
      '避险避坑': '#E67E22',
      'CFO之后': '#D35400',
      '职业发展': '#2ECC71',
      '财经BP': '#27AE60',
      '业财融合': '#3498DB',
      '业财系统': '#2980B9',
      '架构': '#5DADE2',
      '财务运营': '#F39C12',
      '会计': '#E67E22',
      '合规': '#F1C40F',
      '税务': '#D68910',
      '资本运作': '#9B59B6',
      '债务融资': '#8E44AD',
      '司库': '#7D3C98',
      '股权融资': '#A569BD',
      '上市': '#BB8FCE',
      '并购投资': '#9B59B6',
      '前瞻热点': '#E67E22',
      '数转智改': '#1ABC9C',
      '数字化': '#16A085',
      '大模型': '#138D75',
      '出海': '#117A65'
    };
    
    if (colorMap[themeName]) {
      return colorMap[themeName];
    }
    
    for (const [key, color] of Object.entries(colorMap)) {
      if (themeName.includes(key) || key.includes(themeName)) {
        return color;
      }
    }
    
    const defaultColors = ['#4A90E2', '#50C878', '#FF8C42', '#E74C3C', '#9B59B6', '#34495E'];
    const hash = themeName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return defaultColors[hash % defaultColors.length];
  },

  // 处理预订点击
  handleBook(e) {
    const scheduleId = e.currentTarget.dataset.id;
    const userInfo = this.data.userInfo || app.globalData.userInfo || wx.getStorageSync('userInfo');
    
    // 如果是游客（未登录），显示注册提醒
    if (!userInfo || !userInfo.id) {
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

    // 已登录用户，执行预订逻辑
    this.bookCourse(scheduleId);
  },

  // 预订课程
  async bookCourse(scheduleId) {
    const userInfo = this.data.userInfo || app.globalData.userInfo;
    
    if (!userInfo || !userInfo.id) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        showCancel: false
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
              console.log('[主题详情] 预订成功，返回数据:', JSON.stringify(result, null, 2));
              
              // 获取问卷链接
              const questionnaireUrl = result.questionnaire_url || result.data?.questionnaire_url || null;
              console.log('[主题详情] 问卷链接:', questionnaireUrl);
              
              // 显示预订成功提示，并提醒取消规则和课前问卷
              // 始终显示取消规则提示（无论是否有问卷链接）
              let content = '您已成功预订该课程！\n\n温馨提示：开课前3天内不可取消，如需取消请提前3天操作。';
              
              // 如果有问卷链接，添加问卷提示和链接
              if (questionnaireUrl) {
                content += '\n\n请填写课前问卷（选填）：\n' + questionnaireUrl + '\n点击下方按钮复制链接，粘贴到浏览器中填写问卷。';
              }
              
              console.log('[主题详情] 弹窗内容（完整）:', content);
              console.log('[主题详情] 弹窗内容长度:', content.length);
              console.log('[主题详情] 是否包含取消规则:', content.includes('开课前3天内不可取消'));
              
              // 先刷新列表，确保状态正确更新
              await this.loadSchedules();
              
              // 显示成功弹窗
              // 注意：confirmText 最多只能4个中文字符
              const confirmText = questionnaireUrl ? '复制链接' : '我知道了';
              wx.showModal({
                title: '预订成功',
                content: content,
                showCancel: false,
                confirmText: confirmText,
                success: (modalRes) => {
                  if (modalRes.confirm && questionnaireUrl) {
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
                        console.error('[主题详情] 链接复制失败:', err);
                        wx.showToast({
                          title: '复制失败，请手动复制链接',
                          icon: 'none',
                          duration: 2000
                        });
                      }
                    });
                  }
                }
              });
            } else {
              throw new Error(result.error || '预订失败');
            }
          } catch (error) {
            let errorMessage = '预订失败';
            
            if (error.error) {
              errorMessage = error.error;
            } else if (error.message) {
              errorMessage = error.message;
            } else if (error.data && error.data.error) {
              errorMessage = error.data.error;
            } else if (typeof error === 'string') {
              errorMessage = error;
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
            } else if (errorMessage.length > 30 || errorMessage.includes('受限条件') || errorMessage.includes('不适用于') || errorMessage.includes('限制')) {
              // 如果错误消息较长或包含限制信息，使用showModal显示
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
  }
});
