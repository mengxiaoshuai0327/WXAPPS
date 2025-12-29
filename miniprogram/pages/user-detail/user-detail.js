// pages/user-detail/user-detail.js
const app = getApp();

Page({
  data: {
    userInfo: {},
    editedNickname: '',
    editedRealName: '',
    editedPhone: '',
    editedAvatarUrl: '',
    // 会员详细资料
    memberProfile: {
      position: '', // 职位/角色
      position_other: '', // 职位其他说明
      company_type: '', // 公司类型
      company_type_other: '', // 公司类型其他说明
      job_title: '', // 岗位头衔
      position_years: '', // 在本岗位任职年数
      total_work_years: '', // 在企业总计工作年限
      managed_team_size: '', // 管理的财务团队人数
      total_finance_team_size: '', // 企业整个财务团队人数
      reporting_layers: '' // 离财务一号位的汇报关系层数
    },
    // 能力自评
    abilityAssessment: {
      financial_ability: '', // 财务专业能力（单选）
      business_ability: '', // 业务支持与经营管理能力（单选）
      process_ability: '', // 流程和系统能力（单选）
      leadership_ability: '', // 领导力和影响力（单选）
      capital_ability: '' // 资本运作和价值管理能力（单选）
    },
    showBusinessAbilityModal: false, // 业务能力选择弹窗
    businessAbilityDisplayText: '', // 业务能力显示文本
    showMemberProfile: false, // 会员详细资料是否展开，默认折叠
    showAbilityAssessment: false, // 能力自评是否展开，默认折叠
    // 职位选项
    positionOptions: [
      { value: 'OA', label: 'CFO/财务一号位' },
      { value: 'OB', label: 'CFO/财务一号位的直接下属' },
      { value: 'OC', label: '会计师事务所高级经理及以上' },
      { value: 'OD', label: '投行券商董事及以上' },
      { value: 'OE', label: '投资机构董事及以上' },
      { value: 'OF', label: '以上都不符合,请说明' }
    ],
    // 公司类型选项
    companyTypeOptions: [
      { value: 'OA', label: '上市公司' },
      { value: 'OB', label: '上市公司之母公司' },
      { value: 'OC', label: '上市公司之子公司' },
      { value: 'OD', label: '非上市公司,年收入规模在5亿以上' },
      { value: 'OE', label: '创业公司,估值达到10亿以上' },
      { value: 'OF', label: '外企中国或亚洲子公司' },
      { value: 'OG', label: '会计师事务所' },
      { value: 'OH', label: '投行券商' },
      { value: 'OI', label: '投资企业' },
      { value: 'OJ', label: '以上都不符合,请说明' }
    ],
    showPositionPicker: false,
    showCompanyTypePicker: false,
    positionIndex: -1,
    companyTypeIndex: -1,
    positionDisplayText: '',
    companyTypeDisplayText: '',
    financialAbilityDisplayText: '',
    processAbilityDisplayText: '',
    leadershipAbilityDisplayText: '',
    capitalAbilityDisplayText: '',
    // 能力自评选项
    financialAbilityOptions: [
      { value: 'never_recognized', label: '未曾被他人明确认可过' },
      { value: 'recognized_by_non_finance', label: '曾得到非财人员明确认可' },
      { value: 'recognized_by_finance', label: '曾得到其他财务人员明确认可' },
      { value: 'recognized_by_expert', label: '曾得到财务专家的明确认可' }
    ],
    businessAbilityOptions: [
      { value: 'never_recognized', label: '未曾被业务明确认可过' },
      { value: 'recognized_by_business', label: '曾得到业务人员明确认可' },
      { value: 'recognized_by_leader', label: '曾得到业务领军人明确认可' },
      { value: 'recognized_by_ceo', label: '曾得到老板/CEO 明确认可' }
    ],
    processAbilityOptions: [
      { value: 'no_participation', label: '基本没有参与过相关项目' },
      { value: 'participated', label: '参与过相关项目并做出了应有贡献' },
      { value: 'managed', label: '管理过项目并带领项目团队基本达成目标' },
      { value: 'led_transformation', label: '引领过组织变革中的流程和系统转型部分' }
    ],
    leadershipAbilityOptions: [
      { value: 'within_team', label: '影响力范围主要集中在下属团队内' },
      { value: 'peer_teams', label: '影响力覆盖到平级的其他团队, 常被咨询建议和意见, 且经常被吸纳' },
      { value: 'senior_leadership', label: '影响力能向上到达上级领导, 重要的建议和意见被倾听和重视, 常常被采纳' },
      { value: 'external', label: '影响力能到达组织以外, 在外部合作伙伴和同行问有良好声誉, "软实力"带来的资源帮助企业更好的实现目标' }
    ],
    capitalAbilityOptions: [
      { value: 'limited_exposure', label: '主要关注企业日常经营, 对资本运作和价值管理接触不多' },
      { value: 'secondary_role', label: '有所学习了解和接触, 但仅在边操作为次要角色参与过相关项目' },
      { value: 'core_member', label: '深度 (作为团队主力成员之一) 参与过相关项目并做出了应有贡献' },
      { value: 'led_projects', label: '主导过项目并带领团队基本达成目标, 提升了企业价值' }
    ],
    financialAbilityIndex: -1,
    processAbilityIndex: -1,
    leadershipAbilityIndex: -1,
    capitalAbilityIndex: -1
  },

  onLoad() {
    this.loadUserInfo();
  },

  // 切换会员详细资料展开/折叠
  toggleMemberProfile() {
    this.setData({
      showMemberProfile: !this.data.showMemberProfile
    });
  },

  // 切换能力自评展开/折叠
  toggleAbilityAssessment() {
    this.setData({
      showAbilityAssessment: !this.data.showAbilityAssessment
    });
  },

  async loadUserInfo() {
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

      const res = await app.request({
        url: `/users/${userInfo.id}`,
        method: 'GET'
      });

      if (res.success) {
        const user = res.data;
        // 格式化创建时间
        const created_at_formatted = user.created_at 
          ? this.formatDateTime(user.created_at)
          : '';

        // 根据用户角色确定显示的ID和标签
        let idLabel = '会员ID';
        let idValue = '未设置';
        if (user.role === 'instructor') {
          idLabel = '教练编号';
          idValue = user.instructor_id || '未设置';
        } else if (user.role === 'member') {
          idLabel = '会员编号';
          idValue = user.member_id || '未设置';
        }

        // 解析会员详细资料和能力自评
        let memberProfile = {
          position: '',
          position_other: '',
          company_type: '',
          company_type_other: '',
          job_title: '',
          position_years: '',
          total_work_years: '',
          managed_team_size: '',
          total_finance_team_size: '',
          reporting_layers: ''
        };
        if (user.member_profile) {
          if (typeof user.member_profile === 'string') {
            try {
              memberProfile = { ...memberProfile, ...JSON.parse(user.member_profile) };
            } catch (e) {
              console.warn('解析member_profile失败:', e);
            }
          } else {
            memberProfile = { ...memberProfile, ...user.member_profile };
          }
        }

        let abilityAssessment = {
          financial_ability: '',
          business_ability: '',
          process_ability: '',
          leadership_ability: '',
          capital_ability: ''
        };
        if (user.ability_assessment) {
          if (typeof user.ability_assessment === 'string') {
            try {
              const parsed = JSON.parse(user.ability_assessment);
              abilityAssessment = { ...abilityAssessment, ...parsed };
              // 如果之前是多选数组，转换为单选（取第一个值）
              if (Array.isArray(abilityAssessment.business_ability)) {
                abilityAssessment.business_ability = abilityAssessment.business_ability.length > 0 ? abilityAssessment.business_ability[0] : '';
              } else if (typeof abilityAssessment.business_ability !== 'string') {
                abilityAssessment.business_ability = '';
              }
            } catch (e) {
              console.warn('解析ability_assessment失败:', e);
            }
          } else {
            abilityAssessment = { ...abilityAssessment, ...user.ability_assessment };
            // 如果之前是多选数组，转换为单选（取第一个值）
            if (Array.isArray(abilityAssessment.business_ability)) {
              abilityAssessment.business_ability = abilityAssessment.business_ability.length > 0 ? abilityAssessment.business_ability[0] : '';
            } else if (typeof abilityAssessment.business_ability !== 'string') {
              abilityAssessment.business_ability = '';
            }
          }
        }

        this.setData({
          userInfo: {
            id: user.id,
            nickname: user.nickname,
            real_name: user.real_name,
            phone: user.phone,
            avatar_url: user.avatar_url,
            role: user.role,
            member_id: user.member_id,
            instructor_id: user.instructor_id,
            company: user.company,
            created_at: user.created_at,
            created_at_formatted: created_at_formatted,
            displayIdLabel: idLabel,
            displayIdValue: idValue,
            instructor_info: user.instructor_info,
            invite_stats: user.invite_stats
          },
          editedNickname: user.nickname || '',
          editedRealName: user.real_name || '',
          editedPhone: user.phone || '',
          memberProfile: memberProfile,
          abilityAssessment: abilityAssessment,
          positionIndex: memberProfile.position ? (() => {
            const idx = this.data.positionOptions.findIndex(opt => opt.value === memberProfile.position);
            return idx >= 0 ? idx : -1;
          })() : -1,
          companyTypeIndex: memberProfile.company_type ? (() => {
            const idx = this.data.companyTypeOptions.findIndex(opt => opt.value === memberProfile.company_type);
            return idx >= 0 ? idx : -1;
          })() : -1,
          financialAbilityIndex: abilityAssessment.financial_ability ? (() => {
            const idx = this.data.financialAbilityOptions.findIndex(opt => opt.value === abilityAssessment.financial_ability);
            return idx >= 0 ? idx : -1;
          })() : -1,
          processAbilityIndex: abilityAssessment.process_ability ? (() => {
            const idx = this.data.processAbilityOptions.findIndex(opt => opt.value === abilityAssessment.process_ability);
            return idx >= 0 ? idx : -1;
          })() : -1,
          leadershipAbilityIndex: abilityAssessment.leadership_ability ? (() => {
            const idx = this.data.leadershipAbilityOptions.findIndex(opt => opt.value === abilityAssessment.leadership_ability);
            return idx >= 0 ? idx : -1;
          })() : -1,
          capitalAbilityIndex: abilityAssessment.capital_ability ? (() => {
            const idx = this.data.capitalAbilityOptions.findIndex(opt => opt.value === abilityAssessment.capital_ability);
            return idx >= 0 ? idx : -1;
          })() : -1,
          positionDisplayText: memberProfile.position ? (() => {
            const opt = this.data.positionOptions.find(opt => opt.value === memberProfile.position);
            return opt ? opt.label : '';
          })() : '',
          companyTypeDisplayText: memberProfile.company_type ? (() => {
            const opt = this.data.companyTypeOptions.find(opt => opt.value === memberProfile.company_type);
            return opt ? opt.label : '';
          })() : '',
          financialAbilityDisplayText: abilityAssessment.financial_ability ? (() => {
            const opt = this.data.financialAbilityOptions.find(opt => opt.value === abilityAssessment.financial_ability);
            return opt ? opt.label : '';
          })() : '',
          processAbilityDisplayText: abilityAssessment.process_ability ? (() => {
            const opt = this.data.processAbilityOptions.find(opt => opt.value === abilityAssessment.process_ability);
            return opt ? opt.label : '';
          })() : '',
          leadershipAbilityDisplayText: abilityAssessment.leadership_ability ? (() => {
            const opt = this.data.leadershipAbilityOptions.find(opt => opt.value === abilityAssessment.leadership_ability);
            return opt ? opt.label : '';
          })() : '',
          capitalAbilityDisplayText: abilityAssessment.capital_ability ? (() => {
            const opt = this.data.capitalAbilityOptions.find(opt => opt.value === abilityAssessment.capital_ability);
            return opt ? opt.label : '';
          })() : ''
        });

        // 初始化业务能力显示文本
        this.updateBusinessAbilityDisplayText();
      }
    } catch (error) {
      console.error('加载用户信息失败', error);
      wx.showToast({
        title: error.message || error.error || '加载失败',
        icon: 'none',
        duration: 3000
      });
    }
  },

  onNicknameInput(e) {
    this.setData({ editedNickname: e.detail.value });
  },

  onRealNameInput(e) {
    this.setData({ editedRealName: e.detail.value });
  },

  onPhoneInput(e) {
    this.setData({ editedPhone: e.detail.value });
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['original'], // 使用原图，但前端会检查大小
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        // 检查文件大小
        wx.getFileInfo({
          filePath: tempFilePath,
          success: (fileInfo) => {
            const fileSizeMB = fileInfo.size / (1024 * 1024);
            if (fileSizeMB > 8) {
              wx.showModal({
                title: '提示',
                content: `图片大小 ${fileSizeMB.toFixed(2)}MB，超过 8MB 限制，请选择较小的图片`,
                showCancel: false
              });
              return;
            }
            this.uploadAvatar(tempFilePath);
          },
          fail: () => {
            // 如果获取文件信息失败，直接上传（由后端验证）
            this.uploadAvatar(tempFilePath);
          }
        });
      },
      fail: (error) => {
        console.error('选择图片失败', error);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 上传头像
  async uploadAvatar(filePath) {
    wx.showLoading({
      title: '上传中...',
      mask: true
    });

    try {
      // 构建上传URL（小程序上传文件需要使用完整URL，且不能包含/api前缀）
      const baseUrl = app.globalData.apiBaseUrl.replace('/api', '');
      const uploadUrl = `${baseUrl}/api/users/upload-avatar`;
      
      console.log('上传头像URL:', uploadUrl);
      
      // 上传文件到服务器
      const uploadRes = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: uploadUrl,
          filePath: filePath,
          name: 'avatar',
          success: (res) => {
            console.log('上传响应状态码:', res.statusCode);
            console.log('上传响应数据:', res.data);
            try {
              const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
              if (res.statusCode === 200) {
                resolve(data);
              } else {
                reject(new Error(data.error || `上传失败: ${res.statusCode}`));
              }
            } catch (e) {
              console.error('解析响应失败:', e, res.data);
              reject(new Error('服务器响应格式错误: ' + res.data));
            }
          },
          fail: (err) => {
            console.error('上传失败:', err);
            reject(new Error(err.errMsg || '网络错误，请检查网络连接'));
          }
        });
      });

      if (uploadRes.success && uploadRes.data && uploadRes.data.avatar_url) {
        // 更新本地显示
        this.setData({
          'userInfo.avatar_url': uploadRes.data.avatar_url,
          editedAvatarUrl: uploadRes.data.avatar_url
        });

        wx.hideLoading();
        wx.showToast({
          title: '上传成功',
          icon: 'success'
        });
      } else {
        throw new Error(uploadRes.error || '上传失败');
      }
    } catch (error) {
      console.error('上传头像失败', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || error.error || '上传失败',
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 职位选择
  onPositionChange(e) {
    const index = parseInt(e.detail.value);
    if (index < 0 || index >= this.data.positionOptions.length) return;
    const option = this.data.positionOptions[index];
    this.setData({
      'memberProfile.position': option.value,
      'memberProfile.position_other': option.value === 'OF' ? this.data.memberProfile.position_other : '',
      positionIndex: index,
      positionDisplayText: option.label
    });
  },

  // 公司类型选择
  onCompanyTypeChange(e) {
    const index = parseInt(e.detail.value);
    if (index < 0 || index >= this.data.companyTypeOptions.length) return;
    const option = this.data.companyTypeOptions[index];
    this.setData({
      'memberProfile.company_type': option.value,
      'memberProfile.company_type_other': (option.value === 'OF' || option.value === 'OJ') ? this.data.memberProfile.company_type_other : '',
      companyTypeIndex: index,
      companyTypeDisplayText: option.label
    });
  },

  // 职位其他说明输入
  onPositionOtherInput(e) {
    this.setData({
      'memberProfile.position_other': e.detail.value
    });
  },

  // 公司类型其他说明输入
  onCompanyTypeOtherInput(e) {
    this.setData({
      'memberProfile.company_type_other': e.detail.value
    });
  },

  // 会员详细资料其他字段输入
  onJobTitleInput(e) {
    this.setData({
      'memberProfile.job_title': e.detail.value
    });
  },

  onPositionYearsInput(e) {
    this.setData({
      'memberProfile.position_years': e.detail.value
    });
  },

  onTotalWorkYearsInput(e) {
    this.setData({
      'memberProfile.total_work_years': e.detail.value
    });
  },

  onManagedTeamSizeInput(e) {
    this.setData({
      'memberProfile.managed_team_size': e.detail.value
    });
  },

  onTotalFinanceTeamSizeInput(e) {
    this.setData({
      'memberProfile.total_finance_team_size': e.detail.value
    });
  },

  onReportingLayersInput(e) {
    this.setData({
      'memberProfile.reporting_layers': e.detail.value
    });
  },

  // 能力自评选择
  onFinancialAbilityChange(e) {
    const index = parseInt(e.detail.value);
    if (index < 0 || index >= this.data.financialAbilityOptions.length) return;
    const option = this.data.financialAbilityOptions[index];
    this.setData({
      'abilityAssessment.financial_ability': option.value,
      financialAbilityIndex: index,
      financialAbilityDisplayText: option.label
    });
  },

  // 显示业务能力选择弹窗
  showBusinessAbilityPicker() {
    this.setData({
      showBusinessAbilityModal: true
    });
  },

  // 隐藏业务能力选择弹窗
  hideBusinessAbilityPicker() {
    this.setData({
      showBusinessAbilityModal: false
    });
    // 更新显示文本
    this.updateBusinessAbilityDisplayText();
  },

  // 选择业务能力选项（单选）
  selectBusinessAbilityOption(e) {
    const value = e.currentTarget.dataset.value;
    console.log('选择选项:', value);
    
    // 单选：直接设置为选中的值
    const abilityAssessment = { ...this.data.abilityAssessment };
    abilityAssessment.business_ability = value;
    
    this.setData({
      abilityAssessment: abilityAssessment
    });
    
    // 更新显示文本
    this.updateBusinessAbilityDisplayText();
    
    console.log('更新后的值:', this.data.abilityAssessment.business_ability);
  },

  // 更新业务能力显示文本
  updateBusinessAbilityDisplayText() {
    const selectedValue = this.data.abilityAssessment.business_ability || '';
    if (!selectedValue) {
      this.setData({
        businessAbilityDisplayText: ''
      });
      return;
    }
    
    const option = this.data.businessAbilityOptions.find(opt => opt.value === selectedValue);
    const label = option ? option.label : selectedValue;
    
    this.setData({
      businessAbilityDisplayText: label
    });
  },

  onProcessAbilityChange(e) {
    const index = parseInt(e.detail.value);
    if (index < 0 || index >= this.data.processAbilityOptions.length) return;
    const option = this.data.processAbilityOptions[index];
    this.setData({
      'abilityAssessment.process_ability': option.value,
      processAbilityIndex: index,
      processAbilityDisplayText: option.label
    });
  },

  onLeadershipAbilityChange(e) {
    const index = parseInt(e.detail.value);
    if (index < 0 || index >= this.data.leadershipAbilityOptions.length) return;
    const option = this.data.leadershipAbilityOptions[index];
    this.setData({
      'abilityAssessment.leadership_ability': option.value,
      leadershipAbilityIndex: index,
      leadershipAbilityDisplayText: option.label
    });
  },

  onCapitalAbilityChange(e) {
    const index = parseInt(e.detail.value);
    if (index < 0 || index >= this.data.capitalAbilityOptions.length) return;
    const option = this.data.capitalAbilityOptions[index];
    this.setData({
      'abilityAssessment.capital_ability': option.value,
      capitalAbilityIndex: index,
      capitalAbilityDisplayText: option.label
    });
  },

  // 获取能力自评选项标签
  getFinancialAbilityLabel(value) {
    const option = this.data.financialAbilityOptions.find(opt => opt.value === value);
    return option ? option.label : '请选择';
  },

  getProcessAbilityLabel(value) {
    const option = this.data.processAbilityOptions.find(opt => opt.value === value);
    return option ? option.label : '请选择';
  },

  getLeadershipAbilityLabel(value) {
    const option = this.data.leadershipAbilityOptions.find(opt => opt.value === value);
    return option ? option.label : '请选择';
  },

  getCapitalAbilityLabel(value) {
    const option = this.data.capitalAbilityOptions.find(opt => opt.value === value);
    return option ? option.label : '请选择';
  },

  getBusinessAbilityLabels(values) {
    if (!values || values.length === 0) return [];
    return values.map(v => {
      const option = this.data.businessAbilityOptions.find(opt => opt.value === v);
      return option ? option.label : v;
    });
  },

  // 获取选项的显示文本
  getPositionLabel(value) {
    const option = this.data.positionOptions.find(opt => opt.value === value);
    return option ? option.label : '请选择';
  },

  getCompanyTypeLabel(value) {
    const option = this.data.companyTypeOptions.find(opt => opt.value === value);
    return option ? option.label : '请选择';
  },

  async saveUserInfo() {
    try {
      const userInfo = app.globalData.userInfo;
      const { editedNickname, editedRealName, editedPhone, editedAvatarUrl, memberProfile, abilityAssessment } = this.data;

      // 验证手机号格式
      if (editedPhone && !/^1[3-9]\d{9}$/.test(editedPhone)) {
        wx.showToast({
          title: '手机号格式不正确',
          icon: 'none'
        });
        return;
      }

      // 构建更新数据
      const updateData = {};
      if (editedNickname !== undefined) {
        updateData.nickname = editedNickname;
      }
      if (editedRealName !== undefined) {
        updateData.real_name = editedRealName;
      }
      if (editedPhone !== undefined) {
        updateData.phone = editedPhone;
      }
      if (editedAvatarUrl !== undefined && editedAvatarUrl !== '') {
        updateData.avatar_url = editedAvatarUrl;
      }
      // 添加会员详细资料（只要有任何一个字段有值就保存）
      const hasMemberProfile = memberProfile && (
        memberProfile.position || 
        memberProfile.company_type || 
        memberProfile.job_title || 
        memberProfile.position_years || 
        memberProfile.total_work_years ||
        memberProfile.managed_team_size ||
        memberProfile.total_finance_team_size ||
        memberProfile.reporting_layers ||
        memberProfile.position_other ||
        memberProfile.company_type_other
      );
      if (hasMemberProfile) {
        updateData.member_profile = memberProfile;
      }
      // 添加能力自评（只要有任何一个字段有值就保存）
      const hasAbilityAssessment = abilityAssessment && (
        abilityAssessment.financial_ability ||
        abilityAssessment.business_ability ||
        abilityAssessment.process_ability ||
        abilityAssessment.leadership_ability ||
        abilityAssessment.capital_ability
      );
      if (hasAbilityAssessment) {
        updateData.ability_assessment = abilityAssessment;
      }

      const res = await app.request({
        url: `/users/${userInfo.id}`,
        method: 'PUT',
        data: updateData
      });

      if (res.success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        // 更新全局用户信息
        const currentUserInfo = app.globalData.userInfo;
        app.globalData.userInfo = {
          id: currentUserInfo.id,
          nickname: editedNickname,
          real_name: editedRealName,
          phone: editedPhone,
          avatar_url: editedAvatarUrl || currentUserInfo.avatar_url,
          role: currentUserInfo.role,
          member_id: currentUserInfo.member_id,
          instructor_id: currentUserInfo.instructor_id,
          company: currentUserInfo.company,
          created_at: currentUserInfo.created_at
        };
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (error) {
      console.error('保存用户信息失败', error);
      wx.showToast({
        title: error.error || error.message || '保存失败',
        icon: 'none',
        duration: 3000
      });
    }
  },

  formatDateTime(dateTime) {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
});
