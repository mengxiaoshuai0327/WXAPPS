<template>
  <div class="invoice-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>发票管理列表</span>
        </div>
      </template>

      <!-- 筛选条件 -->
      <el-form :inline="true" class="filter-form">
        <el-form-item label="关键词">
          <el-input 
            v-model="filters.keyword" 
            placeholder="用户昵称/会员ID/手机号/发票抬头/邮箱" 
            clearable
            style="width: 300px"
            @keyup.enter="loadInvoices"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部状态" clearable style="width: 150px">
            <el-option label="待处理" value="pending" />
            <el-option label="处理中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadInvoices">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>

      <el-table 
        :data="invoices" 
        style="width: 100%" 
        v-loading="loading"
        :reserve-selection="false"
        table-layout="fixed"
        :show-overflow-tooltip="true"
      >
        <el-table-column prop="application_code" label="申请编码" width="200" />
        <el-table-column label="用户信息" width="180">
          <template #default="scope">
            <div>
              <div>{{ scope.row.user_name }}</div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.user_member_id }}</div>
              <div style="font-size: 12px; color: #999;">{{ scope.row.user_phone }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="invoice_header" label="发票抬头" min-width="200" />
        <el-table-column prop="tax_number" label="税号" width="150" />
        <el-table-column prop="email" label="收发票邮箱" width="200" />
        <el-table-column label="课券信息" width="200">
          <template #default="scope">
            <div v-if="scope.row.ticket_codes && scope.row.ticket_codes.length > 0">
              <div v-for="(code, index) in scope.row.ticket_codes.slice(0, 2)" :key="index" style="font-size: 12px;">
                {{ code }}
              </div>
              <div v-if="scope.row.ticket_codes.length > 2" style="font-size: 12px; color: #999;">
                等{{ scope.row.ticket_codes.length }}张
              </div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="发票金额" width="120">
          <template #default="scope">
            ¥{{ parseFloat(scope.row.amount || 0).toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="invoice_number" label="发票号码" width="150" />
        <el-table-column prop="created_at_formatted" label="申请时间" width="180" />
        <el-table-column prop="issued_at_formatted" label="开票时间" width="180" />
        <el-table-column label="操作" width="200">
          <template #default="scope">
            <el-button 
              size="small" 
              @click="viewDetail(scope.row)"
            >
              详情
            </el-button>
            <!-- 待处理状态：显示"处理中"和"完成"按钮 -->
            <template v-if="scope.row.status === 'pending'">
              <el-button 
                size="small" 
                type="primary" 
                @click="updateStatus(scope.row, 'processing')"
              >
                处理中
              </el-button>
              <el-button 
                size="small" 
                type="success" 
                @click="completeInvoice(scope.row)"
              >
                完成
              </el-button>
            </template>
            <!-- 处理中状态：只显示"完成"按钮 -->
            <template v-else-if="scope.row.status === 'processing'">
              <el-button 
                size="small" 
                type="success" 
                @click="completeInvoice(scope.row)"
              >
                完成
              </el-button>
            </template>
            <!-- 已完成和已取消状态：不显示其他按钮 -->
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadInvoices"
        @current-change="loadInvoices"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog 
      v-model="showDetailDialog" 
      title="发票详情" 
      width="800px"
      @close="currentInvoice = null"
    >
      <el-descriptions :column="2" border v-if="currentInvoice">
        <el-descriptions-item label="发票ID">{{ currentInvoice.id }}</el-descriptions-item>
        <el-descriptions-item label="申请编码">{{ currentInvoice.application_code || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(currentInvoice.status)">
            {{ getStatusText(currentInvoice.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="用户昵称">{{ currentInvoice.user_name }}</el-descriptions-item>
        <el-descriptions-item label="会员ID">{{ currentInvoice.user_member_id }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ currentInvoice.user_phone }}</el-descriptions-item>
        <el-descriptions-item label="发票抬头" :span="2">{{ currentInvoice.invoice_header }}</el-descriptions-item>
        <el-descriptions-item label="税号">{{ currentInvoice.tax_number || '-' }}</el-descriptions-item>
        <el-descriptions-item label="收发票邮箱">{{ currentInvoice.email }}</el-descriptions-item>
        <el-descriptions-item label="发票金额">¥{{ parseFloat(currentInvoice.amount || 0).toFixed(2) }}</el-descriptions-item>
        <el-descriptions-item label="发票号码">{{ currentInvoice.invoice_number || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请时间">{{ currentInvoice.created_at_formatted }}</el-descriptions-item>
        <el-descriptions-item label="开票时间">{{ currentInvoice.issued_at_formatted || '-' }}</el-descriptions-item>
        <el-descriptions-item label="课券信息" :span="2">
          <div v-if="currentInvoice.tickets && currentInvoice.tickets.length > 0">
            <el-table :data="currentInvoice.tickets" size="small" style="margin-top: 10px;">
              <el-table-column prop="ticket_code" label="课券编号" width="150" />
              <el-table-column prop="actual_amount" label="金额" width="100">
                <template #default="scope">
                  ¥{{ parseFloat(scope.row.actual_amount || 0).toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column label="优惠券" width="150">
                <template #default="scope">
                  <span v-if="scope.row.discount_coupon">
                    {{ scope.row.discount_coupon.discount_code }}<br/>
                    <span style="color: #67c23a;">-¥{{ parseFloat(scope.row.discount_coupon.amount || 0).toFixed(2) }}</span>
                  </span>
                  <span v-else style="color: #999;">-</span>
                </template>
              </el-table-column>
              <el-table-column prop="course_title" label="课程" min-width="200" />
              <el-table-column prop="used_at" label="使用时间" width="150">
                <template #default="scope">
                  {{ scope.row.used_at || '-' }}
                </template>
              </el-table-column>
            </el-table>
          </div>
          <span v-else style="color: #999;">-</span>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 完成发票对话框 -->
    <el-dialog 
      v-model="showCompleteDialog" 
      title="完成发票" 
      width="500px"
      @close="completeForm.invoice_number = ''"
    >
      <el-form :model="completeForm" label-width="120px">
        <el-form-item label="发票号码" required>
          <el-input 
            v-model="completeForm.invoice_number" 
            placeholder="请输入发票号码"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCompleteDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmComplete" :loading="saving">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../utils/api';

const invoices = ref([]);
const loading = ref(false);
const saving = ref(false);
const showDetailDialog = ref(false);
const showCompleteDialog = ref(false);
const currentInvoice = ref(null);
const completeForm = ref({
  invoice_number: ''
});

const filters = ref({
  keyword: '',
  status: ''
});

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});

const loadInvoices = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    };

    if (filters.value.keyword) {
      params.keyword = filters.value.keyword;
    }

    if (filters.value.status) {
      params.status = filters.value.status;
    }

    const res = await api.get('/admin/invoices', { params });
    invoices.value = res.data || [];
    pagination.value.total = res.pagination?.total || 0;
  } catch (error) {
    ElMessage.error('加载发票列表失败');
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.value = {
    keyword: '',
    status: ''
  };
  pagination.value.page = 1;
  loadInvoices();
};

const viewDetail = async (invoice) => {
  try {
    console.log('获取发票详情，ID:', invoice.id);
    currentInvoice.value = null; // 先清空，避免显示旧数据
    showDetailDialog.value = true;
    
    const res = await api.get(`/admin/invoices/${invoice.id}`);
    console.log('发票详情API响应:', res);
    
    if (res && res.success !== false && res.data) {
      currentInvoice.value = res.data;
    } else {
      const errorMsg = res?.error || res?.message || '获取发票详情失败';
      console.error('API返回错误:', res);
      ElMessage.error(errorMsg);
      showDetailDialog.value = false;
    }
  } catch (error) {
    console.error('获取发票详情错误:', error);
    console.error('错误详情:', {
      message: error.message,
      response: error.response,
      data: error.response?.data
    });
    const errorMsg = error.response?.data?.error || 
                     error.response?.data?.message || 
                     error.message || 
                     '获取发票详情失败，请检查后端服务是否正常运行';
    ElMessage.error(errorMsg);
    showDetailDialog.value = false;
  }
};

const updateStatus = async (invoice, status) => {
  try {
    await api.put(`/admin/invoices/${invoice.id}/status`, { status });
    ElMessage.success('状态更新成功');
    loadInvoices();
  } catch (error) {
    ElMessage.error('更新状态失败');
  }
};

const completeInvoice = (invoice) => {
  currentInvoice.value = invoice;
  // 重置表单，清空之前的发票号
  completeForm.value.invoice_number = '';
  showCompleteDialog.value = true;
};

const confirmComplete = async () => {
  if (!completeForm.value.invoice_number) {
    ElMessage.warning('请输入发票号码');
    return;
  }

  saving.value = true;
  try {
    await api.put(`/admin/invoices/${currentInvoice.value.id}/status`, {
      status: 'completed',
      invoice_number: completeForm.value.invoice_number
    });
    ElMessage.success('发票完成成功');
    showCompleteDialog.value = false;
    loadInvoices();
  } catch (error) {
    ElMessage.error('完成发票失败');
  } finally {
    saving.value = false;
  }
};

const getStatusType = (status) => {
  const types = {
    'pending': 'warning',
    'processing': 'primary',
    'completed': 'success',
    'cancelled': 'danger'
  };
  return types[status] || 'info';
};

const getStatusText = (status) => {
  const texts = {
    'pending': '待处理',
    'processing': '处理中',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return texts[status] || status;
};

const formatDateTime = (dateTime) => {
  if (!dateTime) return '';
  const date = new Date(dateTime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

onMounted(() => {
  loadInvoices();
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
</style>

