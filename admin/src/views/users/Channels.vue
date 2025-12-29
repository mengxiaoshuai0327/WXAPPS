<template>
  <div class="channel-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>渠道方列表</span>
          <el-button type="primary" @click="showEditDialog = true; editingChannel = null; resetForm();">
            <el-icon><Plus /></el-icon>
            创建渠道方
          </el-button>
        </div>
      </template>

      <el-table :data="channels" style="width: 100%" v-loading="loading">
        <el-table-column prop="channel_id" label="渠道方ID" width="150">
          <template #default="scope">
            <span v-if="scope.row.channel_id" style="font-family: monospace; font-weight: bold; color: #409eff;">
              {{ scope.row.channel_id }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="channel_name" label="渠道名称" width="200" />
        <el-table-column prop="channel_short_name" label="渠道简称" width="150" />
        <el-table-column prop="contact_person" label="联系人" width="120" />
        <el-table-column prop="contact_phone" label="联系方式" width="150" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="scope">
            <el-button size="small" type="primary" @click="editChannel(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteChannel(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑对话框 -->
    <el-dialog 
      v-model="showEditDialog" 
      :title="editingChannel ? '编辑渠道方' : '创建渠道方'" 
      width="600px"
      @close="resetForm"
    >
      <el-form :model="channelForm" label-width="100px" :rules="rules" ref="formRef">
        <el-form-item label="渠道名称" prop="channel_name">
          <el-input v-model="channelForm.channel_name" placeholder="请输入渠道名称" />
        </el-form-item>
        <el-form-item label="渠道简称">
          <el-input v-model="channelForm.channel_short_name" placeholder="请输入渠道简称（选填）" />
        </el-form-item>
        <el-form-item label="联系人">
          <el-input v-model="channelForm.contact_person" placeholder="请输入联系人（选填）" />
        </el-form-item>
        <el-form-item label="联系方式">
          <el-input v-model="channelForm.contact_phone" placeholder="请输入联系方式（选填）" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input 
            v-model="channelForm.description" 
            type="textarea"
            :rows="3"
            placeholder="请输入渠道描述（选填）"
          />
        </el-form-item>
        <el-alert
          type="info"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          <template #default>
            <div>
              <p><strong>渠道方说明：</strong></p>
              <p>1. 渠道方不需要登录小程序功能，仅用于管理渠道销售和配置渠道推广方案。</p>
              <p>2. 渠道方ID（如CH73730147）作为唯一标识，用于识别和管理渠道方。</p>
              <p>3. 创建渠道方后，需要在"渠道推广方案管理"页面为该渠道配置推广方案。</p>
            </div>
          </template>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveChannel" :loading="saving">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '../../utils/api';

const channels = ref([]);
const loading = ref(false);
const saving = ref(false);
const showEditDialog = ref(false);
const editingChannel = ref(null);
const formRef = ref(null);

const channelForm = ref({
  channel_name: '',
  channel_short_name: '',
  contact_person: '',
  contact_phone: '',
  description: ''
});


const rules = {
  channel_name: [
    { required: true, message: '请输入渠道名称', trigger: 'blur' }
  ]
};

const loadChannels = async () => {
  loading.value = true;
  try {
    const res = await api.get('/admin/channels');
    if (res.success) {
      channels.value = res.data || [];
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载渠道方列表失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载渠道方列表失败';
    ElMessage.error(errorMessage);
    channels.value = [];
  } finally {
    loading.value = false;
  }
};

const editChannel = (channel) => {
  editingChannel.value = channel;
  channelForm.value = {
    channel_name: channel.channel_name || '',
    channel_short_name: channel.channel_short_name || '',
    contact_person: channel.contact_person || '',
    contact_phone: channel.contact_phone || '',
    description: channel.description || ''
  };
  showEditDialog.value = true;
};

const resetForm = () => {
  editingChannel.value = null;
  channelForm.value = {
    channel_name: '',
    channel_short_name: '',
    contact_person: '',
    contact_phone: '',
    description: ''
  };
  if (formRef.value) {
    formRef.value.resetFields();
  }
};

const saveChannel = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
  } catch (error) {
    return;
  }
  
  saving.value = true;
  try {
    if (editingChannel.value) {
      // 更新渠道方
      const updateData = {
        channel_name: channelForm.value.channel_name || null,
        channel_short_name: channelForm.value.channel_short_name || null,
        contact_person: channelForm.value.contact_person || null,
        contact_phone: channelForm.value.contact_phone || null,
        description: channelForm.value.description || null
      };
      
      const response = await api.put(`/admin/channels/${editingChannel.value.id}`, updateData);
      
      if (response.success) {
        ElMessage.success('更新成功');
        showEditDialog.value = false;
        loadChannels();
      } else {
        throw new Error(response.error || '更新失败');
      }
    } else {
      // 创建渠道方
      const response = await api.post('/admin/channels', {
        channel_name: channelForm.value.channel_name,
        channel_short_name: channelForm.value.channel_short_name || null,
        contact_person: channelForm.value.contact_person || null,
        contact_phone: channelForm.value.contact_phone || null,
        description: channelForm.value.description || null
      });
      
      if (response.success) {
        ElMessage.success(`创建成功，渠道方ID: ${response.data.channel_id}`);
        showEditDialog.value = false;
        loadChannels();
      } else {
        throw new Error(response.error || '创建失败');
      }
    }
  } catch (error) {
    console.error('保存渠道方失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '保存失败';
    ElMessage.error(errorMessage);
  } finally {
    saving.value = false;
  }
};

const deleteChannel = async (channel) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除渠道方"${channel.channel_name}"（${channel.channel_id}）吗？\n\n注意：如果该渠道方下有关联的渠道销售或推广方案，将无法删除。`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false
      }
    );
    
    loading.value = true;
    try {
      const response = await api.delete(`/admin/channels/${channel.id}`);
      
      if (response.success) {
        ElMessage.success('删除成功');
        loadChannels();
      } else {
        throw new Error(response.error || '删除失败');
      }
    } catch (error) {
      console.error('删除渠道方失败:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.details || 
                          error.message || 
                          '删除失败';
      ElMessage.error(errorMessage);
    } finally {
      loading.value = false;
    }
  } catch (error) {
    // 用户取消删除
    if (error !== 'cancel') {
      console.error('删除确认对话框错误:', error);
    }
  }
};

onMounted(() => {
  loadChannels();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

</style>

