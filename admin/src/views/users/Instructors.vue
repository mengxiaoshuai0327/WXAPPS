<template>
  <div class="instructor-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>教练列表</span>
          <el-button type="primary" @click="showEditDialog = true; editingInstructor = null; resetForm();">
            <el-icon><Plus /></el-icon>
            创建教练
          </el-button>
        </div>
      </template>

      <el-table :data="instructors" style="width: 100%" v-loading="loading">
        <el-table-column prop="instructor_id" label="教练ID" width="120">
          <template #default="scope">
            <span v-if="scope.row.instructor_id">{{ scope.row.instructor_id }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" width="150" />
        <el-table-column prop="real_name" label="姓名" width="120" />
        <el-table-column prop="phone" label="手机号" width="150" />
        <el-table-column label="头像" width="100">
          <template #default="scope">
            <el-image 
              v-if="scope.row.avatar_url" 
              :src="scope.row.avatar_url" 
              style="width: 50px; height: 50px; border-radius: 50%;"
              fit="cover"
            />
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="password" label="密码" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.has_password ? 'success' : 'info'" size="small">
              {{ scope.row.password }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="role" label="角色" width="100">
          <template #default="scope">
            <el-tag type="warning" size="small">教练</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="background" label="个人背景简介" min-width="200" show-overflow-tooltip />
        <el-table-column label="是否热门" width="140" align="center">
          <template #default="scope">
            <el-switch
              :model-value="scope.row.is_popular"
              :active-value="1"
              :inactive-value="0"
              inline-prompt
              active-text="是"
              inactive-text="否"
              active-color="#67c23a"
              inactive-color="#909399"
              @change="(val) => togglePopularStatus(scope.row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button size="small" type="primary" @click="editInstructor(scope.row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑对话框 -->
    <el-dialog 
      v-model="showEditDialog" 
      :title="editingInstructor ? '编辑教练' : '创建教练'" 
      width="600px"
      @close="resetForm"
    >
      <el-form :model="instructorForm" label-width="100px" :rules="rules" ref="formRef">
        <el-form-item label="昵称" prop="nickname">
          <el-input v-model="instructorForm.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="姓名" prop="real_name">
          <el-input v-model="instructorForm.real_name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="instructorForm.phone" placeholder="请输入手机号" :disabled="!!editingInstructor" />
          <div v-if="editingInstructor" style="color: #999; font-size: 12px; margin-top: 5px;">
            手机号不可修改
          </div>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input 
            v-model="instructorForm.password" 
            type="password" 
            :placeholder="editingInstructor ? '留空则不修改密码' : '请输入密码'"
            show-password
          />
          <div v-if="editingInstructor" style="color: #999; font-size: 12px; margin-top: 5px;">
            留空则不修改密码
          </div>
        </el-form-item>
        <el-form-item label="头像">
          <el-upload
            class="avatar-uploader"
            :action="uploadAction"
            :show-file-list="false"
            :on-success="handleAvatarSuccess"
            :on-error="handleAvatarError"
            :before-upload="beforeAvatarUpload"
            :headers="uploadHeaders"
            name="avatar"
          >
            <img v-if="instructorForm.avatar_url" :src="instructorForm.avatar_url" class="avatar" />
            <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
          </el-upload>
          <div style="margin-top: 10px;">
            <el-input 
              v-model="instructorForm.avatar_url" 
              placeholder="或直接输入头像URL（选填）" 
              style="width: 100%;"
            />
          </div>
        </el-form-item>
        <el-form-item label="个人背景简介">
          <el-input 
            v-model="instructorForm.background" 
            type="textarea" 
            :rows="3"
            placeholder="请输入教练背景介绍（选填）"
          />
        </el-form-item>
        <el-form-item label="是否热门教练">
          <el-switch
            v-model="instructorForm.is_popular"
            active-text="是"
            inactive-text="否"
            :active-value="1"
            :inactive-value="0"
          />
        </el-form-item>
        <el-form-item v-if="editingInstructor && editingInstructor.instructor_id" label="教练ID">
          <el-input v-model="editingInstructor.instructor_id" disabled />
          <div style="color: #999; font-size: 12px; margin-top: 5px;">
            教练ID由系统自动生成，不可修改
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveInstructor" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Upload } from '@element-plus/icons-vue';
import api from '../../utils/api';
import axios from 'axios';

const instructors = ref([]);
const loading = ref(false);
const showEditDialog = ref(false);
const saving = ref(false);
const editingInstructor = ref(null);
const formRef = ref(null);
const uploadingAvatar = ref(false);

const instructorForm = ref({
  nickname: '',
  real_name: '',
  phone: '',
  password: '',
  avatar_url: '',
  background: '',
  is_popular: 0
});

// 上传配置
const uploadAction = computed(() => {
  const baseURL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:3000/api';
  return `${baseURL}/users/upload-avatar`;
});

const uploadHeaders = computed(() => {
  return {};
});

// 上传前的验证
const beforeAvatarUpload = (file) => {
  const isImage = file.type.startsWith('image/');
  const isLt8M = file.size / 1024 / 1024 < 8;

  if (!isImage) {
    ElMessage.error('只能上传图片文件!');
    return false;
  }
  if (!isLt8M) {
    ElMessage.error('图片大小不能超过 8MB!');
    return false;
  }
  uploadingAvatar.value = true;
  return true;
};

// 上传成功回调
const handleAvatarSuccess = (response, file) => {
  uploadingAvatar.value = false;
  if (response.success && response.data && response.data.avatar_url) {
    instructorForm.value.avatar_url = response.data.avatar_url;
    ElMessage.success('头像上传成功');
  } else {
    ElMessage.error(response.error || '头像上传失败');
  }
};

// 上传失败回调
const handleAvatarError = (error) => {
  uploadingAvatar.value = false;
  console.error('头像上传失败:', error);
  ElMessage.error('头像上传失败，请重试');
};

const rules = {
  nickname: [
    { required: false, message: '请输入昵称', trigger: 'blur' }
  ],
  real_name: [
    { required: false, message: '请输入姓名', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  password: [
    { 
      required: true, 
      message: '请输入密码', 
      trigger: 'blur',
      validator: (rule, value, callback) => {
        if (!editingInstructor.value && !value) {
          callback(new Error('请输入密码'));
        } else {
          callback();
        }
      }
    }
  ]
};

const loadInstructors = async () => {
  loading.value = true;
  try {
    const res = await api.get('/admin/instructors');
    if (res.success) {
      instructors.value = res.data || [];
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载教练列表失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载教练列表失败';
    ElMessage.error(errorMessage);
    instructors.value = [];
  } finally {
    loading.value = false;
  }
};

const editInstructor = (instructor) => {
  editingInstructor.value = instructor;
  instructorForm.value = {
    nickname: instructor.nickname || '',
    real_name: instructor.real_name || '',
    phone: instructor.phone || '',
    password: '', // 编辑时不显示密码
    avatar_url: instructor.avatar_url || '',
    background: instructor.background || '',
    is_popular: instructor.is_popular || 0
  };
  showEditDialog.value = true;
};

const togglePopularStatus = async (instructor, newStatus) => {
  const oldStatus = instructor.is_popular; // 保存原状态
  
  // 先更新UI状态（乐观更新）
  instructor.is_popular = newStatus;
  
  try {
    const response = await api.put(`/admin/instructors/${instructor.id}`, {
      is_popular: newStatus
    });
    
    if (response.success) {
      ElMessage.success(newStatus === 1 ? '已设置为热门教练' : '已取消热门教练');
      // 重新加载数据以确保状态同步
      await loadInstructors();
    } else {
      throw new Error(response.error || '更新失败');
    }
  } catch (error) {
    // 恢复原状态
    instructor.is_popular = oldStatus;
    console.error('更新热门状态失败:', error);
    const errorMessage = error?.response?.data?.error || 
                        error?.response?.data?.details || 
                        error?.message || 
                        '更新失败';
    ElMessage.error(errorMessage);
  }
};

const resetForm = () => {
  editingInstructor.value = null;
  instructorForm.value = {
    nickname: '',
    real_name: '',
    phone: '',
    password: '',
    avatar_url: '',
    background: '',
    is_popular: 0
  };
  if (formRef.value) {
    formRef.value.resetFields();
  }
};

const saveInstructor = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
  } catch (error) {
    return;
  }
  
  // 验证至少填写昵称或姓名
  if (!instructorForm.value.nickname && !instructorForm.value.real_name) {
    ElMessage.warning('请至少填写昵称或姓名');
    return;
  }
  
  saving.value = true;
  try {
    if (editingInstructor.value) {
      // 更新教练
      const updateData = {
        nickname: instructorForm.value.nickname || null,
        real_name: instructorForm.value.real_name || null,
        avatar_url: instructorForm.value.avatar_url || null,
        background: instructorForm.value.background || null,
        is_popular: instructorForm.value.is_popular || 0
      };
      
      // 只有提供了新密码才更新
      if (instructorForm.value.password) {
        updateData.password = instructorForm.value.password;
      }
      
      const response = await api.put(`/admin/instructors/${editingInstructor.value.id}`, updateData);
      
      if (response.success) {
        ElMessage.success('更新成功');
        showEditDialog.value = false;
        loadInstructors();
      } else {
        throw new Error(response.error || '更新失败');
      }
    } else {
      // 创建教练
      if (!instructorForm.value.password) {
        ElMessage.warning('创建教练时必须设置密码');
        return;
      }
      
      const response = await api.post('/admin/instructors', {
        nickname: instructorForm.value.nickname || null,
        real_name: instructorForm.value.real_name || null,
        phone: instructorForm.value.phone,
        password: instructorForm.value.password,
        avatar_url: instructorForm.value.avatar_url || null,
        background: instructorForm.value.background || null,
        is_popular: instructorForm.value.is_popular || 0
      });
      
      if (response.success) {
        ElMessage.success(`创建成功，教练ID: ${response.data.instructor_id}`);
        showEditDialog.value = false;
        loadInstructors();
      } else {
        throw new Error(response.error || '创建失败');
      }
    }
  } catch (error) {
    console.error('保存教练失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '保存失败';
    ElMessage.error(errorMessage);
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadInstructors();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.avatar-uploader {
  display: inline-block;
}

.avatar-uploader :deep(.el-upload) {
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;
}

.avatar-uploader :deep(.el-upload:hover) {
  border-color: #409eff;
}

.avatar {
  width: 120px;
  height: 120px;
  display: block;
  object-fit: cover;
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 120px;
  height: 120px;
  line-height: 120px;
  text-align: center;
}

:deep(.el-switch__label) {
  font-size: 12px;
}

:deep(.el-switch__label.is-active) {
  color: #67c23a;
}
</style>
