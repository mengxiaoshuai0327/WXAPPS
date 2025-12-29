<template>
  <div class="banner-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>Banner管理</span>
          <el-button type="primary" @click="showUploadDialog = true">
            <el-icon><Plus /></el-icon>
            上传Banner
          </el-button>
        </div>
      </template>

      <!-- 提示信息 -->
      <el-alert
        :title="`当前已激活 ${activeCount} / 6 张Banner`"
        :type="activeCount >= 6 ? 'warning' : 'success'"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #default>
          <div>
            <div style="margin-bottom: 8px;">
              <span>最多可以推送6张Banner到小程序首页。当前已激活 {{ activeCount }} 张。</span>
              <span v-if="activeCount >= 6" style="color: #e6a23c; margin-left: 10px;">
                已达到上限，激活新Banner前请先取消其他Banner的激活状态。
              </span>
            </div>
            <div style="color: #409eff; font-weight: 500; font-size: 13px;">
              📐 Banner图片建议尺寸：<strong>1500px × 682px</strong>（宽高比 2.2:1），格式：JPG/PNG，文件大小不超过 5MB
            </div>
          </div>
        </template>
      </el-alert>

      <!-- Banner列表 -->
      <div class="banner-grid" v-loading="loading">
        <div 
          v-for="banner in banners" 
          :key="banner.id" 
          class="banner-item"
          :class="{ 'active': banner.status === 'active' }"
        >
          <div class="banner-image-wrapper">
            <el-image 
              :src="banner.image_url" 
              fit="cover"
              class="banner-image"
              :preview-src-list="[banner.image_url]"
            />
            <div class="banner-overlay">
              <el-tag 
                :type="banner.status === 'active' ? 'success' : 'info'"
                class="status-tag"
              >
                {{ banner.status === 'active' ? '已激活' : '未激活' }}
              </el-tag>
            </div>
          </div>
          
          <div class="banner-info">
            <div class="info-row">
              <span class="label">排序：</span>
              <span>{{ banner.sort_order }}</span>
            </div>
            <div class="info-row" v-if="banner.link_type !== 'none'">
              <span class="label">链接：</span>
              <span>{{ banner.link_type === 'course' ? '课程' : '外部链接' }}</span>
            </div>
            <div class="info-row">
              <span class="label">上传时间：</span>
              <span>{{ formatDate(banner.created_at) }}</span>
            </div>
          </div>

          <div class="banner-actions">
            <el-button 
              size="small" 
              type="primary" 
              @click="showPreview(banner)"
              style="margin-bottom: 10px;"
            >
              预览效果
            </el-button>
            <el-switch
              :model-value="banner.status"
              active-value="active"
              inactive-value="inactive"
              active-text="已激活"
              inactive-text="未激活"
              @change="(val) => toggleStatus(banner, val)"
              :disabled="banner.status === 'inactive' && activeCount >= 6"
            />
            <el-button 
              size="small" 
              type="danger" 
              @click="deleteBanner(banner)"
              style="margin-top: 10px;"
            >
              删除
            </el-button>
          </div>
        </div>

        <div v-if="banners.length === 0 && !loading" class="empty-state">
          <el-empty description="暂无Banner，点击上方按钮上传" />
        </div>
      </div>
    </el-card>

    <!-- 上传对话框 -->
    <el-dialog 
      v-model="showUploadDialog" 
      title="上传Banner" 
      width="700px"
      @close="resetUploadForm"
    >
      <el-form :model="uploadForm" label-width="100px">
        <el-alert
          type="info"
          :closable="false"
          style="margin-bottom: 20px;"
        >
          <template #default>
            <div>
              <div style="margin-bottom: 5px;"><strong>📐 建议尺寸：</strong></div>
              <div style="font-size: 13px; line-height: 1.6;">
                • 最佳尺寸：<strong style="color: #409eff;">1500px × 682px</strong>（宽高比 2.2:1）<br>
                • 格式：JPG/PNG/GIF，文件大小不超过 5MB<br>
                • 重要内容建议放在图片中央区域，避免左右边缘被裁剪
              </div>
            </div>
          </template>
        </el-alert>
        <el-form-item label="选择图片" required>
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :on-change="handleFileChange"
            :limit="1"
            accept="image/jpeg,image/jpg,image/png,image/gif"
            drag
          >
            <el-icon class="el-icon--upload"><upload-filled /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持 jpg/png/gif 格式，文件大小不超过 5MB
              </div>
            </template>
          </el-upload>
          <div v-if="previewImage" class="preview-upload-container">
            <div class="preview-label">上传预览：</div>
            <el-image :src="previewImage" fit="contain" style="max-height: 200px; border: 1px solid #dcdfe6; border-radius: 4px;" />
            <div class="preview-label" style="margin-top: 20px;">小程序前端效果预览：</div>
            <div class="miniprogram-preview">
              <div class="phone-frame">
                <div class="phone-screen">
                  <div class="banner-preview-container">
                    <img :src="previewImage" class="banner-preview-image" alt="Banner预览" />
                  </div>
                  <div class="preview-note">小程序首页显示效果（宽高比 2.2:1）</div>
                </div>
              </div>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="排序顺序">
          <el-input-number 
            v-model="uploadForm.sort_order" 
            :min="0" 
            :max="100"
            placeholder="数字越小越靠前"
          />
          <div class="form-tip">排序数字越小，显示越靠前</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="uploadBanner" :loading="uploading">
          确定上传
        </el-button>
      </template>
    </el-dialog>

    <!-- 预览对话框 -->
    <el-dialog 
      v-model="showPreviewDialog" 
      title="小程序前端效果预览" 
      width="450px"
      :close-on-click-modal="true"
    >
      <div class="preview-dialog-content">
        <div class="phone-frame-preview">
          <div class="phone-screen-preview">
            <div class="banner-preview-container-large">
              <img :src="previewBannerImage" class="banner-preview-image-large" alt="Banner预览" />
            </div>
            <div class="preview-info">
              <div class="preview-info-item">
                <span class="preview-label">排序：</span>
                <span>{{ previewBanner?.sort_order }}</span>
              </div>
              <div class="preview-info-item">
                <span class="preview-label">状态：</span>
                <el-tag :type="previewBanner?.status === 'active' ? 'success' : 'info'" size="small">
                  {{ previewBanner?.status === 'active' ? '已激活' : '未激活' }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
        <div class="preview-tip">
          <el-icon><InfoFilled /></el-icon>
          <span>此为小程序首页显示效果（宽高比 2.2:1，aspectFill 模式）</span>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" @click="showPreviewDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, UploadFilled, InfoFilled } from '@element-plus/icons-vue';
