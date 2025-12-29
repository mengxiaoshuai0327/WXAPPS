<template>
  <div class="channel-promotion-schemes">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>渠道推广方案管理</span>
          <el-button type="primary" @click="handleCreateClick">
            <el-icon><Plus /></el-icon>
            添加渠道推广方案
          </el-button>
        </div>
      </template>

      <!-- 提示信息 -->
      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #default>
          <div>
            <p><strong>渠道推广方案说明：</strong></p>
            <p>1. 渠道推广方案用于配置不同渠道的优惠券发放规则。</p>
            <p>2. 当用户通过渠道销售的邀请码注册时，系统会根据渠道方对应的渠道推广方案自动发放优惠券给被邀请人。</p>
            <p>3. 创建方案前，请先确保已在"渠道方列表"中创建了对应的渠道方。</p>
            <p>4. 选择渠道方后，系统会自动关联，创建后不可修改。</p>
          </div>
        </template>
      </el-alert>

      <!-- 筛选栏 -->
      <div class="filter-bar" style="margin-bottom: 20px;">
        <el-form :inline="true">
          <el-form-item label="状态">
            <el-select 
              v-model="filters.status" 
              placeholder="全部状态" 
              clearable 
              style="width: 150px" 
              @change="loadSchemes"
            >
              <el-option label="已激活" value="active" />
              <el-option label="未激活" value="inactive" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadSchemes">查询</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 方案列表 -->
      <el-table 
        :data="schemes" 
        v-loading="loading"
        style="width: 100%"
        border
      >
        <el-table-column prop="scheme_code" label="方案编码" width="150">
          <template #default="{ row }">
            <span v-if="row.scheme_code" style="font-family: monospace; font-weight: bold; color: #409eff;">
              {{ row.scheme_code }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="关联渠道方" min-width="250">
          <template #default="{ row }">
            <div>
              <div>{{ row.channel_name || '-' }}</div>
              <div v-if="row.channel_id" style="font-size: 12px; color: #999; font-family: monospace;">
                渠道方ID：{{ row.channel_id }}
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="优惠券配置" min-width="280">
          <template #default="{ row }">
            <div>
              <div>
                <el-tag type="success" size="small" style="margin-right: 5px;">奖励被邀请人</el-tag>
                <span class="amount">{{ formatAmountWithoutSymbol(row.amount) }}</span>元
                <span style="color: #666;">
                  （赠送{{ row.ticket_count !== null && row.ticket_count !== undefined ? row.ticket_count : 1 }}张，每张{{ formatAmountWithoutSymbol(row.ticket_price !== null && row.ticket_price !== undefined ? row.ticket_price : (row.amount || 0)) }}元）
                </span>
              </div>
              <div class="expiry">有效期：{{ row.expiry_days }}天</div>
            </div>
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
        <el-table-column label="更新时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.updated_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click="editScheme(row)">
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
              @click="deleteScheme(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑对话框 -->
    <el-dialog 
      v-model="showEditDialog" 
      :title="editingScheme ? '编辑渠道推广方案' : '添加渠道推广方案'" 
      width="600px"
      @close="resetForm"
    >
      <el-form :model="form" label-width="140px" :rules="rules" ref="formRef">
        <el-form-item label="关联渠道方" prop="channel_code">
          <el-select 
            v-model="form.channel_code" 
            placeholder="请选择渠道方"
            filterable
            style="width: 100%"
            @change="onChannelChange"
            :disabled="!!editingScheme"
          >
            <el-option 
              v-for="channel in availableChannels" 
              :key="channel.channel_code" 
              :label="`${channel.channel_name} (${channel.channel_id})`" 
              :value="channel.channel_code"
            >
              <div>
                <div>{{ channel.channel_name }}</div>
                <div style="font-size: 12px; color: #999;">
                  {{ channel.channel_short_name ? `简称：${channel.channel_short_name}，` : '' }}
                  渠道方ID：{{ channel.channel_id }}
                </div>
              </div>
            </el-option>
          </el-select>
          <div class="form-tip" v-if="!editingScheme">请选择已创建的渠道方。只有创建了渠道方后，才能添加渠道推广方案。创建后不可修改。</div>
          <div class="form-tip" v-else>渠道方关联后不可修改。</div>
        </el-form-item>

        <el-form-item label="渠道简称">
          <el-input 
            v-model="form.channel_name" 
            placeholder="将根据选择的渠道方自动填充"
            maxlength="200"
            :disabled="true"
          />
          <div class="form-tip">渠道简称将根据选择的渠道方自动填充，不可编辑。</div>
        </el-form-item>

        <el-form-item label="赠送课券数量" prop="ticket_count">
          <el-input-number 
            v-model="form.ticket_count" 
            :min="1" 
            :max="100"
            style="width: 100%;"
          />
          <div class="form-tip">设置赠送的课券数量</div>
        </el-form-item>

        <el-form-item label="每张课券价格（元）" prop="ticket_price">
          <el-input-number 
            v-model="form.ticket_price" 
            :min="0" 
            :max="10000"
            :precision="2"
            style="width: 100%;"
          />
          <div class="form-tip">每张课券的价格（总金额 = 课券数量 × 单价）</div>
        </el-form-item>

        <el-form-item label="有效期（天）" prop="expiry_days">
          <el-input-number 
            v-model="form.expiry_days" 
            :min="1" 
            :max="365"
            style="width: 100%;"
          />
          <div class="form-tip">优惠券有效期天数（默认30天=1个月）</div>
        </el-form-item>

        <el-form-item label="描述">
          <el-input 
            v-model="form.description" 
            type="textarea"
            :rows="3"
            placeholder="请输入方案描述"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="active">激活</el-radio>
            <el-radio value="inactive">未激活</el-radio>
          </el-radio-group>
          <div class="form-tip">只有激活状态的方案才会生效</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Refresh } from '@element-plus/icons-vue';
