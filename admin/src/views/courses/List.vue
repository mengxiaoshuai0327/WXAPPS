<template>
  <div class="course-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>课程列表</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建课程
          </el-button>
        </div>
      </template>

      <el-table :data="courses" style="width: 100%" v-loading="loading">
        <el-table-column prop="course_code" label="课程ID" width="150">
          <template #default="scope">
            <span>{{ scope.row.course_code || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="module_name" label="课程模块" width="150" />
        <el-table-column prop="theme_name" label="课程主题" width="150" />
        <el-table-column prop="title" label="课程标题" min-width="200" />
        <el-table-column prop="subtitle" label="课程副标题" min-width="200" show-overflow-tooltip>
          <template #default="scope">
            <span>{{ scope.row.subtitle || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="course_intro" label="课程描述" min-width="250" show-overflow-tooltip>
          <template #default="scope">
            <span>{{ scope.row.course_intro || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="instructor_name" label="教练" width="120" />
        <el-table-column prop="instructor_number" label="教练ID" width="150">
          <template #default="scope">
            <span>{{ scope.row.instructor_number || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="schedule_count" label="排课次数" width="100" align="center">
          <template #default="scope">
            <span>{{ scope.row.schedule_count || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="scope">
            <span>{{ scope.row.created_at || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="editCourse(scope.row)">编辑</el-button>
            <el-button size="small" type="primary" @click="viewSchedules(scope.row)">排课</el-button>
            <el-button size="small" type="warning" @click="createDraftSchedule(scope.row)">待开课</el-button>
            <el-button size="small" type="danger" @click="deleteCourse(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑对话框 -->
    <el-dialog 
      v-model="showCreateDialog" 
      :title="editingCourse ? '编辑课程' : '创建课程'" 
      width="600px"
    >
      <el-form :model="courseForm" label-width="100px">
        <el-form-item label="课程主题" required>
          <el-select v-model="courseForm.theme_id" placeholder="请选择主题" style="width: 100%">
            <el-option 
              v-for="theme in themes" 
              :key="theme.id" 
              :label="theme.name" 
              :value="theme.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="教练" required>
          <el-select 
            v-model="courseForm.instructor_id" 
            placeholder="请选择教练" 
            style="width: 100%"
            @change="onInstructorChange"
          >
            <el-option 
              v-for="instructor in instructors" 
              :key="instructor.id" 
              :label="instructor.nickname" 
              :value="instructor.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="课程编号" v-if="editingCourse">
          <el-input v-model="courseForm.course_code" disabled placeholder="课程编号由系统自动生成" />
          <div style="font-size: 12px; color: #999; margin-top: 5px;">
            课程编号由系统自动生成，创建后不可修改
          </div>
        </el-form-item>
        <el-form-item label="课程标题" required>
          <el-input v-model="courseForm.title" placeholder="请输入课程标题" />
        </el-form-item>
        <el-form-item label="副标题">
          <el-input v-model="courseForm.subtitle" placeholder="请输入副标题" />
        </el-form-item>
        <el-form-item label="教练简介">
          <el-input 
            v-model="courseForm.instructor_intro" 
            type="textarea" 
            :rows="3"
            placeholder="针对此课程的教练简介"
          />
        </el-form-item>
        <el-form-item label="课程简介" required>
          <el-input 
            v-model="courseForm.course_intro" 
            type="textarea" 
            :rows="4"
            placeholder="请输入课程简介"
          />
        </el-form-item>
        <el-form-item label="课程案例">
          <div style="width: 100%;">
            <div 
              v-for="(caseItem, index) in courseForm.cases" 
              :key="index" 
              style="display: flex; align-items: center; margin-bottom: 10px;"
            >
              <el-input 
                v-model="courseForm.cases[index]" 
                :placeholder="`案例${index + 1}名称`"
                style="flex: 1; margin-right: 10px;"
              />
              <el-button 
                type="danger" 
                size="small" 
                @click="removeCase(index)"
                :disabled="courseForm.cases.length <= 1"
              >
                删除
              </el-button>
            </div>
            <el-button 
              type="primary" 
              size="small" 
              @click="addCase"
              style="width: 100%;"
            >
              + 添加案例
            </el-button>
            <div style="font-size: 12px; color: #999; margin-top: 8px;">
              提示：案例将用于课程评价问卷的案例评分题，学员需要对每个案例进行1-5分评分
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveCourse" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 待开课对话框 -->
    <el-dialog 
      v-model="showDraftScheduleDialog" 
      title="创建待开课" 
      width="500px"
    >
      <el-form :model="draftScheduleForm" label-width="100px">
        <el-form-item label="课程" required>
          <el-input :value="currentCourse?.title" disabled />
        </el-form-item>
        <el-form-item label="开课人" required>
          <el-input 
            :value="currentCourse?.instructor_name || ''" 
            disabled 
            placeholder="开课人由课程决定，不可修改"
          />
        </el-form-item>
        <el-alert
          type="info"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          <template #default>
            <div style="font-size: 13px;">
              待开课不需要填写具体的上课日期、时间和人数，可以在后续编辑时补充完整信息。
            </div>
          </template>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="showDraftScheduleDialog = false">取消</el-button>
        <el-button type="primary" @click="saveDraftSchedule" :loading="savingDraftSchedule">保存</el-button>
      </template>
    </el-dialog>

    <!-- 排课对话框 -->
    <el-dialog 
      v-model="showScheduleDialog" 
      title="创建排课" 
      width="600px"
    >
      <el-form :model="scheduleForm" label-width="100px">
        <el-form-item label="课程" required>
          <el-input :value="currentCourse?.title" disabled />
        </el-form-item>
        <el-form-item label="开课日期" required>
          <el-date-picker
            v-model="scheduleForm.schedule_date"
            type="date"
            placeholder="选择开课日期"
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
            placeholder="选择开始时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-picker
            v-model="scheduleForm.end_time"
            format="HH:mm"
            value-format="HH:mm:ss"
            placeholder="选择结束时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="开课人" required>
          <el-input 
            :value="currentCourse?.instructor_name || ''" 
            disabled 
            placeholder="开课人由课程决定，不可修改"
          />
        </el-form-item>
        <el-form-item label="最大人数">
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
        <el-form-item label="课前问卷链接">
          <el-input 
            v-model="scheduleForm.questionnaire_url" 
            placeholder="请输入课前问卷链接（选填）"
            maxlength="500"
          />
        </el-form-item>
        <el-form-item label="课前问卷ID">
          <el-input 
            v-model="scheduleForm.questionnaire_id" 
            placeholder="请输入课前问卷ID号（选填）"
            maxlength="100"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showScheduleDialog = false">取消</el-button>
        <el-button type="primary" @click="saveSchedule" :loading="savingSchedule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '../../utils/api';

const courses = ref([]);
const themes = ref([]);
const instructors = ref([]);
const loading = ref(false);
const saving = ref(false);
const showCreateDialog = ref(false);
const editingCourse = ref(null);
const showScheduleDialog = ref(false);
const showDraftScheduleDialog = ref(false);
const currentCourse = ref(null);
const savingSchedule = ref(false);
const savingDraftSchedule = ref(false);

const courseForm = ref({
  theme_id: null,
  instructor_id: null,
  course_code: '', // 编辑时使用，创建时由后端自动生成
  title: '',
  subtitle: '',
  instructor_intro: '',
  course_intro: '',
  cases: [''] // 案例列表，至少保留一个空项
});

const scheduleForm = ref({
  course_id: null,
  schedule_date: '',
  time_slot: 'morning',
  start_time: '09:00:00',
  end_time: '12:00:00',
  max_students: 20,
  location: '',
  questionnaire_url: '',
  questionnaire_id: ''
});

const draftScheduleForm = ref({
  course_id: null
});

const loadCourses = async () => {
  loading.value = true;
  try {
    const res = await api.get('/courses/admin/list');
    courses.value = res.data || [];
  } catch (error) {
    ElMessage.error('加载课程列表失败');
  } finally {
    loading.value = false;
  }
};

const loadThemes = async () => {
  try {
    const res = await api.get('/courses/themes');
    themes.value = res.data || [];
  } catch (error) {
    ElMessage.error('加载主题列表失败');
  }
};

const loadInstructors = async () => {
  try {
    const res = await api.get('/admin/instructors');
    instructors.value = res.data || [];
  } catch (error) {
    ElMessage.error('加载教练列表失败');
  }
};

// 教练选择改变时，自动填充教练简介
const onInstructorChange = (instructorId) => {
  if (!instructorId) {
    courseForm.value.instructor_intro = '';
    return;
  }
  
  // 从教练列表中找到选中的教练
  const selectedInstructor = instructors.value.find(inst => inst.id === instructorId);
  if (selectedInstructor) {
    // 优先使用 background（背景介绍），如果没有则使用 bio（个人简介）
    // 如果两者都有，组合使用
    let intro = '';
    if (selectedInstructor.background && selectedInstructor.bio) {
      // 两者都有，组合使用
      intro = `${selectedInstructor.background}\n${selectedInstructor.bio}`;
    } else if (selectedInstructor.background) {
      intro = selectedInstructor.background;
    } else if (selectedInstructor.bio) {
      intro = selectedInstructor.bio;
    }
    
    courseForm.value.instructor_intro = intro;
  }
};

const addCase = () => {
  courseForm.value.cases.push('');
};

const removeCase = (index) => {
  if (courseForm.value.cases.length > 1) {
    courseForm.value.cases.splice(index, 1);
  }
};

const saveCourse = async () => {
  if (!courseForm.value.theme_id || !courseForm.value.instructor_id || !courseForm.value.title || !courseForm.value.course_intro) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  saving.value = true;
  try {
    // 过滤空案例，构建问卷配置
    const validCases = courseForm.value.cases.filter(c => c && c.trim() !== '');
    const questionnaireConfig = validCases.length > 0 ? {
      cases: validCases.map((name, index) => ({
        id: `case${index + 1}`,
        name: name.trim()
      }))
    } : null;

    const formData = {
      theme_id: courseForm.value.theme_id,
      instructor_id: courseForm.value.instructor_id,
      title: courseForm.value.title,
      subtitle: courseForm.value.subtitle || null,
      instructor_intro: courseForm.value.instructor_intro || null,
      course_intro: courseForm.value.course_intro,
      questionnaire_config: questionnaireConfig
    };

    if (editingCourse.value) {
      // 编辑时，保留课程编号
      formData.course_code = courseForm.value.course_code;
      await api.put(`/courses/admin/${editingCourse.value.id}`, formData);
      ElMessage.success('更新成功');
    } else {
      // 创建时，不传递course_code，由后端自动生成
      const result = await api.post('/courses/admin/create', formData);
      ElMessage.success(`创建成功，课程编号：${result.data?.course_code || '已生成'}`);
    }
    showCreateDialog.value = false;
    loadCourses();
    resetForm();
  } catch (error) {
    ElMessage.error(error.error || '保存失败');
  } finally {
    saving.value = false;
  }
};

const editCourse = (course) => {
  editingCourse.value = course;
  
  // 解析问卷配置中的案例
  let cases = [''];
  if (course.questionnaire_config) {
    try {
      const config = typeof course.questionnaire_config === 'string' 
        ? JSON.parse(course.questionnaire_config) 
        : course.questionnaire_config;
      if (config.cases && Array.isArray(config.cases) && config.cases.length > 0) {
        cases = config.cases.map(c => c.name || c);
      }
    } catch (e) {
      console.error('解析问卷配置失败:', e);
    }
  }
  
  courseForm.value = {
    theme_id: course.theme_id,
    instructor_id: course.instructor_id,
    course_code: course.course_code,
    title: course.title,
    subtitle: course.subtitle || '',
    instructor_intro: course.instructor_intro || '',
    course_intro: course.course_intro || '',
    cases: cases
  };
  showCreateDialog.value = true;
  
  // 编辑时，如果教练简介为空，尝试自动填充
  if (!courseForm.value.instructor_intro && courseForm.value.instructor_id) {
    onInstructorChange(courseForm.value.instructor_id);
  }
  
  // 编辑时，如果教练简介为空，也尝试自动填充
  if (!courseForm.value.instructor_intro && courseForm.value.instructor_id) {
    onInstructorChange(courseForm.value.instructor_id);
  }
};

const deleteCourse = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除该课程吗？', '提示', {
      type: 'warning'
    });
    await api.delete(`/courses/admin/${id}`);
    ElMessage.success('删除成功');
    loadCourses();
  } catch (error) {
    if (error !== 'cancel') {
      // 显示后端返回的具体错误信息
      const errorMessage = error?.response?.data?.error || error?.error || error?.message || '删除失败';
      ElMessage.error(errorMessage);
    }
  }
};

const createDraftSchedule = (course) => {
  // 打开待开课对话框
  currentCourse.value = course;
  draftScheduleForm.value = {
    course_id: course.id
  };
  showDraftScheduleDialog.value = true;
};

const saveDraftSchedule = async () => {
  if (!draftScheduleForm.value.course_id) {
    ElMessage.warning('课程信息错误');
    return;
  }

  savingDraftSchedule.value = true;
  try {
    const scheduleData = {
      course_id: draftScheduleForm.value.course_id,
      status: 'draft'
    };
    
    await api.post('/courses/admin/schedules/draft', scheduleData);
    ElMessage.success('待开课创建成功');
    showDraftScheduleDialog.value = false;
    loadCourses(); // 重新加载课程列表以更新排课次数
  } catch (error) {
    console.error('创建待开课失败:', error);
    const errorMessage = error?.response?.data?.error || 
                        error?.response?.data?.details || 
                        error?.message || 
                        '创建待开课失败';
    ElMessage.error(errorMessage);
  } finally {
    savingDraftSchedule.value = false;
  }
};

const viewSchedules = (course) => {
  // 打开排课对话框
  currentCourse.value = course;
  scheduleForm.value = {
    course_id: course.id,
    schedule_date: '',
    time_slot: 'morning',
    start_time: '09:00:00',
    end_time: '12:00:00',
    max_students: 20,
    location: '',
    questionnaire_url: '',
    questionnaire_id: ''
  };
  showScheduleDialog.value = true;
};

// 处理时间段变化，自动填充默认时间（但用户可以自由调整）
const handleTimeSlotChange = (timeSlot) => {
  // 根据时间段设置默认时间，但用户可以之后自由修改
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
  editingCourse.value = null;
  courseForm.value = {
    theme_id: null,
    instructor_id: null,
    course_code: '',
    title: '',
    subtitle: '',
    instructor_intro: '',
    course_intro: '',
    cases: ['']
  };
};

// 保存排课
const saveSchedule = async () => {
  if (!scheduleForm.value.course_id || !scheduleForm.value.schedule_date || !scheduleForm.value.time_slot) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  savingSchedule.value = true;
  try {
    // 构建排课数据（开课人由课程决定，不需要传递）
    const scheduleData = {
      course_id: scheduleForm.value.course_id,
      schedule_date: scheduleForm.value.schedule_date,
      time_slot: scheduleForm.value.time_slot,
      start_time: scheduleForm.value.start_time || null,
      end_time: scheduleForm.value.end_time || null,
      max_students: scheduleForm.value.max_students || 20,
      location: scheduleForm.value.location?.trim() || null,
      questionnaire_url: scheduleForm.value.questionnaire_url?.trim() || null,
      questionnaire_id: scheduleForm.value.questionnaire_id?.trim() || null
    };
    
    await api.post('/courses/admin/schedules', scheduleData);
    ElMessage.success('排课创建成功');
    showScheduleDialog.value = false;
    loadCourses(); // 重新加载课程列表以更新排课次数
    // 跳转到排课管理页面查看新创建的排课
    window.location.hash = `/courses/schedules?course_id=${scheduleForm.value.course_id}`;
  } catch (error) {
    ElMessage.error(error.error || '创建排课失败');
  } finally {
    savingSchedule.value = false;
  }
};

onMounted(() => {
  loadCourses();
  loadThemes();
  loadInstructors();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

