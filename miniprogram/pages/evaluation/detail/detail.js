// pages/evaluation/detail/detail.js
const app = getApp();

Page({
  data: {
    evaluation: null,
    courseInfo: {},
    answers: {},
    loading: true
  },

  onLoad(options) {
    const { id } = options;
    if (!id) {
      wx.showModal({
        title: '提示',
        content: '评价ID不存在',
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }
    this.setData({ evaluationId: id });
    this.loadEvaluationDetail();
  },

  async loadEvaluationDetail() {
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

      // 获取评价详情
      console.log('获取评价详情，evaluationId:', this.data.evaluationId, 'user_id:', userInfo.id);
      const res = await app.request({
        url: `/evaluations/${this.data.evaluationId}?user_id=${userInfo.id}`,
        method: 'GET'
      });

      console.log('评价详情API响应:', res);

      if (!res || !res.success) {
        const errorMsg = res && res.error ? res.error : '获取评价详情失败';
        console.error('获取评价详情失败:', errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!res.data) {
        console.error('评价详情数据为空');
        throw new Error('评价不存在');
      }

      const evaluation = res.data;
      let answers = {};
      
      try {
        if (evaluation.answers) {
          answers = typeof evaluation.answers === 'string' 
            ? JSON.parse(evaluation.answers) 
            : evaluation.answers;
        }
      } catch (e) {
        console.error('解析答案失败:', e);
      }

      // 加载问卷模板以获取问题文本
      let questionnaireTemplate = null;
      try {
        const templateRes = await app.request({
          url: '/evaluations/questionnaire-template',
          method: 'GET',
          data: { course_id: evaluation.course_id }
        });
        console.log('问卷模板API响应:', templateRes);
        if (templateRes.success && templateRes.data) {
          questionnaireTemplate = templateRes.data;
          console.log('问卷模板加载成功，问题数量:', questionnaireTemplate.questions ? questionnaireTemplate.questions.length : 0);
        } else {
          console.error('问卷模板加载失败:', templateRes);
        }
      } catch (e) {
        console.error('加载问卷模板失败:', e);
      }
      
      // 如果问卷模板加载失败，尝试从后端获取默认模板
      if (!questionnaireTemplate) {
        console.warn('问卷模板加载失败，尝试获取默认模板');
        try {
          const defaultTemplateRes = await app.request({
            url: '/evaluations/questionnaire-template',
            method: 'GET'
          });
          if (defaultTemplateRes.success && defaultTemplateRes.data) {
            questionnaireTemplate = defaultTemplateRes.data;
            console.log('默认问卷模板加载成功');
          }
        } catch (e) {
          console.error('获取默认问卷模板失败:', e);
        }
      }
      
      console.log('最终问卷模板:', questionnaireTemplate ? '已加载' : '未加载');
      console.log('问题数量:', questionnaireTemplate && questionnaireTemplate.questions ? questionnaireTemplate.questions.length : 0);
      if (questionnaireTemplate && questionnaireTemplate.questions) {
        console.log('问题列表:', questionnaireTemplate.questions.map(q => ({ id: q.id, text: q.text })));
      }

      // 格式化Q6和Q8答案
      const q6Formatted = this.formatQ6Answer(answers.q6, evaluation.course_cases || []);
      const q8Formatted = this.formatQ8Answer(answers.q8);

      // 确保日期格式正确（防止后端返回非字符串类型）
      let scheduleDate = evaluation.schedule_date;
      let scheduleDateDisplay = evaluation.schedule_date_display;
      
      if (scheduleDate && typeof scheduleDate !== 'string') {
        // 如果是Date对象或其他类型，转换为字符串
        if (scheduleDate instanceof Date) {
          scheduleDate = scheduleDate.toISOString().split('T')[0];
        } else {
          scheduleDate = String(scheduleDate);
        }
      }
      
      if (!scheduleDateDisplay && scheduleDate) {
        // 如果没有格式化后的日期，自己格式化
        const dateStr = String(scheduleDate);
        let formattedDate = dateStr;
        if (dateStr.includes('T')) {
          formattedDate = dateStr.split('T')[0];
        } else if (dateStr.includes(' ')) {
          formattedDate = dateStr.split(' ')[0];
        }
        scheduleDateDisplay = evaluation.time_slot_text 
          ? `${formattedDate} ${evaluation.time_slot_text}` 
          : formattedDate;
      }

      console.log('设置页面数据:');
      console.log('- questionnaireTemplate:', questionnaireTemplate ? '存在' : '不存在');
      console.log('- answers:', answers);
      console.log('- q6Formatted:', q6Formatted);
      console.log('- q8Formatted:', q8Formatted);
      
      this.setData({
        evaluation,
        courseInfo: {
          title: evaluation.title,
          schedule_date: scheduleDate,
          time_slot_text: evaluation.time_slot_text,
          schedule_date_display: scheduleDateDisplay || scheduleDate,
          instructor_name: evaluation.instructor_name
        },
        answers,
        questionnaireTemplate,
        q6Formatted,
        q8Formatted,
        loading: false
      });
      
      console.log('页面数据设置完成，questionnaireTemplate.questions:', this.data.questionnaireTemplate && this.data.questionnaireTemplate.questions ? this.data.questionnaireTemplate.questions.length : 0);
    } catch (error) {
      console.error('加载评价详情失败', error);
      this.setData({ 
        loading: false,
        evaluation: null,
        questionnaireTemplate: null
      });
      
      const errorMessage = error.message || '加载评价详情失败';
      console.log('显示错误信息:', errorMessage);
      
      wx.showModal({
        title: '提示',
        content: errorMessage,
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  // 获取问题文本
  getQuestionText(questionId) {
    if (!this.data.questionnaireTemplate || !this.data.questionnaireTemplate.questions) {
      return questionId;
    }
    const question = this.data.questionnaireTemplate.questions.find(q => q.id === questionId);
    return question ? question.text : questionId;
  },

  // 获取答案文本（用于WXML显示）
  getAnswerText(questionId, answerValue) {
    if (!this.data.questionnaireTemplate || !this.data.questionnaireTemplate.questions) {
      return answerValue;
    }
    
    const question = this.data.questionnaireTemplate.questions.find(q => q.id === questionId);
    if (!question) {
      return answerValue;
    }

    // 单选题或多选题
    if (question.type === 'single' || question.type === 'multiple') {
      const option = question.options.find(opt => opt.id === answerValue || opt.value === answerValue);
      return option ? option.label : answerValue;
    }

    // 矩阵题
    if (question.type === 'matrix' && question.matrixCols) {
      const col = question.matrixCols.find(c => c.value === answerValue || c.id === answerValue);
      return col ? col.label : answerValue;
    }

    return answerValue;
  },

  // 格式化Q6案例评分
  formatQ6Answer(q6Answer, courseCases) {
    if (!q6Answer || typeof q6Answer !== 'object') {
      return [];
    }

    const cases = courseCases || [];
    const result = [];

    Object.keys(q6Answer).forEach(caseId => {
      const score = q6Answer[caseId];
      const caseItem = cases.find(c => (c.id || c) === caseId);
      const caseName = caseItem ? (caseItem.name || caseItem) : `案例${caseId.replace('case', '')}`;
      
      result.push({
        caseId,
        caseName,
        score: score && typeof score === 'number' && score >= 1 && score <= 5 ? score : null
      });
    });

    return result;
  },

  // 格式化Q8矩阵答案
  formatQ8Answer(q8Answer) {
    if (!q8Answer || typeof q8Answer !== 'object') {
      return [];
    }

    const rowMap = {
      'row1': '本次私教在本主题下的延伸课程',
      'row2': '本次私教在其他主题下的课程',
      'row3': '本主题下，其他私教的课程'
    };

    const colMap = {
      'A': '请马上帮我预报名',
      'B': '愿意考虑',
      'C': '不考虑',
      'col1': '请马上帮我预报名',
      'col2': '愿意考虑',
      'col3': '不考虑'
    };

    const result = [];
    Object.keys(q8Answer).forEach(rowKey => {
      const colValue = q8Answer[rowKey];
      result.push({
        rowKey,
        rowLabel: rowMap[rowKey] || rowKey,
        colValue,
        colLabel: colMap[colValue] || colValue
      });
    });

    return result;
  }
});

