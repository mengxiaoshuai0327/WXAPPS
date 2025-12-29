<template>
  <div class="theme-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>课程主题</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建主题
          </el-button>
        </div>
      </template>

      <el-table :data="themes" style="width: 100%" v-loading="loading">
        <el-table-column prop="theme_code" label="主题ID" width="120">
          <template #default="scope">
            <span v-if="scope.row.theme_code">{{ scope.row.theme_code }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="module_name" label="所属模块" width="150" />
        <el-table-column prop="name" label="主题简称" min-width="150" />
        <el-table-column prop="full_name" label="主题名称" min-width="200" show-overflow-tooltip>
          <template #default="scope">
            <span>{{ scope.row.full_name || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="300" />
        <el-table-column prop="status" label="状态" width="120" align="center">
          <template #default="scope">
            <el-switch
              :model-value="scope.row.status"
              active-value="active"
              inactive-value="inactive"
              inline-prompt
              active-text="激活"
              inactive-text="未激活"
              active-color="#67c23a"
              inactive-color="#909399"
              @change="(val) => toggleStatus(scope.row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="editTheme(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteTheme(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" :title="editingTheme ? '编辑主题' : '创建主题'" width="500px">
      <el-form :model="themeForm" label-width="100px">
        <el-form-item label="所属模块" required>
          <el-select v-model="themeForm.module_id" placeholder="请选择模块" style="width: 100%">
            <el-option v-for="module in modules" :key="module.id" :label="module.name" :value="module.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="主题简称" required>
          <el-input v-model="themeForm.name" placeholder="请输入主题简称" />
        </el-form-item>
        <el-form-item label="主题名称">
          <el-input v-model="themeForm.full_name" placeholder="请输入主题名称（选填）" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="themeForm.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="themeForm.status">
            <el-radio value="active">激活</el-radio>
            <el-radio value="inactive">未激活</el-radio>
          </el-radio-group>
          <div style="font-size: 12px; color: #999; margin-top: 5px;">
            未激活的主题在游客模式下不会显示
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveTheme" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '../../utils/api';

const themes = ref([]);
const modules = ref([]);
const loading = ref(false);
const saving = ref(false);
const showCreateDialog = ref(false);
const editingTheme = ref(null);

const themeForm = ref({
  module_id: null,
  name: '',
  full_name: '',
  description: '',
  status: 'active'
});

const loadThemes = async () => {
  loading.value = true;
  try {
    const res = await api.get('/admin/themes');
    themes.value = res.data || [];
  } catch (error) {
    ElMessage.error('加载主题列表失败');
  } finally {
    loading.value = false;
  }
};

const loadModules = async () => {
  try {
    const res = await api.get('/admin/modules');
    modules.value = res.data || [];
  } catch (error) {
    ElMessage.error('加载模块列表失败');
  }
};

const saveTheme = async () => {
  if (!themeForm.value.module_id || !themeForm.value.name) {
    ElMessage.warning('请填写完整信息');
    return;
  }
  saving.value = true;
  try {
    if (editingTheme.value) {
      await api.put(`/admin/themes/${editingTheme.value.id}`, themeForm.value);
      ElMessage.success('更新成功');
    } else {
      await api.post('/admin/themes', themeForm.value);
      ElMessage.success('创建成功');
    }
    showCreateDialog.value = false;
    loadThemes();
    resetForm();
  } catch (error) {
    ElMessage.error(error.error || '保存失败');
  } finally {
    saving.value = false;
  }
};

const editTheme = (theme) => {
  editingTheme.value = theme;
  themeForm.value = {
    module_id: theme.module_id,
    name: theme.name,
    full_name: theme.full_name || '',
    description: theme.description || '',
    status: theme.status || 'active' // 确保status有默认值
  };
  showCreateDialog.value = true;
};

const toggleStatus = async (theme, newStatus) => {
  const oldStatus = theme.status; // 保存原状态
  
  // 先更新UI状态（乐观更新）
  theme.status = newStatus;
  
  try {
    await api.put(`/admin/themes/${theme.id}`, {
      module_id: theme.module_id,
      name: theme.name,
      full_name: theme.full_name || '',
      description: theme.description,
      status: newStatus
    });
    
    ElMessage.success(newStatus === 'active' ? '已激活' : '已取消激活');
    // 重新加载数据以确保状态同步
    await loadThemes();
  } catch (error) {
    // 恢复原状态
    theme.status = oldStatus;
    console.error('更新状态失败:', error);
    const errorMessage = error?.response?.data?.error || 
                        error?.response?.data?.details || 
                        error?.message || 
                        '更新失败';
    ElMessage.error(errorMessage);
  }
};

const deleteTheme = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除该主题吗？', '提示', { type: 'warning' });
    await api.delete(`/admin/themes/${id}`);
    ElMessage.success('删除成功');
    loadThemes();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const resetForm = () => {
  editingTheme.value = null;
  themeForm.value = { module_id: null, name: '', full_name: '', description: '', status: 'active' };
};

onMounted(() => {
  loadThemes();
  loadModules();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

:deep(.el-switch__label) {
  font-size: 12px;
}

:deep(.el-switch__label.is-active) {
  color: #67c23a;
}
</style>