import api from '../../utils/api';

const schemes = ref([]);
const availableChannels = ref([]); // 可用的渠道方列表
const loading = ref(false);
const showEditDialog = ref(false);
const submitting = ref(false);
const editingScheme = ref(null);
const formRef = ref(null);

const filters = ref({
  status: ''
});

const form = ref({
  channel_code: '',
  channel_name: '',
  ticket_count: 1,
  ticket_price: 500,
  expiry_days: 30,
  description: '',
  status: 'active'
});

const rules = {
  channel_code: [
    { required: true, message: '请选择渠道方', trigger: 'change' }
  ],
  ticket_count: [
    { required: true, message: '请输入课券数量', trigger: 'blur' },
    { type: 'number', min: 1, max: 100, message: '课券数量必须在1-100之间', trigger: 'blur' }
  ],
  ticket_price: [
    { required: true, message: '请输入每张课券价格', trigger: 'blur' },
    { type: 'number', min: 0, max: 10000, message: '单价必须在0-10000元之间', trigger: 'blur' }
  ],
  expiry_days: [
    { required: true, message: '请输入有效期天数', trigger: 'blur' },
    { type: 'number', min: 1, max: 365, message: '有效期必须在1-365天之间', trigger: 'blur' }
  ]
};

const formatAmount = (amount) => {
  return amount ? parseFloat(amount).toFixed(2) : '0.00';
};

// 格式化金额（不带符号，整数时不显示小数）
const formatAmountWithoutSymbol = (amount) => {
  if (!amount) return '0';
  const num = parseFloat(amount);
  if (num % 1 === 0) {
    return num.toString();
  }
  return num.toFixed(2);
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
};

