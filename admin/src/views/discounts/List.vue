<template>
  <div class="discount-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>优惠券使用列表</span>
          <el-button type="primary" @click="showCreateDialog">发放优惠券</el-button>
        </div>
      </template>

      <!-- 筛选条件 -->
      <el-form :inline="true" class="filter-form">
        <el-form-item label="用户">
          <el-input 
            v-model="filters.keyword" 
            placeholder="会员ID/昵称/手机号" 
            clearable
            style="width: 200px"
            @keyup.enter="loadDiscounts"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 150px">
            <el-option label="全部" value="all" />
            <el-option label="未使用" value="unused" />
            <el-option label="已使用" value="used" />
            <el-option label="已过期" value="expired" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源">
          <el-select v-model="filters.source" placeholder="全部来源" clearable style="width: 150px">
            <el-option label="全部" value="all" />
            <el-option label="会员推广-邀请注册奖励（给邀请人）" value="invite_register" />
            <el-option label="会员推广-邀请购券奖励（给邀请人）" value="invite_purchase" />
            <el-option label="教练推广奖励（给被邀请人）" value="instructor_invite" />
            <el-option label="渠道推广奖励（给被邀请人）" value="channel_invite" />
            <el-option label="授课奖励" value="instructor_reward" />
            <el-option label="特殊推广（管理员发放）" value="admin_special" />
            <el-option label="管理员发放" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadDiscounts">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="discounts" style="width: 100%" v-loading="loading">
        <el-table-column prop="discount_code" label="优惠券编号" width="150" />
        <el-table-column label="用户信息" width="200">
          <template #default="scope">
            <div>
              <div>{{ scope.row.user_name }}</div>
              <div style="font-size: 12px; color: #999;" v-if="scope.row.user_role === 'instructor' && scope.row.user_instructor_id">
                教练编号: {{ scope.row.user_instructor_id }}
              </div>
              <div style="font-size: 12px; color: #999;" v-else-if="scope.row.user_member_id">
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
        <el-table-column prop="source_text" label="来源" width="150" />
        <el-table-column label="邀请人信息" width="200">
          <template #default="scope">
            <div v-if="scope.row.source === 'invite_register' || scope.row.source === 'invite_purchase' || scope.row.source === 'instructor_invite' || scope.row.source === 'channel_invite'">
              <div>{{ scope.row.source_user_name || '-' }}</div>
              <div style="font-size: 12px; color: #999;" v-if="scope.row.source_user_role === 'instructor' && scope.row.source_user_instructor_id">
                教练编号: {{ scope.row.source_user_instructor_id }}
              </div>
              <div style="font-size: 12px; color: #999;" v-else-if="scope.row.source_user_member_id">
                会员编号: {{ scope.row.source_user_member_id }}
              </div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at_formatted" label="赠予时间" width="180" />
        <el-table-column prop="period_text" label="使用期限" width="200">
          <template #default="scope">
            <span>{{ scope.row.period_text || '永久有效' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="used_at_formatted" label="使用时间" width="180">
          <template #default="scope">
            <span v-if="scope.row.used_at_formatted">{{ scope.row.used_at_formatted }}</span>
            <span v-else style="color: #999;">未使用</span>
          </template>
        </el-table-column>
        <el-table-column prop="status_text" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.actual_status)">
              {{ scope.row.status_text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button 
              size="small" 
              @click="viewDetail(scope.row)"
            >
              详情
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteDiscount(scope.row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadDiscounts"
          @current-change="loadDiscounts"
        />
      </div>
    </el-card>

    <!-- 发放优惠券对话框 -->
    <el-dialog v-model="createDialogVisible" title="发放优惠券（特殊推广）" width="500px">
      <el-form :model="createForm" label-width="100px">
        <el-form-item label="用户" required>
          <el-select
            v-model="createForm.user_id"
            filterable
            remote
            :remote-method="searchUsers"
            placeholder="请输入会员ID/昵称/手机号搜索"
            style="width: 100%"
            :loading="userSearchLoading"
          >
            <el-option
              v-for="user in userOptions"
              :key="user.id"
              :label="`${user.nickname} (${user.member_id})`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="面值" required>
          <el-select
            v-model="createForm.amount"
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
        </el-form-item>
        <el-form-item label="使用期限">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            @change="handleDateRangeChange"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="createDiscount" :loading="createLoading">确定</el-button>
      </template>
    </el-dialog>

    <!-- 详情对话框 -->
    <el-dialog 
      v-model="detailDialogVisible" 
      title="优惠券详情" 
      width="600px"
      @close="currentDiscount = null"
    >
      <div v-if="currentDiscount">
        <el-descriptions :column="2" border>
        <el-descriptions-item label="优惠券编号">{{ currentDiscount.discount_code }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(currentDiscount.actual_status)">
            {{ currentDiscount.status_text }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="面值">
          <span style="color: #f56c6c; font-weight: bold;">¥ {{ currentDiscount.amount_formatted }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="来源">{{ currentDiscount.source_text }}</el-descriptions-item>
        <el-descriptions-item label="用户昵称">{{ currentDiscount.user_name }}</el-descriptions-item>
        <el-descriptions-item label="用户类型">
          <span v-if="currentDiscount.user_role === 'instructor'">教练</span>
          <span v-else-if="currentDiscount.user_role === 'member'">会员</span>
          <span v-else>未知</span>
        </el-descriptions-item>
        <el-descriptions-item label="会员编号" v-if="currentDiscount.user_role === 'member'">
          {{ currentDiscount.user_member_id || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="教练编号" v-if="currentDiscount.user_role === 'instructor'">
          {{ currentDiscount.user_instructor_id || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="手机号">{{ currentDiscount.user_phone }}</el-descriptions-item>
        <el-descriptions-item label="邀请人姓名" v-if="currentDiscount.source === 'invite_register' || currentDiscount.source === 'invite_purchase'">
          {{ currentDiscount.source_user_name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="邀请人类型" v-if="currentDiscount.source === 'invite_register' || currentDiscount.source === 'invite_purchase'">
          <span v-if="currentDiscount.source_user_role === 'instructor'">教练</span>
          <span v-else-if="currentDiscount.source_user_role === 'member'">会员</span>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="邀请人编号" v-if="currentDiscount.source === 'invite_register' || currentDiscount.source === 'invite_purchase'">
          <span v-if="currentDiscount.source_user_role === 'instructor'">{{ currentDiscount.source_user_instructor_id || '-' }}</span>
          <span v-else>{{ currentDiscount.source_user_member_id || '-' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="赠予时间">{{ currentDiscount.created_at_formatted }}</el-descriptions-item>
        <el-descriptions-item label="使用期限">
          <span>{{ currentDiscount.period_text || '永久有效' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="开始日期" v-if="currentDiscount.start_date_formatted">
          {{ currentDiscount.start_date_formatted }}
        </el-descriptions-item>
        <el-descriptions-item label="结束日期" v-if="currentDiscount.expiry_date_formatted">
          {{ currentDiscount.expiry_date_formatted }}
        </el-descriptions-item>
        <el-descriptions-item label="使用时间" :span="2">
          <span v-if="currentDiscount.used_at_formatted">{{ currentDiscount.used_at_formatted }}</span>
          <span v-else style="color: #999;">未使用</span>
        </el-descriptions-item>
        <el-descriptions-item label="被邀请人姓名" v-if="currentDiscount.source === 'invite_register' || currentDiscount.source === 'invite_purchase'">
          {{ currentDiscount.source_user_name || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="被邀请人编号" v-if="currentDiscount.source === 'invite_register' || currentDiscount.source === 'invite_purchase'">
          {{ currentDiscount.source_user_member_id || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="推广类型" v-if="currentDiscount.promotion_type">
          <span v-if="currentDiscount.promotion_type === 'instructor'">教练推广</span>
          <span v-else-if="currentDiscount.promotion_type === 'channel'">渠道推广</span>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="推广教练编号" v-if="currentDiscount.promotion_type === 'instructor' && currentDiscount.instructor_id_for_promotion">
          {{ currentDiscount.instructor_id_for_promotion }}
        </el-descriptions-item>
        <el-descriptions-item label="推广教练姓名" v-if="currentDiscount.promotion_type === 'instructor' && currentDiscount.instructor_name_for_promotion">
          {{ currentDiscount.instructor_name_for_promotion }}
        </el-descriptions-item>
        <el-descriptions-item label="推广渠道名称" v-if="currentDiscount.promotion_type === 'channel' && currentDiscount.channel_name_for_promotion">
          {{ currentDiscount.channel_name_for_promotion }}
        </el-descriptions-item>
        <el-descriptions-item label="推广渠道销售编号" v-if="currentDiscount.promotion_type === 'channel' && currentDiscount.channel_sales_id_for_promotion">
          {{ currentDiscount.channel_sales_id_for_promotion }}
        </el-descriptions-item>
        <el-descriptions-item label="推广渠道销售姓名" v-if="currentDiscount.promotion_type === 'channel' && currentDiscount.channel_sales_name_for_promotion">
          {{ currentDiscount.channel_sales_name_for_promotion }}
        </el-descriptions-item>
      </el-descriptions>
      </div>
      <div v-else style="text-align: center; padding: 40px; color: #999;">
        加载中...
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../utils/api';

const discounts = ref([]);
const loading = ref(false);
const createDialogVisible = ref(false);
const detailDialogVisible = ref(false);
const createLoading = ref(false);
const userSearchLoading = ref(false);
const userOptions = ref([]);
const currentDiscount = ref(null);

const filters = ref({
  keyword: '',
  status: '',
  source: ''
});

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const dateRange = ref(null);
const createForm = ref({
  user_id: null,
  amount: null,
  start_date: null,
  expiry_date: null
});

const loadDiscounts = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    };

    if (filters.value.keyword) {
      params.keyword = filters.value.keyword;
    }
    if (filters.value.status && filters.value.status !== 'all') {
      params.status = filters.value.status;
    }
    if (filters.value.source && filters.value.source !== 'all') {
      params.source = filters.value.source;
    }

    console.log('请求优惠券列表，参数:', params);
    const res = await api.get('/admin/discounts', { params });
    console.log('优惠券列表响应:', res);
    
    if (res && res.success !== false) {
      discounts.value = res.data || [];
      pagination.value.total = res.pagination?.total || 0;
    } else {
      const errorMsg = res?.error || res?.message || '加载优惠券列表失败';
      console.error('API返回错误:', res);
      ElMessage.error(errorMsg);
    }
  } catch (error) {
    console.error('加载优惠券列表错误:', error);
    console.error('错误详情:', {
      message: error.message,
      response: error.response,
      data: error.response?.data
    });
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message || 
                     '加载优惠券列表失败，请检查后端服务是否正常运行';
    ElMessage.error(errorMsg);
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.value = {
    keyword: '',
    status: '',
    source: ''
  };
  pagination.value.page = 1;
  loadDiscounts();
};

const getStatusType = (status) => {
  const types = {
    'unused': 'success',
    'used': 'info',
    'expired': 'danger'
  };
  return types[status] || 'info';
};

const handleDateRangeChange = (dates) => {
  if (dates && dates.length === 2) {
    createForm.value.start_date = dates[0];
    createForm.value.expiry_date = dates[1];
  } else {
    createForm.value.start_date = null;
    createForm.value.expiry_date = null;
  }
};

const showCreateDialog = () => {
  createForm.value = {
    user_id: null,
    amount: null,
    start_date: null,
    expiry_date: null
  };
  dateRange.value = null;
  userOptions.value = [];
  createDialogVisible.value = true;
};

const searchUsers = async (query) => {
  if (!query) {
    userOptions.value = [];
    return;
  }
  userSearchLoading.value = true;
  try {
    const res = await api.get('/admin/users', {
      params: {
        keyword: query,
        page: 1,
        pageSize: 10
      }
    });
    userOptions.value = res.data || [];
  } catch (error) {
    ElMessage.error('搜索用户失败');
  } finally {
    userSearchLoading.value = false;
  }
};

const createDiscount = async () => {
  if (!createForm.value.user_id) {
    ElMessage.warning('请选择用户');
    return;
  }
  if (!createForm.value.amount || (createForm.value.amount !== 100 && createForm.value.amount !== 500)) {
    ElMessage.warning('请选择有效的面值（100元或500元）');
    return;
  }

  createLoading.value = true;
  try {
    console.log('发放优惠券，数据:', createForm.value);
    const res = await api.post('/admin/discounts', createForm.value);
    console.log('发放优惠券响应:', res);
    
    if (res && res.success !== false) {
      ElMessage.success(res.message || '发放成功');
      createDialogVisible.value = false;
      loadDiscounts();
    } else {
      const errorMsg = res?.error || res?.message || '发放失败';
      console.error('API返回错误:', res);
      ElMessage.error(errorMsg);
    }
  } catch (error) {
    console.error('发放优惠券错误:', error);
    console.error('错误详情:', {
      message: error.message,
      response: error.response,
      data: error.response?.data
    });
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message || 
                     '发放失败，请检查后端服务';
    ElMessage.error(errorMsg);
  } finally {
    createLoading.value = false;
  }
};

const viewDetail = async (row) => {
  try {
    currentDiscount.value = null; // 先清空，避免显示旧数据
    detailDialogVisible.value = true;
    const res = await api.get(`/admin/discounts/${row.id}`);
    if (res && res.data) {
    currentDiscount.value = res.data;
    } else {
      ElMessage.error('获取详情失败');
      detailDialogVisible.value = false;
    }
  } catch (error) {
    console.error('获取优惠券详情错误:', error);
    ElMessage.error(error.response?.data?.error || error.message || '获取详情失败');
    detailDialogVisible.value = false;
  }
};

const deleteDiscount = async (row) => {
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
    
    await api.delete(`/admin/discounts/${row.id}`);
    ElMessage.success('删除成功');
    loadDiscounts();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.error || '删除失败');
    }
  }
};

onMounted(() => {
  loadDiscounts();
});
</script>

<style scoped>
.discount-list {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-form {
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>

