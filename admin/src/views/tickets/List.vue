<template>
  <div class="ticket-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>课券列表</span>
        </div>
      </template>

      <el-table :data="tickets" style="width: 100%" v-loading="loading">
        <el-table-column label="用户信息" width="180">
          <template #default="scope">
            <div>
              <div>{{ scope.row.user_name }}</div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.user_member_id }}</div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.user_phone }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="ticket_code" label="课券编号" width="150" />
        <el-table-column prop="status_text" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ scope.row.status_text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="课券来源" width="200">
          <template #default="scope">
            <div v-if="scope.row.source === 'purchase' || scope.row.source === 'admin' || scope.row.source === 'instructor_reward'">
              <span>自行购买</span>
            </div>
            <div v-else-if="scope.row.source === 'gift' && scope.row.giver_member_id">
              <div>他人赠送</div>
              <div style="font-size: 12px; color: #666; margin-top: 4px;">赠送人: {{ scope.row.giver_member_id }}</div>
              <div v-if="scope.row.original_ticket_code" style="font-size: 12px; color: #409eff; margin-top: 4px;">
                原课券编号: {{ scope.row.original_ticket_code }}
              </div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="课券金额" width="120">
          <template #default="scope">
            <span>¥{{ parseFloat(scope.row.purchase_amount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="优惠券信息" width="180">
          <template #default="scope">
            <div v-if="scope.row.discount_coupon_id">
              <div style="font-size: 12px; color: #666;" v-if="scope.row.discount_coupon_code">
                编号: {{ scope.row.discount_coupon_code }}
              </div>
              <div style="font-size: 12px; color: #666;" v-else>
                ID: {{ scope.row.discount_coupon_id }}
              </div>
              <div style="font-size: 12px; color: #52c41a;">金额: ¥{{ parseFloat(scope.row.discount_coupon_amount || 0).toFixed(2) }}</div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="实际支付" width="120">
          <template #default="scope">
            <span style="font-weight: 500; color: #1a1a1a;">¥{{ parseFloat(scope.row.actual_amount || 0).toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="使用课程" width="200">
          <template #default="scope">
            <div v-if="scope.row.course_id">
              <div style="font-size: 12px; color: #666;">{{ scope.row.course_code || '-' }}</div>
              <div style="font-size: 12px; color: #1a1a1a;">{{ scope.row.course_title }}</div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="purchase_date" label="购买日期" width="180">
          <template #default="scope">
            <span v-if="scope.row.purchase_date">{{ scope.row.purchase_date }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="validity_period" label="有效期" width="220">
          <template #default="scope">
            <span v-if="scope.row.validity_period" style="color: #1a1a1a;">{{ scope.row.validity_period }}</span>
            <span v-else style="color: #999;">永久有效</span>
          </template>
        </el-table-column>
        <el-table-column prop="used_date" label="使用日期" width="180">
          <template #default="scope">
            <span v-if="scope.row.used_date">{{ scope.row.used_date }}</span>
            <span v-else style="color: #999;">未使用</span>
          </template>
        </el-table-column>
        <el-table-column label="开票状态" width="150">
          <template #default="scope">
            <div>
              <el-tag 
                :type="getInvoiceStatusTagType(scope.row.invoice_status_text)" 
                size="small">
                {{ scope.row.invoice_status_text || '未开票' }}
              </el-tag>
              <div v-if="scope.row.invoice_info" style="margin-top: 4px; font-size: 12px; color: #666;">
                <div v-if="scope.row.invoice_info.invoice_number">
                  发票号: {{ scope.row.invoice_info.invoice_number }}
                </div>
                <div v-else-if="scope.row.invoice_status_text === '已申请'">
                  申请时间: {{ scope.row.invoice_info.created_at }}
                </div>
                <div v-else>
                  状态: {{ getInvoiceStatusText(scope.row.invoice_info.status) }}
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button 
              type="danger" 
              size="small" 
              @click="deleteTicket(scope.row)"
              :disabled="scope.row.status === 'booked' || scope.row.status === 'used'">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../utils/api';

const tickets = ref([]);
const loading = ref(false);

const loadTickets = async () => {
  loading.value = true;
  try {
    const res = await api.get('/admin/tickets');
    console.log('课券列表响应:', res);
    
    if (res && res.success !== false) {
      tickets.value = res.data || [];
    } else {
      const errorMsg = res?.error || res?.message || '加载课券列表失败';
      console.error('API返回错误:', res);
      ElMessage.error(errorMsg);
    }
  } catch (error) {
    console.error('加载课券列表错误:', error);
    console.error('错误详情:', {
      message: error.message,
      response: error.response,
      data: error.response?.data
    });
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message || 
                     '加载课券列表失败，请检查后端服务是否正常运行';
    ElMessage.error(errorMsg);
  } finally {
    loading.value = false;
  }
};

const getStatusType = (status) => {
  const types = {
    'unused': 'success',
    'booked': 'warning',
    'used': 'info',
    'expired': 'danger'
  };
  return types[status] || 'info';
};

const getStatusText = (status) => {
  const texts = {
    'unused': '未使用',
    'booked': '已预订',
    'used': '已使用',
    'expired': '已过期'
  };
  return texts[status] || status;
};

const getInvoiceStatusText = (status) => {
  const texts = {
    'pending': '待处理',
    'processing': '处理中',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return texts[status] || status || '待处理';
};

const getInvoiceStatusTagType = (statusText) => {
  if (statusText === '已开票') {
    return 'success';
  } else if (statusText === '已申请') {
    return 'warning';
  } else {
    return 'info';
  }
};

const deleteTicket = async (ticket) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除课券"${ticket.ticket_code}"吗？删除后将无法恢复。`,
      '确认删除',
      {
        type: 'warning',
        confirmButtonText: '确定删除',
        cancelButtonText: '取消'
      }
    );

    const response = await api.delete(`/admin/tickets/${ticket.id}`);
    
    if (response.success) {
      ElMessage.success('删除成功');
      loadTickets();
    } else {
      throw new Error(response.error || '删除失败');
    }
  } catch (error) {
    // 用户取消删除
    if (error === 'cancel' || error.message === 'cancel') {
      return;
    }
    
    console.error('删除课券失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '删除失败';
    ElMessage.error(errorMessage);
  }
};

onMounted(() => {
  loadTickets();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

