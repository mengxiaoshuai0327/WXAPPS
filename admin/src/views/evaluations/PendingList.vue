<template>
  <div class="pending-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>待评价列表</span>
        </div>
      </template>

      <div class="filter-bar" style="margin-bottom: 20px;">
        <el-form :inline="true">
          <el-form-item label="课程">
            <el-select 
              v-model="filters.course_id" 
              placeholder="全部课程" 
              clearable 
              style="width: 200px" 
              @change="loadData"
            >
              <el-option 
                v-for="course in courses" 
                :key="course.id" 
                :label="course.title" 
                :value="course.id" 
              />
            </el-select>
          </el-form-item>
          <el-form-item label="教练">
            <el-select 
              v-model="filters.instructor_id" 
              placeholder="全部教练" 
              clearable 
              style="width: 200px" 
              @change="loadData"
            >
              <el-option 
                v-for="instructor in instructors" 
                :key="instructor.id" 
                :label="instructor.nickname" 
                :value="instructor.id" 
              />
            </el-select>
          </el-form-item>
          <el-form-item label="是否触发评价">
            <el-select 
              v-model="filters.has_triggered" 
              placeholder="全部" 
              clearable 
              style="width: 150px" 
              @change="loadData"
            >
              <el-option label="已触发" value="1" />
              <el-option label="未触发" value="0" />
            </el-select>
          </el-form-item>
          <el-form-item label="是否已评价">
            <el-select 
              v-model="filters.has_evaluated" 
              placeholder="全部" 
              clearable 
              style="width: 150px" 
              @change="loadData"
            >
              <el-option label="已评价" value="1" />
              <el-option label="未评价" value="0" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <el-table :data="list" style="width: 100%" v-loading="loading" border>
        <el-table-column prop="schedule_id" label="排课ID" width="100" fixed="left" />
        <el-table-column label="课程名称" min-width="200" fixed="left">
          <template #default="scope">
            <div>{{ scope.row.course_title }}</div>
            <div style="font-size: 12px; color: #999;">{{ scope.row.course_code }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="instructor_name" label="教练" width="120" />
        <el-table-column label="预定课程人" width="150">
          <template #default="scope">
            <div>{{ scope.row.member_name }}</div>
            <div style="font-size: 12px; color: #999;">{{ scope.row.member_code || `ID: ${scope.row.member_id}` }}</div>
          </template>
        </el-table-column>
        <el-table-column label="上课时间" width="180">
          <template #default="scope">
            <div>{{ scope.row.schedule_date }}</div>
            <div style="font-size: 12px; color: #999;">
              {{ scope.row.time_slot_text }}
              <span v-if="scope.row.start_time && scope.row.end_time">
                ({{ scope.row.start_time }}-{{ scope.row.end_time }})
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="是否触发课后评价" width="150" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.questionnaire_triggered ? 'success' : 'info'">
              {{ scope.row.questionnaire_triggered ? '已触发' : '未触发' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="触发评价时间" width="180">
          <template #default="scope">
            <span v-if="scope.row.trigger_time">
              {{ formatDateTime(scope.row.trigger_time) }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="预定人是否评价" width="150" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.has_evaluated ? 'success' : 'warning'">
              {{ scope.row.has_evaluated ? '已评价' : '未评价' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评价时间" width="180">
          <template #default="scope">
            <span v-if="scope.row.evaluation_time">
              {{ formatDateTime(scope.row.evaluation_time) }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button 
              size="small" 
              type="primary" 
              @click="viewDetail(scope.row)"
            >
              查看详情
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';

export default {
  name: 'PendingList',
  setup() {
    const loading = ref(false);
    const list = ref([]);
    const courses = ref([]);
    const instructors = ref([]);
    
    const filters = ref({
      course_id: '',
      instructor_id: '',
      has_triggered: '',
      has_evaluated: ''
    });

    const pagination = ref({
      page: 1,
      pageSize: 20,
      total: 0
    });

    // 加载课程列表
    const loadCourses = async () => {
      try {
        const res = await axios.get('/api/admin/courses/list');
        if (res.data.success) {
          courses.value = res.data.data || [];
        }
      } catch (error) {
        console.error('加载课程列表失败:', error);
      }
    };

    // 加载教练列表
    const loadInstructors = async () => {
      try {
        const res = await axios.get('/api/admin/users/instructors');
        if (res.data.success) {
          instructors.value = res.data.data || [];
        }
      } catch (error) {
        console.error('加载教练列表失败:', error);
      }
    };

    // 加载数据
    const loadData = async () => {
      loading.value = true;
      try {
        const params = {
          page: pagination.value.page,
          pageSize: pagination.value.pageSize,
          ...filters.value
        };

        // 移除空值
        Object.keys(params).forEach(key => {
          if (params[key] === '' || params[key] === null || params[key] === undefined) {
            delete params[key];
          }
        });

        const res = await axios.get('/api/admin/evaluations/pending-list', { params });
        
        if (res.data.success) {
          list.value = res.data.data || [];
          pagination.value.total = res.data.pagination?.total || 0;
        } else {
          ElMessage.error(res.data.error || '加载失败');
        }
      } catch (error) {
        console.error('加载待评价列表失败:', error);
        ElMessage.error('加载失败: ' + (error.response?.data?.error || error.message));
      } finally {
        loading.value = false;
      }
    };

    // 格式化日期时间
    const formatDateTime = (dateTime) => {
      if (!dateTime) return '-';
      const date = new Date(dateTime);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    // 查看详情
    const viewDetail = (row) => {
      if (row.has_evaluated && row.evaluation_id) {
        // 如果已评价，跳转到评价详情页
        window.open(`/evaluations/list?evaluation_id=${row.evaluation_id}`, '_blank');
      } else {
        // 否则显示预订信息
        ElMessage.info(`排课ID: ${row.schedule_id}, 预订ID: ${row.booking_id}, 会员: ${row.member_name}`);
      }
    };

    // 分页处理
    const handleSizeChange = (size) => {
      pagination.value.pageSize = size;
      pagination.value.page = 1;
      loadData();
    };

    const handlePageChange = (page) => {
      pagination.value.page = page;
      loadData();
    };

    onMounted(() => {
      loadCourses();
      loadInstructors();
      loadData();
    });

    return {
      loading,
      list,
      courses,
      instructors,
      filters,
      pagination,
      loadData,
      formatDateTime,
      viewDetail,
      handleSizeChange,
      handlePageChange
    };
  }
};
</script>

<style scoped>
.pending-list {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 500;
}

.filter-bar {
  margin-bottom: 20px;
}

.el-table {
  margin-top: 20px;
}
</style>

