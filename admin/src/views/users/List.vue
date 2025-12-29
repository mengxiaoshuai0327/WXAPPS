<template>
  <div class="user-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户列表</span>
        </div>
      </template>

      <el-table :data="users" style="width: 100%" v-loading="loading">
        <el-table-column label="会员ID/教练ID/渠道方ID" width="150">
          <template #default="scope">
            <span v-if="scope.row.role === 'instructor' && scope.row.instructor_id">
              {{ scope.row.instructor_id }}
            </span>
            <span v-else-if="scope.row.role === 'member'">
              <!-- 如果有member_id则显示member_id，否则显示数据库ID -->
              {{ scope.row.member_id || scope.row.id }}
            </span>
            <span v-else-if="scope.row.role === 'channel' && scope.row.channel_id">
              {{ scope.row.channel_id }}
            </span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="nickname" label="昵称" width="150" />
        <el-table-column prop="real_name" label="姓名" width="120" />
        <el-table-column prop="company" label="机构/公司" width="180">
          <template #default="scope">
            <span v-if="scope.row.company">{{ scope.row.company }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="150" />
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
        <el-table-column prop="password" label="密码" width="200">
          <template #default="scope">
            <span v-if="scope.row.password" style="font-family: monospace; font-size: 12px;">
              {{ scope.row.password }}
            </span>
            <span v-else style="color: #999;">未设置</span>
          </template>
        </el-table-column>
        <el-table-column prop="role" label="角色" width="120">
          <template #default="scope">
            <el-tag 
              v-if="scope.row.is_channel_sales" 
              type="warning"
            >
              渠道销售
            </el-tag>
            <el-tag 
              v-else
              :type="scope.row.role === 'member' ? 'success' : scope.row.role === 'instructor' ? 'warning' : scope.row.role === 'channel' ? 'warning' : 'info'"
            >
              {{ scope.row.role === 'member' ? '会员' : scope.row.role === 'instructor' ? '教练' : scope.row.role === 'channel' ? '渠道方' : '游客' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="是否他人邀请" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.is_invited ? 'success' : 'info'" size="small">
              {{ scope.row.is_invited ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="邀请人编码" width="150">
          <template #default="scope">
            <span v-if="scope.row.inviter_code">{{ scope.row.inviter_code }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="邀请人姓名" width="150">
          <template #default="scope">
            <span v-if="scope.row.inviter_name">{{ scope.row.inviter_name }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="注册时间" width="180">
          <template #default="scope">
            <span>{{ scope.row.created_at || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="职位/角色" width="200">
          <template #default="scope">
            <div v-if="scope.row.member_profile && scope.row.member_profile.position">
              <div>{{ getPositionLabel(scope.row.member_profile.position) }}</div>
              <div v-if="scope.row.member_profile.position === 'OF' && scope.row.member_profile.position_other" style="color: #999; font-size: 12px; margin-top: 4px;">
                {{ scope.row.member_profile.position_other }}
              </div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="公司类型" width="220">
          <template #default="scope">
            <div v-if="scope.row.member_profile && scope.row.member_profile.company_type">
              <div>{{ getCompanyTypeLabel(scope.row.member_profile.company_type) }}</div>
              <div v-if="(scope.row.member_profile.company_type === 'OF' || scope.row.member_profile.company_type === 'OJ') && scope.row.member_profile.company_type_other" style="color: #999; font-size: 12px; margin-top: 4px;">
                {{ scope.row.member_profile.company_type_other }}
              </div>
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="岗位头衔" width="150">
          <template #default="scope">
            <span v-if="scope.row.member_profile && scope.row.member_profile.job_title">{{ scope.row.member_profile.job_title }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="在本岗位任职年数" width="150">
          <template #default="scope">
            <span v-if="scope.row.member_profile && scope.row.member_profile.position_years">{{ scope.row.member_profile.position_years }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="在企业总计工作年限" width="160">
          <template #default="scope">
            <span v-if="scope.row.member_profile && scope.row.member_profile.total_work_years">{{ scope.row.member_profile.total_work_years }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="管理的财务团队人数" width="160">
          <template #default="scope">
            <span v-if="scope.row.member_profile && scope.row.member_profile.managed_team_size">{{ scope.row.member_profile.managed_team_size }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="企业整个财务团队人数" width="170">
          <template #default="scope">
            <span v-if="scope.row.member_profile && scope.row.member_profile.total_finance_team_size">{{ scope.row.member_profile.total_finance_team_size }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="离财务一号位汇报关系层数" width="180">
          <template #default="scope">
            <span v-if="scope.row.member_profile && scope.row.member_profile.reporting_layers !== null && scope.row.member_profile.reporting_layers !== undefined">{{ scope.row.member_profile.reporting_layers }}</span>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="财务能力" width="180">
          <template #default="scope">
            <div v-if="scope.row.ability_assessment && scope.row.ability_assessment.financial_ability">
              {{ getFinancialAbilityLabel(scope.row.ability_assessment.financial_ability) }}
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="业务能力" width="200">
          <template #default="scope">
            <div v-if="scope.row.ability_assessment && scope.row.ability_assessment.business_ability">
              {{ getBusinessAbilityLabel(scope.row.ability_assessment.business_ability) }}
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="流程和系统能力" width="200">
          <template #default="scope">
            <div v-if="scope.row.ability_assessment && scope.row.ability_assessment.process_ability">
              {{ getProcessAbilityLabel(scope.row.ability_assessment.process_ability) }}
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="领导力和影响力" width="220">
          <template #default="scope">
            <div v-if="scope.row.ability_assessment && scope.row.ability_assessment.leadership_ability">
              {{ getLeadershipAbilityLabel(scope.row.ability_assessment.leadership_ability) }}
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="资本运作和价值管理能力" width="220">
          <template #default="scope">
            <div v-if="scope.row.ability_assessment && scope.row.ability_assessment.capital_ability">
              {{ getCapitalAbilityLabel(scope.row.ability_assessment.capital_ability) }}
            </div>
            <span v-else style="color: #999;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button 
              size="small" 
              type="primary" 
              @click="editUser(scope.row)"
            >
              编辑
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteUser(scope.row)"
              :disabled="scope.row.role === 'instructor'"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑用户对话框 -->
    <el-dialog 
      v-model="showEditDialog" 
      title="编辑用户" 
      width="600px"
      @close="resetForm"
    >
      <el-form :model="userForm" label-width="100px">
        <el-form-item label="昵称">
          <el-input v-model="userForm.nickname" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="userForm.real_name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="机构/公司">
          <el-input v-model="userForm.company" placeholder="请输入机构或公司（选填）" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="userForm.phone" placeholder="请输入手机号" />
        </el-form-item>
        <!-- 根据角色显示不同的ID字段 -->
        <el-form-item v-if="userForm.role === 'member'" label="会员ID">
          <el-input v-model="userForm.member_id" placeholder="会员ID" disabled />
          <div style="color: #999; font-size: 12px; margin-top: 5px;">
            会员ID由系统自动生成，不可修改
          </div>
        </el-form-item>
        <el-form-item v-else-if="userForm.role === 'instructor'" label="教练ID">
          <el-input v-model="userForm.instructor_id" placeholder="教练ID" disabled />
          <div style="color: #999; font-size: 12px; margin-top: 5px;">
            教练ID由系统自动生成，不可修改
          </div>
        </el-form-item>
        <el-form-item v-else-if="userForm.role === 'channel'" label="渠道方ID">
          <el-input v-model="userForm.channel_id" placeholder="渠道方ID" disabled />
          <div style="color: #999; font-size: 12px; margin-top: 5px;">
            渠道方ID由系统自动生成，不可修改
          </div>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.role" placeholder="请选择角色" style="width: 100%">
            <el-option label="游客" value="visitor" />
            <el-option label="会员" value="member" />
            <el-option label="教练" value="instructor" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="saveUser" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '../../utils/api';

const users = ref([]);
const loading = ref(false);
const showEditDialog = ref(false);
const saving = ref(false);
const userForm = ref({
  id: null,
  nickname: '',
  real_name: '',
  company: '',
  phone: '',
  member_id: '',
  instructor_id: '',
  channel_id: '',
  role: 'visitor'
});

const loadUsers = async () => {
  loading.value = true;
  try {
    const res = await api.get('/admin/users');
    if (res.success) {
      users.value = res.data || [];
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载用户列表失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载用户列表失败';
    ElMessage.error(errorMessage);
    users.value = [];
  } finally {
    loading.value = false;
  }
};

const editUser = (user) => {
  userForm.value = {
    id: user.id,
    nickname: user.nickname || '',
    real_name: user.real_name || '',
    company: user.company || '',
    phone: user.phone || '',
    member_id: user.member_id || '',
    instructor_id: user.instructor_id || '',
    channel_id: user.channel_id || '',
    role: user.role || 'visitor'
  };
  showEditDialog.value = true;
};

const resetForm = () => {
  userForm.value = {
    id: null,
    nickname: '',
    real_name: '',
    company: '',
    phone: '',
    member_id: '',
    instructor_id: '',
    channel_id: '',
    role: 'visitor'
  };
};

const saveUser = async () => {
  // 验证必填字段
  if (!userForm.value.nickname && !userForm.value.real_name) {
    ElMessage.warning('请至少填写昵称或姓名');
    return;
  }

  // 验证手机号格式
  if (userForm.value.phone && !/^1[3-9]\d{9}$/.test(userForm.value.phone)) {
    ElMessage.warning('手机号格式不正确');
    return;
  }

  saving.value = true;
  try {
    const response = await api.put(`/admin/users/${userForm.value.id}`, {
      nickname: userForm.value.nickname || null,
      real_name: userForm.value.real_name || null,
      company: userForm.value.company || null,
      phone: userForm.value.phone || null,
      member_id: userForm.value.member_id || null,
      role: userForm.value.role
    });
    
    if (response.success) {
      ElMessage.success('更新成功');
      showEditDialog.value = false;
      loadUsers();
    } else {
      throw new Error(response.error || '更新失败');
    }
  } catch (error) {
    console.error('保存用户失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '更新失败';
    ElMessage.error(errorMessage);
  } finally {
    saving.value = false;
  }
};

// 职位选项
const positionOptions = [
  { value: 'OA', label: 'CFO/财务一号位' },
  { value: 'OB', label: 'CFO/财务一号位的直接下属' },
  { value: 'OC', label: '会计师事务所高级经理及以上' },
  { value: 'OD', label: '投行券商董事及以上' },
  { value: 'OE', label: '投资机构董事及以上' },
  { value: 'OF', label: '以上都不符合,请说明' }
];

// 公司类型选项
const companyTypeOptions = [
  { value: 'OA', label: '上市公司' },
  { value: 'OB', label: '上市公司之母公司' },
  { value: 'OC', label: '上市公司之子公司' },
  { value: 'OD', label: '非上市公司,年收入规模在5亿以上' },
  { value: 'OE', label: '创业公司,估值达到10亿以上' },
  { value: 'OF', label: '外企中国或亚洲子公司' },
  { value: 'OG', label: '会计师事务所' },
  { value: 'OH', label: '投行券商' },
  { value: 'OI', label: '投资企业' },
  { value: 'OJ', label: '以上都不符合,请说明' }
];

const getPositionLabel = (value) => {
  const option = positionOptions.find(opt => opt.value === value);
  return option ? option.label : value;
};

const getCompanyTypeLabel = (value) => {
  const option = companyTypeOptions.find(opt => opt.value === value);
  return option ? option.label : value;
};

// 能力自评选项
const financialAbilityOptions = [
  { value: 'never_recognized', label: '未曾被他人明确认可过' },
  { value: 'recognized_by_non_finance', label: '曾得到非财人员明确认可' },
  { value: 'recognized_by_finance', label: '曾得到其他财务人员明确认可' },
  { value: 'recognized_by_expert', label: '曾得到财务专家的明确认可' }
];

const getFinancialAbilityLabel = (value) => {
  const option = financialAbilityOptions.find(opt => opt.value === value);
  return option ? option.label : value;
};

// 业务能力选项（单选）
const businessAbilityOptions = [
  { value: 'never_recognized', label: '未曾被业务明确认可过' },
  { value: 'recognized_by_business', label: '曾得到业务人员明确认可' },
  { value: 'recognized_by_leader', label: '曾得到业务领军人明确认可' },
  { value: 'recognized_by_ceo', label: '曾得到老板/CEO 明确认可' }
];

const getBusinessAbilityLabel = (value) => {
  if (!value) return '';
  // 兼容处理：如果value是数组（旧数据），取第一个值
  const actualValue = Array.isArray(value) ? (value.length > 0 ? value[0] : '') : value;
  const option = businessAbilityOptions.find(opt => opt.value === actualValue);
  return option ? option.label : actualValue;
};

// 流程和系统能力选项
const processAbilityOptions = [
  { value: 'no_participation', label: '基本没有参与过相关项目' },
  { value: 'participated', label: '参与过相关项目并做出了应有贡献' },
  { value: 'managed', label: '管理过项目并带领项目团队基本达成目标' },
  { value: 'led_transformation', label: '引领过组织变革中的流程和系统转型部分' }
];

const getProcessAbilityLabel = (value) => {
  const option = processAbilityOptions.find(opt => opt.value === value);
  return option ? option.label : value;
};

// 领导力和影响力选项
const leadershipAbilityOptions = [
  { value: 'within_team', label: '影响力范围主要集中在下属团队内' },
  { value: 'peer_teams', label: '影响力覆盖到平级的其他团队, 常被咨询建议和意见, 且经常被吸纳' },
  { value: 'senior_leadership', label: '影响力能向上到达上级领导, 重要的建议和意见被倾听和重视, 常常被采纳' },
  { value: 'external', label: '影响力能到达组织以外, 在外部合作伙伴和同行问有良好声誉, "软实力"带来的资源帮助企业更好的实现目标' }
];

const getLeadershipAbilityLabel = (value) => {
  const option = leadershipAbilityOptions.find(opt => opt.value === value);
  return option ? option.label : value;
};

// 资本运作和价值管理能力选项
const capitalAbilityOptions = [
  { value: 'limited_exposure', label: '主要关注企业日常经营, 对资本运作和价值管理接触不多' },
  { value: 'secondary_role', label: '有所学习了解和接触, 但仅在边操作为次要角色参与过相关项目' },
  { value: 'core_member', label: '深度 (作为团队主力成员之一) 参与过相关项目并做出了应有贡献' },
  { value: 'led_projects', label: '主导过项目并带领团队基本达成目标, 提升了企业价值' }
];

const getCapitalAbilityLabel = (value) => {
  const option = capitalAbilityOptions.find(opt => opt.value === value);
  return option ? option.label : value;
};

const deleteUser = async (user) => {
  try {
    // 检查是否有活跃预订
    if (user.booking_count > 0) {
      await ElMessageBox.confirm(
        `该用户有 ${user.booking_count} 个预订记录，删除用户将同时删除所有相关数据（预订、课券、评价等）。确定要继续吗？`,
        '警告',
        {
          type: 'warning',
          confirmButtonText: '确定删除',
          cancelButtonText: '取消'
        }
      );
    } else {
      await ElMessageBox.confirm(
        `确定要删除用户 "${user.nickname || user.real_name || user.member_id}" 吗？删除后将无法恢复。`,
        '确认删除',
        {
          type: 'warning',
          confirmButtonText: '确定删除',
          cancelButtonText: '取消'
        }
      );
    }

    // 执行删除
    const response = await api.delete(`/admin/users/${user.id}`);
    
    if (response.success) {
      ElMessage.success('删除成功');
      loadUsers();
    } else {
      throw new Error(response.error || '删除失败');
    }
  } catch (error) {
    // 用户取消删除
    if (error === 'cancel' || error.message === 'cancel') {
      return;
    }
    
    // 处理API错误
    console.error('删除用户失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '删除失败';
    ElMessage.error(errorMessage);
  }
};

onMounted(() => {
  loadUsers();
});
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

