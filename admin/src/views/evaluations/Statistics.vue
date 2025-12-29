<template>
  <div class="evaluation-statistics">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>课程评价统计表</span>
        </div>
      </template>

      <!-- 筛选栏 -->
      <div class="filter-bar" style="margin-bottom: 20px;">
        <el-form :inline="true">
          <el-form-item label="教练">
            <el-select 
              v-model="filters.instructor_id" 
              placeholder="全部教练" 
              clearable 
              style="width: 200px" 
              @change="loadStatistics"
            >
              <el-option 
                v-for="instructor in instructors" 
                :key="instructor.id" 
                :label="instructor.nickname" 
                :value="instructor.id" 
              />
            </el-select>
          </el-form-item>
          <el-form-item label="课程">
            <el-select 
              v-model="filters.course_id" 
              placeholder="全部课程" 
              clearable 
              style="width: 200px" 
              @change="loadStatistics"
            >
              <el-option 
                v-for="course in courses" 
                :key="course.id" 
                :label="course.title" 
                :value="course.id" 
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadStatistics">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
            <el-button type="success" @click="exportData">导出</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 统计表格 -->
      <el-table 
        :data="statistics" 
        style="width: 100%" 
        v-loading="loading" 
        border
        :max-height="600"
      >
        <el-table-column prop="course_title" label="课程" min-width="200" fixed="left">
          <template #default="scope">
            <div style="font-weight: 500;">{{ scope.row.course_title }}</div>
            <div style="font-size: 12px; color: #999;">{{ scope.row.course_code }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="instructor_name" label="教练" width="120" fixed="left" />
        <el-table-column prop="schedule_count" label="排课次数" width="100" align="center" />
        <el-table-column prop="booking_count" label="报名人数" width="100" align="center" />
        <el-table-column prop="evaluation_count" label="评价数量" width="100" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.evaluation_count > 0 ? 'success' : 'info'">
              {{ scope.row.evaluation_count }}
            </el-tag>
          </template>
        </el-table-column>
        
        <!-- 平均分列 -->
        <el-table-column label="平均分" width="120" align="center">
          <template #default="scope">
            <div v-if="scope.row.evaluation_count > 0">
              <div style="font-size: 12px; color: #999; margin-bottom: 4px;">培训价值</div>
              <div style="font-weight: 500; color: #409eff;">
                {{ scope.row.avg_q1_score || '-' }}
              </div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="CFO水平" width="100" align="center">
          <template #default="scope">
            <span v-if="scope.row.evaluation_count > 0">
              {{ scope.row.avg_q2_score || '-' }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="认知突破" width="100" align="center">
          <template #default="scope">
            <span v-if="scope.row.evaluation_count > 0">
              {{ scope.row.avg_q3_score || '-' }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="应用帮助" width="100" align="center">
          <template #default="scope">
            <span v-if="scope.row.evaluation_count > 0">
              {{ scope.row.avg_q4_score || '-' }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="案例评分" width="100" align="center">
          <template #default="scope">
            <span v-if="scope.row.evaluation_count > 0 && scope.row.avg_case_score">
              {{ scope.row.avg_case_score }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="推荐意愿" width="100" align="center">
          <template #default="scope">
            <span v-if="scope.row.evaluation_count > 0">
              {{ scope.row.avg_q9_score || '-' }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>

        <!-- Q1选项统计 -->
        <el-table-column label="培训价值分布" width="200" align="center">
          <template #default="scope">
            <div v-if="scope.row.evaluation_count > 0" style="font-size: 12px;">
              <div style="margin-bottom: 4px;">
                <el-tag size="small" type="success">更高: {{ scope.row.q1_a_count }}</el-tag>
                <el-tag size="small" type="info" style="margin-left: 4px;">差不多: {{ scope.row.q1_b_count }}</el-tag>
              </div>
              <div style="margin-bottom: 4px;">
                <el-tag size="small" type="warning">偏低: {{ scope.row.q1_c_count }}</el-tag>
                <el-tag size="small" type="success" style="margin-left: 4px;">价值高: {{ scope.row.q1_d_count }}</el-tag>
              </div>
              <div>
                <el-tag size="small" type="danger">价值低: {{ scope.row.q1_e_count }}</el-tag>
              </div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>

        <!-- Q9选项统计 -->
        <el-table-column label="推荐意愿分布" width="150" align="center">
          <template #default="scope">
            <div v-if="scope.row.evaluation_count > 0" style="font-size: 12px;">
              <div style="margin-bottom: 4px;">
                <el-tag size="small" type="success">很愿意: {{ scope.row.q9_a_count }}</el-tag>
              </div>
              <div>
                <el-tag size="small" type="info">不太愿意: {{ scope.row.q9_b_count }}</el-tag>
              </div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="scope">
            <el-button size="small" @click="viewCourseEvaluations(scope.row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="statistics.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无数据" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import api from '../../utils/api';

const router = useRouter();
const statistics = ref([]);
const loading = ref(false);
const courses = ref([]);
const instructors = ref([]);

const filters = ref({
  instructor_id: null,
  course_id: null
});

const loadStatistics = async () => {
  loading.value = true;
  try {
    const params = {};
    if (filters.value.instructor_id) {
      params.instructor_id = filters.value.instructor_id;
    }
    if (filters.value.course_id) {
      params.course_id = filters.value.course_id;
    }

    const res = await api.get('/admin/evaluations/statistics', { params });
    
    if (res && res.success !== false) {
      statistics.value = res.data || [];
    } else {
      ElMessage.error(res?.error || '加载统计失败');
      statistics.value = [];
    }
  } catch (error) {
    console.error('加载统计失败:', error);
    ElMessage.error('加载统计失败，请检查后端服务是否正常运行');
    statistics.value = [];
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

const resetFilters = () => {
  filters.value = {
    instructor_id: null,
    course_id: null
  };
  loadStatistics();
};

const exportData = () => {
  // 简单的CSV导出
  if (statistics.value.length === 0) {
    ElMessage.warning('没有数据可导出');
    return;
  }

  const headers = [
    '课程', '课程代码', '教练', '排课次数', '报名人数', '评价数量',
    '培训价值平均分', 'CFO水平平均分', '认知突破平均分', '应用帮助平均分', 
    '案例评分平均分', '推荐意愿平均分',
    '培训价值-更高', '培训价值-差不多', '培训价值-偏低', '培训价值-价值高', '培训价值-价值低',
    '推荐意愿-很愿意', '推荐意愿-不太愿意'
  ];

  const rows = statistics.value.map(row => [
    row.course_title || '',
    row.course_code || '',
    row.instructor_name || '',
    row.schedule_count || 0,
    row.booking_count || 0,
    row.evaluation_count || 0,
    row.avg_q1_score || '',
    row.avg_q2_score || '',
    row.avg_q3_score || '',
    row.avg_q4_score || '',
    row.avg_case_score || '',
    row.avg_q9_score || '',
    row.q1_a_count || 0,
    row.q1_b_count || 0,
    row.q1_c_count || 0,
    row.q1_d_count || 0,
    row.q1_e_count || 0,
    row.q9_a_count || 0,
    row.q9_b_count || 0
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `课程评价统计_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  ElMessage.success('导出成功');
};

const viewCourseEvaluations = (row) => {
  // 跳转到评价管理页面，并筛选该课程
  router.push({
    path: '/evaluations/list',
    query: {
      course_id: row.course_id,
      instructor_id: row.instructor_id
    }
  });
};

onMounted(() => {
  loadCourses();
  loadInstructors();
  loadStatistics();
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

.empty-state {
  text-align: center;
  padding: 40px 0;
}
</style>





















































