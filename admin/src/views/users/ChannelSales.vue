<template>
  <div class="channel-sales-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>渠道销售列表</span>
          <el-button type="primary" @click="showEditDialog = true; editingSale = null; resetForm();">
            <el-icon><Plus /></el-icon>
            创建渠道销售
          </el-button>
        </div>
      </template>

      <!-- 筛选条件 -->
      <el-form :inline="true" class="filter-form" style="margin-bottom: 20px;">
        <el-form-item label="渠道方">
          <el-select 
            v-model="filterChannelUserId" 
            placeholder="全部渠道" 
            clearable
            style="width: 200px"
            @change="loadSales"
          >
            <el-option 
              v-for="channel in channels" 
              :key="channel.id" 
              :label="channel.channel_name || channel.nickname || channel.channel_id" 
              :value="channel.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input 
            v-model="filterKeyword" 
            placeholder="会员ID/昵称/手机号" 
            clearable
            style="width: 200px"
            @keyup.enter="loadSales"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadSales">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="sales" style="width: 100%" v-loading="loading" border>
        <el-table-column prop="member_id" label="会员ID" width="120">
          <template #default="scope">
            <span v-if="scope.row.member_id">{{ scope.row.member_id }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" width="150" />
        <el-table-column prop="real_name" label="姓名" width="120" />
        <el-table-column prop="phone" label="手机号" width="150" />
        <el-table-column label="所属渠道" width="200">
          <template #default="scope">
            <div>
              <div>{{ scope.row.channel_name || '未知渠道' }}</div>
              <div style="font-size: 12px; color: #999; font-family: monospace;" v-if="scope.row.channel_id">
                渠道方ID：{{ scope.row.channel_id }}
              </div>
            </div>
          </template>
        </el-table-column>
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
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button size="small" type="primary" @click="editSale(scope.row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteSale(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadSales"
        @current-change="loadSales"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <!-- 创建/编辑对话框 -->
    <el-dialog 
      v-model="showEditDialog" 
      :title="editingSale ? '编辑渠道销售' : '创建渠道销售'" 
      width="600px"
      @close="resetForm"
    >
      <el-form :model="saleForm" label-width="120px" :rules="rules" ref="formRef">
        <el-form-item label="所属渠道方" prop="channel_user_id">
          <el-select 
            v-model="saleForm.channel_user_id" 
            placeholder="请选择所属渠道方" 
            style="width: 100%"
            :disabled="!!editingSale"
          >
            <el-option 
              v-for="channel in channels" 
              :key="channel.id" 
              :label="channel.channel_name || channel.nickname || channel.channel_id" 
              :value="channel.id" 
            />
          </el-select>
          <div v-if="editingSale" style="color: #999; font-size: 12px; margin-top: 5px;">
            所属渠道方不可修改
          </div>
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="saleForm.nickname" placeholder="请输入昵称（选填）" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="saleForm.real_name" placeholder="请输入姓名（选填）" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input 
            v-model="saleForm.phone" 
            placeholder="请输入11位手机号" 
            maxlength="11"
            @input="handlePhoneInput"
          />
          <div style="color: #999; font-size: 12px; margin-top: 5px;">
            格式：1开头，第二位3-9，共11位数字（例如：13800138000）
          </div>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input 
            v-model="saleForm.password" 
            type="password" 
            :placeholder="editingSale ? '留空则不修改密码' : '请输入密码'"
            show-password
          />
          <div v-if="editingSale" style="color: #999; font-size: 12px; margin-top: 5px;">
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
            <img v-if="saleForm.avatar_url" :src="saleForm.avatar_url" class="avatar" />
            <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
          </el-upload>
        </el-form-item>
        <el-alert
          type="info"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          <template #default>
            <div>
              <p><strong>渠道销售说明：</strong></p>
              <p>1. 渠道销售是渠道方下属的销售人员，可以作为会员登录小程序</p>
              <p>2. 渠道销售使用自己的会员ID（member_id）作为邀请码分享给其他用户</p>
              <p>3. 通过渠道销售邀请注册的用户，将享受该渠道方对应的渠道推广方案优惠券政策</p>
            </div>
          </template>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveSale" :loading="saving">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import api from '../../utils/api';

const sales = ref([]);
const channels = ref([]);
const loading = ref(false);
const saving = ref(false);
const showEditDialog = ref(false);
const editingSale = ref(null);
const formRef = ref(null);

const filterChannelUserId = ref('');
const filterKeyword = ref('');

const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0
});

const saleForm = ref({
  channel_user_id: null,
  nickname: '',
  real_name: '',
  phone: '',
  password: '',
  avatar_url: ''
});

const uploadAction = computed(() => {
  const baseURL = api.defaults?.baseURL || 'http://localhost:3000/api';
  return `${baseURL}/users/upload-avatar`;
});

const uploadHeaders = computed(() => {
  return {};
});

const handleAvatarSuccess = (response) => {
  if (response.success && response.data) {
    saleForm.value.avatar_url = response.data.avatar_url;
    ElMessage.success('头像上传成功');
  } else {
    ElMessage.error('头像上传失败');
  }
};

const handleAvatarError = () => {
  ElMessage.error('头像上传失败，请重试');
};

