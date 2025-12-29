<template>
  <div class="module-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>课程模块</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建模块
          </el-button>
        </div>
      </template>

      <el-table :data="modules" style="width: 100%" v-loading="loading">
        <el-table-column prop="module_code" label="模块ID" width="120">
          <template #default="scope">
            <span v-if="scope.row.module_code">{{ scope.row.module_code }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="模块名称" min-width="200" />
        <el-table-column prop="description" label="描述" min-width="300" />
        <el-table-column prop="sort_order" label="排序" width="100" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="editModule(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteModule(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showCreateDialog" :title="editingModule ? '编辑模块' : '创建模块'" width="500px">
      <el-form :model="moduleForm" label-width="100px">
        <el-form-item label="模块名称" required>
          <el-input v-model="moduleForm.name" placeholder="请输入模块名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="moduleForm.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="moduleForm.sort_order" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveModule" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '../../utils/api';

const modules = ref([]);
const loading = ref(false);
const saving = ref(false);
const showCreateDialog = ref(false);
const editingModule = ref(null);

const moduleForm = ref({
  name: '',
  description: '',
  sort_order: 0
});

const loadModules = async () => {
  loading.value = true;
  try {
    const res = await api.get('/admin/modules');
    modules.value = res.data || [];
  } catch (error) {
    ElMessage.error('加载模块列表失败');
  } finally {
    loading.value = false;
  }
};

const saveModule = async () => {
  if (!moduleForm.value.name) {
    ElMessage.warning('请输入模块名称');
    return;
  }
  saving.value = true;
  try {
    if (editingModule.value) {
      await api.put(`/admin/modules/${editingModule.value.id}`, moduleForm.value);
      ElMessage.success('更新成功');
    } else {
      await api.post('/admin/modules', moduleForm.value);
      ElMessage.success('创建成功');
    }
    showCreateDialog.value = false;
    loadModules();
    resetForm();
  } catch (error) {
    ElMessage.error(error.error || '保存失败');
  } finally {
    saving.value = false;
  }
};

const editModule = (module) => {
  editingModule.value = module;
  moduleForm.value = { ...module };
  showCreateDialog.value = true;
};

const deleteModule = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除该模块吗？', '提示', { type: 'warning' });
    await api.delete(`/admin/modules/${id}`);
    ElMessage.success('删除成功');
    loadModules();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error?.error || error?.message || '删除失败');
    }
  }
};

const resetForm = () => {
  editingModule.value = null;
  moduleForm.value = { name: '', description: '', sort_order: 0 };
};

onMounted(() => {
  loadModules();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

