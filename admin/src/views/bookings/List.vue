<template>
  <div class="booking-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>课程预定列表</span>
        </div>
      </template>

      <!-- 筛选条件 -->
      <el-form :inline="true" class="filter-form">
        <el-form-item label="用户">
          <el-input 
            v-model="filters.user_keyword" 
            placeholder="会员ID/昵称/手机号" 
            clearable
            style="width: 200px"
            @keyup.enter="loadBookings"
          />
        </el-form-item>
        <el-form-item label="课程">
          <el-input 
            v-model="filters.course_keyword" 
            placeholder="课程名称" 
            clearable
            style="width: 200px"
            @keyup.enter="loadBookings"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 150px">
            <el-option label="已预订" value="booked" />
            <el-option label="已取消" value="cancelled" />
            <el-option label="已完成" value="completed" />
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
          <el-button type="primary" @click="loadBookings">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
          <el-button type="success" :icon="Download" @click="exportToExcel" :loading="exporting">导出Excel</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="bookings" style="width: 100%" v-loading="loading">
        <el-table-column prop="course_code" label="课程编号" width="150">
          <template #default="scope">
            <span>{{ scope.row.course_code || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="course_title" label="课程名称" min-width="200" />
        <el-table-column prop="instructor_name" label="授课老师" width="120" />
        <el-table-column prop="instructor_number" label="授课老师编号" width="150">
          <template #default="scope">
            <span>{{ scope.row.instructor_number || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="date_time_text" label="上课时间" width="200" />
        <el-table-column prop="user_name" label="会员（报名人）名称" width="150">
          <template #default="scope">
            <span>{{ scope.row.user_name || scope.row.user_nickname || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="user_member_id" label="会员（报名人）编号" width="150">
          <template #default="scope">
            <span>{{ scope.row.user_member_id || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="booked_at_formatted" label="预定时间" width="180" />
        <el-table-column prop="status" label="预定状态" width="120">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="ticket_code" label="使用课券编码" width="150">
          <template #default="scope">
            <span>{{ scope.row.ticket_code || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="签到状态" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.checkin_status === 'checked_in'" type="success">已签到</el-tag>
            <el-tag v-else-if="scope.row.checkin_status === 'not_checked_in'" type="danger">未签到</el-tag>
            <el-tag v-else type="info">待签到</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="签到时间" width="180">
          <template #default="scope">
            <span>{{ scope.row.checkin_time_formatted || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="问卷状态" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.evaluation_status === 'submitted'" type="success">已填写</el-tag>
            <el-tag v-else-if="scope.row.evaluation_status === 'not_submitted'" type="danger">未填写</el-tag>
            <el-tag v-else type="info">待填写</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="问卷填写时间" width="180">
          <template #default="scope">
            <span>{{ scope.row.evaluation_time_formatted || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button 
              size="small" 
              @click="editBooking(scope.row)"
              :disabled="scope.row.status !== 'booked'"
            >
              编辑
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="cancelBooking(scope.row)"
              :disabled="scope.row.status !== 'booked'"
            >
              取消
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadBookings"
        @current-change="loadBookings"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog 
      v-model="showEditDialog" 
      title="编辑预定" 
      width="700px"
    >
      <el-form :model="bookingForm" label-width="140px">
        <el-form-item label="会员（报名人）" required>
          <el-select 
            v-model="bookingForm.user_id" 
            placeholder="请选择会员" 
            filterable
            style="width: 100%"
            @change="onUserChange"
          >
            <el-option 
              v-for="user in availableUsers" 
              :key="user.id" 
              :label="`${user.real_name || user.nickname || ''} (${user.member_id || ''})`" 
              :value="user.id"
            >
              <div>
                <div>{{ user.real_name || user.nickname }}</div>
                <div style="font-size: 12px; color: #999;">{{ user.member_id }}</div>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="课程排期" required>
          <el-select 
            v-model="bookingForm.schedule_id" 
            placeholder="请选择课程排期" 
            filterable
            style="width: 100%"
            @change="onScheduleChange"
          >
            <el-option 
              v-for="schedule in availableSchedules" 
              :key="schedule.id" 
              :label="`${schedule.course_title || schedule.course_code} - ${formatScheduleTime(schedule)}`" 
              :value="schedule.id"
              :disabled="schedule.current_students >= schedule.max_students"
            >
              <div>
                <div>{{ schedule.course_title || schedule.course_code }}</div>
                <div style="font-size: 12px; color: #999;">
                  {{ formatScheduleTime(schedule) }}
                  <span v-if="schedule.current_students >= schedule.max_students" style="color: #f56c6c;">（已满）</span>
                  <span v-else style="color: #67c23a;">（{{ schedule.max_students - schedule.current_students }}个空位）</span>
                </div>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="预定状态" required>
          <el-select v-model="bookingForm.status" placeholder="请选择状态" style="width: 100%">
            <el-option label="已预订" value="booked" />
            <el-option label="已取消" value="cancelled" />
            <el-option label="已完成" value="completed" />
          </el-select>
        </el-form-item>
        <el-form-item label="使用课券编码">
          <el-select 
            v-model="bookingForm.ticket_id" 
            placeholder="请选择课券（可选）" 
            clearable
            filterable
            style="width: 100%"
          >
            <el-option 
              v-for="ticket in availableTickets" 
              :key="ticket.id" 
              :label="`${ticket.ticket_code} (${ticket.status === 'unused' ? '未使用' : ticket.status === 'booked' ? '已预订' : '已使用'})`" 
              :value="ticket.id"
              :disabled="ticket.status !== 'unused' && ticket.id !== bookingForm.ticket_id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="预定时间">
          <el-date-picker
            v-model="bookingForm.booked_at"
            type="datetime"
            placeholder="选择预定时间"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveBooking" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download } from '@element-plus/icons-vue';
import axios from 'axios';
import api from '../../utils/api';

const bookings = ref([]);
const loading = ref(false);
const saving = ref(false);
const exporting = ref(false);
const showEditDialog = ref(false);
const availableSchedules = ref([]);
const availableUsers = ref([]);
const availableTickets = ref([]);
const bookingForm = ref({
  id: null,
  user_id: null,
  user_name: '',
  user_member_id: '',
  schedule_id: null,
  course_title: '',
  date_time_text: '',
  status: 'booked',
  ticket_id: null,
  booked_at: ''
});

const filters = ref({
  user_keyword: '',
  course_keyword: '',
  status: '',
  date: null
});

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const loadBookings = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    };

    // 处理用户关键词搜索（可能是会员ID、昵称或手机号）
    if (filters.value.user_keyword) {
      // 如果是纯数字，可能是会员ID或手机号
      if (/^\d+$/.test(filters.value.user_keyword)) {
        // 尝试作为会员ID查询
        params.user_id = filters.value.user_keyword;
      } else {
        // 作为昵称或手机号，需要在后端处理
        params.user_keyword = filters.value.user_keyword;
      }
    }

    if (filters.value.course_keyword) {
      params.course_keyword = filters.value.course_keyword;
    }

    if (filters.value.status) {
      params.status = filters.value.status;
    }

    if (filters.value.date) {
      params.date = filters.value.date;
    }

    const res = await api.get('/admin/bookings', { params });
    if (res && res.success) {
      bookings.value = res.data || [];
      pagination.value.total = res.pagination?.total || 0;
    } else {
      bookings.value = [];
      pagination.value.total = 0;
      ElMessage.error(res?.error || '加载预定列表失败');
    }
  } catch (error) {
    console.error('加载预定列表错误:', error);
    bookings.value = [];
    pagination.value.total = 0;
    ElMessage.error(error.response?.data?.error || error.message || '加载预定列表失败');
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.value = {
    user_keyword: '',
    course_keyword: '',
    status: '',
    date: null
  };
  pagination.value.page = 1;
  loadBookings();
};

const editBooking = async (booking) => {
  try {
    // 并行加载所有需要的数据
    const [schedulesRes, usersRes] = await Promise.all([
      api.get('/courses/admin/schedules'),
      api.get('/admin/users', { params: { page: 1, pageSize: 1000 } })
    ]);
    
    availableSchedules.value = schedulesRes.data || [];
    availableUsers.value = usersRes.data || [];
    
    // 设置表单数据
    bookingForm.value = {
      id: booking.id,
      user_id: booking.user_id,
      user_name: booking.user_name,
      user_member_id: booking.user_member_id,
      schedule_id: booking.schedule_id,
      course_title: booking.course_title,
      date_time_text: booking.date_time_text,
      status: booking.status || 'booked',
      ticket_id: booking.ticket_id || null,
      booked_at: booking.booked_at_formatted || booking.booked_at || ''
    };
    
    // 加载该用户的可用课券列表
    if (bookingForm.value.user_id) {
      await loadUserTickets(bookingForm.value.user_id);
    }
    
    showEditDialog.value = true;
  } catch (error) {
    console.error('加载数据失败:', error);
    ElMessage.error('加载数据失败');
  }
};

// 加载用户的课券列表
const loadUserTickets = async (userId) => {
  try {
    const res = await api.get('/admin/tickets', { params: { user_id: userId, page: 1, pageSize: 1000 } });
    availableTickets.value = res.data || [];
  } catch (error) {
    console.error('加载课券列表失败:', error);
    availableTickets.value = [];
  }
};

// 用户选择改变时，重新加载课券列表
const onUserChange = async (userId) => {
  if (userId) {
    await loadUserTickets(userId);
    // 清空课券选择，让用户重新选择
    bookingForm.value.ticket_id = null;
  } else {
    availableTickets.value = [];
    bookingForm.value.ticket_id = null;
  }
};

const onScheduleChange = (scheduleId) => {
  const selectedSchedule = availableSchedules.value.find(s => s.id === scheduleId);
  if (selectedSchedule && selectedSchedule.current_students >= selectedSchedule.max_students) {
    ElMessage.warning('该排期已满员，请选择其他排期');
    bookingForm.value.schedule_id = null;
  }
};

const saveBooking = async () => {
  if (!bookingForm.value.user_id || !bookingForm.value.schedule_id || !bookingForm.value.status) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  saving.value = true;
  try {
    const updateData = {
      user_id: bookingForm.value.user_id,
      schedule_id: bookingForm.value.schedule_id,
      status: bookingForm.value.status,
      ticket_id: bookingForm.value.ticket_id || null,
      booked_at: bookingForm.value.booked_at || null
    };
    
    await api.put(`/admin/bookings/${bookingForm.value.id}`, updateData);
    ElMessage.success('更新成功');
    showEditDialog.value = false;
    loadBookings();
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.error || '更新失败');
  } finally {
    saving.value = false;
  }
};

const formatScheduleTime = (schedule) => {
  if (!schedule.schedule_date) return '';
  
  let timeText = schedule.schedule_date;
  
  if (schedule.time_slot === 'full_day') {
    timeText += ' 全天';
  } else if (schedule.time_slot === 'morning') {
    timeText += ' 上午';
  } else if (schedule.time_slot === 'afternoon') {
    timeText += ' 下午';
  }
  
  if (schedule.start_time && schedule.end_time) {
    const start = schedule.start_time.substring(0, 5);
    const end = schedule.end_time.substring(0, 5);
    timeText += ` (${start}-${end})`;
  }
  
  return timeText;
};

const cancelBooking = async (booking) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消用户"${booking.user_name}"的课程预定吗？取消后将释放课券并通知用户。`,
      '确认取消',
      {
        type: 'warning',
        inputPlaceholder: '请输入取消原因（选填）',
        inputType: 'textarea'
      }
    );
    
    await api.put(`/admin/bookings/${booking.id}/cancel`);
    ElMessage.success('取消成功');
    loadBookings();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('取消失败');
    }
  }
};

const getStatusType = (status) => {
  const types = {
    'booked': 'success',
    'cancelled': 'danger',
    'completed': 'info'
  };
  return types[status] || 'info';
};

const getStatusText = (status) => {
  const texts = {
    'booked': '已预订',
    'cancelled': '已取消',
    'completed': '已完成'
  };
  return texts[status] || status;
};

const getTicketStatusType = (status) => {
  const types = {
    'unused': 'success',
    'booked': 'warning',
    'used': 'info',
    'expired': 'danger'
  };
  return types[status] || 'info';
};

const getTicketStatusText = (status) => {
  const texts = {
    'unused': '未使用',
    'booked': '已预订',
    'used': '已使用',
    'expired': '已过期'
  };
  return texts[status] || status;
};

const exportToExcel = async () => {
  exporting.value = true;
  try {
    // 构建查询参数（使用当前的筛选条件）
    const params = {};

    if (filters.value.user_keyword) {
      if (/^\d+$/.test(filters.value.user_keyword)) {
        params.user_id = filters.value.user_keyword;
      } else {
        params.user_keyword = filters.value.user_keyword;
      }
    }

    if (filters.value.course_keyword) {
      params.course_keyword = filters.value.course_keyword;
    }

    if (filters.value.status) {
      params.status = filters.value.status;
    }

    if (filters.value.date) {
      params.date = filters.value.date;
    }

    // 使用axios下载文件（需要设置responseType为blob）
    const baseURL = process.env.VUE_APP_API_BASE_URL || '/api';
    const response = await axios({
      url: `${baseURL}/admin/bookings/export/excel`,
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
    let filename = `课程预定列表_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
  loadBookings();
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