const beforeAvatarUpload = (file) => {
  const isImage = file.type.startsWith('image/');
  const isLt2M = file.size / 1024 / 1024 < 2;

  if (!isImage) {
    ElMessage.error('只能上传图片文件!');
    return false;
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!');
    return false;
  }
  return true;
};

const rules = {
  channel_user_id: [
    { required: true, message: '请选择所属渠道方', trigger: 'change' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: ['blur', 'change'] },
    { 
      pattern: /^1[3-9]\d{9}$/, 
      message: '手机号格式不正确，请输入11位手机号（1开头，第二位3-9）', 
      trigger: ['blur', 'change'] 
    }
  ],
  password: [
    { 
      required: true, 
      message: '请输入密码', 
      trigger: 'blur',
      validator: (rule, value, callback) => {
        if (!editingSale.value && !value) {
          callback(new Error('请输入密码'));
        } else {
          callback();
        }
      }
    },
    {
      min: 6,
      message: '密码长度至少6位',
      trigger: 'blur'
    }
  ]
};

const loadChannels = async () => {
  try {
    const res = await api.get('/admin/channels');
    if (res.success) {
      channels.value = res.data || [];
    }
  } catch (error) {
    console.error('加载渠道方列表失败:', error);
  }
};

const loadSales = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    };
    
    if (filterChannelUserId.value) {
      params.channel_user_id = filterChannelUserId.value;
    }
    
    if (filterKeyword.value) {
      params.keyword = filterKeyword.value;
    }
    
    const res = await api.get('/admin/channel-sales', { params });
    if (res.success) {
      sales.value = res.data || [];
      if (res.pagination) {
        pagination.value.total = res.pagination.total || 0;
      }
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载渠道销售列表失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载渠道销售列表失败';
    ElMessage.error(errorMessage);
    sales.value = [];
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filterChannelUserId.value = '';
  filterKeyword.value = '';
  pagination.value.page = 1;
  loadSales();
};

const handlePhoneInput = (value) => {
  // 只允许输入数字，自动过滤非数字字符（如"联想北京"等）
  saleForm.value.phone = value.replace(/[^\d]/g, '');
};

const editSale = (sale) => {
  editingSale.value = sale;
  saleForm.value = {
    channel_user_id: sale.channel_user_id,
    nickname: sale.nickname || '',
    real_name: sale.real_name || '',
    phone: sale.phone || '',
    password: '', // 编辑时不显示密码
    avatar_url: sale.avatar_url || ''
  };
  showEditDialog.value = true;
};

const resetForm = () => {
  editingSale.value = null;
  saleForm.value = {
    channel_user_id: null,
    nickname: '',
    real_name: '',
    phone: '',
    password: '',
    avatar_url: ''
  };
  if (formRef.value) {
    formRef.value.resetFields();
    formRef.value.clearValidate();
  }
};

const saveSale = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
  } catch (error) {
    return;
  }
  
  saving.value = true;
  try {
    if (editingSale.value) {
      // 更新渠道销售
      const updateData = {
        nickname: saleForm.value.nickname || null,
        real_name: saleForm.value.real_name || null,
        phone: saleForm.value.phone || null,
        avatar_url: saleForm.value.avatar_url || null
      };
      
      // 只有提供了新密码才更新
      if (saleForm.value.password) {
        updateData.password = saleForm.value.password;
      }
      
      // 渠道方不能修改
      // if (saleForm.value.channel_user_id !== editingSale.value.channel_user_id) {
      //   updateData.channel_user_id = saleForm.value.channel_user_id;
      // }
      
      const response = await api.put(`/admin/channel-sales/${editingSale.value.id}`, updateData);
      
      if (response.success) {
        ElMessage.success('更新成功');
        showEditDialog.value = false;
        loadSales();
      } else {
        throw new Error(response.error || '更新失败');
      }
    } else {
      // 创建渠道销售
      if (!saleForm.value.password) {
        ElMessage.warning('创建渠道销售时必须设置密码');
        return;
      }
      
      const response = await api.post('/admin/channel-sales', {
        nickname: saleForm.value.nickname || null,
        real_name: saleForm.value.real_name || null,
        phone: saleForm.value.phone,
        password: saleForm.value.password,
        avatar_url: saleForm.value.avatar_url || null,
        channel_user_id: saleForm.value.channel_user_id
      });
      
      if (response.success) {
        ElMessage.success(`创建成功，会员ID: ${response.data.member_id}`);
        showEditDialog.value = false;
        loadSales();
      } else {
        throw new Error(response.error || '创建失败');
      }
    }
  } catch (error) {
    console.error('保存渠道销售失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '保存失败';
    ElMessage.error(errorMessage);
  } finally {
    saving.value = false;
  }
};

const deleteSale = async (sale) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除渠道销售 "${sale.real_name || sale.nickname || sale.member_id}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await api.delete(`/admin/channel-sales/${sale.id}`);
    
    if (response.success) {
      ElMessage.success('删除成功');
      loadSales();
    } else {
      throw new Error(response.error || '删除失败');
    }
  } catch (error) {
    if (error === 'cancel') {
      return;
    }
    console.error('删除渠道销售失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '删除失败';
    ElMessage.error(errorMessage);
  }
};

onMounted(() => {
  loadChannels();
  loadSales();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form .el-form-item {
  margin-bottom: 0;
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
</style>

