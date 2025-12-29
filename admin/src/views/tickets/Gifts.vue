<template>
  <div class="gift-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>赠券列表</span>
        </div>
      </template>

      <!-- 筛选条件 -->
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="关键词">
          <el-input 
            v-model="filterForm.keyword" 
            placeholder="赠送人/受赠人/课券编号" 
            clearable
            @clear="loadGifts"
            style="width: 200px;"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadGifts">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table :data="gifts" style="width: 100%" v-loading="loading">
        <el-table-column label="赠送人信息" width="180">
          <template #default="scope">
            <div>
              <div>{{ scope.row.giver_name || scope.row.giver_real_name }}</div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.giver_member_id }}</div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.giver_phone }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="受赠人信息" width="180">
          <template #default="scope">
            <div>
              <div>{{ scope.row.receiver_name || scope.row.receiver_real_name }}</div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.receiver_member_id }}</div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.receiver_phone }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="ticket_code" label="赠送课券编号" width="150" />
        <el-table-column label="原课券编号" width="150">
          <template #default="scope">
            <span v-if="scope.row.original_ticket_code">{{ scope.row.original_ticket_code }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="课券金额" width="120">
          <template #default="scope">
            <span>¥{{ parseFloat(scope.row.purchase_amount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用折扣信息" width="180">
          <template #default="scope">
            <div v-if="scope.row.discount_coupon_code">
              <div style="font-size: 12px; color: #666;">
                编号: {{ scope.row.discount_coupon_code }}
              </div>
              <div style="font-size: 12px; color: #52c41a;">
                金额: ¥{{ parseFloat(scope.row.discount_coupon_amount || 0).toFixed(2) }}
              </div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="实际支付金额" width="120">
          <template #default="scope">
            <span style="font-weight: 500; color: #1a1a1a;">¥{{ parseFloat(scope.row.actual_amount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="purchase_date" label="课券购买日期" width="120" />
        <el-table-column prop="validity_period" label="有效期" width="220" />
        <el-table-column label="限定报课模块" width="150">
          <template #default="scope">
            <span v-if="scope.row.restrict_module_name">{{ scope.row.restrict_module_name }}</span>
            <span v-else style="color: #999;">无限制</span>
          </template>
        </el-table-column>
        <el-table-column label="限定报课主题" width="150">
          <template #default="scope">
            <span v-if="scope.row.restrict_theme_name">{{ scope.row.restrict_theme_name }}</span>
            <span v-else style="color: #999;">无限制</span>
          </template>
        </el-table-column>
        <el-table-column prop="gifted_at_formatted" label="赠送时间" width="180" />
        <el-table-column prop="status_text" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination" v-if="pagination.totalPages > 1">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../../utils/api';

const gifts = ref([]);
const loading = ref(false);
const filterForm = ref({
  keyword: ''
});
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 0
});

const loadGifts = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    };
    if (filterForm.value.keyword) {
      params.keyword = filterForm.value.keyword;
    }
    
    const res = await api.get('/admin/tickets/gifts', { params });
    console.log('赠券列表响应:', res);
    
    if (res && res.success !== false) {
      gifts.value = res.data || [];
      if (res.pagination) {
        pagination.value = {
          ...pagination.value,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages
        };
      }
    } else {
      const errorMsg = res?.error || res?.message || '加载赠券列表失败';
      console.error('API返回错误:', res);
      ElMessage.error(errorMsg);
    }
  } catch (error) {
    console.error('加载赠券列表错误:', error);
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message || 
                     '加载赠券列表失败，请检查后端服务是否正常运行';
    ElMessage.error(errorMsg);
  } finally {
    loading.value = false;
  }
};

const resetFilter = () => {
  filterForm.value.keyword = '';
  pagination.value.page = 1;
  loadGifts();
};

const handleSizeChange = (val) => {
  pagination.value.pageSize = val;
  pagination.value.page = 1;
  loadGifts();
};

const handlePageChange = (val) => {
  pagination.value.page = val;
  loadGifts();
};

const getStatusType = (status) => {
  const types = {
    'unused': 'success',
    'booked': 'warning',
    'used': 'info',
    'expired': 'danger',
    'gifted': 'info'
  };
  return types[status] || 'info';
};

const getStatusText = (status) => {
  const texts = {
    'unused': '未使用',
    'booked': '已预订',
    'used': '已使用',
    'expired': '已过期',
    'gifted': '已赠送'
  };
  return texts[status] || status;
};

onMounted(() => {
  loadGifts();
});
</script>

<style scoped>
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