import api from '../../utils/api';

const banners = ref([]);
const loading = ref(false);
const showUploadDialog = ref(false);
const showPreviewDialog = ref(false);
const uploading = ref(false);
const uploadForm = ref({
  sort_order: 0
});
const previewImage = ref(null);
const selectedFile = ref(null);
const uploadRef = ref(null);
const previewBanner = ref(null);
const previewBannerImage = ref(null);

const activeCount = computed(() => {
  return banners.value.filter(b => b.status === 'active').length;
});

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
};

const loadBanners = async () => {
  loading.value = true;
  try {
    const res = await api.get('/banners/admin/list');
    if (res.success) {
      banners.value = res.data || [];
      // 确保每个banner的status是字符串
      banners.value = banners.value.map(b => ({
        ...b,
        status: String(b.status)
      }));
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载Banner列表失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载Banner列表失败';
    ElMessage.error(errorMessage);
    banners.value = [];
  } finally {
    loading.value = false;
  }
};

const handleFileChange = (file) => {
  selectedFile.value = file.raw;
  // 创建预览
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.value = e.target.result;
  };
  reader.readAsDataURL(file.raw);
};

const resetUploadForm = () => {
  uploadForm.value = {
    sort_order: 0
  };
  previewImage.value = null;
  selectedFile.value = null;
  if (uploadRef.value) {
    uploadRef.value.clearFiles();
  }
};

const uploadBanner = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请选择要上传的图片');
    return;
  }

  // 验证文件大小
  if (selectedFile.value.size > 5 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 5MB');
    return;
  }

  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('image', selectedFile.value);
    formData.append('sort_order', uploadForm.value.sort_order || 0);
    formData.append('link_type', 'none');

    const response = await api.post('/banners/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    if (response.success) {
      ElMessage.success(response.message || '上传成功');
      showUploadDialog.value = false;
      loadBanners();
    } else {
      throw new Error(response.error || '上传失败');
    }
  } catch (error) {
    console.error('上传Banner失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '上传失败';
    ElMessage.error(errorMessage);
  } finally {
    uploading.value = false;
  }
};

