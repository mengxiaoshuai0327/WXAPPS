<template>
  <div class="intention-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>课程意向列表</span>
        </div>
      </template>

      <!-- 筛选条件 -->
      <el-form :inline="true" class="filter-form">
        <el-form-item label="用户">
          <el-input 
            v-model="filters.keyword" 
            placeholder="会员ID/昵称/手机号/课程描述" 
            clearable
            style="width: 200px"
            @keyup.enter="loadIntentions"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 150px">
            <el-option label="全部" value="all" />
            <el-option label="待处理" value="pending" />
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item label="日期范围">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            @change="handleDateRangeChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadIntentions">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="intentions" style="width: 100%" v-loading="loading">
        <el-table-column prop="created_at_formatted" label="提交时间" width="180" />
        <el-table-column label="用户信息" width="200">
          <template #default="scope">
            <div>
              <div>{{ scope.row.user_nickname || scope.row.user_real_name || '-' }}</div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.user_member_id || '-' }}</div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.user_phone || '-' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="选择的主题" min-width="200">
          <template #default="scope">
            <div v-if="scope.row.selected_theme_names && scope.row.selected_theme_names.length > 0">
              <el-tag 
                v-for="(name, index) in scope.row.selected_theme_names" 
                :key="index"
                size="small"
                style="margin-right: 8px; margin-bottom: 4px;"
              >
                {{ name }}
              </el-tag>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="选择的课程" min-width="200">
          <template #default="scope">
            <div v-if="scope.row.selected_course_names && scope.row.selected_course_names.length > 0">
              <el-tag 
                v-for="(name, index) in scope.row.selected_course_names" 
                :key="index"
                type="success"
                size="small"
                style="margin-right: 8px; margin-bottom: 4px;"
              >
                {{ name }}
              </el-tag>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="other_courses" label="其他课程描述" min-width="200" show-overflow-tooltip>
          <template #default="scope">
            <span>{{ scope.row.other_courses || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="preferred_time" label="期望上课时间" width="180">
          <template #default="scope">
            <span>{{ scope.row.preferred_time || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="意向老师" width="150">
          <template #default="scope">
            <div v-if="scope.row.preferred_instructor_id">
              <div>{{ scope.row.instructor_nickname || scope.row.instructor_real_name || '-' }}</div>
            </div>
            <div v-else-if="scope.row.preferred_instructor_name">
              <div>{{ scope.row.preferred_instructor_name }}</div>
              <div style="font-size: 12px; color: #999;">（自定义）</div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="status_text" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ scope.row.status_text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button 
              size="small" 
              @click="viewDetail(scope.row)"
            >
              详情
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteIntention(scope.row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadIntentions"
          @current-change="loadIntentions"
        />
      </div>
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog 
      v-model="detailDialogVisible" 
      title="课程意向详情" 
      width="800px"
      @close="currentIntention = null"
    >
      <div v-if="currentIntention">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="提交时间">{{ currentIntention.created_at_formatted }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentIntention.status)">
              {{ currentIntention.status_text }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="用户昵称">{{ currentIntention.user_nickname || '-' }}</el-descriptions-item>
          <el-descriptions-item label="真实姓名">{{ currentIntention.user_real_name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="会员ID">{{ currentIntention.user_member_id || '-' }}</el-descriptions-item>
          <el-descriptions-item label="手机号">{{ currentIntention.user_phone || '-' }}</el-descriptions-item>
          
          <el-descriptions-item label="选择的主题" :span="2">
            <div v-if="currentIntention.selected_themes && currentIntention.selected_themes.length > 0">
              <el-tag 
                v-for="(theme, index) in currentIntention.selected_themes" 
                :key="index"
                size="small"
                style="margin-right: 8px; margin-bottom: 4px;"
              >
                {{ theme.name }}
              </el-tag>
            </div>
            <span v-else style="color: #999;">无</span>
          </el-descriptions-item>
          
          <el-descriptions-item label="选择的课程" :span="2">
            <div v-if="currentIntention.selected_courses && currentIntention.selected_courses.length > 0">
              <el-tag 
                v-for="(course, index) in currentIntention.selected_courses" 
                :key="index"
                type="success"
                size="small"
                style="margin-right: 8px; margin-bottom: 4px;"
              >
                {{ course.title }}
              </el-tag>
            </div>
            <span v-else style="color: #999;">无</span>
          </el-descriptions-item>
          
          <el-descriptions-item label="其他课程描述" :span="2">
            <span>{{ currentIntention.other_courses || '-' }}</span>
          </el-descriptions-item>
          
          <el-descriptions-item label="期望上课时间" :span="2">
            <span>{{ currentIntention.preferred_time || '-' }}</span>
          </el-descriptions-item>
          
          <el-descriptions-item label="意向老师" :span="2">
            <div v-if="currentIntention.preferred_instructor_id">
              <div>{{ currentIntention.instructor_nickname || currentIntention.instructor_real_name || '-' }}</div>
              <div style="font-size: 12px; color: #999;">系统内老师</div>
            </div>
            <div v-else-if="currentIntention.preferred_instructor_name">
              <div>{{ currentIntention.preferred_instructor_name }}</div>
              <div style="font-size: 12px; color: #999;">自定义老师</div>
            </div>
            <span v-else style="color: #999;">无</span>
          </el-descriptions-item>
          
          <el-descriptions-item label="管理员备注" :span="2">
            <el-input
              v-model="currentIntention.admin_note"
              type="textarea"
              :rows="3"
              placeholder="请输入备注"
              @blur="updateIntention"
            />
          </el-descriptions-item>
        </el-descriptions>

        <!-- 状态操作 -->
        <div style="margin-top: 20px; text-align: right;">
          <el-button 
            v-if="currentIntention.status === 'pending'"
            type="info"
            @click="updateStatus('processing')"
          >
            标记为处理中
          </el-button>
          <el-button 
            v-if="currentIntention.status === 'pending' || currentIntention.status === 'processing'"
            type="success"
            @click="updateStatus('completed')"
          >
            标记为已完成
          </el-button>
          <el-button 
            v-if="currentIntention.status === 'pending'"
            type="warning"
            @click="updateStatus('cancelled')"
          >
            标记为已取消
          </el-button>
        </div>
      </div>
      <div v-else style="text-align: center; padding: 40px; color: #999;">
        加载中...
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../utils/api';

const intentions = ref([]);
const loading = ref(false);
const detailDialogVisible = ref(false);
const currentIntention = ref(null);
const dateRange = ref(null);

const filters = ref({
  keyword: '',
  status: ''
});

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const loadIntentions = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    };

    if (filters.value.keyword) {
      params.keyword = filters.value.keyword;
    }
    if (filters.value.status && filters.value.status !== 'all') {
      params.status = filters.value.status;
    }
    if (dateRange.value && dateRange.value.length === 2) {
      params.start_date = dateRange.value[0];
      params.end_date = dateRange.value[1];
    }

    const res = await api.get('/admin/intentions', { params });
    
    if (res && res.success !== false) {
      intentions.value = res.data || [];
      pagination.value.total = res.pagination?.total || 0;
    } else {
      const errorMsg = res?.error || res?.message || '加载列表失败';
      ElMessage.error(errorMsg);
    }
  } catch (error) {
    console.error('加载课程意向列表错误:', error);
    ElMessage.error(error.response?.data?.error || error.message || '加载失败，请检查后端服务');
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.value = {
    keyword: '',
    status: ''
  };
  dateRange.value = null;
  pagination.value.page = 1;
  loadIntentions();
};

const handleDateRangeChange = (dates) => {
  // dateRange已经自动更新
};

const getStatusType = (status) => {
  const types = {
    'pending': 'warning',
    'processing': 'info',
    'completed': 'success',
    'processed': 'success', // 兼容旧值
    'cancelled': 'danger'
  };
  return types[status] || 'info';
};

const viewDetail = async (row) => {
  try {
    currentIntention.value = null;
    detailDialogVisible.value = true;
    const res = await api.get(`/admin/intentions/${row.id}`);
    if (res && res.data) {
      currentIntention.value = res.data;
    } else {
      ElMessage.error('获取详情失败');
      detailDialogVisible.value = false;
    }
  } catch (error) {
    console.error('获取课程意向详情错误:', error);
    ElMessage.error(error.response?.data?.error || error.message || '获取详情失败');
    detailDialogVisible.value = false;
  }
};

const updateIntention = async () => {
  if (!currentIntention.value || !currentIntention.value.id) return;
  
  try {
    await api.put(`/admin/intentions/${currentIntention.value.id}`, {
      admin_note: currentIntention.value.admin_note
    });
    ElMessage.success('备注已更新');
    loadIntentions();
  } catch (error) {
    console.error('更新课程意向错误:', error);
    ElMessage.error(error.response?.data?.error || error.message || '更新失败');
  }
};

const updateStatus = async (status) => {
  if (!currentIntention.value || !currentIntention.value.id) return;
  
  try {
    await api.put(`/admin/intentions/${currentIntention.value.id}`, {
      status: status
    });
    ElMessage.success('状态已更新');
    currentIntention.value.status = status;
    const statusTexts = {
      'pending': '待处理',
      'processing': '处理中',
      'completed': '已完成',
      'processed': '已处理', // 兼容旧值
      'cancelled': '已取消'
    };
    currentIntention.value.status_text = statusTexts[status];
    loadIntentions();
  } catch (error) {
    console.error('更新状态错误:', error);
    ElMessage.error(error.response?.data?.error || error.message || '更新失败');
  }
};

const deleteIntention = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除这条课程意向吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    await api.delete(`/admin/intentions/${row.id}`);
    ElMessage.success('删除成功');
    loadIntentions();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || error.message || '删除失败');
    }
  }
};

onMounted(() => {
  loadIntentions();
});
</script>

<style scoped>
.intention-list {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>

