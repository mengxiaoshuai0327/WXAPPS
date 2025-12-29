<template>
  <div class="marketing-stats">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>营销方案统计数据</span>
        </div>
      </template>

      <!-- 筛选栏 -->
      <div class="filter-bar" style="margin-bottom: 20px;">
        <el-form :inline="true">
          <el-form-item label="邀请人角色">
            <el-select 
              v-model="filters.inviter_role" 
              placeholder="全部角色" 
              clearable 
              style="width: 150px" 
              @change="loadStats"
            >
              <el-option label="会员" value="member" />
              <el-option label="教练" value="instructor" />
              <el-option label="渠道方" value="channel" />
            </el-select>
          </el-form-item>
          <el-form-item label="邀请人ID">
            <el-input 
              v-model="filters.inviter_id" 
              placeholder="邀请人ID" 
              clearable 
              style="width: 150px"
              @clear="loadStats"
              @keyup.enter="loadStats"
            />
          </el-form-item>
          <el-form-item label="被邀请人ID">
            <el-input 
              v-model="filters.invitee_id" 
              placeholder="被邀请人ID" 
              clearable 
              style="width: 150px"
              @clear="loadStats"
              @keyup.enter="loadStats"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadStats">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 统计表格 -->
      <el-table 
        :data="stats" 
        v-loading="loading"
        style="width: 100%"
        border
        stripe
      >
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="邀请人" width="200">
          <template #default="{ row }">
            <div>{{ row.inviter_real_name || row.inviter_nickname || '-' }}</div>
            <div style="font-size: 12px; color: #999;">
              {{ row.inviter_member_id || row.inviter_instructor_id || row.inviter_channel_id || row.inviter_id }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="邀请人角色" width="100">
          <template #default="{ row }">
            <el-tag 
              :type="row.inviter_role === 'member' ? 'success' : row.inviter_role === 'instructor' ? 'warning' : 'info'"
              size="small"
            >
              {{ row.inviter_role === 'member' ? '会员' : row.inviter_role === 'instructor' ? '教练' : '渠道方' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册人（被邀请人）" width="200">
          <template #default="{ row }">
            <div>{{ row.invitee_real_name || row.invitee_nickname || '-' }}</div>
            <div style="font-size: 12px; color: #999;">
              {{ row.invitee_member_id || row.invitee_id }}
              <span v-if="row.invitee_phone"> | {{ row.invitee_phone }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="invite_code" label="邀请码" width="130" />
        <el-table-column prop="registered_at" label="注册时间" width="170" />
        <el-table-column label="首次购买" width="280">
          <template #default="{ row }">
            <div v-if="row.first_purchase_at">
              <div>时间：{{ row.first_purchase_at }}</div>
              <div>数量：{{ row.first_purchase_quantity }}张</div>
              <div>原价：¥{{ formatMoney(row.first_purchase_amount) }}</div>
              <div v-if="row.first_purchase_discount_amount > 0" style="color: #f56c6c;">
                折扣：-¥{{ formatMoney(row.first_purchase_discount_amount) }}
                <span v-if="row.first_purchase_discount_rate">
                  ({{ (row.first_purchase_discount_rate * 100).toFixed(0) }}%)
                </span>
              </div>
              <div style="font-weight: bold; color: #409eff;">
                实付：¥{{ formatMoney(row.first_purchase_actual_amount) }}
              </div>
              <div v-if="row.campaign_name" style="font-size: 12px; color: #999; margin-top: 5px;">
                方案：{{ row.campaign_name }}
              </div>
            </div>
            <span v-else style="color: #999;">未购买</span>
          </template>
        </el-table-column>
        <el-table-column label="累计统计" width="140">
          <template #default="{ row }">
            <div>数量：<strong>{{ row.total_purchase_quantity }}</strong>张</div>
            <div>金额：<strong>¥{{ formatMoney(row.total_purchase_amount) }}</strong></div>
          </template>
        </el-table-column>
        <el-table-column prop="updated_at" label="更新时间" width="170" />
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
        style="margin-top: 20px; justify-content: flex-end;"
      />

      <div v-if="stats.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无统计数据" />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '../../utils/api';

const stats = ref([]);
const loading = ref(false);

const filters = ref({
  inviter_role: '',
  inviter_id: '',
  invitee_id: ''
});

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const formatMoney = (amount) => {
  if (!amount && amount !== 0) return '0.00';
  return parseFloat(amount).toFixed(2);
};

const loadStats = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    };

    if (filters.value.inviter_role) {
      params.inviter_role = filters.value.inviter_role;
    }
    if (filters.value.inviter_id) {
      params.inviter_id = filters.value.inviter_id;
    }
    if (filters.value.invitee_id) {
      params.invitee_id = filters.value.invitee_id;
    }

    const res = await api.get('/admin/marketing/campaign-stats', { params });
    if (res.success) {
      stats.value = res.data || [];
      pagination.value.total = res.pagination?.total || 0;
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载营销方案统计数据失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载营销方案统计数据失败';
    ElMessage.error(errorMessage);
    stats.value = [];
    pagination.value.total = 0;
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.value = {
    inviter_role: '',
    inviter_id: '',
    invitee_id: ''
  };
  pagination.value.page = 1;
  loadStats();
};

const handleSizeChange = (size) => {
  pagination.value.pageSize = size;
  pagination.value.page = 1;
  loadStats();
};

const handlePageChange = (page) => {
  pagination.value.page = page;
  loadStats();
};

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
.marketing-stats {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 500;
}

.filter-bar {
  background-color: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
}

.empty-state {
  padding: 60px 20px;
  text-align: center;
}
</style>