const toggleStatus = async (banner, newStatus) => {
  const oldStatus = banner.status; // 保存原状态
  
  // 如果要激活，检查是否已满6张
  if (newStatus === 'active') {
    // 计算其他激活的Banner数量（排除当前这个）
    const otherActiveCount = banners.value.filter(
      b => b.id !== banner.id && b.status === 'active'
    ).length;
    
    if (otherActiveCount >= 6) {
      ElMessage.warning('最多只能激活6张Banner，请先取消其他Banner的激活状态');
      return; // 不更新状态，保持原状
    }
  }

  // 先更新UI状态（乐观更新）
  banner.status = newStatus;

  try {
    const response = await api.put(`/banners/${banner.id}`, {
      status: newStatus
    });

    if (response.success) {
      ElMessage.success(newStatus === 'active' ? '已激活' : '已取消激活');
      // 重新加载数据以确保状态同步
      await loadBanners();
    } else {
      // 恢复原状态
      banner.status = oldStatus;
      throw new Error(response.error || '更新失败');
    }
  } catch (error) {
    // 恢复原状态
    banner.status = oldStatus;
    console.error('更新Banner状态失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '更新失败';
    ElMessage.error(errorMessage);
  }
};

const deleteBanner = async (banner) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除这个Banner吗？删除后将无法恢复。`,
      '确认删除',
      {
        type: 'warning',
        confirmButtonText: '确定删除',
        cancelButtonText: '取消'
      }
    );

    const response = await api.delete(`/banners/${banner.id}`);
    
    if (response.success) {
      ElMessage.success('删除成功');
      loadBanners();
    } else {
      throw new Error(response.error || '删除失败');
    }
  } catch (error) {
    // 用户取消删除
    if (error === 'cancel' || error.message === 'cancel') {
      return;
    }
    
    console.error('删除Banner失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '删除失败';
    ElMessage.error(errorMessage);
  }
};

const showPreview = (banner) => {
  previewBanner.value = banner;
  previewBannerImage.value = banner.image_url;
  showPreviewDialog.value = true;
};

onMounted(() => {
  loadBanners();
});
</script>

<style scoped>
.banner-list {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.banner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.banner-item {
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  transition: all 0.3s;
}

.banner-item.active {
  border-color: #67c23a;
  box-shadow: 0 2px 12px rgba(103, 194, 58, 0.3);
}

.banner-image-wrapper {
  position: relative;
  width: 100%;
  height: 200px;
  overflow: hidden;
  background: #f5f5f5;
}

.banner-image {
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.banner-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
}

.status-tag {
  font-weight: bold;
}

.banner-info {
  padding: 15px;
  border-bottom: 1px solid #e4e7ed;
}

.info-row {
  display: flex;
  margin-bottom: 8px;
  font-size: 14px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  color: #909399;
  margin-right: 8px;
  min-width: 80px;
}

.banner-actions {
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 60px 20px;
  text-align: center;
}

.preview-upload-container {
  margin-top: 15px;
  text-align: center;
}

.preview-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
  margin-bottom: 10px;
  text-align: left;
}

.miniprogram-preview {
  margin-top: 15px;
  display: flex;
  justify-content: center;
}

.phone-frame {
  width: 200px;
  background: #1a1a1a;
  border-radius: 20px;
  padding: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.phone-screen {
  width: 100%;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  padding: 10px;
}

.banner-preview-container {
  width: 100%;
  height: 113px; /* 340rpx 转换为px，基于375px宽度: 340 * (375/750) = 170px，但为了预览效果缩小到约113px */
  overflow: hidden;
  border-radius: 8px;
  position: relative;
  background: #f5f5f5;
}

.banner-preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.preview-note {
  font-size: 11px;
  color: #909399;
  margin-top: 8px;
  text-align: center;
}

.preview-dialog-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
}

.phone-frame-preview {
  width: 280px;
  background: #1a1a1a;
  border-radius: 25px;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.phone-screen-preview {
  width: 100%;
  background: #fff;
  border-radius: 18px;
  overflow: hidden;
  padding: 15px;
}

.banner-preview-container-large {
  width: 100%;
  height: 127px; /* 340rpx 转换为px，基于375px宽度: 340 * (375/750) = 170px，缩小到约127px用于预览 */
  overflow: hidden;
  border-radius: 12px;
  position: relative;
  background: #f5f5f5;
  margin-bottom: 15px;
}

.banner-preview-image-large {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.preview-info {
  padding: 10px 0;
  border-top: 1px solid #e4e7ed;
}

.preview-info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
}

.preview-info-item:last-child {
  margin-bottom: 0;
}

.preview-tip {
  margin-top: 20px;
  padding: 12px 16px;
  background: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #409eff;
  max-width: 350px;
}

.preview-tip .el-icon {
  font-size: 16px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
</style>

