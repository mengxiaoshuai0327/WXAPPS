<template>
  <div class="ranking-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>排行榜管理</span>
          <el-button type="primary" @click="saveSort" :loading="saving" :disabled="!hasChanges">
            保存排序
          </el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="排课榜" name="instructor_schedule">
          <div class="ranking-content">
            <div class="time-range-filter">
              <span>时间范围：</span>
              <el-radio-group v-model="timeRange" @change="loadRankings">
                <el-radio-button label="month">本月</el-radio-button>
                <el-radio-button label="quarter">近3个月</el-radio-button>
                <el-radio-button label="all">全部</el-radio-button>
              </el-radio-group>
            </div>
            <el-table 
              :data="rankings" 
              style="width: 100%" 
              v-loading="loading"
              row-key="target_id"
            >
              <el-table-column label="排名" width="120" align="center" fixed="left">
                <template #default="scope">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <el-button
                      link
                      size="small"
                      :disabled="scope.$index === 0"
                      @click="moveUp(scope.$index)"
                      :icon="ArrowUp"
                    />
                    <span>{{ scope.$index + 1 }}</span>
                    <el-button
                      link
                      size="small"
                      :disabled="scope.$index === rankings.length - 1"
                      @click="moveDown(scope.$index)"
                      :icon="ArrowDown"
                    />
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="课程名称" min-width="200">
                <template #default="scope">
                  <div>{{ scope.row.data?.name || '-' }}</div>
                  <div v-if="scope.row.data?.subtitle" style="font-size: 12px; color: #999;">
                    {{ scope.row.data.subtitle }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="课程编号" width="120">
                <template #default="scope">
                  {{ scope.row.data?.course_code || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="教练" width="120">
                <template #default="scope">
                  {{ scope.row.data?.instructor_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="主题" width="150">
                <template #default="scope">
                  {{ scope.row.data?.theme_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="排课次数" width="120" align="center">
                <template #default="scope">
                  {{ scope.row.score || 0 }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="学习榜" name="member_study">
          <div class="ranking-content">
            <div class="time-range-filter">
              <span>时间范围：</span>
              <el-radio-group v-model="timeRange" @change="loadRankings">
                <el-radio-button label="month">本月</el-radio-button>
                <el-radio-button label="quarter">近3个月</el-radio-button>
                <el-radio-button label="all">全部</el-radio-button>
              </el-radio-group>
            </div>
            <el-table 
              :data="rankings" 
              style="width: 100%" 
              v-loading="loading"
              row-key="target_id"
            >
              <el-table-column label="排名" width="120" align="center" fixed="left">
                <template #default="scope">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <el-button
                      link
                      size="small"
                      :disabled="scope.$index === 0"
                      @click="moveUp(scope.$index)"
                      :icon="ArrowUp"
                    />
                    <span>{{ scope.$index + 1 }}</span>
                    <el-button
                      link
                      size="small"
                      :disabled="scope.$index === rankings.length - 1"
                      @click="moveDown(scope.$index)"
                      :icon="ArrowDown"
                    />
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="用户" width="150">
                <template #default="scope">
                  {{ scope.row.data?.name || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="会员ID" width="120">
                <template #default="scope">
                  {{ scope.row.data?.member_id || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="学习次数" width="120" align="center">
                <template #default="scope">
                  {{ scope.row.score || 0 }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="主题榜" name="theme">
          <div class="ranking-content">
            <div class="time-range-filter">
              <span>时间范围：</span>
              <el-radio-group v-model="timeRange" @change="loadRankings">
                <el-radio-button label="month">本月</el-radio-button>
                <el-radio-button label="quarter">近3个月</el-radio-button>
                <el-radio-button label="all">全部</el-radio-button>
              </el-radio-group>
            </div>
            <el-table 
              :data="rankings" 
              style="width: 100%" 
              v-loading="loading"
              row-key="target_id"
            >
              <el-table-column label="排名" width="120" align="center" fixed="left">
                <template #default="scope">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <el-button
                      link
                      size="small"
                      :disabled="scope.$index === 0"
                      @click="moveUp(scope.$index)"
                      :icon="ArrowUp"
                    />
                    <span>{{ scope.$index + 1 }}</span>
                    <el-button
                      link
                      size="small"
                      :disabled="scope.$index === rankings.length - 1"
                      @click="moveDown(scope.$index)"
                      :icon="ArrowDown"
                    />
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="主题名称" min-width="200">
                <template #default="scope">
                  <el-button 
                    link 
                    type="primary" 
                    @click="viewThemeDetail(scope.row.target_id)"
                  >
                    {{ scope.row.data?.name || '-' }}
                  </el-button>
                </template>
              </el-table-column>
              <el-table-column label="排课次数" width="120" align="center">
                <template #default="scope">
                  {{ scope.row.score || 0 }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>

        <el-tab-pane label="评价榜" name="course">
          <div class="ranking-content">
            <div class="time-range-filter">
              <span>时间范围：</span>
              <el-radio-group v-model="timeRange" @change="loadRankings">
                <el-radio-button label="month">本月</el-radio-button>
                <el-radio-button label="quarter">近3个月</el-radio-button>
                <el-radio-button label="all">全部</el-radio-button>
              </el-radio-group>
            </div>
            <el-table 
              :data="rankings" 
              style="width: 100%" 
              v-loading="loading"
              row-key="target_id"
              @expand-change="handleExpandChange"
            >
              <el-table-column type="expand">
                <template #default="scope">
                  <div style="padding: 20px; background: #f5f7fa;">
                    <div v-loading="loadingCourseEvaluations[scope.row.target_id]">
                      <el-table 
                        :data="courseEvaluations[scope.row.target_id] || []" 
                        style="width: 100%"
                        border
                        size="small"
                      >
                        <el-table-column type="index" label="序号" width="60" align="center" />
                        <el-table-column label="会员信息" width="150">
                          <template #default="evalScope">
                            <div>{{ evalScope.row.user_name || '-' }}</div>
                            <div style="font-size: 12px; color: #999;">
                              {{ evalScope.row.member_id || '-' }}
                            </div>
                          </template>
                        </el-table-column>
                        <el-table-column label="上课时间" width="120">
                          <template #default="evalScope">
                            <div>{{ evalScope.row.schedule_date || '-' }}</div>
                            <div style="font-size: 12px; color: #999;">
                              {{ evalScope.row.time_slot || '-' }}
                            </div>
                          </template>
                        </el-table-column>
                        <el-table-column label="评价时间" width="160">
                          <template #default="evalScope">
                            {{ evalScope.row.submitted_at || '-' }}
                          </template>
                        </el-table-column>
                        <el-table-column label="综合得分" width="100" align="center">
                          <template #default="evalScope">
                            <span style="font-weight: bold; color: #409eff;">
                              {{ evalScope.row.score ? parseFloat(evalScope.row.score).toFixed(2) : '0.00' }}
                            </span>
                          </template>
                        </el-table-column>
                        <el-table-column label="操作" width="120" align="center" fixed="right">
                          <template #default="evalScope">
                            <el-button 
                              size="small" 
                              type="primary"
                              @click="viewEvaluationDetail(evalScope.row.evaluation_id)"
                            >
                              查看详情
                            </el-button>
                          </template>
                        </el-table-column>
                      </el-table>
                    </div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="排名" width="120" align="center" fixed="left">
                <template #default="scope">
                  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <el-button
                      link
                      size="small"
                      :disabled="scope.$index === 0"
                      @click="moveUp(scope.$index)"
                      :icon="ArrowUp"
                    />
                    <span>{{ scope.$index + 1 }}</span>
                    <el-button
                      link
                      size="small"
                      :disabled="scope.$index === rankings.length - 1"
                      @click="moveDown(scope.$index)"
                      :icon="ArrowDown"
                    />
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="课程名称" min-width="200">
                <template #default="scope">
                  <div>{{ scope.row.data?.name || '-' }}</div>
                  <div v-if="scope.row.data?.subtitle" style="font-size: 12px; color: #999;">
                    {{ scope.row.data.subtitle }}
                  </div>
                </template>
              </el-table-column>
              <el-table-column label="课程编号" width="120">
                <template #default="scope">
                  {{ scope.row.data?.course_code || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="教练" width="120">
                <template #default="scope">
                  {{ scope.row.data?.instructor_name || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="评价次数" width="120" align="center">
                <template #default="scope">
                  {{ scope.row.data?.evaluation_count || 0 }}
                </template>
              </el-table-column>
              <el-table-column label="综合得分" width="120" align="center">
                <template #default="scope">
                  {{ scope.row.score ? parseFloat(scope.row.score).toFixed(2) : '0.00' }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 主题详情弹窗 -->
    <el-dialog
      v-model="showThemeDetailDialog"
      :title="themeDetail.theme_name"
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-loading="loadingThemeDetail">
        <div style="margin-bottom: 20px;">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="主题名称">
              {{ themeDetail.theme_name || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="排课总数">
              {{ themeDetail.schedule_count || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="主题描述" :span="2">
              {{ themeDetail.theme_description || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <div style="margin-top: 20px;">
          <h3 style="margin-bottom: 15px;">课程列表</h3>
          <el-table :data="themeDetail.courses" style="width: 100%" border>
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column label="课程名称" min-width="200">
              <template #default="scope">
                <div>{{ scope.row.course_title || '-' }}</div>
                <div v-if="scope.row.course_subtitle" style="font-size: 12px; color: #999;">
                  {{ scope.row.course_subtitle }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="课程编号" width="120">
              <template #default="scope">
                {{ scope.row.course_code || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="授课教练" width="120">
              <template #default="scope">
                {{ scope.row.instructor_name || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="排课次数" width="120" align="center">
              <template #default="scope">
                {{ scope.row.schedule_count || 0 }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <template #footer>
        <el-button @click="showThemeDetailDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 评价详情弹窗 -->
    <el-dialog
      v-model="showEvaluationDetailDialog"
      title="评价详情"
      width="900px"
      :close-on-click-modal="false"
    >
      <div v-if="currentEvaluation">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="评价ID">{{ currentEvaluation.id }}</el-descriptions-item>
          <el-descriptions-item label="会员姓名">{{ currentEvaluation.user_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="会员ID">{{ currentEvaluation.user_member_id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="课程">{{ currentEvaluation.course_title || '-' }} ({{ currentEvaluation.course_code || '-' }})</el-descriptions-item>
          <el-descriptions-item label="上课日期">{{ currentEvaluation.schedule_date_formatted || '-' }}</el-descriptions-item>
          <el-descriptions-item label="时间段">{{ currentEvaluation.time_slot_text || '-' }}</el-descriptions-item>
          <el-descriptions-item label="评价时间">{{ currentEvaluation.submitted_at_formatted || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div style="margin-top: 20px;">
          <h3 style="margin-bottom: 15px;">问卷答案</h3>
          <div v-if="currentEvaluation.answers">
            <!-- Q1-Q4, Q9 选择题 -->
            <div v-for="q in ['q1', 'q2', 'q3', 'q4', 'q9']" :key="q" 
                 v-if="currentEvaluation.answers[q]" 
                 style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
              <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText(q) }}</div>
              <div style="color: #606266; font-size: 14px;">{{ getAnswerLabel(q, currentEvaluation.answers[q]) }}</div>
            </div>
            
            <!-- Q5: 教练启发式授课建议 -->
            <div v-if="currentEvaluation.answers.q5" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
              <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q5') }}</div>
              <div style="color: #606266; font-size: 14px;">{{ getAnswerLabel('q5', currentEvaluation.answers.q5) }}</div>
            </div>
            
            <!-- Q6: 案例评分 -->
            <div v-if="currentEvaluation.answers.q6" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
              <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q6') }}</div>
              <div style="color: #606266; font-size: 14px;">
                <div v-for="(score, caseId) in currentEvaluation.answers.q6" :key="caseId" 
                     style="margin-bottom: 8px; padding: 8px; background: #fff; border-radius: 4px; display: flex; align-items: center;">
                  <span style="min-width: 150px; font-weight: 500;">{{ getCaseLabel(caseId, currentEvaluation.course_cases) }}:</span>
                  <el-rate :model-value="score" disabled :max="5" size="default" style="flex: 1;" />
                  <span style="margin-left: 12px; font-weight: 500; color: #409eff; min-width: 50px;">{{ score }}分</span>
                </div>
              </div>
            </div>
            
            <!-- Q7: 反馈和建议 -->
            <div v-if="currentEvaluation.answers.q7 || currentEvaluation.feedback" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
              <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q7') }}</div>
              <div style="color: #606266; font-size: 14px; white-space: pre-wrap;">{{ currentEvaluation.answers.q7 || currentEvaluation.feedback || '-' }}</div>
            </div>
            
            <!-- Q8: 未来课程报名意愿（矩阵题） -->
            <div v-if="currentEvaluation.answers.q8" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
              <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q8') }}</div>
              <div style="color: #606266; font-size: 14px;">
                <div v-if="typeof currentEvaluation.answers.q8 === 'object'">
                  <div v-for="(value, key) in currentEvaluation.answers.q8" :key="key" 
                       style="margin-bottom: 6px; padding: 6px; background: #fff; border-radius: 4px;">
                    {{ formatQ8Answer(key, value) }}
                  </div>
                </div>
                <div v-else>{{ formatAnswer(currentEvaluation.answers.q8) }}</div>
              </div>
            </div>
            
            <!-- Q10, Q11: 姓名和手机号 -->
            <div v-if="currentEvaluation.answers.q10" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
              <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q10') }}</div>
              <div style="color: #606266; font-size: 14px;">{{ currentEvaluation.answers.q10 }}</div>
            </div>
            <div v-if="currentEvaluation.answers.q11" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
              <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q11') }}</div>
              <div style="color: #606266; font-size: 14px;">{{ currentEvaluation.answers.q11 }}</div>
            </div>
          </div>
          <div v-else style="color: #999;">暂无问卷答案</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showEvaluationDetailDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowUp, ArrowDown } from '@element-plus/icons-vue';
import api from '../../utils/api';

const rankings = ref([]);
const originalRankings = ref([]);
const loading = ref(false);
const saving = ref(false);
const activeTab = ref('instructor_schedule');
const timeRange = ref('all');
const showThemeDetailDialog = ref(false);
const loadingThemeDetail = ref(false);
const themeDetail = ref({
  theme_name: '',
  theme_description: '',
  schedule_count: 0,
  courses: []
});
const courseEvaluations = ref({});
const loadingCourseEvaluations = ref({});
const showEvaluationDetailDialog = ref(false);
const currentEvaluation = ref(null);

const hasChanges = computed(() => {
  if (rankings.value.length !== originalRankings.value.length) return true;
  return rankings.value.some((item, index) => {
    const original = originalRankings.value[index];
    return !original || item.target_id !== original.target_id;
  });
});

const handleTabChange = () => {
  loadRankings();
  // 清空展开的数据
  courseEvaluations.value = {};
};

// 处理表格展开
const handleExpandChange = async (row, expandedRows) => {
  // 只处理评价榜的展开
  if (activeTab.value !== 'course') return;
  // 如果展开，加载该课程的评价列表
  if (expandedRows.includes(row)) {
    if (!courseEvaluations.value[row.target_id]) {
      await loadCourseEvaluations(row.target_id);
    }
  }
};

const loadRankings = async () => {
  loading.value = true;
  try {
    const res = await api.get('/admin/rankings', {
      params: {
        type: activeTab.value,
        time_range: timeRange.value
      }
    });
    rankings.value = res.data || [];
    originalRankings.value = JSON.parse(JSON.stringify(rankings.value));
  } catch (error) {
    console.error('加载排行榜失败', error);
    ElMessage.error('加载排行榜失败');
  } finally {
    loading.value = false;
  }
};

const moveUp = (index) => {
  if (index > 0) {
    const temp = rankings.value[index];
    rankings.value[index] = rankings.value[index - 1];
    rankings.value[index - 1] = temp;
    // 更新排名
    rankings.value.forEach((item, idx) => {
      item.rank = idx + 1;
    });
  }
};

const moveDown = (index) => {
  if (index < rankings.value.length - 1) {
    const temp = rankings.value[index];
    rankings.value[index] = rankings.value[index + 1];
    rankings.value[index + 1] = temp;
    // 更新排名
    rankings.value.forEach((item, idx) => {
      item.rank = idx + 1;
    });
  }
};

const saveSort = async () => {
  saving.value = true;
  try {
    await api.put('/admin/rankings/sort', {
      type: activeTab.value,
      time_range: timeRange.value,
      rankings: rankings.value.map((item, index) => ({
        target_id: item.target_id,
        score: item.score,
        data: item.data,
        rank: index + 1
      }))
    });
    ElMessage.success('排序保存成功');
    originalRankings.value = JSON.parse(JSON.stringify(rankings.value));
  } catch (error) {
    console.error('保存排序失败', error);
    ElMessage.error('保存排序失败');
  } finally {
    saving.value = false;
  }
};

const loadCourseEvaluations = async (courseId) => {
  loadingCourseEvaluations.value[courseId] = true;
  try {
    const res = await api.get(`/admin/rankings/course/${courseId}/evaluations`, {
      params: {
        time_range: timeRange.value
      }
    });
    if (res && res.success && res.data) {
      courseEvaluations.value[courseId] = res.data;
    } else {
      ElMessage.error('获取评价列表失败');
      courseEvaluations.value[courseId] = [];
    }
  } catch (error) {
    console.error('获取课程评价列表失败', error);
    ElMessage.error('获取评价列表失败');
    courseEvaluations.value[courseId] = [];
  } finally {
    loadingCourseEvaluations.value[courseId] = false;
  }
};

const viewEvaluationDetail = async (evaluationId) => {
  try {
    const res = await api.get(`/admin/evaluations/${evaluationId}`);
    if (res && res.success && res.data) {
      currentEvaluation.value = res.data;
      showEvaluationDetailDialog.value = true;
    } else {
      ElMessage.error('获取评价详情失败');
    }
  } catch (error) {
    console.error('获取评价详情失败', error);
    ElMessage.error('获取评价详情失败');
  }
};

const viewThemeDetail = async (themeId) => {
  showThemeDetailDialog.value = true;
  loadingThemeDetail.value = true;
  try {
    const res = await api.get(`/rankings/theme/${themeId}/detail`, {
      params: {
        time_range: timeRange.value
      }
    });
    if (res && res.success && res.data) {
      themeDetail.value = {
        theme_name: res.data.theme_name || '-',
        theme_description: res.data.theme_description || '-',
        schedule_count: res.data.schedule_count || 0,
        courses: res.data.courses || []
      };
    } else {
      ElMessage.error('获取主题详情失败');
    }
  } catch (error) {
    console.error('获取主题详情失败', error);
    ElMessage.error('获取主题详情失败');
  } finally {
    loadingThemeDetail.value = false;
  }
};

// 问卷问题文本映射
const getQuestionText = (questionId) => {
  const questionMap = {
    'q1': '1. 相比于您参加过的与本主题类似的其他培训，您认为本次培训的价值',
    'q2': '2. 您认为本次授课的资深大牛CFO的水平是否达到了您来之前的预期?',
    'q3': '3. 认知突破，新的框架和方法论:',
    'q4': '4. 理解如何将认知突破和框架方法论应用于解决实际问题:',
    'q5': '5. 不论本次做的如何，您建议未来希望我们继续坚持教练启发式授课吗:',
    'q6': '6. 您认为授课中所用案例是否有效帮助了课程的学习？',
    'q7': '7. 您对本次课程还有哪些反馈和建议？',
    'q8': '8. 如果未来有本次大牛私教的其他课程，您也希望参加吗？',
    'q9': '9. 您是否愿意推荐本课程和推荐本培训项目给您认识的财务同行好友?',
    'q10': '10. 您的姓名',
    'q11': '11. 请输入您的手机号码'
  };
  return questionMap[questionId] || questionId;
};

// 答案标签映射
const getAnswerLabel = (questionId, answerValue) => {
  const answerMaps = {
    'q1': {
      'A': '更高',
      'B': '差不多',
      'C': '偏低',
      'D': '没参加过类似培训，但认为本次培训对您的价值比较高',
      'E': '没参加过类似培训，但认为本次培训对您没有很大价值'
    },
    'q2': {
      'A': '大为超出预期',
      'B': '基本符合预期',
      'C': '明显低于预期'
    },
    'q3': {
      'A': '很有启发',
      'B': '有一些启发',
      'C': '几乎没有启发'
    },
    'q4': {
      'A': '很有帮助',
      'B': '有一些帮助',
      'C': '几乎没有帮助'
    },
    'q5': {
      'A': '继续坚持，>50%时间用于互动式学习',
      'B': '很难做好，不必强求，可适当削减互动时间',
      'C': '不必继续，因为讲座式培训更适合中国文化'
    },
    'q9': {
      'A': '很愿意，希望立即行动',
      'B': '不太愿意或还要再想一想'
    }
  };
  
  const map = answerMaps[questionId];
  if (map && map[answerValue]) {
    return map[answerValue];
  }
  return answerValue;
};

// 案例标签映射
const getCaseLabel = (caseId, courseCases) => {
  if (courseCases && Array.isArray(courseCases)) {
    const caseItem = courseCases.find(c => (c.id || c) === caseId);
    if (caseItem) {
      return caseItem.name || caseItem;
    }
  }
  const caseMap = {
    'case1': '案例1',
    'case2': '案例2',
    'case3': '案例3',
    'case4': '案例4',
    'case5': '案例5',
    'case6': '案例6'
  };
  return caseMap[caseId] || caseId;
};

// Q8答案格式化
const formatQ8Answer = (rowKey, colValue) => {
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
  const rowLabel = rowMap[rowKey] || rowKey;
  const colLabel = colMap[colValue] || colValue;
  return `${rowLabel}: ${colLabel}`;
};

// 通用答案格式化
const formatAnswer = (answer) => {
  if (typeof answer === 'object' && answer !== null) {
    return JSON.stringify(answer);
  }
  if (Array.isArray(answer)) {
    return answer.join(', ');
  }
  return String(answer || '-');
};

onMounted(() => {
  loadRankings();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ranking-content {
  padding: 20px 0;
}

.time-range-filter {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 10px;
}

</style>
