<template>
  <div class="evaluation-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>评价管理</span>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <!-- 课程评价跟进列表 -->
        <el-tab-pane label="课程评价跟进" name="follow-up">
          <div class="filter-bar" style="margin-bottom: 20px;">
            <el-form :inline="true">
              <el-form-item label="课程">
                <el-select v-model="followUpFilters.course_id" placeholder="全部课程" clearable style="width: 200px" @change="loadFollowUpList">
                  <el-option 
                    v-for="course in courses" 
                    :key="course.id" 
                    :label="course.title" 
                    :value="course.id" 
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="教练">
                <el-select v-model="followUpFilters.instructor_id" placeholder="全部教练" clearable style="width: 200px" @change="loadFollowUpList">
                  <el-option 
                    v-for="instructor in instructors" 
                    :key="instructor.id" 
                    :label="instructor.nickname" 
                    :value="instructor.id" 
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="评价状态">
                <el-select v-model="followUpFilters.status" placeholder="全部状态" clearable style="width: 150px" @change="loadFollowUpList">
                  <el-option label="已触发评价" value="triggered" />
                  <el-option label="待触发评价" value="not_triggered" />
                </el-select>
              </el-form-item>
            </el-form>
          </div>

          <el-table :data="followUpList" style="width: 100%" v-loading="followUpLoading">
            <el-table-column prop="id" label="排课ID" width="100" />
            <el-table-column prop="course_title" label="课程" min-width="200">
              <template #default="scope">
                <div>{{ scope.row.course_title }}</div>
                <div style="font-size: 12px; color: #999;">{{ scope.row.course_code }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="instructor_name" label="教练" width="120" />
            <el-table-column label="上课时间" width="180">
              <template #default="scope">
                <div>{{ scope.row.schedule_date_formatted }}</div>
                <div style="font-size: 12px; color: #999;">
                  {{ scope.row.time_slot_text }} 
                  <span v-if="scope.row.start_time && scope.row.end_time">
                    ({{ scope.row.start_time.substring(0, 5) }}-{{ scope.row.end_time.substring(0, 5) }})
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="报名情况" width="120">
              <template #default="scope">
                <div>{{ scope.row.active_booking_count }}/{{ scope.row.max_students }}</div>
                <div style="font-size: 12px; color: #999;">总预订: {{ scope.row.booking_count }}</div>
              </template>
            </el-table-column>
            <el-table-column label="评价状态" width="120">
              <template #default="scope">
                <el-tag :type="getEvaluationStatusType(scope.row.evaluation_status_code)">
                  {{ scope.row.evaluation_status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="评价数量" width="100">
              <template #default="scope">
                <span>{{ scope.row.evaluation_count }} 份</span>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="课程状态" width="100">
          <template #default="scope">
                <el-tag :type="getScheduleStatusType(scope.row.status)">
                  {{ getScheduleStatusText(scope.row.status) }}
                </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
                <el-button size="small" @click="viewFollowUpDetail(scope.row)">查看详情</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-model:current-page="followUpPagination.page"
            v-model:page-size="followUpPagination.pageSize"
            :total="followUpPagination.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="loadFollowUpList"
            @current-change="loadFollowUpList"
            style="margin-top: 20px; justify-content: flex-end;"
          />
        </el-tab-pane>

        <!-- 评价明细列表 -->
        <el-tab-pane label="评价明细" name="detail">
          <div class="filter-bar" style="margin-bottom: 20px;">
            <el-form :inline="true">
              <el-form-item label="课程">
                <el-select v-model="detailFilters.course_id" placeholder="全部课程" clearable style="width: 200px" @change="loadEvaluations">
                  <el-option 
                    v-for="course in courses" 
                    :key="course.id" 
                    :label="course.title" 
                    :value="course.id" 
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="排课ID">
                <el-input v-model="detailFilters.schedule_id" placeholder="输入排课ID" clearable style="width: 150px" @change="loadEvaluations" />
              </el-form-item>
            </el-form>
          </div>

          <el-table :data="evaluations" style="width: 100%" v-loading="loading" border>
            <el-table-column prop="id" label="ID" width="70" align="center" />
            <el-table-column prop="user_name" label="姓名/手机号" width="150">
              <template #default="scope">
                <div style="font-weight: 500;">{{ scope.row.answers?.q10 || scope.row.user_name || '-' }}</div>
                <div style="font-size: 12px; color: #999;">
                  {{ scope.row.answers?.q11 || scope.row.user_member_id || '-' }}
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="course_title" label="课程信息" min-width="180">
              <template #default="scope">
                <div style="font-weight: 500;">{{ scope.row.course_title }}</div>
                <div style="font-size: 12px; color: #999;">
                  {{ scope.row.schedule_date_formatted }} {{ scope.row.time_slot_text }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="1) 培训价值" width="140" align="center">
              <template #default="scope">
                <el-tag v-if="scope.row.answers?.q1" :type="getQ1TagType(scope.row.answers.q1)" size="small">
                  {{ getAnswerLabel('q1', scope.row.answers.q1) }}
                </el-tag>
                <span v-else style="color: #999;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="2) CFO水平" width="130" align="center">
              <template #default="scope">
                <el-tag v-if="scope.row.answers?.q2" :type="getQ2TagType(scope.row.answers.q2)" size="small">
                  {{ getAnswerLabel('q2', scope.row.answers.q2) }}
                </el-tag>
                <span v-else style="color: #999;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="3) 认知突破" width="120" align="center">
              <template #default="scope">
                <el-tag v-if="scope.row.answers?.q3" :type="getQ3TagType(scope.row.answers.q3)" size="small">
                  {{ getAnswerLabel('q3', scope.row.answers.q3) }}
                </el-tag>
                <span v-else style="color: #999;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="4) 应用帮助" width="120" align="center">
              <template #default="scope">
                <el-tag v-if="scope.row.answers?.q4" :type="getQ4TagType(scope.row.answers.q4)" size="small">
                  {{ getAnswerLabel('q4', scope.row.answers.q4) }}
                </el-tag>
                <span v-else style="color: #999;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="5) 教练启发式授课" width="180" align="center">
              <template #default="scope">
                <div v-if="scope.row.answers?.q5" style="font-size: 12px;">
                  {{ getAnswerLabel('q5', scope.row.answers.q5) }}
                </div>
                <span v-else style="color: #999;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="6) 案例评分" width="250">
              <template #default="scope">
                <div v-if="scope.row.answers?.q6" style="font-size: 11px;">
                  <div v-for="(score, caseId) in scope.row.answers.q6" :key="caseId" style="margin-bottom: 3px; display: flex; align-items: center;">
                    <span style="min-width: 100px; font-weight: 500;">{{ getCaseLabel(caseId, scope.row.course_cases) }}:</span>
                    <el-rate :model-value="score" disabled :max="5" size="small" style="flex: 1;" />
                    <span style="margin-left: 8px; color: #666; min-width: 40px;">{{ score }}分</span>
                  </div>
                </div>
                <span v-else style="color: #999;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="7) 反馈建议" min-width="200" show-overflow-tooltip>
              <template #default="scope">
                <div style="font-size: 12px; max-height: 60px; overflow: hidden;">
                  {{ scope.row.answers?.q7 || scope.row.feedback || '-' }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="8) 未来课程报名" width="200">
              <template #default="scope">
                <div v-if="scope.row.answers?.q8" style="font-size: 11px;">
                  <div v-if="typeof scope.row.answers.q8 === 'object'">
                    <div v-for="(value, key) in scope.row.answers.q8" :key="key" style="margin-bottom: 3px;">
                      {{ formatQ8Answer(key, value) }}
                    </div>
                  </div>
                  <div v-else>{{ formatAnswer(scope.row.answers.q8) }}</div>
                </div>
                <span v-else style="color: #999;">-</span>
              </template>
            </el-table-column>
            <el-table-column label="9) 推荐意愿" width="150" align="center">
              <template #default="scope">
                <el-tag v-if="scope.row.answers?.q9" :type="scope.row.answers.q9 === 'A' ? 'success' : 'info'" size="small">
                  {{ getAnswerLabel('q9', scope.row.answers.q9) }}
                </el-tag>
                <span v-else style="color: #999;">-</span>
              </template>
            </el-table-column>
            <el-table-column prop="submitted_at_formatted" label="评价时间" width="160" align="center" />
            <el-table-column label="操作" width="180" fixed="right" align="center">
              <template #default="scope">
                <el-button size="small" @click="viewDetail(scope.row)">详情</el-button>
            <el-button size="small" type="danger" @click="deleteEvaluation(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

          <el-pagination
            v-model:current-page="detailPagination.page"
            v-model:page-size="detailPagination.pageSize"
            :total="detailPagination.total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="loadEvaluations"
            @current-change="loadEvaluations"
            style="margin-top: 20px; justify-content: flex-end;"
          />
        </el-tab-pane>

        <!-- 案例评分明细列表 -->
        <el-tab-pane label="案例评分明细" name="case-details">
          <div class="filter-bar" style="margin-bottom: 20px;">
            <el-form :inline="true">
              <el-form-item label="课程">
                <el-select v-model="caseDetailsFilters.course_id" placeholder="全部课程" clearable style="width: 200px" @change="loadCaseDetails">
                  <el-option 
                    v-for="course in courses" 
                    :key="course.id" 
                    :label="course.title" 
                    :value="course.id" 
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="排课ID">
                <el-input v-model="caseDetailsFilters.schedule_id" placeholder="输入排课ID" clearable style="width: 150px" @change="loadCaseDetails" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="loadCaseDetails">查询</el-button>
                <el-button @click="resetCaseDetailsFilters">重置</el-button>
              </el-form-item>
            </el-form>
          </div>

          <el-table :data="caseDetailsList || []" style="width: 100%" v-loading="caseDetailsLoading" border>
            <el-table-column prop="evaluation_id" label="评价ID" width="100" align="center" />
            <el-table-column prop="course_title" label="课程" min-width="200">
              <template #default="scope">
                <div style="font-weight: 500;">{{ scope.row.course_title }}</div>
                <div style="font-size: 12px; color: #999;">{{ scope.row.course_code }}</div>
              </template>
            </el-table-column>
            <el-table-column label="用户信息" width="150">
              <template #default="scope">
                <div>{{ scope.row.user_name || '-' }}</div>
                <div style="font-size: 12px; color: #999;">{{ scope.row.user_member_id || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column label="上课时间" width="150">
              <template #default="scope">
                <div>{{ scope.row.schedule_date }}</div>
                <div style="font-size: 12px; color: #999;">{{ scope.row.time_slot }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="submitted_at" label="评价时间" width="180" />
            <el-table-column prop="case_name" label="案例" width="150" align="center">
              <template #default="scope">
                <span style="font-weight: 500;">{{ scope.row.case_name }}</span>
              </template>
            </el-table-column>
            <el-table-column label="案例评分" width="200" align="center">
              <template #default="scope">
                <div v-if="scope.row.case_score" style="display: flex; align-items: center; justify-content: center; gap: 8px;">
                  <el-rate :model-value="scope.row.case_score" disabled :max="5" size="default" />
                  <span style="font-weight: 500; color: #409eff; font-size: 16px;">{{ scope.row.case_score }}分</span>
                </div>
                <span v-else style="color: #999;">未评分</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right" align="center">
              <template #default="scope">
                <el-button size="small" @click="viewEvaluationDetail(scope.row.evaluation_id)">查看评价详情</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-if="caseDetailsPagination && caseDetailsPagination.page !== undefined"
            v-model:current-page="caseDetailsPagination.page"
            v-model:page-size="caseDetailsPagination.pageSize"
            :total="caseDetailsPagination.total || 0"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="loadCaseDetails"
            @current-change="loadCaseDetails"
            style="margin-top: 20px; justify-content: flex-end;"
          />
        </el-tab-pane>

        <!-- 未来课程报名反馈列表 -->
        <el-tab-pane label="未来课程报名反馈" name="registration-feedback">
          <div class="filter-bar" style="margin-bottom: 20px;">
            <el-form :inline="true">
              <el-form-item label="课程">
                <el-select v-model="registrationFeedbackFilters.course_id" placeholder="全部课程" clearable style="width: 200px" @change="loadRegistrationFeedback">
                  <el-option 
                    v-for="course in courses" 
                    :key="course.id" 
                    :label="course.title" 
                    :value="course.id" 
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="排课ID">
                <el-input v-model="registrationFeedbackFilters.schedule_id" placeholder="输入排课ID" clearable style="width: 150px" @change="loadRegistrationFeedback" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="loadRegistrationFeedback">查询</el-button>
                <el-button @click="resetRegistrationFeedbackFilters">重置</el-button>
              </el-form-item>
            </el-form>
          </div>

          <el-table :data="registrationFeedbackList || []" style="width: 100%" v-loading="registrationFeedbackLoading" border>
            <el-table-column prop="evaluation_id" label="评价ID" width="100" align="center" />
            <el-table-column prop="course_title" label="课程" min-width="200">
              <template #default="scope">
                <div style="font-weight: 500;">{{ scope.row.course_title }}</div>
                <div style="font-size: 12px; color: #999;">{{ scope.row.course_code }}</div>
              </template>
            </el-table-column>
            <el-table-column label="用户信息" width="180">
              <template #default="scope">
                <div style="font-weight: 500;">{{ scope.row.user_name || '-' }}</div>
                <div style="font-size: 12px; color: #999;">{{ scope.row.user_member_id || '-' }}</div>
                <div style="font-size: 12px; color: #999;">{{ scope.row.user_phone || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column label="上课时间" width="150">
              <template #default="scope">
                <div>{{ scope.row.schedule_date_formatted }}</div>
                <div style="font-size: 12px; color: #999;">{{ scope.row.time_slot_text }}</div>
              </template>
            </el-table-column>
            <el-table-column prop="submitted_at_formatted" label="评价时间" width="180" />
            <el-table-column label="本次私教在本主题下的延伸课程" width="200" align="center">
              <template #default="scope">
                <el-tag :type="getRegistrationFeedbackTagType(scope.row.row1_answer)" size="small">
                  {{ getRegistrationFeedbackLabel(scope.row.row1_answer) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="本次私教在其他主题下的课程" width="200" align="center">
              <template #default="scope">
                <el-tag :type="getRegistrationFeedbackTagType(scope.row.row2_answer)" size="small">
                  {{ getRegistrationFeedbackLabel(scope.row.row2_answer) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="本主题下，其他私教的课程" width="200" align="center">
              <template #default="scope">
                <el-tag :type="getRegistrationFeedbackTagType(scope.row.row3_answer)" size="small">
                  {{ getRegistrationFeedbackLabel(scope.row.row3_answer) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right" align="center">
              <template #default="scope">
                <el-button size="small" @click="viewEvaluationDetail(scope.row.evaluation_id)">查看评价详情</el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-if="registrationFeedbackPagination && registrationFeedbackPagination.page !== undefined"
            v-model:current-page="registrationFeedbackPagination.page"
            v-model:page-size="registrationFeedbackPagination.pageSize"
            :total="registrationFeedbackPagination.total || 0"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="loadRegistrationFeedback"
            @current-change="loadRegistrationFeedback"
            style="margin-top: 20px; justify-content: flex-end;"
          />
        </el-tab-pane>
      </el-tabs>

      <!-- 评价详情对话框 -->
      <el-dialog 
        v-model="showDetailDialog" 
        title="评价详情" 
        width="900px"
      >
        <el-descriptions :column="2" border v-if="currentEvaluation">
          <el-descriptions-item label="用户">
            {{ currentEvaluation.user_name || currentEvaluation.answers?.q10 || '-' }}
            <span v-if="currentEvaluation.user_member_id || currentEvaluation.answers?.q11" style="color: #999; margin-left: 8px;">
              ({{ currentEvaluation.user_member_id || currentEvaluation.answers?.q11 }})
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="课程">{{ currentEvaluation.course_title }}</el-descriptions-item>
          <el-descriptions-item label="上课日期">{{ currentEvaluation.schedule_date_formatted }} {{ currentEvaluation.time_slot_text }}</el-descriptions-item>
          <el-descriptions-item label="评价时间">{{ currentEvaluation.submitted_at_formatted }}</el-descriptions-item>
          <el-descriptions-item label="问卷答案" :span="2">
            <div v-if="currentEvaluation.answers" style="margin-top: 10px;">
              <!-- Q1: 培训价值评价 -->
              <div v-if="currentEvaluation.answers.q1" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
                <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q1') }}</div>
                <div style="color: #606266; font-size: 14px;">{{ getAnswerLabel('q1', currentEvaluation.answers.q1) }}</div>
              </div>
              
              <!-- Q2: CFO水平评价 -->
              <div v-if="currentEvaluation.answers.q2" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
                <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q2') }}</div>
                <div style="color: #606266; font-size: 14px;">{{ getAnswerLabel('q2', currentEvaluation.answers.q2) }}</div>
              </div>
              
              <!-- Q3: 认知突破评价 -->
              <div v-if="currentEvaluation.answers.q3" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
                <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q3') }}</div>
                <div style="color: #606266; font-size: 14px;">{{ getAnswerLabel('q3', currentEvaluation.answers.q3) }}</div>
              </div>
              
              <!-- Q4: 应用帮助评价 -->
              <div v-if="currentEvaluation.answers.q4" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
                <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q4') }}</div>
                <div style="color: #606266; font-size: 14px;">{{ getAnswerLabel('q4', currentEvaluation.answers.q4) }}</div>
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
                  <div v-for="(score, caseId) in currentEvaluation.answers.q6" :key="caseId" style="margin-bottom: 8px; padding: 8px; background: #fff; border-radius: 4px; display: flex; align-items: center;">
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
                    <div v-for="(value, key) in currentEvaluation.answers.q8" :key="key" style="margin-bottom: 6px; padding: 6px; background: #fff; border-radius: 4px;">
                      {{ formatQ8Answer(key, value) }}
                    </div>
                  </div>
                  <div v-else>{{ formatAnswer(currentEvaluation.answers.q8) }}</div>
                </div>
              </div>
              
              <!-- Q9: 推荐意愿 -->
              <div v-if="currentEvaluation.answers.q9" style="margin-bottom: 16px; padding: 12px; background: #f5f5f5; border-radius: 4px; border-left: 3px solid #409eff;">
                <div style="font-weight: 500; margin-bottom: 6px; color: #303133;">{{ getQuestionText('q9') }}</div>
                <div style="color: #606266; font-size: 14px;">{{ getAnswerLabel('q9', currentEvaluation.answers.q9) }}</div>
              </div>
            </div>
            <span v-else style="color: #999;">-</span>
          </el-descriptions-item>
        </el-descriptions>
        <template #footer>
          <el-button @click="showDetailDialog = false">关闭</el-button>
        </template>
      </el-dialog>

      <!-- 课程评价跟进详情对话框 -->
      <el-dialog 
        v-model="showFollowUpDetailDialog" 
        title="课程评价跟进详情" 
        width="900px"
      >
        <el-descriptions :column="2" border v-if="currentFollowUp">
          <el-descriptions-item label="排课ID">{{ currentFollowUp.id }}</el-descriptions-item>
          <el-descriptions-item label="课程">{{ currentFollowUp.course_title }} ({{ currentFollowUp.course_code }})</el-descriptions-item>
          <el-descriptions-item label="教练">{{ currentFollowUp.instructor_name }}</el-descriptions-item>
          <el-descriptions-item label="上课日期">{{ currentFollowUp.schedule_date_formatted }}</el-descriptions-item>
          <el-descriptions-item label="时间段">{{ currentFollowUp.time_slot_text }}</el-descriptions-item>
          <el-descriptions-item label="上课时间">
            <span v-if="currentFollowUp.start_time && currentFollowUp.end_time">
              {{ currentFollowUp.start_time.substring(0, 5) }} - {{ currentFollowUp.end_time.substring(0, 5) }}
            </span>
            <span v-else>-</span>
          </el-descriptions-item>
          <el-descriptions-item label="报名情况">{{ currentFollowUp.active_booking_count }}/{{ currentFollowUp.max_students }} 人</el-descriptions-item>
          <el-descriptions-item label="总预订数">{{ currentFollowUp.booking_count }} 人</el-descriptions-item>
          <el-descriptions-item label="评价状态">
            <el-tag :type="getEvaluationStatusType(currentFollowUp.evaluation_status_code)">
              {{ currentFollowUp.evaluation_status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="评价数量">{{ currentFollowUp.evaluation_count }} 份</el-descriptions-item>
          <el-descriptions-item label="课程状态">
            <el-tag :type="getScheduleStatusType(currentFollowUp.status)">
              {{ getScheduleStatusText(currentFollowUp.status) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <template #footer>
          <el-button @click="showFollowUpDetailDialog = false">关闭</el-button>
          <el-button type="primary" @click="viewEvaluationsBySchedule(currentFollowUp.id)">查看该课程的评价明细</el-button>
        </template>
      </el-dialog>

    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../utils/api';

const activeTab = ref('follow-up');
const followUpList = ref([]);
const followUpLoading = ref(false);
const evaluations = ref([]);
const loading = ref(false);
const caseDetailsList = ref([]);
const caseDetailsLoading = ref(false);
const registrationFeedbackList = ref([]);
const registrationFeedbackLoading = ref(false);
const showDetailDialog = ref(false);
const showFollowUpDetailDialog = ref(false);
const currentEvaluation = ref(null);
const currentFollowUp = ref(null);
const courses = ref([]);
const instructors = ref([]);

const followUpFilters = ref({
  course_id: null,
  instructor_id: null,
  status: null
});

const detailFilters = ref({
  course_id: null,
  schedule_id: null
});

const caseDetailsFilters = ref({
  course_id: null,
  schedule_id: null
});

const registrationFeedbackFilters = ref({
  course_id: null,
  schedule_id: null
});

const followUpPagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const detailPagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const caseDetailsPagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const registrationFeedbackPagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const handleTabChange = (tabName) => {
  if (tabName === 'follow-up') {
    loadFollowUpList();
  } else if (tabName === 'case-details') {
    loadCaseDetails();
  } else if (tabName === 'registration-feedback') {
    loadRegistrationFeedback();
  } else {
    loadEvaluations();
  }
};

const loadFollowUpList = async () => {
  followUpLoading.value = true;
  try {
    const params = {
      page: followUpPagination.value.page,
      pageSize: followUpPagination.value.pageSize,
      ...followUpFilters.value
    };
    // 移除空值参数
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === undefined || params[key] === '') {
        delete params[key];
      }
    });
    
    const res = await api.get('/admin/evaluations/follow-up', { params });
    
    if (res && res.success !== false) {
      followUpList.value = res.data || [];
      if (res.pagination) {
        followUpPagination.value.total = res.pagination.total;
      }
    } else {
      const errorMsg = res?.error || res?.message || '加载课程评价跟进列表失败';
      ElMessage.error(errorMsg);
      followUpList.value = [];
    }
  } catch (error) {
    console.error('加载课程评价跟进列表错误:', error);
    let errorMsg = '加载课程评价跟进列表失败';
    
    if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error') || error.message?.includes('ERR_NETWORK')) {
      errorMsg = '无法连接到后端服务，请检查后端服务是否正常运行（端口 3000）';
    } else if (error.response) {
      errorMsg = error.response.data?.error || 
                 error.response.data?.message || 
                 `请求失败: ${error.response.status}`;
    } else if (error.message) {
      errorMsg = error.message;
    }
    
    ElMessage.error(errorMsg);
    followUpList.value = [];
    followUpPagination.value.total = 0;
  } finally {
    followUpLoading.value = false;
  }
};

const loadEvaluations = async () => {
  loading.value = true;
  try {
    const params = {
      page: detailPagination.value.page,
      pageSize: detailPagination.value.pageSize,
      ...detailFilters.value
    };
    // 移除空值参数
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === undefined || params[key] === '') {
        delete params[key];
      }
    });
    
    const res = await api.get('/admin/evaluations', { params });
    
    if (res && res.success !== false) {
    evaluations.value = res.data || [];
      if (res.pagination) {
        detailPagination.value.total = res.pagination.total;
      }
    } else {
      const errorMsg = res?.error || res?.message || '加载评价列表失败';
      ElMessage.error(errorMsg);
      evaluations.value = [];
    }
  } catch (error) {
    console.error('加载评价列表错误:', error);
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message || 
                     '加载评价列表失败，请检查后端服务是否正常运行';
    ElMessage.error(errorMsg);
    evaluations.value = [];
    detailPagination.value.total = 0;
  } finally {
    loading.value = false;
  }
};

const loadCourses = async () => {
  try {
    const res = await api.get('/courses/admin/list');
    courses.value = res.data || [];
  } catch (error) {
    console.error('加载课程列表失败', error);
  }
};

const loadInstructors = async () => {
  try {
    const res = await api.get('/admin/instructors');
    instructors.value = res.data || [];
  } catch (error) {
    console.error('加载教练列表失败', error);
  }
};

const viewDetail = async (evaluation) => {
  try {
    const res = await api.get(`/admin/evaluations/${evaluation.id}`);
    currentEvaluation.value = res.data;
    showDetailDialog.value = true;
  } catch (error) {
    ElMessage.error('获取评价详情失败');
  }
};

const viewFollowUpDetail = (followUp) => {
  currentFollowUp.value = followUp;
  showFollowUpDetailDialog.value = true;
};

const viewEvaluationsBySchedule = (scheduleId) => {
  showFollowUpDetailDialog.value = false;
  activeTab.value = 'detail';
  detailFilters.value.schedule_id = scheduleId;
  loadEvaluations();
};

const resetCaseDetailsFilters = () => {
  caseDetailsFilters.value = {
    course_id: null,
    schedule_id: null
  };
  caseDetailsPagination.value.page = 1;
  loadCaseDetails();
};

const loadCaseDetails = async () => {
  caseDetailsLoading.value = true;
  try {
    const params = {
      page: caseDetailsPagination.value.page,
      pageSize: caseDetailsPagination.value.pageSize,
      ...caseDetailsFilters.value
    };
    // 过滤掉空值参数
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === undefined || params[key] === '') {
        delete params[key];
      }
    });

    console.log('[前端] 加载案例评分明细，参数:', params);
    const res = await api.get('/admin/evaluations/case-details', { params });
    console.log('[前端] 案例评分明细API响应:', res);
    
    if (res && res.success !== false) {
      caseDetailsList.value = res.data || [];
      console.log('[前端] 案例评分明细数据:', caseDetailsList.value);
      if (res.pagination) {
        caseDetailsPagination.value.total = res.pagination.total;
        console.log('[前端] 分页信息:', res.pagination);
      }
    } else {
      const errorMsg = res?.error || res?.message || '加载案例评分明细失败';
      console.error('[前端] 案例评分明细加载失败:', errorMsg);
      ElMessage.error(errorMsg);
      caseDetailsList.value = [];
    }
  } catch (error) {
    console.error('[前端] 加载案例评分明细异常:', error);
    console.error('[前端] 错误详情:', {
      response: error.response,
      data: error.response?.data,
      status: error.response?.status
    });
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message || 
                     '加载案例评分明细失败，请检查后端服务是否正常运行';
    ElMessage.error(errorMsg);
    caseDetailsList.value = [];
    caseDetailsPagination.value.total = 0;
  } finally {
    caseDetailsLoading.value = false;
  }
};

const loadRegistrationFeedback = async () => {
  registrationFeedbackLoading.value = true;
  try {
    const params = {
      page: registrationFeedbackPagination.value.page,
      pageSize: registrationFeedbackPagination.value.pageSize,
      ...registrationFeedbackFilters.value
    };
    // 过滤掉空值参数
    Object.keys(params).forEach(key => {
      if (params[key] === null || params[key] === undefined || params[key] === '') {
        delete params[key];
      }
    });

    console.log('[前端] 加载未来课程报名反馈，参数:', params);
    const res = await api.get('/admin/evaluations/course-registration-feedback', { params });
    console.log('[前端] 未来课程报名反馈API响应:', res);
    
    if (res && res.success !== false) {
      registrationFeedbackList.value = res.data || [];
      console.log('[前端] 未来课程报名反馈数据:', registrationFeedbackList.value);
      if (res.pagination) {
        registrationFeedbackPagination.value.total = res.pagination.total;
        console.log('[前端] 分页信息:', res.pagination);
      }
    } else {
      const errorMsg = res?.error || res?.message || '加载未来课程报名反馈失败';
      console.error('[前端] 未来课程报名反馈加载失败:', errorMsg);
      ElMessage.error(errorMsg);
      registrationFeedbackList.value = [];
    }
  } catch (error) {
    console.error('[前端] 加载未来课程报名反馈异常:', error);
    console.error('[前端] 错误详情:', {
      response: error.response,
      data: error.response?.data,
      status: error.response?.status
    });
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message || 
                     '加载未来课程报名反馈失败，请检查后端服务是否正常运行';
    ElMessage.error(errorMsg);
    registrationFeedbackList.value = [];
    registrationFeedbackPagination.value.total = 0;
  } finally {
    registrationFeedbackLoading.value = false;
  }
};

const resetRegistrationFeedbackFilters = () => {
  registrationFeedbackFilters.value = {
    course_id: null,
    schedule_id: null
  };
  registrationFeedbackPagination.value.page = 1;
  loadRegistrationFeedback();
};

const getRegistrationFeedbackLabel = (value) => {
  const labelMap = {
    'A': '请马上帮我预报名',
    'B': '愿意考虑',
    'C': '不考虑',
    // 兼容旧数据格式
    'col1': '请马上帮我预报名',
    'col2': '愿意考虑',
    'col3': '不考虑'
  };
  return labelMap[value] || value || '-';
};

const getRegistrationFeedbackTagType = (value) => {
  if (value === 'A' || value === 'col1') return 'success';
  if (value === 'B' || value === 'col2') return 'warning';
  if (value === 'C' || value === 'col3') return 'info';
  return '';
};

const viewEvaluationDetail = async (evaluationId) => {
  try {
    const res = await api.get(`/admin/evaluations/${evaluationId}`);
    if (res && res.success !== false && res.data) {
      currentEvaluation.value = res.data;
      showDetailDialog.value = true;
    } else {
      ElMessage.error(res?.error || '评价不存在');
    }
  } catch (error) {
    console.error('获取评价详情失败:', error);
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message || 
                     '获取评价详情失败';
    ElMessage.error(errorMsg);
  }
};

const deleteEvaluation = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除该评价吗？', '提示', { type: 'warning' });
    await api.delete(`/admin/evaluations/${id}`);
    ElMessage.success('删除成功');
    loadEvaluations();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const getEvaluationStatusType = (statusCode) => {
  const map = {
    'triggered': 'success',
    'pending': 'warning',
    'not_started': 'info'
  };
  return map[statusCode] || 'info';
};

const getScheduleStatusType = (status) => {
  const map = {
    'scheduled': 'success',
    'completed': 'info',
    'cancelled': 'danger'
  };
  return map[status] || 'info';
};

const getScheduleStatusText = (status) => {
  const map = {
    'scheduled': '已排课',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return map[status] || status;
};

const getTimeSlotText = (timeSlot) => {
  const map = {
    'morning': '上午',
    'afternoon': '下午',
    'full_day': '全天'
  };
  return map[timeSlot] || timeSlot;
};

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

const getCaseLabel = (caseId, courseCases) => {
  // 如果有课程案例配置，使用配置中的名称
  if (courseCases && Array.isArray(courseCases)) {
    const caseItem = courseCases.find(c => (c.id || c) === caseId);
    if (caseItem) {
      return caseItem.name || caseItem;
    }
  }
  
  // 否则使用默认映射
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

const getQ1TagType = (value) => {
  if (value === 'A' || value === 'D') return 'success';
  if (value === 'B') return 'info';
  return 'warning';
};

const getQ2TagType = (value) => {
  if (value === 'A') return 'success';
  if (value === 'B') return 'info';
  return 'warning';
};

const getQ3TagType = (value) => {
  if (value === 'A') return 'success';
  if (value === 'B') return 'info';
  return 'warning';
};

const getQ4TagType = (value) => {
  if (value === 'A') return 'success';
  if (value === 'B') return 'info';
  return 'warning';
};

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
    // 兼容旧数据格式
    'col1': '请马上帮我预报名',
    'col2': '愿意考虑',
    'col3': '不考虑'
  };
  const rowLabel = rowMap[rowKey] || rowKey;
  const colLabel = colMap[colValue] || colValue;
  return `${rowLabel}: ${colLabel}`;
};

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
  loadCourses();
  loadInstructors();
  // 默认加载第一个Tab的数据
  if (activeTab.value === 'follow-up') {
    loadFollowUpList();
  } else if (activeTab.value === 'case-details') {
    loadCaseDetails();
  } else if (activeTab.value === 'registration-feedback') {
    loadRegistrationFeedback();
  } else {
  loadEvaluations();
  }
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-bar {
  margin-bottom: 20px;
}
</style>
