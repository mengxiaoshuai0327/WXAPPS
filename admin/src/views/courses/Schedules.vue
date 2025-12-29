<template>
  <div class="schedule-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>排课列表</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建排课
          </el-button>
        </div>
      </template>

      <!-- 筛选条件 -->
      <el-form :inline="true" class="filter-form">
        <el-form-item label="课程">
          <el-select v-model="filters.course_id" placeholder="全部课程" clearable style="width: 200px">
            <el-option 
              v-for="course in courses" 
              :key="course.id" 
              :label="course.title" 
              :value="course.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="filters.date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            clearable
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadSchedules">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="success" :icon="Download" @click="exportToExcel" :loading="exporting">导出Excel</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="schedules" style="width: 100%" v-loading="loading">
        <el-table-column prop="course_code" label="课程编号" width="150">
          <template #default="scope">
            <span>{{ scope.row.course_code || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="course_title" label="课程" min-width="200" />
        <el-table-column label="上课日期" width="120">
          <template #default="scope">
            {{ formatDate(scope.row.schedule_date) }}
          </template>
        </el-table-column>
        <el-table-column label="时间段" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.time_slot === 'morning'">上午</el-tag>
            <el-tag type="success" v-else-if="scope.row.time_slot === 'afternoon'">下午</el-tag>
            <el-tag type="warning" v-else>全天</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="start_time" label="开始时间" width="100" />
        <el-table-column prop="end_time" label="结束时间" width="100" />
        <el-table-column label="活动地点" width="180" show-overflow-tooltip>
          <template #default="scope">
            <span>{{ scope.row.location || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="课前问卷链接" width="200" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.questionnaire_url" style="color: #409eff; cursor: pointer;" @click="copyQuestionnaireUrl(scope.row.questionnaire_url)">
              {{ scope.row.questionnaire_url }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="课前问卷ID" width="150">
          <template #default="scope">
            <span>{{ scope.row.questionnaire_id || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="报名情况" width="120">
          <template #default="scope">
            {{ scope.row.current_students }}/{{ scope.row.max_students }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="150">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
            <!-- 如果日期已过去但状态显示为已排课，显示提示 -->
            <span v-if="scope.row.original_status === 'scheduled' && scope.row.status === 'completed'" 
                  style="font-size: 12px; color: #999; margin-left: 5px;">
              (已过期)
            </span>
            <!-- 如果已通知意向用户，显示提示 -->
            <div v-if="scope.row.interest_users_notified && scope.row.status === 'scheduled'" 
                 style="font-size: 12px; color: #67C23A; margin-top: 5px;">
              ✓ 已通知意向用户
            </div>
          </template>
        </el-table-column>
        <el-table-column label="签到状态" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.checkin_triggered" type="success">已触发</el-tag>
            <el-tag v-else type="info">未触发</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="问卷状态" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.questionnaire_triggered" type="success">已触发</el-tag>
            <el-tag v-else type="info">未触发</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="意向会员" width="120">
          <template #default="scope">
            <span v-if="scope.row.interest_users_count > 0" style="color: #409EFF; cursor: pointer;" @click="viewInterestUsers(scope.row)">
              {{ scope.row.interest_users_count }}人
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="scope">
            <!-- 待开课状态显示开课按钮 -->
            <el-button 
              v-if="scope.row.status === 'draft'"
              size="small" 
              type="primary" 
              @click="openCourse(scope.row)"
            >
              开课
            </el-button>
            <el-button 
              size="small" 
              type="success" 
              @click="triggerQuestionnaire(scope.row)"
              :disabled="scope.row.questionnaire_triggered || scope.row.status !== 'completed'"
            >
              {{ scope.row.questionnaire_triggered ? '已触发' : '触发问卷' }}
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteSchedule(scope.row.id)"
              :disabled="scope.row.status === 'completed'"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 开课对话框 -->
    <el-dialog 
      v-model="showOpenCourseDialog" 
      title="开课" 
      width="600px"
    >
      <el-form :model="openCourseForm" label-width="100px">
        <el-form-item label="课程" required>
          <el-input :value="currentSchedule?.course_title" disabled />
        </el-form-item>
        <el-form-item label="上课日期" required>
          <el-date-picker
            v-model="openCourseForm.schedule_date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="时间段" required>
          <el-radio-group v-model="openCourseForm.time_slot" @change="handleOpenCourseTimeSlotChange">
            <el-radio label="morning">上午</el-radio>
            <el-radio label="afternoon">下午</el-radio>
            <el-radio label="full_day">全天</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-picker
            v-model="openCourseForm.start_time"
            format="HH:mm"
            value-format="HH:mm:ss"
            placeholder="选择时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-picker
            v-model="openCourseForm.end_time"
            format="HH:mm"
            value-format="HH:mm:ss"
            placeholder="选择时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="最大人数" required>
          <el-input-number v-model="openCourseForm.max_students" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="上课地址">
          <el-input 
            v-model="openCourseForm.location" 
            placeholder="请输入线下上课地址（选填）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="课前问卷链接">
          <el-input 
            v-model="openCourseForm.questionnaire_url" 
            placeholder="请输入课前问卷链接（选填）"
            maxlength="500"
          />
        </el-form-item>
        <el-form-item label="课前问卷ID">
          <el-input 
            v-model="openCourseForm.questionnaire_id" 
            placeholder="请输入课前问卷ID号（选填）"
            maxlength="100"
          />
        </el-form-item>
        <el-form-item v-if="currentSchedule && currentSchedule.interest_users_count > 0">
          <el-checkbox v-model="openCourseForm.notify_interest_users">
            通知{{ currentSchedule.interest_users_count }}位意向会员课程已开课
          </el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showOpenCourseDialog = false">取消</el-button>
        <el-button type="primary" @click="saveOpenCourse" :loading="savingOpenCourse">确认开课</el-button>
      </template>
    </el-dialog>

    <!-- 意向会员列表对话框 -->
    <el-dialog 
      v-model="showInterestUsersDialog" 
      title="意向会员列表" 
      width="600px"
    >
      <el-table :data="interestUsers" v-loading="loadingInterestUsers">
        <el-table-column prop="nickname" label="用户昵称" />
        <el-table-column prop="member_id" label="会员ID" />
        <el-table-column prop="phone" label="手机号" />
        <el-table-column prop="created_at" label="关注时间">
          <template #default="scope">
            {{ formatDateTime(scope.row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 创建/编辑对话框 -->
    <el-dialog 
      v-model="showCreateDialog" 
      :title="editingSchedule ? '编辑排课' : '创建排课'" 
      width="600px"
    >
      <el-form :model="scheduleForm" label-width="100px">
        <el-form-item label="课程" required>
          <el-select v-model="scheduleForm.course_id" placeholder="请选择课程" style="width: 100%">
            <el-option 
              v-for="course in courses" 
              :key="course.id" 
              :label="course.title" 
              :value="course.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="上课日期" required>
          <el-date-picker
            v-model="scheduleForm.schedule_date"
            type="date"
            placeholder="选择日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="时间段" required>
          <el-radio-group v-model="scheduleForm.time_slot" @change="handleTimeSlotChange">
            <el-radio label="morning">上午</el-radio>
            <el-radio label="afternoon">下午</el-radio>
            <el-radio label="full_day">全天</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-picker
            v-model="scheduleForm.start_time"
            format="HH:mm"
            value-format="HH:mm:ss"
            placeholder="选择时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-picker
            v-model="scheduleForm.end_time"
            format="HH:mm"
            value-format="HH:mm:ss"
            placeholder="选择时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="最大人数" required>
          <el-input-number v-model="scheduleForm.max_students" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="上课地址">
          <el-input 
            v-model="scheduleForm.location" 
            placeholder="请输入线下上课地址（选填）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveSchedule" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Download } from '@element-plus/icons-vue';
import axios from 'axios';
import api from '../../utils/api';

const schedules = ref([]);
const courses = ref([]);
const loading = ref(false);
const saving = ref(false);
const exporting = ref(false);
const showCreateDialog = ref(false);
const editingSchedule = ref(null);
const showOpenCourseDialog = ref(false);
const currentSchedule = ref(null);
const savingOpenCourse = ref(false);

const filters = ref({
  course_id: null,
  date: null
});

const scheduleForm = ref({
  course_id: null,
  schedule_date: '',
  time_slot: 'morning',
  start_time: '09:00:00',
  end_time: '12:00:00',
  max_students: 20,
  location: ''
});

const openCourseForm = ref({
  schedule_date: '',
  time_slot: 'morning',
  start_time: '09:00:00',
  end_time: '12:00:00',
  max_students: 20,
  location: '',
  questionnaire_url: '',
  questionnaire_id: '',
  notify_interest_users: false
});

const showInterestUsersDialog = ref(false);
const interestUsers = ref([]);
const loadingInterestUsers = ref(false);

const loadSchedules = async () => {
  loading.value = true;
  try {
    const params = {};
    if (filters.value.course_id) params.course_id = filters.value.course_id;
    if (filters.value.date) params.date = filters.value.date;
    
    const res = await api.get('/courses/admin/schedules', { params });
    // 确保 questionnaire_triggered 和 checkin_triggered 字段存在，同时保留问卷字段
    schedules.value = (res.data || []).map(schedule => {
      // 调试日志：检查问卷字段
      if (schedule.questionnaire_url || schedule.questionnaire_id) {
        console.log('[排课列表前端] 找到问卷数据:', {
          id: schedule.id,
          questionnaire_url: schedule.questionnaire_url,
          questionnaire_id: schedule.questionnaire_id
        });
      }
      return {
        ...schedule,
        questionnaire_triggered: schedule.questionnaire_triggered || false,
        checkin_triggered: schedule.checkin_triggered || false,
        questionnaire_url: schedule.questionnaire_url || null, // 明确保留问卷链接
        questionnaire_id: schedule.questionnaire_id || null // 明确保留问卷ID
      };
    });
  } catch (error) {
    ElMessage.error('加载排课列表失败');
  } finally {
    loading.value = false;
  }
};

const loadCourses = async () => {
  try {
    const res = await api.get('/courses/admin/list');
    courses.value = res.data || [];
  } catch (error) {
    ElMessage.error('加载课程列表失败');
  }
};

const saveSchedule = async () => {
  if (!scheduleForm.value.course_id || !scheduleForm.value.schedule_date || !scheduleForm.value.time_slot) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  saving.value = true;
  try {
    // 构建提交数据，确保location字段被正确传递
    let locationValue = scheduleForm.value.location;
    if (locationValue && typeof locationValue === 'string') {
      locationValue = locationValue.trim();
      locationValue = locationValue || null; // 空字符串转为null
    } else {
      locationValue = null;
    }
    
    const submitData = {
      course_id: scheduleForm.value.course_id,
      schedule_date: scheduleForm.value.schedule_date,
      time_slot: scheduleForm.value.time_slot,
      start_time: scheduleForm.value.start_time,
      end_time: scheduleForm.value.end_time,
      max_students: scheduleForm.value.max_students,
      location: locationValue
    };
    console.log('[前端] 提交的排课数据:', JSON.stringify(submitData, null, 2));
    console.log('[前端] location字段值:', submitData.location, '类型:', typeof submitData.location);
    console.log('[前端] scheduleForm.value完整数据:', JSON.stringify(scheduleForm.value, null, 2));
    
    if (editingSchedule.value) {
      await api.put(`/courses/admin/schedules/${editingSchedule.value.id}`, submitData);
      ElMessage.success('更新成功');
    } else {
      await api.post('/courses/admin/schedules', submitData);
      ElMessage.success('创建成功');
    }
    showCreateDialog.value = false;
    loadSchedules();
    resetForm();
  } catch (error) {
    ElMessage.error(error.error || '保存失败');
  } finally {
    saving.value = false;
  }
};

const editSchedule = (schedule) => {
  editingSchedule.value = schedule;
  // 如果编辑时没有开始和结束时间，根据时间段设置默认值
  let startTime = schedule.start_time;
  let endTime = schedule.end_time;
  
  if (!startTime || !endTime) {
    const defaultTimes = {
      'morning': { start: '09:00:00', end: '12:00:00' },
      'afternoon': { start: '14:00:00', end: '17:00:00' },
      'full_day': { start: '09:00:00', end: '17:00:00' }
    };
    const defaults = defaultTimes[schedule.time_slot] || defaultTimes['morning'];
    startTime = startTime || defaults.start;
    endTime = endTime || defaults.end;
  }
  
  scheduleForm.value = {
    course_id: schedule.course_id,
    schedule_date: schedule.schedule_date,
    time_slot: schedule.time_slot,
    start_time: startTime,
    end_time: endTime,
    max_students: schedule.max_students,
    location: schedule.location || ''
  };
  showCreateDialog.value = true;
};

const deleteSchedule = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除该排课吗？', '提示', {
      type: 'warning'
    });
    await api.delete(`/courses/admin/schedules/${id}`);
    ElMessage.success('删除成功');
    loadSchedules();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const resetFilters = () => {
  filters.value = {
    course_id: null,
    date: null
  };
  loadSchedules();
};

// 处理时间段变化，自动填充默认时间
const handleTimeSlotChange = (timeSlot) => {
  // 根据时间段设置默认时间
  const defaultTimes = {
    'morning': { start: '09:00:00', end: '12:00:00' },
    'afternoon': { start: '14:00:00', end: '17:00:00' },
    'full_day': { start: '09:00:00', end: '17:00:00' }
  };
  
  if (defaultTimes[timeSlot]) {
    scheduleForm.value.start_time = defaultTimes[timeSlot].start;
    scheduleForm.value.end_time = defaultTimes[timeSlot].end;
  }
};

const resetForm = () => {
  editingSchedule.value = null;
  scheduleForm.value = {
    course_id: null,
    schedule_date: '',
    time_slot: 'morning',
    start_time: '09:00:00',
    end_time: '12:00:00',
    max_students: 20,
    location: ''
  };
};

const triggerQuestionnaire = async (schedule) => {
  try {
    await ElMessageBox.confirm(
      `确定要触发该课程的问卷吗？系统将通知所有已报名学员填写评价问卷。`,
      '触发问卷',
      {
        type: 'warning',
        confirmButtonText: '确定触发',
        cancelButtonText: '取消'
      }
    );
    
    // 获取当前登录用户（应该是教练）
    // 这里需要从用户信息中获取 instructor_id
    // 暂时使用课程信息中的 instructor_id，实际应该从登录状态获取
    const res = await api.post(`/courses/admin/schedules/${schedule.id}/trigger-questionnaire`, {
      instructor_id: schedule.instructor_id || 1 // 实际应该从登录状态获取
    });
    
    ElMessage.success(res.message || '问卷已成功触发');
    loadSchedules();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.error || '触发问卷失败');
    }
  }
};

const getStatusType = (status) => {
  const types = {
    'draft': 'warning',
    'scheduled': 'success',
    'cancelled': 'danger',
    'completed': 'info'
  };
  return types[status] || 'info';
};

const getStatusText = (status) => {
  const texts = {
    'draft': '待开课',
    'scheduled': '已排课',
    'cancelled': '已取消',
    'completed': '已完成'
  };
  return texts[status] || status;
};

const viewInterestUsers = async (schedule) => {
  loadingInterestUsers.value = true;
  showInterestUsersDialog.value = true;
  try {
    const res = await api.get(`/schedule-interests/schedule/${schedule.id}/users`);
    interestUsers.value = res.data || [];
  } catch (error) {
    ElMessage.error('加载意向会员列表失败');
    interestUsers.value = [];
  } finally {
    loadingInterestUsers.value = false;
  }
};

const formatDateTime = (dateTime) => {
  if (!dateTime) return '-';
  const date = new Date(dateTime);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 格式化日期，只显示 YYYY-MM-DD
const formatDate = (dateString) => {
  if (!dateString) return '';
  // 如果是 ISO 格式的日期时间字符串，只取日期部分
  if (dateString.includes('T')) {
    return dateString.split('T')[0];
  }
  // 如果已经是日期格式，直接返回
  if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return dateString;
  }
  // 尝试解析并格式化
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return dateString;
  }
};

// 开课功能
const openCourse = (schedule) => {
  currentSchedule.value = schedule;
  // 初始化表单，设置默认值
  openCourseForm.value = {
    schedule_date: '',
    time_slot: schedule.time_slot || 'morning',
    start_time: schedule.start_time || '09:00:00',
    end_time: schedule.end_time || '12:00:00',
    max_students: schedule.max_students || 20,
    location: schedule.location || '',
    questionnaire_url: schedule.questionnaire_url || '',
    questionnaire_id: schedule.questionnaire_id || '',
    notify_interest_users: false
  };
  
  // 如果时间段有值，根据时间段设置默认时间
  if (schedule.time_slot) {
    const defaultTimes = {
      'morning': { start: '09:00:00', end: '12:00:00' },
      'afternoon': { start: '14:00:00', end: '17:00:00' },
      'full_day': { start: '09:00:00', end: '17:00:00' }
    };
    const defaults = defaultTimes[schedule.time_slot];
    if (defaults) {
      openCourseForm.value.start_time = defaults.start;
      openCourseForm.value.end_time = defaults.end;
    }
  }
  
  showOpenCourseDialog.value = true;
};

const handleOpenCourseTimeSlotChange = (timeSlot) => {
  // 根据时间段设置默认时间
  const defaultTimes = {
    'morning': { start: '09:00:00', end: '12:00:00' },
    'afternoon': { start: '14:00:00', end: '17:00:00' },
    'full_day': { start: '09:00:00', end: '17:00:00' }
  };
  
  if (defaultTimes[timeSlot]) {
    openCourseForm.value.start_time = defaultTimes[timeSlot].start;
    openCourseForm.value.end_time = defaultTimes[timeSlot].end;
  }
};

const saveOpenCourse = async () => {
  if (!currentSchedule.value) {
    ElMessage.warning('课程信息错误');
    return;
  }
  
  if (!openCourseForm.value.schedule_date || !openCourseForm.value.time_slot) {
    ElMessage.warning('请填写完整信息（上课日期和时间段为必填项）');
    return;
  }

  savingOpenCourse.value = true;
  try {
    // 构建提交数据，确保location字段被正确传递
    let locationValue = openCourseForm.value.location;
    if (locationValue && typeof locationValue === 'string') {
      locationValue = locationValue.trim();
      locationValue = locationValue || null; // 空字符串转为null
    } else {
      locationValue = null;
    }
    
    // 设置默认时间
    let finalStartTime = openCourseForm.value.start_time;
    let finalEndTime = openCourseForm.value.end_time;
    if (!finalStartTime || !finalEndTime) {
      const defaultTimes = {
        'morning': { start: '09:00:00', end: '12:00:00' },
        'afternoon': { start: '14:00:00', end: '17:00:00' },
        'full_day': { start: '09:00:00', end: '17:00:00' }
      };
      const defaults = defaultTimes[openCourseForm.value.time_slot] || defaultTimes['morning'];
      finalStartTime = finalStartTime || defaults.start;
      finalEndTime = finalEndTime || defaults.end;
    }
    
    const submitData = {
      schedule_date: openCourseForm.value.schedule_date,
      time_slot: openCourseForm.value.time_slot,
      start_time: finalStartTime,
      end_time: finalEndTime,
      max_students: openCourseForm.value.max_students || 20,
      location: locationValue,
      questionnaire_url: openCourseForm.value.questionnaire_url?.trim() || null,
      questionnaire_id: openCourseForm.value.questionnaire_id?.trim() || null,
      status: 'scheduled', // 将状态更新为已排课
      notify_interest_users: openCourseForm.value.notify_interest_users || false
    };
    
    await api.put(`/courses/admin/schedules/${currentSchedule.value.id}`, submitData);
    ElMessage.success('开课成功');
    showOpenCourseDialog.value = false;
    loadSchedules();
  } catch (error) {
    const errorMessage = error?.response?.data?.error || 
                        error?.response?.data?.details || 
                        error?.message || 
                        '开课失败';
    ElMessage.error(errorMessage);
  } finally {
    savingOpenCourse.value = false;
  }
};

// 复制课前问卷链接到剪贴板
const copyQuestionnaireUrl = async (url) => {
  if (!url) return;
  
  try {
    // 使用现代浏览器API复制到剪贴板
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      ElMessage.success('链接已复制到剪贴板');
    } else {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        ElMessage.success('链接已复制到剪贴板');
      } catch (err) {
        ElMessage.error('复制失败，请手动复制');
      }
      document.body.removeChild(textArea);
    }
  } catch (err) {
    ElMessage.error('复制失败，请手动复制');
  }
};

const exportToExcel = async () => {
  exporting.value = true;
  try {
    // 构建查询参数（使用当前的筛选条件）
    const params = {};

    if (filters.value.course_id) {
      params.course_id = filters.value.course_id;
    }

    if (filters.value.date) {
      params.date = filters.value.date;
    }

    // 使用axios下载文件（需要设置responseType为blob）
    const baseURL = process.env.VUE_APP_API_BASE_URL || '/api';
    const response = await axios({
      url: `${baseURL}/courses/admin/schedules/export/excel`,
      method: 'GET',
      params: params,
      responseType: 'blob'
    });

    // 创建blob URL并下载
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // 从响应头获取文件名，如果没有则使用默认名称
    const contentDisposition = response.headers['content-disposition'];
    let filename = `排课列表_${new Date().toISOString().slice(0, 10)}.xlsx`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
      }
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    ElMessage.success('导出成功');
  } catch (error) {
    console.error('导出Excel错误:', error);
    // 如果返回的是JSON错误，尝试解析
    if (error.response && error.response.data instanceof Blob) {
      try {
        const text = await error.response.data.text();
        const errorData = JSON.parse(text);
        ElMessage.error(errorData.error || '导出失败');
      } catch (parseError) {
        ElMessage.error('导出失败');
      }
    } else {
      ElMessage.error(error.response?.data?.error || error.message || '导出失败');
    }
  } finally {
    exporting.value = false;
  }
};

onMounted(() => {
  loadSchedules();
  loadCourses();
  
  // 检查URL参数中是否有course_id
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get('course_id');
  if (courseId) {
    filters.value.course_id = parseInt(courseId);
    loadSchedules();
  }
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  margin-bottom: 20px;
}
</style>

