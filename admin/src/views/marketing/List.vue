<template>
  <div class="marketing-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>营销方案管理</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建营销方案
          </el-button>
        </div>
      </template>

      <!-- 筛选栏 -->
      <div class="filter-bar" style="margin-bottom: 20px;">
        <el-form :inline="true">
          <el-form-item label="角色">
            <el-select 
              v-model="filters.role" 
              placeholder="全部角色" 
              clearable 
              style="width: 150px" 
              @change="loadCampaigns"
            >
              <el-option label="教练" value="instructor" />
              <el-option label="渠道方" value="channel" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select 
              v-model="filters.status" 
              placeholder="全部状态" 
              clearable 
              style="width: 150px" 
              @change="loadCampaigns"
            >
              <el-option label="已激活" value="active" />
              <el-option label="未激活" value="inactive" />
            </el-select>
          </el-form-item>
          <el-form-item label="用户">
            <el-input 
              v-model="filters.user_keyword" 
              placeholder="用户ID/昵称/姓名" 
              clearable 
              style="width: 200px"
              @clear="loadCampaigns"
              @keyup.enter="loadCampaigns"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadCampaigns">查询</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 提示信息 -->
      <el-alert
        :title="`当前有 ${activeCount} 个激活的营销方案`"
        :type="activeCount > 0 ? 'success' : 'info'"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #default>
          <span>营销方案按用户维度管理，每个教练或渠道方可以有多个营销方案（不同时间段），但在同一时间只能有一个激活的方案。折扣比例以小数形式设置（如0.20表示20%折扣，即8折；0.30表示30%折扣，即7折）。</span>
        </template>
      </el-alert>

      <!-- 营销方案列表 -->
      <el-table 
        :data="campaigns" 
        v-loading="loading"
        style="width: 100%"
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="用户信息" width="200">
          <template #default="{ row }">
            <div>{{ row.user_nickname || row.user_real_name || '-' }}</div>
            <div style="font-size: 12px; color: #999;">
              {{ row.instructor_id || row.channel_id || '-' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.user_role === 'instructor' ? 'success' : 'warning'">
              {{ row.user_role === 'instructor' ? '教练' : '渠道方' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="方案名称" min-width="150" />
        <el-table-column label="折扣比例" width="120">
          <template #default="{ row }">
            <span style="font-weight: bold; color: #409eff;">
              {{ (row.discount_rate * 100).toFixed(0) }}%
            </span>
            <div style="font-size: 12px; color: #999;">
              ({{ ((1 - row.discount_rate) * 100).toFixed(0) }}折)
            </div>
          </template>
        </el-table-column>
        <el-table-column label="生效时间" width="220">
          <template #default="{ row }">
            <div>{{ formatDateOnly(row.start_date) || '立即生效' }}</div>
            <div style="font-size: 12px; color: #999;">至 {{ formatDateOnly(row.end_date) || '永久有效' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'">
              {{ row.status === 'active' ? '已激活' : '未激活' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="editCampaign(row)">
              编辑
            </el-button>
            <el-button 
              size="small" 
              :type="row.status === 'active' ? 'warning' : 'success'"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'active' ? '停用' : '激活' }}
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteCampaign(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="campaigns.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无营销方案，点击上方按钮创建" />
      </div>
    </el-card>

    <!-- 创建/编辑对话框 -->
    <el-dialog 
      v-model="showCreateDialog" 
      :title="editingCampaign ? '编辑营销方案' : '创建营销方案'" 
      width="700px"
      @close="resetForm"
    >
      <el-form :model="form" label-width="140px" :rules="rules" ref="formRef">
        <el-form-item label="用户角色" prop="user_role">
          <el-select 
            v-model="form.user_role" 
            placeholder="请选择角色"
            style="width: 100%;"
            @change="handleRoleChange"
          >
            <el-option label="教练" value="instructor" />
            <el-option label="渠道方" value="channel" />
          </el-select>
          <div class="form-tip">选择要设置营销方案的用户角色</div>
        </el-form-item>
        <el-form-item label="选择用户" prop="user_id">
          <el-select 
            v-model="form.user_id" 
            :placeholder="form.user_role ? `请选择${form.user_role === 'instructor' ? '教练' : '渠道方'}` : '请先选择角色'"
            :disabled="!form.user_role"
            filterable
            :loading="userLoading"
            style="width: 100%;"
            @change="handleUserChange"
          >
            <el-option
              v-for="user in userOptions"
              :key="user.id"
              :label="`${user.nickname || user.real_name || '-'} (${user.instructor_id || user.channel_id || user.id})`"
              :value="user.id"
            >
              <span style="float: left">{{ user.nickname || user.real_name || '-' }}</span>
              <span style="float: right; color: #8492a6; font-size: 13px;">
                {{ user.instructor_id || user.channel_id || user.id }}
              </span>
            </el-option>
          </el-select>
          <div class="form-tip">选择一个{{ form.user_role === 'instructor' ? '教练' : form.user_role === 'channel' ? '渠道方' : '用户' }}，为其设置营销方案</div>
        </el-form-item>
        <el-form-item label="方案名称">
          <el-input 
            v-model="form.name" 
            placeholder="请输入方案名称（选填，用于描述）"
            maxlength="200"
          />
        </el-form-item>
        <el-form-item label="折扣比例" prop="discount_rate">
          <el-input-number 
            v-model="form.discount_rate" 
            :min="0" 
            :max="1"
            :step="0.01"
            :precision="2"
            placeholder="请输入折扣比例"
            style="width: 100%;"
          />
          <div class="form-tip">请输入0-1之间的小数，如0.20表示20%折扣（即8折），0.30表示30%折扣（即7折）</div>
          <div v-if="form.discount_rate" class="form-tip" style="color: #409eff;">
            实际折扣：{{ (form.discount_rate * 100).toFixed(0) }}%折扣 = {{ ((1 - form.discount_rate) * 100).toFixed(0) }}折
          </div>
        </el-form-item>
        <el-form-item label="生效开始日期">
          <el-date-picker
            v-model="form.start_date"
            type="date"
            placeholder="选择开始日期（留空表示立即生效）"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
          />
          <div class="form-tip">留空表示立即生效</div>
        </el-form-item>
        <el-form-item label="生效结束日期">
          <el-date-picker
            v-model="form.end_date"
            type="date"
            placeholder="选择结束日期（留空表示永久有效）"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%;"
            :disabled-date="(date) => form.start_date && date < new Date(form.start_date)"
          />
          <div class="form-tip">留空表示永久有效</div>
        </el-form-item>
        <el-form-item label="方案描述">
          <el-input 
            v-model="form.description" 
            type="textarea"
            :rows="3"
            placeholder="请输入方案描述（选填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="active">激活</el-radio>
            <el-radio value="inactive">未激活</el-radio>
          </el-radio-group>
          <div class="form-tip">注意：同一用户在同一时间只能有一个激活的营销方案</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '../../utils/api';
import axios from 'axios';

const campaigns = ref([]);
const loading = ref(false);
const showCreateDialog = ref(false);
const submitting = ref(false);
const editingCampaign = ref(null);
const formRef = ref(null);
const userLoading = ref(false);
const userOptions = ref([]);

const filters = ref({
  role: '',
  status: '',
  user_keyword: ''
});

const form = ref({
  user_role: '',
  user_id: null,
  name: '',
  discount_rate: 0.20,
  start_date: null,
  end_date: null,
  description: '',
  status: 'active'
});

const rules = {
  user_role: [
    { required: true, message: '请选择用户角色', trigger: 'change' }
  ],
  user_id: [
    { required: true, message: '请选择用户', trigger: 'change' }
  ],
  discount_rate: [
    { required: true, message: '请输入折扣比例', trigger: 'blur' },
    { type: 'number', min: 0, max: 1, message: '折扣比例必须在0-1之间', trigger: 'blur' }
  ]
};

const activeCount = computed(() => {
  return campaigns.value.filter(c => c.status === 'active').length;
});

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
};

// 格式化日期，只显示年月日（东八区时间）
const formatDateOnly = (dateString) => {
  if (!dateString) return null;
  
  try {
    // 如果已经是 YYYY-MM-DD 格式，直接返回
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // 解析日期字符串
    let date;
    if (dateString.includes('T')) {
      // ISO格式字符串（如：2025-12-15T16:00:00.000Z）
      date = new Date(dateString);
    } else {
      // 普通日期字符串
      date = new Date(dateString);
    }
    
    // 如果日期无效，返回原值
    if (isNaN(date.getTime())) {
      return dateString;
    }
    
    // 获取本地时间（浏览器会根据系统时区自动转换）
    // 但我们需要确保显示的是东八区时间
    // 如果字符串包含Z（UTC），需要手动加8小时
    let targetDate = date;
    if (dateString.includes('Z') || dateString.endsWith('UTC')) {
      // UTC时间，需要转换为东八区（加8小时）
      const utcTime = date.getTime();
      const beijingTime = utcTime + (8 * 60 * 60 * 1000);
      targetDate = new Date(beijingTime);
    }
    
    // 格式化为 YYYY-MM-DD
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('格式化日期失败:', error, dateString);
    // 尝试提取日期部分
    if (typeof dateString === 'string' && dateString.includes('-')) {
      return dateString.split('T')[0].split(' ')[0];
    }
    return dateString;
  }
};

// 根据角色加载用户列表
const loadUsersByRole = async (role) => {
  if (!role) {
    userOptions.value = [];
    return;
  }
  
  userLoading.value = true;
  try {
    let res;
    if (role === 'instructor') {
      res = await api.get('/admin/instructors');
    } else if (role === 'channel') {
      res = await api.get('/admin/channels');
    } else {
      userOptions.value = [];
      return;
    }
    
    if (res.success) {
      userOptions.value = res.data || [];
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载用户列表失败:', error);
    ElMessage.error('加载用户列表失败: ' + (error.response?.data?.error || error.message || '未知错误'));
    userOptions.value = [];
  } finally {
    userLoading.value = false;
  }
};

// 角色改变时重新加载用户列表
const handleRoleChange = (role) => {
  form.value.user_id = null;
  userOptions.value = [];
  if (role) {
    loadUsersByRole(role);
  }
};

const handleUserChange = (userId) => {
  const selectedUser = userOptions.value.find(u => u.id === userId);
  if (selectedUser && !form.value.name) {
    // 自动填充方案名称
    form.value.name = `${selectedUser.nickname || selectedUser.real_name || '用户'}的营销方案`;
  }
};

const loadCampaigns = async () => {
  loading.value = true;
  try {
    const params = {};
    if (filters.value.role) params.role = filters.value.role;
    if (filters.value.status) params.status = filters.value.status;
    if (filters.value.user_keyword) params.user_id = filters.value.user_keyword;

    const res = await api.get('/admin/marketing/list', { params });
    if (res.success) {
      campaigns.value = res.data || [];
      
      // 如果有关键词，进一步过滤
      if (filters.value.user_keyword && isNaN(filters.value.user_keyword)) {
        const keyword = filters.value.user_keyword.toLowerCase();
        campaigns.value = campaigns.value.filter(c => 
          (c.user_nickname && c.user_nickname.toLowerCase().includes(keyword)) ||
          (c.user_real_name && c.user_real_name.toLowerCase().includes(keyword)) ||
          (c.instructor_id && c.instructor_id.toLowerCase().includes(keyword)) ||
          (c.channel_id && c.channel_id.toLowerCase().includes(keyword))
        );
      }
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载营销方案列表失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载营销方案列表失败';
    ElMessage.error(errorMessage);
    campaigns.value = [];
  } finally {
    loading.value = false;
  }
};

const resetForm = () => {
  form.value = {
    user_role: '',
    user_id: null,
    name: '',
    discount_rate: 0.20,
    start_date: null,
    end_date: null,
    description: '',
    status: 'active'
  };
  editingCampaign.value = null;
  userOptions.value = [];
  if (formRef.value) {
    formRef.value.resetFields();
  }
};

const editCampaign = async (campaign) => {
  editingCampaign.value = campaign;
  
  // 确定用户角色
  const userRole = campaign.user_role;
  
  form.value = {
    user_role: userRole,
    user_id: campaign.user_id,
    name: campaign.name || '',
    discount_rate: parseFloat(campaign.discount_rate),
    start_date: campaign.start_date || null,
    end_date: campaign.end_date || null,
    description: campaign.description || '',
    status: campaign.status
  };
  
  // 加载用户选项
  if (userRole) {
    await loadUsersByRole(userRole);
  }
  
  showCreateDialog.value = true;
};

const submitForm = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
  } catch (error) {
    return;
  }

  // 验证日期
  if (form.value.start_date && form.value.end_date) {
    const start = new Date(form.value.start_date);
    const end = new Date(form.value.end_date);
    if (start > end) {
      ElMessage.error('开始日期不能晚于结束日期');
      return;
    }
  }

  submitting.value = true;
  try {
    if (editingCampaign.value) {
      // 更新
      const response = await api.put(`/admin/marketing/${editingCampaign.value.id}`, form.value);
      if (response.success) {
        ElMessage.success(response.message || '更新成功');
        showCreateDialog.value = false;
        loadCampaigns();
      } else {
        throw new Error(response.error || '更新失败');
      }
    } else {
      // 创建
      const response = await api.post('/admin/marketing/create', form.value);
      if (response.success) {
        ElMessage.success(response.message || '创建成功');
        showCreateDialog.value = false;
        loadCampaigns();
      } else {
        throw new Error(response.error || '创建失败');
      }
    }
  } catch (error) {
    console.error('提交失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '操作失败';
    ElMessage.error(errorMessage);
  } finally {
    submitting.value = false;
  }
};

const toggleStatus = async (campaign) => {
  const newStatus = campaign.status === 'active' ? 'inactive' : 'active';
  try {
    const response = await api.put(`/admin/marketing/${campaign.id}`, {
      status: newStatus
    });

    if (response.success) {
      ElMessage.success('状态更新成功');
      loadCampaigns();
    } else {
      throw new Error(response.error || '更新失败');
    }
  } catch (error) {
    console.error('更新状态失败:', error);
    const errorMessage = error.response?.data?.error || error.message || '更新失败';
    ElMessage.error(errorMessage);
    loadCampaigns();
  }
};

const deleteCampaign = async (campaign) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除营销方案"${campaign.name || '未命名方案'}"吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await api.delete(`/admin/marketing/${campaign.id}`);
    
    if (response.success) {
      ElMessage.success('删除成功');
      loadCampaigns();
    } else {
      throw new Error(response.error || '删除失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除营销方案失败:', error);
      ElMessage.error(error.response?.data?.error || error.message || '删除失败');
    }
  }
};

onMounted(() => {
  loadCampaigns();
});
</script>

<style scoped>
.marketing-list {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
}

.filter-bar {
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
}
</style>
