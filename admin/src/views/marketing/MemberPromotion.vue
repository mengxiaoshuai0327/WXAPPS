<template>
  <div class="member-promotion">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>会员邀请方案管理</span>
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
            <p><strong>会员邀请方案说明：</strong></p>
            <p>会员邀请方案用于配置会员邀请好友注册和购买时的优惠券奖励规则。</p>
            <p>邀请人奖励包括：被邀请人注册时给邀请人的奖励（默认100元）、被邀请人购买时给邀请人的奖励（默认500元）。</p>
            <p>被邀请人奖励：注册时获得优惠券（默认500元）。</p>
          </div>
        </template>
      </el-alert>

      <div v-if="scheme" class="scheme-content">
        <!-- 方案信息展示 -->
        <el-descriptions :column="2" border>
          <el-descriptions-item label="方案类型" :span="2">
            <el-tag type="primary">会员邀请</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="方案名称" :span="2">
            {{ scheme.name }}
          </el-descriptions-item>
          
          <!-- 邀请人奖励区域 -->
          <el-descriptions-item label="邀请人奖励区域" :span="2">
            <el-divider style="margin: 10px 0;">
              <el-tag type="warning" size="small">奖励邀请人</el-tag>
            </el-divider>
          </el-descriptions-item>
          <el-descriptions-item label="注册奖励（给邀请人）">
            <span class="amount">¥{{ formatAmount(scheme.member_inviter_register_amount) }}</span>
            <span class="reward-note">（被邀请人注册时给邀请人）</span>
          </el-descriptions-item>
          <el-descriptions-item label="购买奖励（给邀请人）">
            <span class="amount">¥{{ formatAmount(scheme.member_inviter_purchase_amount) }}</span>
            <span class="reward-note">（被邀请人购买时给邀请人）</span>
          </el-descriptions-item>
          <el-descriptions-item label="邀请人优惠券有效期" :span="2">
            {{ scheme.inviter_expiry_days }}天
          </el-descriptions-item>
          
          <!-- 被邀请人奖励区域 -->
          <el-descriptions-item label="被邀请人奖励区域" :span="2">
            <el-divider style="margin: 10px 0;">
              <el-tag type="success" size="small">奖励被邀请人</el-tag>
            </el-divider>
          </el-descriptions-item>
          <el-descriptions-item label="注册奖励（给被邀请人）" :span="2">
            <span class="amount">¥{{ formatAmount(scheme.member_invitee_amount) }}</span>
            <span class="reward-note">（被邀请人注册时获得）</span>
          </el-descriptions-item>
          <el-descriptions-item label="被邀请人优惠券有效期" :span="2">
            {{ scheme.invitee_expiry_days }}天
          </el-descriptions-item>
          
          <el-descriptions-item label="状态" :span="2">
            <el-tag :type="scheme.status === 'active' ? 'success' : 'info'">
              {{ scheme.status === 'active' ? '已激活' : '未激活' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="方案描述" :span="2">
            {{ scheme.description || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDate(scheme.updated_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(scheme.created_at) }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 操作按钮 -->
        <div class="action-buttons" style="margin-top: 20px;">
          <el-button type="primary" size="large" @click="editScheme">
            <el-icon><Edit /></el-icon>
            编辑配置
          </el-button>
          <el-button 
            :type="scheme.status === 'active' ? 'warning' : 'success'"
            size="large"
            @click="toggleStatus"
          >
            <el-icon><Switch /></el-icon>
            {{ scheme.status === 'active' ? '停用方案' : '激活方案' }}
          </el-button>
        </div>
      </div>

      <el-empty v-else description="未找到会员邀请方案配置" />
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog 
      v-model="showEditDialog" 
      title="编辑会员邀请方案" 
      width="700px"
      @close="resetForm"
    >
      <el-form :model="form" label-width="200px" :rules="rules" ref="formRef" v-if="scheme">
        <el-form-item label="方案名称" prop="name">
          <el-input 
            v-model="form.name" 
            placeholder="请输入方案名称"
            maxlength="200"
          />
        </el-form-item>

        <el-form-item label="方案描述">
          <el-input 
            v-model="form.description" 
            type="textarea"
            :rows="3"
            placeholder="请输入方案描述"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-divider>邀请人奖励配置</el-divider>
        <el-form-item label="注册奖励金额（元）" prop="member_inviter_register_amount">
          <el-input-number 
            v-model="form.member_inviter_register_amount" 
            :min="0" 
            :max="10000"
            :precision="2"
            style="width: 100%;"
          />
          <div class="form-tip">被邀请人注册时，给邀请人发放的优惠券金额</div>
        </el-form-item>
        <el-form-item label="购买奖励金额（元）" prop="member_inviter_purchase_amount">
          <el-input-number 
            v-model="form.member_inviter_purchase_amount" 
            :min="0" 
            :max="10000"
            :precision="2"
            style="width: 100%;"
          />
          <div class="form-tip">被邀请人购买时，给邀请人发放的优惠券金额</div>
        </el-form-item>
        <el-form-item label="邀请人优惠券有效期（天）" prop="inviter_expiry_days">
          <el-input-number 
            v-model="form.inviter_expiry_days" 
            :min="1" 
            :max="365"
            style="width: 100%;"
          />
          <div class="form-tip">邀请人获得的优惠券有效期天数（默认3个月=90天）</div>
        </el-form-item>

        <el-divider>被邀请人奖励配置</el-divider>
        <el-form-item label="注册奖励金额（元）" prop="member_invitee_amount">
          <el-input-number 
            v-model="form.member_invitee_amount" 
            :min="0" 
            :max="10000"
            :precision="2"
            style="width: 100%;"
          />
          <div class="form-tip">被邀请人注册时获得的优惠券金额</div>
        </el-form-item>
        <el-form-item label="被邀请人优惠券有效期（天）" prop="invitee_expiry_days">
          <el-input-number 
            v-model="form.invitee_expiry_days" 
            :min="1" 
            :max="365"
            style="width: 100%;"
          />
          <div class="form-tip">被邀请人获得的优惠券有效期天数（默认1个月=30天）</div>
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
import { ElMessage } from 'element-plus';
import { Edit, Switch } from '@element-plus/icons-vue';
import api from '../../utils/api';

const scheme = ref(null);
const loading = ref(false);
const showEditDialog = ref(false);
const submitting = ref(false);
const formRef = ref(null);

const form = ref({
  name: '',
  description: '',
  member_inviter_register_amount: 100,
  member_inviter_purchase_amount: 500,
  member_invitee_amount: 500,
  inviter_expiry_days: 90,
  invitee_expiry_days: 30,
  status: 'active'
});

const rules = {
  name: [
    { required: true, message: '请输入方案名称', trigger: 'blur' }
  ]
};

const formatAmount = (amount) => {
  return amount ? parseFloat(amount).toFixed(2) : '0.00';
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
};

const loadScheme = async () => {
  loading.value = true;
  try {
    const res = await api.get('/admin/coupon-schemes/list');
    if (res.success && res.data) {
      const memberScheme = res.data.find(s => s.scheme_type === 'member_invite');
      if (memberScheme) {
        scheme.value = memberScheme;
      } else {
        ElMessage.warning('未找到会员邀请方案配置');
      }
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载会员邀请方案失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载失败';
    ElMessage.error(errorMessage);
  } finally {
    loading.value = false;
  }
};

const editScheme = () => {
  if (!scheme.value) return;
  
  form.value = {
    name: scheme.value.name || '',
    description: scheme.value.description || '',
    member_inviter_register_amount: scheme.value.member_inviter_register_amount ? parseFloat(scheme.value.member_inviter_register_amount) : 100,
    member_inviter_purchase_amount: scheme.value.member_inviter_purchase_amount ? parseFloat(scheme.value.member_inviter_purchase_amount) : 500,
    member_invitee_amount: scheme.value.member_invitee_amount ? parseFloat(scheme.value.member_invitee_amount) : 500,
    inviter_expiry_days: scheme.value.inviter_expiry_days ? parseInt(scheme.value.inviter_expiry_days) : 90,
    invitee_expiry_days: scheme.value.invitee_expiry_days ? parseInt(scheme.value.invitee_expiry_days) : 30,
    status: scheme.value.status || 'active'
  };
  showEditDialog.value = true;
};

const resetForm = () => {
  if (scheme.value) {
    form.value = {
      name: scheme.value.name || '',
      description: scheme.value.description || '',
      member_inviter_register_amount: scheme.value.member_inviter_register_amount ? parseFloat(scheme.value.member_inviter_register_amount) : 100,
      member_inviter_purchase_amount: scheme.value.member_inviter_purchase_amount ? parseFloat(scheme.value.member_inviter_purchase_amount) : 500,
      member_invitee_amount: scheme.value.member_invitee_amount ? parseFloat(scheme.value.member_invitee_amount) : 500,
      inviter_expiry_days: scheme.value.inviter_expiry_days ? parseInt(scheme.value.inviter_expiry_days) : 90,
      invitee_expiry_days: scheme.value.invitee_expiry_days ? parseInt(scheme.value.invitee_expiry_days) : 30,
      status: scheme.value.status || 'active'
    };
  }
  if (formRef.value) {
    formRef.value.resetFields();
  }
};

const submitForm = async () => {
  if (!formRef.value || !scheme.value) return;
  
  try {
    await formRef.value.validate();
  } catch (error) {
    return;
  }

  submitting.value = true;
  try {
    const response = await api.put(`/admin/coupon-schemes/${scheme.value.id}`, form.value);
    if (response.success) {
      ElMessage.success(response.message || '更新成功');
      showEditDialog.value = false;
      loadScheme();
    } else {
      throw new Error(response.error || '更新失败');
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

const toggleStatus = async () => {
  if (!scheme.value) return;
  
  const newStatus = scheme.value.status === 'active' ? 'inactive' : 'active';
  try {
    const response = await api.put(`/admin/coupon-schemes/${scheme.value.id}`, {
      status: newStatus
    });

    if (response.success) {
      ElMessage.success('状态更新成功');
      loadScheme();
    } else {
      throw new Error(response.error || '更新失败');
    }
  } catch (error) {
    console.error('更新状态失败:', error);
    const errorMessage = error.response?.data?.error || error.message || '更新失败';
    ElMessage.error(errorMessage);
  }
};

onMounted(() => {
  loadScheme();
});
</script>

<style scoped>
.member-promotion {
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

.scheme-content {
  margin-top: 20px;
}

.amount {
  color: #f56c6c;
  font-weight: bold;
  font-size: 18px;
}

.reward-note {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
  font-weight: normal;
}

.action-buttons {
  text-align: center;
}

.action-buttons .el-button {
  margin: 0 10px;
}
</style>

