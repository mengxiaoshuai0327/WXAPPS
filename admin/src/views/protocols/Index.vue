<template>
  <div class="protocols-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>协议管理</span>
        </div>
      </template>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="用户协议" name="user">
          <div class="protocol-content">
            <el-form :model="userForm" ref="userFormRef" label-width="100px">
              <el-form-item label="标题" prop="title" :rules="[{ required: true, message: '请输入标题', trigger: 'blur' }]">
                <el-input v-model="userForm.title" placeholder="请输入标题" />
              </el-form-item>
              <el-form-item label="版本号" prop="version">
                <el-input v-model="userForm.version" placeholder="请输入版本号（如：1.0）" />
              </el-form-item>
              <el-form-item label="内容" prop="content" :rules="[{ required: true, message: '请输入内容', trigger: 'blur' }]">
                <el-input 
                  v-model="userForm.content" 
                  type="textarea" 
                  :rows="20"
                  placeholder="请输入用户协议内容"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveProtocol('user')" :loading="saving">保存</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="隐私条款" name="privacy">
          <div class="protocol-content">
            <el-form :model="privacyForm" ref="privacyFormRef" label-width="100px">
              <el-form-item label="标题" prop="title" :rules="[{ required: true, message: '请输入标题', trigger: 'blur' }]">
                <el-input v-model="privacyForm.title" placeholder="请输入标题" />
              </el-form-item>
              <el-form-item label="版本号" prop="version">
                <el-input v-model="privacyForm.version" placeholder="请输入版本号（如：1.0）" />
              </el-form-item>
              <el-form-item label="内容" prop="content" :rules="[{ required: true, message: '请输入内容', trigger: 'blur' }]">
                <el-input 
                  v-model="privacyForm.content" 
                  type="textarea" 
                  :rows="20"
                  placeholder="请输入隐私条款内容"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveProtocol('privacy')" :loading="saving">保存</el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../../utils/api';

export default {
  name: 'ProtocolsManagement',
  setup() {
    const activeTab = ref('user');
    const saving = ref(false);
    const userFormRef = ref(null);
    const privacyFormRef = ref(null);

    const userForm = reactive({
      title: '',
      content: '',
      version: ''
    });

    const privacyForm = reactive({
      title: '',
      content: '',
      version: ''
    });

    const loadProtocols = async () => {
      try {
        const response = await api.get('/admin/protocols');
        if (response.success && response.data) {
          if (response.data.user_agreement) {
            Object.assign(userForm, {
              title: response.data.user_agreement.title || '',
              content: response.data.user_agreement.content || '',
              version: response.data.user_agreement.version || ''
            });
          }
          if (response.data.privacy_policy) {
            Object.assign(privacyForm, {
              title: response.data.privacy_policy.title || '',
              content: response.data.privacy_policy.content || '',
              version: response.data.privacy_policy.version || ''
            });
          }
        }
      } catch (error) {
        console.error('加载协议内容失败:', error);
        ElMessage.error('加载失败');
      }
    };

    const saveProtocol = async (type) => {
      const formRef = type === 'user' ? userFormRef.value : privacyFormRef.value;
      const form = type === 'user' ? userForm : privacyForm;

      if (!formRef) return;

      try {
        await formRef.validate();
      } catch (error) {
        return;
      }

      saving.value = true;
      try {
        const response = await api.put(`/admin/protocols/${type}`, {
          title: form.title,
          content: form.content,
          version: form.version || '1.0'
        });

        if (response.success) {
          ElMessage.success('保存成功');
          loadProtocols();
        } else {
          throw new Error(response.error || '保存失败');
        }
      } catch (error) {
        console.error('保存协议失败:', error);
        const errorMessage = error.response?.data?.error || error.message || '保存失败';
        ElMessage.error(errorMessage);
      } finally {
        saving.value = false;
      }
    };

    const handleTabChange = (tabName) => {
      // Tab切换时可以添加额外逻辑
    };

    onMounted(() => {
      loadProtocols();
    });

    return {
      activeTab,
      saving,
      userFormRef,
      privacyFormRef,
      userForm,
      privacyForm,
      saveProtocol,
      handleTabChange
    };
  }
};
</script>

<style scoped>
.protocols-management {
  padding: 0;
}

.card-header {
  font-size: 18px;
  font-weight: bold;
}

.protocol-content {
  padding: 20px 0;
}
</style>

