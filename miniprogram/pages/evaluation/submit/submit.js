// pages/evaluation/submit/submit.js
const app = getApp();

Page({
  data: {
    course_id: null,
    schedule_id: null,
    booking_id: null,
    courseInfo: {},
    questionnaire: null,
    questions: [],
    answers: {},
    matrixPickerValues: {}, // 存储矩阵题下拉选择的值
    submitting: false,
    loading: false
  },

  onLoad(options) {
    console.log('评价提交页面加载，参数:', options);
    const { course_id, schedule_id, booking_id, evaluation_id } = options;
    
    // 如果传入了evaluation_id，说明是要查看已提交的评价详情，应该跳转到详情页
    if (evaluation_id) {
      console.log('检测到evaluation_id，跳转到详情页');
      wx.redirectTo({
        url: `/pages/evaluation/detail/detail?id=${encodeURIComponent(evaluation_id)}`,
        fail: (err) => {
          console.error('跳转到详情页失败:', err);
          wx.showModal({
            title: '提示',
            content: '评价不存在',
            showCancel: false,
            success: () => {
              wx.navigateBack();
            }
          });
        }
      });
      return;
    }
    
    if (!course_id || !schedule_id) {
      console.error('缺少必要参数:', { course_id, schedule_id, booking_id });
      wx.showModal({
        title: '错误',
        content: '缺少必要参数，无法加载问卷',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }
    
    this.setData({
      course_id: course_id,
      schedule_id: schedule_id,
      booking_id: booking_id
    });
    this.loadCourseInfo();
    this.loadQuestionnaire();
  },

  async loadCourseInfo() {
    try {
      // 获取课程信息（包含授课老师）
      const courseRes = await app.request({
        url: `/courses/${this.data.course_id}`,
        method: 'GET'
      });
      
      // 从待评价列表中获取排课信息（包含课程日期和授课老师）
      let scheduleInfo = null;
      try {
        const userInfo = app.globalData.userInfo;
        const pendingRes = await app.request({
          url: '/evaluations/pending',
          method: 'GET',
          data: { user_id: userInfo.id }
        });
        if (pendingRes.success && pendingRes.data) {
          scheduleInfo = pendingRes.data.find(c => 
            c.course_id == this.data.course_id && c.schedule_id == this.data.schedule_id
          );
        }
      } catch (e) {
        console.error('从待评价列表获取信息失败:', e);
      }
      
      let courseInfo = {};
      if (courseRes.success && courseRes.data) {
        courseInfo = { ...courseRes.data };
      }
      
      // 从待评价列表中获取日期和授课老师
      if (scheduleInfo) {
        console.log('排课信息:', scheduleInfo);
        
        // 格式化日期，只保留 YYYY-MM-DD 格式，去除时分秒
        if (scheduleInfo.schedule_date) {
          const dateStr = scheduleInfo.schedule_date;
          let formattedDate = dateStr;
          
          // 处理 ISO 8601 格式 (如: 2025-12-06T16:00:00.000Z)
          if (dateStr.includes('T')) {
            formattedDate = dateStr.split('T')[0];
          }
          // 处理普通日期时间格式 (如: 2025-12-06 16:00:00)
          else if (dateStr.includes(' ')) {
            formattedDate = dateStr.split(' ')[0];
          }
          // 如果已经是 YYYY-MM-DD 格式，直接使用
          
          courseInfo.schedule_date = formattedDate;
        }
        
        // 格式化时间段
        if (scheduleInfo.time_slot) {
          courseInfo.time_slot = scheduleInfo.time_slot;
          // 将时间段转换为中文显示
          const timeSlot = scheduleInfo.time_slot.toString().toLowerCase().trim();
          if (timeSlot === 'morning') {
            courseInfo.time_slot_text = '上午';
          } else if (timeSlot === 'afternoon') {
            courseInfo.time_slot_text = '下午';
          } else if (timeSlot === 'full_day' || timeSlot === 'fullday') {
            courseInfo.time_slot_text = '全天';
          } else {
            courseInfo.time_slot_text = '';
            console.warn('未知的时间段值:', timeSlot);
          }
          console.log('时间段:', scheduleInfo.time_slot, '->', courseInfo.time_slot_text);
        } else {
          // 如果没有时间段信息，设置为空
          courseInfo.time_slot_text = '';
          console.warn('警告: 排课信息中没有时间段字段，scheduleInfo:', JSON.stringify(scheduleInfo));
        }
        
        // 如果有授课老师信息，使用它
        if (scheduleInfo.instructor_name) {
          courseInfo.instructor_name = scheduleInfo.instructor_name;
        }
      }
      
      this.setData({ courseInfo });
    } catch (error) {
      console.error('加载课程信息失败', error);
    }
  },

  async loadQuestionnaire() {
    this.setData({ loading: true });
    try {
      console.log('加载问卷模板，course_id:', this.data.course_id);
      // 根据课程ID动态加载问卷模板（包含该课程的案例）
      const res = await app.request({
        url: '/evaluations/questionnaire-template',
        method: 'GET',
        data: {
          course_id: this.data.course_id
        }
      });
      console.log('问卷模板响应:', res);
      if (res.success && res.data) {
        console.log('问卷数据:', res.data);
        // 处理问卷数据，确保questions数组存在
        const questionnaire = res.data;
        const questions = questionnaire.questions || [];
        console.log('问卷问题数量:', questions.length);
        
        // 检查Q8的原始数据
        const q8Original = questions.find(q => q.id === 'q8');
        if (q8Original) {
          console.log('Q8原始数据:', JSON.stringify(q8Original, null, 2));
          console.log('Q8原始数据 - matrixCols:', q8Original.matrixCols);
          console.log('Q8原始数据 - matrixRows:', q8Original.matrixRows);
          console.log('Q8原始数据 - 所有键:', Object.keys(q8Original));
          
          // 检查是否有旧字段名matrixColumns
          if (!q8Original.matrixCols && q8Original.matrixColumns) {
            console.log('发现旧字段名matrixColumns，转换为matrixCols');
            q8Original.matrixCols = q8Original.matrixColumns;
          }
        } else {
          console.error('Q8问题在原始数据中未找到');
        }
        
        if (questions.length === 0) {
          console.error('问卷问题为空');
          wx.showToast({
            title: '问卷数据为空',
            icon: 'none',
            duration: 3000
          });
        }
        
        // 初始化矩阵题的下拉选择值，并确保数据格式正确
        const matrixPickerValues = {};
        const processedQuestions = questions.map(q => {
          // 深拷贝对象，确保所有属性都被保留
          const processedQ = JSON.parse(JSON.stringify(q));
          
          if (processedQ.type === 'matrix') {
            console.log(`处理矩阵题 ${processedQ.id}:`, {
              hasMatrixRows: !!processedQ.matrixRows,
              hasMatrixCols: !!processedQ.matrixCols,
              matrixRows: processedQ.matrixRows,
              matrixCols: processedQ.matrixCols,
              allKeys: Object.keys(processedQ),
              originalQKeys: Object.keys(q),
              originalQ: q
            });
            
            // 检查是否有旧字段名matrixColumns
            if (!processedQ.matrixCols && processedQ.matrixColumns) {
              console.log(`矩阵题 ${processedQ.id} 发现旧字段名matrixColumns，转换为matrixCols`);
              processedQ.matrixCols = processedQ.matrixColumns;
            }
            
            // 确保matrixRows和matrixCols存在
            if (!processedQ.matrixRows) {
              processedQ.matrixRows = q.matrixRows || [];
            }
            if (!processedQ.matrixCols) {
              processedQ.matrixCols = q.matrixCols || q.matrixColumns || [];
            }
            
            if (processedQ.matrixRows && processedQ.matrixCols) {
              // 确保matrixCols是数组且格式正确
              if (!Array.isArray(processedQ.matrixCols)) {
                console.error(`矩阵题 ${processedQ.id} 的选项不是数组:`, processedQ.matrixCols);
                processedQ.matrixCols = Array.isArray(q.matrixCols) ? [...q.matrixCols] : [];
              }
              
              // 确保matrixRows是数组
              if (!Array.isArray(processedQ.matrixRows)) {
                console.error(`矩阵题 ${processedQ.id} 的行不是数组:`, processedQ.matrixRows);
                processedQ.matrixRows = Array.isArray(q.matrixRows) ? [...q.matrixRows] : [];
              }
              
              // 验证选项数据
              if (processedQ.matrixCols.length > 0) {
                console.log(`矩阵题 ${processedQ.id} 的选项列表:`, processedQ.matrixCols);
                processedQ.matrixCols.forEach((col, index) => {
                  console.log(`  选项${index}:`, col);
                  // 确保每个选项都有value字段
                  if (!col.value) {
                    console.error(`矩阵题 ${processedQ.id} 的选项${index}缺少value字段:`, col);
                    // 尝试从id字段获取
                    if (col.id) {
                      col.value = col.id;
                      console.log(`  使用id作为value:`, col.value);
                    } else {
                      // 使用索引作为value
                      col.value = String(index);
                      console.log(`  使用索引作为value:`, col.value);
                    }
                  }
                  // 确保label字段存在
                  if (!col.label) {
                    console.error(`矩阵题 ${processedQ.id} 的选项${index}缺少label字段:`, col);
                  }
                });
              } else {
                console.error(`矩阵题 ${processedQ.id} 的选项为空`);
              }
            } else {
              console.error(`矩阵题 ${processedQ.id} 缺少matrixRows或matrixCols:`, {
                matrixRows: processedQ.matrixRows,
                matrixCols: processedQ.matrixCols,
                originalQ: q
              });
            }
          }
          
          return processedQ;
        });
        
        console.log('矩阵题picker值:', matrixPickerValues);
        
        // 验证处理后的数据
        const q8Processed = processedQuestions.find(q => q.id === 'q8');
        if (q8Processed) {
          console.log('处理后的Q8数据:', JSON.stringify(q8Processed, null, 2));
          console.log('处理后的Q8数据 - matrixCols:', q8Processed.matrixCols);
          console.log('处理后的Q8数据 - matrixRows:', q8Processed.matrixRows);
          
          // 验证matrixCols的数据结构
          if (q8Processed.matrixCols && Array.isArray(q8Processed.matrixCols)) {
            q8Processed.matrixCols.forEach((col, index) => {
              console.log(`matrixCols[${index}]:`, {
                value: col.value,
                label: col.label,
                hasValue: !!col.value,
                hasLabel: !!col.label,
                fullObject: col
              });
              // 确保value字段存在
              if (!col.value && col.id) {
                console.warn(`matrixCols[${index}]缺少value字段，使用id代替`);
                col.value = col.id;
              }
            });
          } else {
            console.error('Q8的matrixCols不是数组或不存在:', q8Processed.matrixCols);
          }
        } else {
          console.error('处理后的Q8问题未找到');
        }
        
        // 创建新的questionnaire对象，确保数据正确传递
        const updatedQuestionnaire = {
          ...questionnaire,
          questions: processedQuestions
        };
        
        // 再次验证updatedQuestionnaire中的Q8数据
        const q8InQuestionnaire = updatedQuestionnaire.questions.find(q => q.id === 'q8');
        if (q8InQuestionnaire) {
          console.log('updatedQuestionnaire中的Q8数据:', {
            id: q8InQuestionnaire.id,
            type: q8InQuestionnaire.type,
            hasMatrixRows: !!q8InQuestionnaire.matrixRows,
            hasMatrixCols: !!q8InQuestionnaire.matrixCols,
            matrixRowsLength: q8InQuestionnaire.matrixRows ? q8InQuestionnaire.matrixRows.length : 0,
            matrixColsLength: q8InQuestionnaire.matrixCols ? q8InQuestionnaire.matrixCols.length : 0,
            matrixCols: q8InQuestionnaire.matrixCols
          });
        }
        
        this.setData({ 
          questionnaire: updatedQuestionnaire,
          questions: processedQuestions,
          matrixPickerValues: matrixPickerValues,
          loading: false
        }, () => {
          // setData完成后的回调，验证数据
          console.log('setData完成，验证数据:');
          const q8 = this.data.questionnaire?.questions?.find(q => q.id === 'q8');
          if (q8) {
            console.log('setData后的Q8数据:', {
              id: q8.id,
              type: q8.type,
              hasMatrixRows: !!q8.matrixRows,
              hasMatrixCols: !!q8.matrixCols,
              matrixRowsLength: q8.matrixRows ? q8.matrixRows.length : 0,
              matrixColsLength: q8.matrixCols ? q8.matrixCols.length : 0,
              matrixCols: q8.matrixCols,
              matrixRows: q8.matrixRows,
              allKeys: Object.keys(q8)
            });
            
            // 如果matrixCols仍然为空，强制更新
            if (!q8.matrixCols || q8.matrixCols.length === 0) {
              console.error('setData后Q8的matrixCols仍然为空，尝试强制更新');
              const q8FromQuestions = this.data.questions?.find(q => q.id === 'q8');
              if (q8FromQuestions && q8FromQuestions.matrixCols && q8FromQuestions.matrixCols.length > 0) {
                console.log('从questions中恢复matrixCols:', q8FromQuestions.matrixCols);
                // 使用路径更新方式
                const q8Index = this.data.questionnaire.questions.findIndex(q => q.id === 'q8');
                if (q8Index >= 0) {
                  const updatedQuestions = [...this.data.questionnaire.questions];
                  updatedQuestions[q8Index] = {
                    ...updatedQuestions[q8Index],
                    matrixCols: q8FromQuestions.matrixCols,
                    matrixRows: q8FromQuestions.matrixRows
                  };
                  this.setData({
                    'questionnaire.questions': updatedQuestions
                  });
                }
              }
            }
          } else {
            console.error('setData后Q8问题未找到');
          }
        });
      } else {
        console.error('问卷模板加载失败，响应:', res);
        wx.showToast({
          title: res.error || '加载问卷失败',
          icon: 'none',
          duration: 3000
        });
        this.setData({ loading: false });
      }
    } catch (error) {
      console.error('加载问卷模板失败', error);
      wx.showToast({
        title: error.error || error.message || '加载问卷失败',
        icon: 'none',
        duration: 3000
      });
      this.setData({ loading: false });
    }
  },

  // 处理单选题
  onSingleSelect(e) {
    const { questionId } = e.currentTarget.dataset;
    const { value } = e.detail;
    const answers = { ...this.data.answers };
    answers[questionId] = value;
    this.setData({ answers });
  },

  // 处理多选题
  onMultipleSelect(e) {
    const { questionId } = e.currentTarget.dataset;
    const { value } = e.detail;
    const answers = { ...this.data.answers };
    if (!answers[questionId]) {
      answers[questionId] = [];
    }
    const index = answers[questionId].indexOf(value);
    if (index > -1) {
      answers[questionId].splice(index, 1);
    } else {
      answers[questionId].push(value);
    }
    this.setData({ answers });
  },

  // 处理评分题
  onRatingChange(e) {
    const { questionId, itemId, rating } = e.currentTarget.dataset;
    const answers = { ...this.data.answers };
    if (!answers[questionId]) {
      answers[questionId] = {};
    }
    answers[questionId][itemId] = parseInt(rating);
    this.setData({ answers });
  },

  // 处理矩阵题 - 单选按钮方式
  onMatrixSelect(e) {
    const { questionId, rowId } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    console.log('矩阵题选择变化:', {
      questionId,
      rowId,
      value,
      detail: e.detail,
      dataset: e.currentTarget.dataset
    });
    
    // 验证value是否有效
    if (!value || value === '') {
      console.error('矩阵题选择值为空，questionId:', questionId, 'rowId:', rowId, 'value:', value);
      // 尝试从radio组件本身获取value
      const radioValue = e.detail.value;
      if (!radioValue || radioValue === '') {
        console.error('无法获取radio的value值');
        wx.showToast({
          title: '选择失败，请重试',
          icon: 'none',
          duration: 2000
        });
        return;
      }
    }
    
    const answers = { ...this.data.answers };
    if (!answers[questionId]) {
      answers[questionId] = {};
    }
    answers[questionId][rowId] = value;
    
    console.log('更新后的答案:', answers[questionId]);
    
    this.setData({ answers });
  },

  // 获取矩阵题下拉选择的当前索引（用于WXML）
  getMatrixPickerValue(questionId, rowId) {
    const key = `${questionId}_${rowId}`;
    const storedValue = this.data.matrixPickerValues[key];
    if (storedValue !== undefined) {
      return storedValue;
    }
    
    // 如果存储中没有，从answers中查找
    const answers = this.data.answers[questionId];
    if (answers && answers[rowId]) {
      const question = this.data.questionnaire.questions.find(q => q.id === questionId);
      if (question && question.matrixCols) {
        const selectedValue = answers[rowId];
        const index = question.matrixCols.findIndex(col => col.value === selectedValue);
        if (index >= 0) {
          // 更新存储的值
          const matrixPickerValues = { ...this.data.matrixPickerValues };
          matrixPickerValues[key] = index;
          this.setData({ matrixPickerValues: matrixPickerValues });
          return index;
        }
      }
    }
    
    return 0; // 默认返回0
  },

  // 获取矩阵题下拉选择的当前标签（用于WXML）
  getMatrixPickerLabel(questionId, rowId) {
    const answers = this.data.answers[questionId];
    if (!answers || !answers[rowId]) {
      return '';
    }
    const question = this.data.questionnaire.questions.find(q => q.id === questionId);
    if (!question || !question.matrixCols) {
      return '';
    }
    const selectedValue = answers[rowId];
    const selectedCol = question.matrixCols.find(col => col.value === selectedValue);
    return selectedCol ? selectedCol.label : '';
  },

  // 处理文本输入
  onTextInput(e) {
    const { questionId } = e.currentTarget.dataset;
    const { value } = e.detail;
    const answers = { ...this.data.answers };
    answers[questionId] = value;
    this.setData({ answers });
  },

  // 验证必填项
  validateAnswers() {
    if (!this.data.questionnaire || !this.data.questionnaire.questions) {
      return { valid: false, message: '问卷加载失败' };
    }

    const requiredQuestions = this.data.questionnaire.questions.filter(q => q.required);
    for (const question of requiredQuestions) {
      if (question.type === 'rating') {
        // 评分题需要检查所有评分项
        const ratingAnswers = this.data.answers[question.id] || {};
        const allRated = question.ratingItems.every(item => ratingAnswers[item.id] !== undefined);
        if (!allRated) {
          return { valid: false, message: `请完成"${question.text}"的所有评分项` };
        }
      } else if (question.type === 'matrix') {
        // 矩阵题需要检查所有行
        const matrixAnswers = this.data.answers[question.id] || {};
        const allAnswered = question.matrixRows.every(row => matrixAnswers[row.id] !== undefined);
        if (!allAnswered) {
          return { valid: false, message: `请完成"${question.text}"的所有选项` };
        }
      } else if (!this.data.answers[question.id]) {
        return { valid: false, message: `请回答"${question.text}"` };
      }
    }
    return { valid: true };
  },

  async submitEvaluation() {
    const validation = this.validateAnswers();
    if (!validation.valid) {
      wx.showToast({
        title: validation.message,
        icon: 'none',
        duration: 3000
      });
      return;
    }

    this.setData({ submitting: true });

    try {
      const userInfo = app.globalData.userInfo;
      
      // 验证Q8答案格式
      console.log('提交评价前的答案数据:', JSON.stringify(this.data.answers, null, 2));
      if (this.data.answers.q8) {
        console.log('Q8答案详情:', JSON.stringify(this.data.answers.q8, null, 2));
        console.log('Q8答案类型:', typeof this.data.answers.q8);
        console.log('Q8答案键:', Object.keys(this.data.answers.q8));
      } else {
        console.warn('警告: Q8答案不存在');
      }
      
      const res = await app.request({
        url: '/evaluations/submit',
        method: 'POST',
        data: {
          user_id: userInfo.id,
          schedule_id: this.data.schedule_id,
          course_id: this.data.course_id,
          questionnaire_data: this.data.answers,
          feedback: this.data.answers.q7 || '' // q7是反馈意见
        }
      });

      if (res.success) {
        wx.showToast({
          title: '评价成功',
          icon: 'success'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(res.error || '提交失败');
      }
    } catch (error) {
      console.error('提交评价失败', error);
      wx.showToast({
        title: error.error || error.message || '提交失败',
        icon: 'none',
        duration: 3000
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
