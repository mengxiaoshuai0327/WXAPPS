// pages/instructor-profile/instructor-profile.js
const app = getApp();

Page({
  data: {
    instructorInfo: {},
    editingSection: null, // 当前正在编辑的section: 'background'
    editBackground: '',
    coursesList: [], // 课程列表
    instructorId: null, // 要查看的教练ID（如果为null，则查看当前登录用户的资料）
    isOwnProfile: false // 是否是查看自己的资料
  },

  onLoad(options) {
    console.log('[讲师资料] 页面加载，options:', options);
    // 从参数中获取要查看的教练ID
    const instructorId = options.id ? parseInt(options.id) : null;
    this.setData({ instructorId });
    this.loadInstructorInfo();
  },

  onShow() {
    console.log('[讲师资料] 页面显示');
    // 如果数据为空，重新加载
    if (!this.data.instructorInfo || !this.data.instructorInfo.nickname) {
      this.loadInstructorInfo();
    }
  },

  async loadInstructorInfo() {
    try {
      console.log('[讲师资料] 开始加载讲师信息');
      const userInfo = app.globalData.userInfo;
      const instructorId = this.data.instructorId;
      
      let targetUserId = instructorId;
      let isOwnProfile = false;
      
      // 如果没有传入ID，需要检查当前用户是否为教练
      if (!targetUserId) {
        if (!userInfo || userInfo.role !== 'instructor') {
          console.log('[讲师资料] 用户不是教练，且未指定教练ID，显示提示');
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
        // 查看自己的资料
        targetUserId = userInfo.id;
        isOwnProfile = true;
      } else {
        // 查看指定教练的资料，检查是否是自己的
        isOwnProfile = userInfo && userInfo.id === targetUserId && userInfo.role === 'instructor';
      }
      
      this.setData({ isOwnProfile });

      console.log('[讲师资料] 请求用户信息，user_id:', targetUserId, 'isOwnProfile:', isOwnProfile);
      const res = await app.request({
        url: `/users/${targetUserId}`,
        method: 'GET'
      });

      console.log('[讲师资料] API响应:', res);

      if (res.success) {
        const targetUser = res.data;
        
        // 检查目标用户是否为教练
        if (targetUser.role !== 'instructor') {
          wx.showModal({
            title: '提示',
            content: '该用户不是教练',
            showCancel: false,
            success: () => {
              wx.navigateBack();
            }
          });
          return;
        }
        
        // 获取教练详细信息
        const instructorInfo = targetUser.instructor_info || {};
        // 使用 Object.assign 替代扩展运算符
        const mergedInfo = Object.assign({}, targetUser, {
          course_introduction: instructorInfo.course_introduction || instructorInfo.bio || '',
          background: instructorInfo.background || ''
        });
        
        console.log('[讲师资料] 合并后的讲师信息:', mergedInfo);
        
        this.setData({
          instructorInfo: mergedInfo
        });
        
        // 加载该教练的课程列表
        this.loadCoursesList(targetUserId);
      } else {
        console.error('[讲师资料] API返回失败:', res.error);
        wx.showToast({
          title: res.error || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('[讲师资料] 加载讲师资料失败', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 选择头像
  chooseAvatar() {
    // 只有查看自己的资料时才能上传头像
    if (!this.data.isOwnProfile) {
      return;
    }
    
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
        // 更新用户头像
        const userInfo = app.globalData.userInfo;
        if (userInfo && userInfo.id) {
          // 保存头像URL到服务器
          const saveRes = await app.request({
            url: `/users/${userInfo.id}`,
            method: 'PUT',
            data: {
              avatar_url: uploadRes.data.avatar_url
            }
          });

          if (saveRes.success) {
            // 更新本地显示和全局数据
            this.setData({
              'instructorInfo.avatar_url': uploadRes.data.avatar_url
            });
            
            // 更新全局用户信息
            app.globalData.userInfo = Object.assign({}, app.globalData.userInfo, {
              avatar_url: uploadRes.data.avatar_url
            });
            wx.setStorageSync('userInfo', app.globalData.userInfo);

            wx.hideLoading();
            wx.showToast({
              title: '上传成功',
              icon: 'success'
            });
          } else {
            throw new Error(saveRes.error || '保存失败');
          }
        } else {
          throw new Error('用户信息不存在');
        }
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

  // 加载课程列表
  async loadCoursesList(instructorId) {
    try {
      console.log('[讲师资料] 开始加载课程列表, instructorId:', instructorId);
      const res = await app.request({
        url: `/courses/list?instructor_id=${instructorId}`,
        method: 'GET'
      });

      if (res.success && res.data) {
        console.log('[讲师资料] 课程列表加载成功，数量:', res.data.length);
        this.setData({
          coursesList: res.data || []
        });
      } else {
        console.error('[讲师资料] 课程列表加载失败:', res.error);
        this.setData({
          coursesList: []
        });
      }
    } catch (error) {
      console.error('[讲师资料] 加载课程列表失败', error);
      this.setData({
        coursesList: []
      });
    }
  },

  // 开始编辑个人背景
  editBackground() {
    // 只有查看自己的资料时才能编辑
    if (!this.data.isOwnProfile) {
      return;
    }
    
    this.setData({
      editingSection: 'background',
      editBackground: this.data.instructorInfo.background || ''
    });
  },

  // 取消编辑
  cancelEdit() {
    this.setData({
      editingSection: null,
      editBackground: ''
    });
  },

  // 输入个人背景
  onBackgroundInput(e) {
    this.setData({
      editBackground: e.detail.value
    });
  },

  // 保存个人背景
  async saveBackground() {
    // 只有查看自己的资料时才能保存
    if (!this.data.isOwnProfile) {
      return;
    }
    
    const content = this.data.editBackground.trim();
    
    if (!content) {
      wx.showToast({
        title: '请输入个人背景介绍',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    try {
      const userInfo = app.globalData.userInfo;
      const res = await app.request({
        url: '/users/instructor/profile',
        method: 'PUT',
        data: {
          user_id: userInfo.id,
          background: content
        }
      });

      if (res.success) {
        this.setData({
          'instructorInfo.background': content,
          editingSection: null,
          editBackground: ''
        });
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      } else {
        throw new Error(res.error || '保存失败');
      }
    } catch (error) {
      console.error('保存个人背景失败', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || error.error || '保存失败',
        icon: 'none',
        duration: 3000
      });
    }
  }
});
