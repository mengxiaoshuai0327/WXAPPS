<template>
  <div class="invitation-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>邀请管理</span>
        </div>
      </template>

      <div class="filter-bar" style="margin-bottom: 20px;">
        <el-form :inline="true">
          <el-form-item label="邀请人">
            <el-input 
              v-model="filters.inviter_id" 
              placeholder="邀请人ID" 
              clearable 
              style="width: 150px"
              @clear="loadData"
              @keyup.enter="loadData"
            />
          </el-form-item>
          <el-form-item label="被邀请人">
            <el-input 
              v-model="filters.invitee_id" 
              placeholder="被邀请人ID" 
              clearable 
              style="width: 150px"
              @clear="loadData"
              @keyup.enter="loadData"
            />
          </el-form-item>
          <el-form-item label="状态">
            <el-select 
              v-model="filters.status" 
              placeholder="全部状态" 
              clearable 
              style="width: 150px" 
              @change="loadData"
            >
              <el-option label="待注册" value="pending" />
              <el-option label="已注册" value="registered" />
              <el-option label="已购买" value="purchased" />
            </el-select>
          </el-form-item>
          <el-form-item label="邀请码">
            <el-input 
              v-model="filters.invite_code" 
              placeholder="邀请码" 
              clearable 
              style="width: 150px"
              @clear="loadData"
              @keyup.enter="loadData"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="loadData">查询</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- Tab切换 -->
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="邀请记录" name="records">
          <!-- 统计信息 -->
          <div class="stats-bar" style="margin-bottom: 20px;">
            <el-row :gutter="20">
              <el-col :span="6">
                <el-statistic title="总邀请数" :value="stats.total_invitations" />
              </el-col>
              <el-col :span="6">
                <el-statistic title="已注册" :value="stats.registered_count" />
              </el-col>
              <el-col :span="6">
                <el-statistic title="已购买" :value="stats.purchased_count" />
              </el-col>
              <el-col :span="6">
                <el-statistic title="待注册" :value="stats.pending_count" />
              </el-col>
            </el-row>
          </div>

      <el-table :data="list" style="width: 100%" v-loading="loading" border>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="邀请人" width="250">
          <template #default="scope">
            <div>{{ scope.row.inviter_name }}</div>
            <div style="font-size: 12px; color: #999;">
              <el-tag size="small" :type="scope.row.inviter_role === 'instructor' ? 'success' : scope.row.inviter_channel_user_id ? 'warning' : 'info'" style="margin-right: 5px;">
                {{ scope.row.inviter_role_text }}
              </el-tag>
              {{ scope.row.inviter_display_id || scope.row.inviter_member_id || scope.row.inviter_instructor_id }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="被邀请人" width="200">
          <template #default="scope">
            <div>{{ scope.row.invitee_name || '-' }}</div>
            <div style="font-size: 12px; color: #999;">
              {{ scope.row.invitee_member_id || '-' }}
              <span v-if="scope.row.invitee_phone"> | {{ scope.row.invitee_phone }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="invite_code" label="邀请码" width="150" />
        <el-table-column label="状态" width="120" align="center">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="180">
          <template #default="scope">
            <span v-if="scope.row.registered_at">{{ scope.row.registered_at }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="购买时间" width="180">
          <template #default="scope">
            <span v-if="scope.row.purchased_at">{{ scope.row.purchased_at }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="邀请人优惠券" width="220">
          <template #default="scope">
            <div>注册奖励: {{ scope.row.register_coupon_count }}张 (¥{{ parseFloat(scope.row.register_coupon_amount || 0).toFixed(2) }})</div>
            <div>购买奖励: {{ scope.row.purchase_coupon_count }}张 (¥{{ parseFloat(scope.row.purchase_coupon_amount || 0).toFixed(2) }})</div>
          </template>
        </el-table-column>
        <el-table-column label="被邀请人优惠券" width="180">
          <template #default="scope">
            <div>{{ scope.row.invitee_coupon_count }}张</div>
            <div style="color: #409eff; font-weight: bold;">¥{{ parseFloat(scope.row.invitee_coupon_amount || 0).toFixed(2) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
      </el-table>

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
        </el-tab-pane>

        <el-tab-pane label="教练/渠道方邀请统计" name="stats">
          <div class="stats-filter-bar" style="margin-bottom: 20px;">
            <el-form :inline="true">
              <el-form-item label="角色">
                <el-select 
                  v-model="statsFilters.role" 
                  placeholder="全部角色" 
                  clearable 
                  style="width: 150px" 
                  @change="loadInvitationStats"
                >
                  <el-option label="教练" value="instructor" />
                  <el-option label="渠道方" value="channel" />
                </el-select>
              </el-form-item>
              <el-form-item label="用户ID">
                <el-input 
                  v-model="statsFilters.user_id" 
                  placeholder="用户ID" 
                  clearable 
                  style="width: 150px"
                  @clear="loadInvitationStats"
                  @keyup.enter="loadInvitationStats"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="loadInvitationStats">查询</el-button>
              </el-form-item>
            </el-form>
          </div>

          <el-table :data="invitationStats" style="width: 100%" v-loading="statsLoading" border>
            <el-table-column prop="id" label="用户ID" width="100" />
            <el-table-column label="用户信息" width="200">
              <template #default="scope">
                <div>{{ scope.row.real_name || scope.row.nickname || '-' }}</div>
                <div style="font-size: 12px; color: #999;">
                  {{ scope.row.member_id || scope.row.instructor_id || scope.row.channel_id || '-' }}
                </div>
              </template>
            </el-table-column>
            <el-table-column label="角色" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.role === 'instructor' ? 'success' : 'warning'">
                  {{ scope.row.role === 'instructor' ? '教练' : '渠道方' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="invited_count" label="邀请人数" width="120" align="center" />
            <el-table-column prop="registered_count" label="已注册" width="120" align="center" />
            <el-table-column prop="purchased_count" label="已购买" width="120" align="center" />
          </el-table>

          <div v-if="invitationStats.length === 0 && !statsLoading" class="empty-state">
            <el-empty description="暂无统计数据" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import axios from 'axios';

export default {
  name: 'InvitationList',
  setup() {
    const loading = ref(false);
    const statsLoading = ref(false);
    const activeTab = ref('records');
    const list = ref([]);
    const invitationStats = ref([]);
    const stats = ref({
      total_invitations: 0,
      registered_count: 0,
      purchased_count: 0,
      pending_count: 0
    });
    
    const filters = ref({
      inviter_id: '',
      invitee_id: '',
      status: '',
      invite_code: ''
    });

    const statsFilters = ref({
      role: '',
      user_id: ''
    });

    const pagination = ref({
      page: 1,
      pageSize: 20,
      total: 0
    });

    // 加载统计数据
    const loadStats = async () => {
      try {
        const res = await axios.get('/api/admin/invitations/stats');
        if (res.data.success) {
          stats.value = res.data.data || stats.value;
        }
      } catch (error) {
        console.error('加载统计失败:', error);
      }
    };

    // 加载数据
    const loadData = async () => {
      loading.value = true;
      try {
        const params = {
          page: pagination.value.page,
          pageSize: pagination.value.pageSize,
          ...filters.value
        };

        // 移除空值
        Object.keys(params).forEach(key => {
          if (params[key] === '' || params[key] === null || params[key] === undefined) {
            delete params[key];
          }
        });

        const res = await axios.get('/api/admin/invitations', { params });
        
        if (res.data.success) {
          list.value = res.data.data || [];
          pagination.value.total = res.data.pagination?.total || 0;
        } else {
          ElMessage.error(res.data.error || '加载失败');
        }
      } catch (error) {
        console.error('加载邀请列表失败:', error);
        ElMessage.error('加载失败: ' + (error.response?.data?.error || error.message));
      } finally {
        loading.value = false;
      }
    };

    // 获取状态类型
    const getStatusType = (status) => {
      const types = {
        pending: 'info',
        registered: 'success',
        purchased: 'success'
      };
      return types[status] || '';
    };

    // 获取状态文本
    const getStatusText = (status) => {
      const texts = {
        pending: '待注册',
        registered: '已注册',
        purchased: '已购买'
      };
      return texts[status] || status;
    };

    // 分页处理
    const handleSizeChange = (size) => {
      pagination.value.pageSize = size;
      pagination.value.page = 1;
      loadData();
    };

    const handlePageChange = (page) => {
      pagination.value.page = page;
      loadData();
    };

    // Tab切换处理
    const handleTabChange = (tabName) => {
      if (tabName === 'stats') {
        loadInvitationStats();
      }
    };

    // 加载教练/渠道方邀请统计
    const loadInvitationStats = async () => {
      statsLoading.value = true;
      try {
        const params = {};
        if (statsFilters.value.role) {
          params.role = statsFilters.value.role;
        }
        if (statsFilters.value.user_id) {
          params.user_id = statsFilters.value.user_id;
        }

        const res = await axios.get('/api/admin/marketing/invitation-stats', { params });
        
        if (res.data.success) {
          invitationStats.value = res.data.data || [];
        } else {
          ElMessage.error(res.data.error || '加载失败');
        }
      } catch (error) {
        console.error('加载邀请统计失败:', error);
        ElMessage.error('加载失败: ' + (error.response?.data?.error || error.message));
        invitationStats.value = [];
      } finally {
        statsLoading.value = false;
      }
    };

    onMounted(() => {
      loadStats();
      loadData();
      if (activeTab.value === 'stats') {
        loadInvitationStats();
      }
    });

    return {
      activeTab,
      loading,
      statsLoading,
      list,
      invitationStats,
      stats,
      filters,
      statsFilters,
      pagination,
      loadData,
      loadStats,
      loadInvitationStats,
      getStatusType,
      getStatusText,
      handleSizeChange,
      handlePageChange,
      handleTabChange
    };
  }
};
</script>

<style scoped>
.invitation-list {
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
  margin-bottom: 20px;
}

.stats-bar {
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.el-table {
  margin-top: 20px;
}
</style>

