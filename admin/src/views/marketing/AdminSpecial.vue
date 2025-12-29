<template>
  <div class="admin-special">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>特殊推广方案管理（管理员手工发放）</span>
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
            <p><strong>特殊推广方案说明：</strong></p>
            <p>管理员可以手工发放优惠券给固定会员或教练。优惠券金额可以在100-1000元之间选择（必须是整百数，如100、200、300...1000）。</p>
            <p>在此页面可以配置特殊推广的默认金额和有效期。</p>
          </div>
        </template>
      </el-alert>

      <div v-if="scheme" class="scheme-content">
        <!-- 方案信息展示 -->
        <el-descriptions :column="2" border>
          <el-descriptions-item label="方案类型">
            <el-tag type="danger">特殊推广（管理员手工发放）</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="方案名称">
            {{ scheme.name }}
          </el-descriptions-item>
          <el-descriptions-item label="默认金额（发放给固定会员）" :span="2">
            <span class="amount">¥{{ formatAmount(scheme.admin_special_amount) }}</span>
            <span class="reward-note">（管理员手工发放给指定的会员或教练）</span>
          </el-descriptions-item>
          <el-descriptions-item label="优惠券有效期" :span="2">
            {{ scheme.admin_special_expiry_days }}天
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

      <el-empty v-else description="未找到特殊推广方案配置" />
    </el-card>

    <!-- 特殊推广方案赠予优惠券列表 -->
    <el-card style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>特殊推广方案赠予优惠券列表</span>
          <div>
            <el-button type="success" @click="showGrantDialog" style="margin-right: 10px;">
              <el-icon><Plus /></el-icon>
              授予优惠券
            </el-button>
            <el-button type="primary" @click="loadCouponList">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- 筛选条件 -->
      <el-form :inline="true" class="filter-form" style="margin-bottom: 20px;">
        <el-form-item label="用户">
          <el-input 
            v-model="couponFilters.keyword" 
            placeholder="会员ID/昵称/手机号" 
            clearable
            style="width: 200px"
            @keyup.enter="loadCouponList"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="couponFilters.status" placeholder="全部状态" clearable style="width: 150px">
            <el-option label="全部" value="all" />
            <el-option label="未使用" value="unused" />
            <el-option label="已使用" value="used" />
            <el-option label="已过期" value="expired" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadCouponList">查询</el-button>
          <el-button @click="resetCouponFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="couponList" style="width: 100%" v-loading="couponListLoading" border>
        <el-table-column prop="discount_code" label="优惠券编号" width="150" />
        <el-table-column label="用户信息" width="200">
          <template #default="scope">
            <div>
              <div>{{ scope.row.user_name }}</div>
              <div style="font-size: 12px; color: #999;" v-if="scope.row.user_member_id">
                会员编号: {{ scope.row.user_member_id }}
              </div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.user_phone }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="amount_formatted" label="面值" width="120">
          <template #default="scope">
            <span style="color: #f56c6c; font-weight: bold;">¥ {{ scope.row.amount_formatted }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="period_text" label="使用期限" width="200" />
        <el-table-column prop="created_at_formatted" label="赠予时间" width="180" />
        <el-table-column prop="used_at_formatted" label="使用时间" width="180">
          <template #default="scope">
            <span v-if="scope.row.used_at_formatted">{{ scope.row.used_at_formatted }}</span>
            <span v-else style="color: #999;">未使用</span>
          </template>
        </el-table-column>
        <el-table-column prop="status_text" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getCouponStatusType(scope.row.actual_status)">
              {{ scope.row.status_text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="viewCouponDetail(scope.row)">
              详情
            </el-button>
            <el-button link type="danger" size="small" @click="deleteCoupon(scope.row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="couponPagination.page"
        v-model:page-size="couponPagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="couponPagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadCouponList"
        @current-change="loadCouponList"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <!-- 优惠券详情对话框 -->
    <el-dialog 
      v-model="couponDetailVisible" 
      title="优惠券详情" 
      width="600px"
      @close="currentCoupon = null"
    >
      <div v-if="currentCoupon">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="优惠券编号">{{ currentCoupon.discount_code }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getCouponStatusType(currentCoupon.actual_status)">
              {{ currentCoupon.status_text }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="面值">
            <span style="color: #f56c6c; font-weight: bold;">¥ {{ currentCoupon.amount_formatted }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="来源">
            {{ currentCoupon.source_text }}
          </el-descriptions-item>
          <el-descriptions-item label="用户信息" :span="2">
            {{ currentCoupon.user_info_text }}
          </el-descriptions-item>
          <el-descriptions-item label="使用期限" :span="2">
            {{ currentCoupon.period_text || '永久有效' }}
          </el-descriptions-item>
          <el-descriptions-item label="赠予时间">
            {{ currentCoupon.created_at_formatted }}
          </el-descriptions-item>
          <el-descriptions-item label="使用时间">
            {{ currentCoupon.used_at_formatted || '未使用' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>

    <!-- 授予优惠券对话框 -->
    <el-dialog 
      v-model="grantDialogVisible" 
      title="授予优惠券（特殊推广）" 
      width="600px"
      @close="resetGrantForm"
    >
      <el-form :model="grantForm" label-width="140px" :rules="grantRules" ref="grantFormRef">
        <el-form-item label="选择用户" prop="user_id" required>
          <el-select
            v-model="grantForm.user_id"
            filterable
            remote
            :remote-method="searchUsers"
            placeholder="请输入姓名/手机号/会员编号/教练编号搜索"
            style="width: 100%"
            :loading="userSearchLoading"
            clearable
            @focus="handleUserSelectFocus"
          >
            <el-option
              v-for="user in userOptions"
              :key="user.id"
              :label="getUserDisplayLabel(user)"
              :value="user.id"
            >
              <span>{{ user.real_name || user.nickname }}</span>
              <span style="color: #8492a6; font-size: 13px; margin-left: 8px;">
                <span v-if="user.role === 'member'">{{ user.member_id }}</span>
                <span v-else-if="user.role === 'instructor'">教练编号: {{ user.instructor_id }}</span>
                <span v-if="user.phone"> - {{ user.phone }}</span>
              </span>
            </el-option>
          </el-select>
          <div class="form-tip">可以选择会员或教练</div>
        </el-form-item>
        <el-form-item label="优惠券金额" prop="amount" required>
          <el-select
            v-model="grantForm.amount"
            placeholder="请选择优惠券面值（100-1000元整百）"
            style="width: 100%"
          >
            <el-option label="100元" :value="100" />
            <el-option label="200元" :value="200" />
            <el-option label="300元" :value="300" />
            <el-option label="400元" :value="400" />
            <el-option label="500元" :value="500" />
            <el-option label="600元" :value="600" />
            <el-option label="700元" :value="700" />
            <el-option label="800元" :value="800" />
            <el-option label="900元" :value="900" />
            <el-option label="1000元" :value="1000" />
          </el-select>
          <div class="form-tip">优惠券金额必须在100-1000元之间，且必须是整百数</div>
        </el-form-item>
        <el-form-item label="有效期">
          <el-date-picker
            v-model="grantDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="handleGrantDateRangeChange"
          />
          <div class="form-tip">如不指定，将使用特殊推广方案的默认有效期（{{ scheme?.admin_special_expiry_days || 7 }}天）</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="grantDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="grantCoupon" :loading="grantLoading">确定授予</el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog 
      v-model="showEditDialog" 
      title="编辑特殊推广方案" 
      width="600px"
      @close="resetForm"
    >
      <el-form :model="form" label-width="180px" :rules="rules" ref="formRef" v-if="scheme">
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

        <el-form-item label="默认金额（元）" prop="admin_special_amount">
          <el-input-number 
            v-model="form.admin_special_amount" 
            :min="100" 
            :max="1000"
            :step="100"
            :precision="0"
            style="width: 100%;"
          />
          <div class="form-tip">特殊推广的默认优惠券金额（100-1000元，必须是整百数）。管理员发放时可以手动选择其他整百金额。</div>
        </el-form-item>

        <el-form-item label="优惠券有效期（天）" prop="admin_special_expiry_days">
          <el-input-number 
            v-model="form.admin_special_expiry_days" 
            :min="1" 
            :max="365"
            style="width: 100%;"
          />
          <div class="form-tip">管理员手工发放的优惠券有效期天数（默认7天）。</div>
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
import { Edit, Switch, Refresh, Plus } from '@element-plus/icons-vue';
import api from '../../utils/api';

const scheme = ref(null);
const loading = ref(false);
const showEditDialog = ref(false);
const submitting = ref(false);
const formRef = ref(null);

// 优惠券列表相关（仅显示特殊推广方案发放的优惠券）
const couponList = ref([]);
const couponListLoading = ref(false);
const couponFilters = ref({
  keyword: '',
  status: 'all'
});
const couponPagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});
const couponDetailVisible = ref(false);
const currentCoupon = ref(null);

// 授予优惠券相关
const grantDialogVisible = ref(false);
const grantFormRef = ref(null);
const grantLoading = ref(false);
const grantForm = ref({
  user_id: null,
  amount: 500,
  start_date: null,
  expiry_date: null
});
const grantDateRange = ref(null);
const userOptions = ref([]);
const userSearchLoading = ref(false);

const grantRules = {
  user_id: [
    { required: true, message: '请选择会员', trigger: 'change' }
  ],
  amount: [
    { required: true, message: '请选择优惠券金额', trigger: 'change' },
    { type: 'number', min: 100, max: 1000, message: '金额必须在100-1000元之间', trigger: 'blur' },
    { validator: (rule, value, callback) => {
        if (value && value % 100 !== 0) {
          callback(new Error('金额必须是整百数（100、200、300...1000）'));
        } else {
          callback();
        }
      }, trigger: 'blur' }
  ]
};

const form = ref({
  name: '',
  description: '',
  admin_special_amount: 500,
  admin_special_expiry_days: 7,
  status: 'active'
});

const rules = {
  name: [
    { required: true, message: '请输入方案名称', trigger: 'blur' }
  ],
  admin_special_amount: [
    { required: true, message: '请输入默认金额', trigger: 'blur' },
    { type: 'number', min: 100, max: 1000, message: '金额必须在100-1000元之间', trigger: 'blur' }
  ],
  admin_special_expiry_days: [
    { required: true, message: '请输入有效期天数', trigger: 'blur' },
    { type: 'number', min: 1, max: 365, message: '有效期必须在1-365天之间', trigger: 'blur' }
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
    // 获取所有方案，筛选出特殊推广方案
    const res = await api.get('/admin/coupon-schemes/list');
    if (res.success && res.data) {
      const specialScheme = res.data.find(s => s.scheme_type === 'admin_special');
      if (specialScheme) {
        scheme.value = specialScheme;
      } else {
        ElMessage.warning('未找到特殊推广方案配置');
      }
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载特殊推广方案失败:', error);
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
    admin_special_amount: scheme.value.admin_special_amount ? parseFloat(scheme.value.admin_special_amount) : 500,
    admin_special_expiry_days: scheme.value.admin_special_expiry_days ? parseInt(scheme.value.admin_special_expiry_days) : 7,
    status: scheme.value.status || 'active'
  };
  showEditDialog.value = true;
};

const resetForm = () => {
  if (scheme.value) {
    form.value = {
      name: scheme.value.name || '',
      description: scheme.value.description || '',
      admin_special_amount: scheme.value.admin_special_amount ? parseFloat(scheme.value.admin_special_amount) : 500,
      admin_special_expiry_days: scheme.value.admin_special_expiry_days ? parseInt(scheme.value.admin_special_expiry_days) : 7,
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

  // 验证金额是否为整百
  if (form.value.admin_special_amount % 100 !== 0) {
    ElMessage.error('金额必须是整百数（100、200、300...1000）');
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

const getCouponStatusType = (status) => {
  switch (status) {
    case 'used':
      return 'success';
    case 'expired':
      return 'info';
    case 'unused':
      return '';
    default:
      return '';
  }
};

const loadCouponList = async () => {
  couponListLoading.value = true;
  try {
    const params = {
      source: 'admin_special',
      page: couponPagination.value.page,
      pageSize: couponPagination.value.pageSize
    };
    
    if (couponFilters.value.keyword) {
      params.keyword = couponFilters.value.keyword;
    }
    
    if (couponFilters.value.status && couponFilters.value.status !== 'all') {
      params.status = couponFilters.value.status;
    }

    const res = await api.get('/admin/discounts', { params });
    if (res.success && res.data) {
      couponList.value = res.data;
      if (res.pagination) {
        couponPagination.value.total = res.pagination.total || 0;
      }
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载优惠券列表失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载失败';
    ElMessage.error(errorMessage);
  } finally {
    couponListLoading.value = false;
  }
};

const resetCouponFilters = () => {
  couponFilters.value = {
    keyword: '',
    status: 'all'
  };
  couponPagination.value.page = 1;
  loadCouponList();
};

const viewCouponDetail = async (row) => {
  try {
    const res = await api.get(`/admin/discounts/${row.id}`);
    if (res.success && res.data) {
      currentCoupon.value = res.data;
      couponDetailVisible.value = true;
    } else {
      throw new Error(res.error || '获取详情失败');
    }
  } catch (error) {
    console.error('获取优惠券详情失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '获取详情失败';
    ElMessage.error(errorMessage);
  }
};

const deleteCoupon = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除优惠券编号为 ${row.discount_code || row.id} 的优惠券吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const res = await api.delete(`/admin/discounts/${row.id}`);
    if (res.success) {
      ElMessage.success('删除成功');
      loadCouponList();
    } else {
      throw new Error(res.error || '删除失败');
    }
  } catch (error) {
    if (error === 'cancel') {
      return;
    }
    console.error('删除优惠券失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '删除失败';
    ElMessage.error(errorMessage);
  }
};

const showGrantDialog = () => {
  if (!scheme.value || scheme.value.status !== 'active') {
    ElMessage.warning('请先激活特殊推广方案');
    return;
  }
  // 设置默认金额为方案的默认金额
  if (scheme.value.admin_special_amount) {
    grantForm.value.amount = parseInt(scheme.value.admin_special_amount);
  }
  grantDialogVisible.value = true;
};

const resetGrantForm = () => {
  grantForm.value = {
    user_id: null,
    amount: scheme.value?.admin_special_amount ? parseInt(scheme.value.admin_special_amount) : 500,
    start_date: null,
    expiry_date: null
  };
  grantDateRange.value = null;
  userOptions.value = [];
  if (grantFormRef.value) {
    grantFormRef.value.resetFields();
  }
};

const handleGrantDateRangeChange = (dates) => {
  if (dates && dates.length === 2) {
    grantForm.value.start_date = dates[0];
    grantForm.value.expiry_date = dates[1];
  } else {
    grantForm.value.start_date = null;
    grantForm.value.expiry_date = null;
  }
};

const getUserDisplayLabel = (user) => {
  if (user.role === 'member') {
    return `${user.real_name || user.nickname} (会员: ${user.member_id})${user.phone ? ` - ${user.phone}` : ''}`;
  } else if (user.role === 'instructor') {
    return `${user.real_name || user.nickname} (教练: ${user.instructor_id})${user.phone ? ` - ${user.phone}` : ''}`;
  } else {
    return `${user.real_name || user.nickname}${user.phone ? ` - ${user.phone}` : ''}`;
  }
};

const handleUserSelectFocus = () => {
  // 当输入框获得焦点时，如果已有搜索关键词，重新搜索
  if (userOptions.value.length === 0) {
    // 可以预加载一些数据，或者保持为空，等待用户输入
  }
};

const searchUsers = async (query) => {
  // 允许空查询，显示最近的一些用户（会员和教练）
  userSearchLoading.value = true;
  try {
    const params = {
      page: 1,
      pageSize: 20
    };
    
    // 如果有查询关键词，添加搜索条件
    if (query && query.trim()) {
      params.keyword = query.trim();
    }
    
    // 不限制角色，允许搜索会员和教练
    // 但如果有keyword，后端会搜索所有相关字段（member_id, instructor_id等）
    
    const res = await api.get('/admin/users', { params });
    if (res.success && res.data) {
      // 只显示会员和教练，过滤掉其他角色
      userOptions.value = res.data.filter(user => user.role === 'member' || user.role === 'instructor');
    } else {
      userOptions.value = [];
    }
  } catch (error) {
    console.error('搜索用户失败:', error);
    userOptions.value = [];
    ElMessage.error('搜索用户失败，请重试');
  } finally {
    userSearchLoading.value = false;
  }
};

const grantCoupon = async () => {
  if (!grantFormRef.value) return;
  
  try {
    await grantFormRef.value.validate();
  } catch (error) {
    return;
  }

  // 验证金额是否为整百
  if (grantForm.value.amount % 100 !== 0) {
    ElMessage.error('金额必须是整百数（100、200、300...1000）');
    return;
  }

  grantLoading.value = true;
  try {
    const requestData = {
      user_id: grantForm.value.user_id,
      amount: grantForm.value.amount
    };
    
    // 如果有指定日期，添加日期参数
    if (grantForm.value.start_date) {
      requestData.start_date = grantForm.value.start_date;
    }
    if (grantForm.value.expiry_date) {
      requestData.expiry_date = grantForm.value.expiry_date;
    }

    const res = await api.post('/admin/discounts', requestData);
    // API拦截器已经处理了响应，成功时返回response.data，失败时抛出错误
    // 所以这里直接检查res.success即可
    if (res && res.success !== false) {
      ElMessage.success(res.message || '优惠券授予成功');
      grantDialogVisible.value = false;
      resetGrantForm();
      loadCouponList();
    } else {
      // 如果返回了响应但success为false
      const errorMsg = res?.error || res?.message || '授予失败';
      ElMessage.error(errorMsg);
    }
  } catch (error) {
    console.error('授予优惠券失败:', error);
    // 由于axios拦截器会在错误时将error.response.data附加到error对象上
    // 这里需要检查多个可能的错误信息位置
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.error ||
                        error.message || 
                        '授予失败，请检查网络连接或联系管理员';
    ElMessage.error(errorMessage);
  } finally {
    grantLoading.value = false;
  }
};

onMounted(() => {
  loadScheme();
  loadCouponList();
});
</script>

<style scoped>
.admin-special {
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

.filter-form {
  margin-bottom: 20px;
}
</style>

