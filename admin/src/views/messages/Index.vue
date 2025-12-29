<template>
  <div class="message-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>消息管理</span>
          <el-button type="primary" @click="showCreateDialog">
            <el-icon><Plus /></el-icon>
            创建消息
          </el-button>
        </div>
      </template>

      <!-- 搜索和筛选 -->
      <el-form :inline="true" :model="filters" class="filter-form" style="margin-bottom: 20px;">
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" placeholder="标题/内容" clearable @clear="loadMessages" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadMessages">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="messages" style="width: 100%" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column prop="content" label="内容" min-width="300" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="scope">
            <el-tag :type="getTypeColor(scope.row.type)">
              {{ getTypeText(scope.row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="receiver_text" label="消息接收人" width="200">
          <template #default="scope">
            <span>{{ scope.row.receiver_text || '全员' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="published" label="推送给前端" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.published ? 'success' : 'info'">
              {{ scope.row.published ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at_formatted" label="发布日期" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button size="small" @click="editMessage(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteMessage(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        :current-page="pagination.page"
        :page-sizes="[10, 20, 50, 100]"
        :page-size="pagination.pageSize"
        layout="total, sizes, prev, pager, next, jumper"
        :total="pagination.total"
        background
        style="margin-top: 20px;"
      />
    </el-card>

    <el-dialog v-model="showSendDialog" :title="editingMessage ? '编辑消息' : '创建消息'" width="600px">
      <el-form :model="messageForm" label-width="120px">
        <el-form-item label="接收用户">
          <el-radio-group v-model="messageForm.targetType" @change="onTargetTypeChange">
            <el-radio label="all">全部用户</el-radio>
            <el-radio label="specific">指定用户</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="messageForm.targetType === 'specific'" label="选择用户">
          <el-select 
            v-model="messageForm.user_ids" 
            placeholder="请选择接收消息的用户（可多选）" 
            multiple
            filterable
            style="width: 100%"
          >
            <el-option 
              v-for="user in users" 
              :key="user.id" 
              :label="`${user.real_name || user.nickname} (${user.member_id || user.phone})`" 
              :value="user.id" 
            />
          </el-select>
          <div style="margin-top: 8px; color: #999; font-size: 12px;">
            已选择 {{ messageForm.user_ids?.length || 0 }} 个用户
          </div>
        </el-form-item>
        <el-form-item label="消息类型" required>
          <el-select v-model="messageForm.type" style="width: 100%">
            <el-option label="系统通知" value="system" />
            <el-option label="课程取消" value="course_cancelled" />
            <el-option label="评价提醒" value="evaluation_reminder" />
            <el-option label="课券即将过期" value="ticket_expiring" />
            <el-option label="邀请奖励" value="invite_reward" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="messageForm.title" placeholder="请输入标题" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="消息内容" required>
          <el-input v-model="messageForm.content" type="textarea" :rows="6" placeholder="请输入消息内容" />
        </el-form-item>
        <el-form-item label="推送给前端">
          <el-switch v-model="messageForm.published" />
          <span style="margin-left: 10px; color: #999; font-size: 12px;">
            开启后，消息将在前端首页显示
          </span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelDialog">取消</el-button>
        <el-button type="primary" @click="saveMessage" :loading="sending">
          {{ editingMessage ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '../../utils/api';

const messages = ref([]);
const users = ref([]);
const loading = ref(false);
const sending = ref(false);
const showSendDialog = ref(false);
const editingMessage = ref(false);

const filters = ref({
  keyword: ''
});

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const messageForm = ref({
  id: null,
  targetType: 'all', // 'all' 或 'specific'
  user_id: null, // 编辑时使用，兼容旧数据
  user_ids: [], // 创建时使用，支持多选
  type: 'system',
  title: '',
  content: '',
  published: true
});

const loadMessages = async () => {
  loading.value = true;
  try {
    const res = await api.get('/admin/messages/list', {
      params: {
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        keyword: filters.value.keyword || undefined
      }
    });
    // API 拦截器已经返回了 response.data，所以 res 就是 { success, data, pagination }
    messages.value = res.data || [];
    pagination.value.total = res.pagination?.total || 0;
  } catch (error) {
    console.error('加载消息列表失败:', error);
    ElMessage.error(error.response?.data?.error || error.message || '加载消息列表失败');
    messages.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
};

const loadUsers = async () => {
  try {
    const res = await api.get('/admin/users');
    users.value = res.data || [];
  } catch (error) {
    // 忽略错误
  }
};

const saveMessage = async () => {
  if (!messageForm.value.title || !messageForm.value.content) {
    ElMessage.warning('请填写完整信息');
    return;
  }
  
  if (messageForm.value.targetType === 'specific' && (!messageForm.value.user_ids || messageForm.value.user_ids.length === 0)) {
    ElMessage.warning('请至少选择一个接收用户');
    return;
  }
  
  sending.value = true;
  try {
    if (editingMessage.value) {
      // 编辑时，发送targetType和user_ids（或user_id）给后端
      const editData = {
        title: messageForm.value.title,
        content: messageForm.value.content,
        type: messageForm.value.type,
        published: messageForm.value.published,
        targetType: messageForm.value.targetType,
        user_id: messageForm.value.targetType === 'all' ? null : (messageForm.value.user_ids?.[0] || messageForm.value.user_id),
        user_ids: messageForm.value.targetType === 'all' ? [] : messageForm.value.user_ids
      };
      await api.put(`/admin/messages/${messageForm.value.id}`, editData);
      ElMessage.success('更新成功');
    } else {
      // 创建时，使用user_ids（多用户）或user_id
      const createData = {
        ...messageForm.value,
        user_ids: messageForm.value.targetType === 'all' ? [] : messageForm.value.user_ids,
        user_id: messageForm.value.targetType === 'all' ? null : undefined
      };
      const res = await api.post('/admin/messages/create', createData);
      ElMessage.success(`创建成功，已创建 ${res.data?.count || 1} 条消息`);
    }
    showSendDialog.value = false;
    loadMessages();
    resetForm();
  } catch (error) {
    ElMessage.error(error.response?.data?.error || error.message || '操作失败');
  } finally {
    sending.value = false;
  }
};

const onTargetTypeChange = (value) => {
  if (value === 'all') {
    messageForm.value.user_ids = [];
    messageForm.value.user_id = null;
  }
};

const editMessage = (message) => {
  editingMessage.value = true;
  messageForm.value = {
    id: message.id,
    targetType: message.user_id ? 'specific' : 'all',
    user_id: message.user_id,
    user_ids: message.user_id ? [message.user_id] : [],
    type: message.type,
    title: message.title,
    content: message.content,
    published: message.published ? true : false
  };
  showSendDialog.value = true;
};

const cancelDialog = () => {
  showSendDialog.value = false;
  resetForm();
};

const resetForm = () => {
  editingMessage.value = false;
  messageForm.value = {
    id: null,
    targetType: 'all',
    user_id: null,
    user_ids: [],
    type: 'system',
    title: '',
    content: '',
    published: true
  };
};

const deleteMessage = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除该消息吗？', '提示', { type: 'warning' });
    await api.delete(`/admin/messages/${id}`);
    ElMessage.success('删除成功');
    loadMessages();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败');
    }
  }
};

const handleSizeChange = (val) => {
  pagination.value.pageSize = val;
  pagination.value.page = 1;
  loadMessages();
};

const handleCurrentChange = (val) => {
  pagination.value.page = val;
  loadMessages();
};

const getTypeColor = (type) => {
  const colors = {
    'system': 'info',
    'course': 'success',
    'activity': 'warning'
  };
  return colors[type] || 'info';
};

const getTypeText = (type) => {
  const texts = {
    'system': '系统通知',
    'course_cancelled': '课程取消',
    'evaluation_reminder': '评价提醒',
    'ticket_expiring': '课券即将过期',
    'invite_reward': '邀请奖励'
  };
  return texts[type] || type;
};

const showCreateDialog = () => {
  resetForm();
  showSendDialog.value = true;
};

onMounted(() => {
  loadMessages();
  loadUsers();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