const loadSchemes = async () => {
  loading.value = true;
  try {
    const params = {};
    if (filters.value.status) params.status = filters.value.status;

    const res = await api.get('/admin/channel-promotion-schemes/list', { params });
    if (res.success) {
      schemes.value = res.data || [];
      console.log('[前端] 加载的方案列表数量:', schemes.value.length);
      // 打印第一个方案的详细信息用于调试
      if (schemes.value.length > 0) {
        const firstScheme = schemes.value[0];
        console.log('[前端] 第一个方案的数据:', {
          id: firstScheme.id,
          scheme_code: firstScheme.scheme_code,
          ticket_count: firstScheme.ticket_count,
          ticket_price: firstScheme.ticket_price,
          amount: firstScheme.amount
        });
      }
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载渠道推广方案列表失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载渠道推广方案列表失败';
    ElMessage.error(errorMessage);
    schemes.value = [];
  } finally {
    loading.value = false;
  }
};

const loadAvailableChannels = async () => {
  try {
    const res = await api.get('/admin/channels');
    console.log('渠道方列表API返回:', res);
    if (res && res.success && res.data && Array.isArray(res.data)) {
      // 只显示已有channel_code的渠道方
      availableChannels.value = res.data.filter(c => c && c.channel_code);
      console.log('过滤后的渠道方列表:', availableChannels.value);
      if (availableChannels.value.length === 0) {
        console.warn('没有可用的渠道方（需要有channel_code）');
      }
    } else {
      console.warn('API返回格式不正确:', res);
      availableChannels.value = [];
    }
  } catch (error) {
    console.error('加载渠道方列表失败:', error);
    console.error('错误详情:', error.response?.data || error.message);
    availableChannels.value = [];
  }
};

const onChannelChange = (channelCode) => {
  // 根据选择的渠道编码，自动填充渠道简称（从渠道方的channel_short_name获取）
  const selectedChannel = availableChannels.value.find(c => c.channel_code === channelCode);
  if (selectedChannel) {
    // 使用渠道方的channel_short_name，如果没有则使用channel_name
    form.value.channel_name = selectedChannel.channel_short_name || selectedChannel.channel_name || '';
  }
};

const handleCreateClick = async () => {
  resetForm();
  await loadAvailableChannels();
  // 打开对话框
  showEditDialog.value = true;
};

const editScheme = async (scheme) => {
  editingScheme.value = scheme;
  await loadAvailableChannels();
  form.value = {
    channel_code: scheme.channel_code || '',
    channel_name: scheme.channel_name || '',
    ticket_count: scheme.ticket_count ? parseInt(scheme.ticket_count) : 1,
    ticket_price: scheme.ticket_price ? parseFloat(scheme.ticket_price) : (scheme.amount ? parseFloat(scheme.amount) : 500),
    expiry_days: scheme.expiry_days ? parseInt(scheme.expiry_days) : 30,
    description: scheme.description || '',
    status: scheme.status || 'active'
  };
  showEditDialog.value = true;
};

const resetForm = () => {
  editingScheme.value = null;
  form.value = {
    channel_code: '',
    channel_name: '',
    ticket_count: 1,
    ticket_price: 500,
    expiry_days: 30,
    description: '',
    status: 'active'
  };
  if (formRef.value) {
    formRef.value.resetFields();
  }
};

const submitForm = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
  } catch (error) {
    return;
  }

  submitting.value = true;
  try {
    if (editingScheme.value) {
      // 更新
      // 如果要将状态更新为激活，提示用户该渠道方的其他激活方案将被停用
      if (form.value.status === 'active' && editingScheme.value.status !== 'active') {
        try {
          await ElMessageBox.confirm(
            '激活此方案后，该渠道方的其他激活方案将自动停用（每个渠道方只能有一个激活方案）。是否继续？',
            '确认更新',
            {
              confirmButtonText: '确定',
              cancelButtonText: '取消',
              type: 'warning'
            }
          );
        } catch {
          // 用户取消
          return;
        }
      }
      
      // 确保 ticket_count 和 ticket_price 被正确传递
      const submitData = {
        ...form.value,
        ticket_count: form.value.ticket_count !== undefined && form.value.ticket_count !== null ? form.value.ticket_count : 1,
        ticket_price: form.value.ticket_price !== undefined && form.value.ticket_price !== null ? form.value.ticket_price : 0
      };
      console.log('[前端] 提交更新的数据:', JSON.stringify(submitData, null, 2));
      const response = await api.put(`/admin/channel-promotion-schemes/${editingScheme.value.id}`, submitData);
      if (response.success) {
        const message = form.value.status === 'active' && editingScheme.value.status !== 'active'
          ? '更新成功，该渠道方的其他方案已自动停用'
          : (response.message || '更新成功');
        ElMessage.success(message);
        showEditDialog.value = false;
        loadSchemes();
      } else {
        throw new Error(response.error || '更新失败');
      }
    } else {
      // 创建
      // 如果要创建激活状态的方案，提示用户该渠道方的其他激活方案将被停用
      if (form.value.status === 'active') {
        try {
          await ElMessageBox.confirm(
            '激活此方案后，该渠道方的其他激活方案将自动停用（每个渠道方只能有一个激活方案）。是否继续？',
            '确认创建',
            {
              confirmButtonText: '确定',
              cancelButtonText: '取消',
              type: 'warning'
            }
          );
        } catch {
          // 用户取消
          return;
        }
      }
      
      const response = await api.post('/admin/channel-promotion-schemes/', form.value);
      if (response.success) {
        const message = form.value.status === 'active' 
          ? '创建成功，该渠道方的其他方案已自动停用' 
          : (response.message || '创建成功');
        ElMessage.success(message);
        showEditDialog.value = false;
        loadSchemes();
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

const toggleStatus = async (scheme) => {
  const newStatus = scheme.status === 'active' ? 'inactive' : 'active';
  
  // 如果要激活，提示用户该渠道方的其他激活方案将被停用
  if (newStatus === 'active') {
    try {
      await ElMessageBox.confirm(
        '激活此方案后，该渠道方的其他激活方案将自动停用（每个渠道方只能有一个激活方案）。是否继续？',
        '确认激活',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      );
    } catch {
      // 用户取消
      return;
    }
  }
  
  try {
    const response = await api.put(`/admin/channel-promotion-schemes/${scheme.id}`, {
      status: newStatus
    });

    if (response.success) {
      ElMessage.success(newStatus === 'active' ? '激活成功，该渠道方的其他方案已自动停用' : '停用成功');
      loadSchemes();
    } else {
      throw new Error(response.error || '更新失败');
    }
  } catch (error) {
    console.error('更新状态失败:', error);
    const errorMessage = error.response?.data?.error || error.message || '更新失败';
    ElMessage.error(errorMessage);
    loadSchemes();
  }
};

const deleteScheme = async (scheme) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除渠道推广方案"${scheme.channel_name}"吗？删除后无法恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await api.delete(`/admin/channel-promotion-schemes/${scheme.id}`);
    if (response.success) {
      ElMessage.success('删除成功');
      loadSchemes();
    } else {
      throw new Error(response.error || '删除失败');
    }
  } catch (error) {
    if (error === 'cancel') {
      return;
    }
    console.error('删除失败:', error);
    const errorMessage = error.response?.data?.error || error.message || '删除失败';
    ElMessage.error(errorMessage);
  }
};


onMounted(() => {
  loadSchemes();
  loadAvailableChannels();
});
</script>

<script>
export default {
  name: 'ChannelPromotionSchemes'
};
</script>

<style scoped>
.channel-promotion-schemes {
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

.amount {
  color: #f56c6c;
  font-weight: bold;
  font-size: 14px;
}

.expiry {
  color: #909399;
  font-size: 12px;
  margin-top: 5px;
}

.filter-bar {
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
}
</style>

