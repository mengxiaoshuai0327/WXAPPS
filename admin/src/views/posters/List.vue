<template>
  <div class="poster-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>邀请海报管理</span>
          <el-button type="primary" @click="showUploadDialog = true">
            <el-icon><Plus /></el-icon>
            上传海报模板
          </el-button>
        </div>
      </template>

      <!-- 提示信息 -->
      <el-alert
        :title="`当前已激活 ${activeCount} 张海报模板`"
        :type="activeCount > 0 ? 'success' : 'info'"
        :closable="false"
        style="margin-bottom: 20px;"
      >
        <template #default>
          <span>小程序用户生成邀请海报时，会从激活的海报模板中选择使用。建议二维码位置预留足够空间（建议至少300x300像素）。</span>
        </template>
      </el-alert>

      <!-- 海报列表 -->
      <div class="poster-grid" v-loading="loading">
        <div 
          v-for="poster in posters" 
          :key="poster.id" 
          class="poster-item"
          :class="{ 'active': poster.status === 'active' }"
        >
          <div class="poster-image-wrapper">
            <el-image 
              :src="poster.image_url" 
              fit="cover"
              class="poster-image"
              :preview-src-list="[poster.image_url]"
            />
            <div class="poster-overlay">
              <el-tag 
                :type="poster.status === 'active' ? 'success' : 'info'"
                class="status-tag"
              >
                {{ poster.status === 'active' ? '已激活' : '未激活' }}
              </el-tag>
            </div>
          </div>
          
          <div class="poster-info">
            <div class="info-row">
              <span class="label">名称：</span>
              <span>{{ poster.name }}</span>
            </div>
            <div class="info-row">
              <span class="label">二维码位置：</span>
              <span>({{ poster.qr_code_position_x }}, {{ poster.qr_code_position_y }})</span>
            </div>
            <div class="info-row">
              <span class="label">二维码大小：</span>
              <span>{{ poster.qr_code_size }}px</span>
            </div>
            <div class="info-row">
              <span class="label">排序：</span>
              <span>{{ poster.sort_order }}</span>
            </div>
            <div class="info-row">
              <span class="label">上传时间：</span>
              <span>{{ formatDate(poster.created_at) }}</span>
            </div>
          </div>

          <div class="poster-actions">
            <el-switch
              :model-value="poster.status"
              active-value="active"
              inactive-value="inactive"
              active-text="已激活"
              inactive-text="未激活"
              @change="(val) => toggleStatus(poster, val)"
            />
            <el-button 
              size="small" 
              type="success"
              @click="previewPoster(poster)"
              style="margin-top: 10px;"
            >
              预览
            </el-button>
            <el-button 
              size="small" 
              type="primary"
              @click="editPoster(poster)"
              style="margin-top: 10px;"
            >
              编辑
            </el-button>
            <el-button 
              size="small" 
              type="danger" 
              @click="deletePoster(poster)"
              style="margin-top: 10px;"
            >
              删除
            </el-button>
          </div>
        </div>

        <div v-if="posters.length === 0 && !loading" class="empty-state">
          <el-empty description="暂无海报模板，点击上方按钮上传" />
        </div>
      </div>
    </el-card>

    <!-- 上传对话框 -->
    <el-dialog 
      v-model="showUploadDialog" 
      title="上传海报模板" 
      width="700px"
      @close="resetUploadForm"
    >
      <el-form :model="uploadForm" label-width="140px">
        <el-form-item label="海报名称" required>
          <el-input 
            v-model="uploadForm.name" 
            placeholder="请输入海报名称"
            maxlength="200"
          />
        </el-form-item>
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
                支持 jpg/png/gif 格式，文件大小不超过 10MB
              </div>
            </template>
          </el-upload>
          <div v-if="previewImage" class="preview-container">
            <el-image :src="previewImage" fit="contain" style="max-height: 300px;" />
          </div>
        </el-form-item>
        <el-form-item label="二维码X坐标">
          <el-input-number 
            v-model="uploadForm.qr_code_position_x" 
            :min="0" 
            placeholder="二维码左上角X坐标（像素）"
            style="width: 100%;"
          />
          <div class="form-tip">二维码左上角X坐标位置（像素）</div>
        </el-form-item>
        <el-form-item label="二维码Y坐标">
          <el-input-number 
            v-model="uploadForm.qr_code_position_y" 
            :min="0" 
            placeholder="二维码左上角Y坐标（像素）"
            style="width: 100%;"
          />
          <div class="form-tip">二维码左上角Y坐标位置（像素）</div>
        </el-form-item>
        <el-form-item label="二维码大小">
          <el-input-number 
            v-model="uploadForm.qr_code_size" 
            :min="50" 
            :max="1000"
            placeholder="二维码大小（像素）"
            style="width: 100%;"
          />
          <div class="form-tip">建议大小：200-400像素</div>
        </el-form-item>
        <el-divider>文字设置</el-divider>
        <el-form-item label="文字内容">
          <el-input 
            v-model="uploadForm.text_content" 
            type="textarea"
            :rows="3"
            placeholder="请输入要显示在海报上的文字（选填）"
            maxlength="200"
          />
          <div class="form-tip">在海报上显示的文字内容</div>
        </el-form-item>
        <el-form-item label="文字X坐标">
          <el-input-number 
            v-model="uploadForm.text_position_x" 
            :min="0" 
            placeholder="文字X坐标（像素）"
            style="width: 100%;"
          />
          <div class="form-tip">文字起始位置的X坐标</div>
        </el-form-item>
        <el-form-item label="文字Y坐标">
          <el-input-number 
            v-model="uploadForm.text_position_y" 
            :min="0" 
            placeholder="文字Y坐标（像素）"
            style="width: 100%;"
          />
          <div class="form-tip">文字起始位置的Y坐标</div>
        </el-form-item>
        <el-form-item label="文字大小">
          <el-input-number 
            v-model="uploadForm.text_font_size" 
            :min="12" 
            :max="200"
            placeholder="文字大小（像素）"
            style="width: 100%;"
          />
          <div class="form-tip">建议大小：24-72像素</div>
        </el-form-item>
        <el-form-item label="文字颜色">
          <el-color-picker v-model="uploadForm.text_color" />
          <div class="form-tip">选择文字颜色</div>
        </el-form-item>
        <el-form-item label="文字对齐">
          <el-radio-group v-model="uploadForm.text_align">
            <el-radio value="left">左对齐</el-radio>
            <el-radio value="center">居中</el-radio>
            <el-radio value="right">右对齐</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-divider>其他设置</el-divider>
        <el-form-item label="排序顺序">
          <el-input-number 
            v-model="uploadForm.sort_order" 
            :min="0" 
            :max="100"
            placeholder="数字越小越靠前"
            style="width: 100%;"
          />
          <div class="form-tip">排序数字越小，显示越靠前</div>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="uploadForm.status">
            <el-radio value="active">激活</el-radio>
            <el-radio value="inactive">未激活</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUploadDialog = false">取消</el-button>
        <el-button type="primary" @click="uploadPoster" :loading="uploading">
          确定上传
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog 
      v-model="showEditDialog" 
      title="编辑海报模板" 
      width="700px"
      @close="resetEditForm"
    >
      <el-form :model="editForm" label-width="140px">
        <el-form-item label="海报名称" required>
          <el-input 
            v-model="editForm.name" 
            placeholder="请输入海报名称"
            maxlength="200"
          />
        </el-form-item>
        <el-form-item label="二维码X坐标">
          <el-input-number 
            v-model="editForm.qr_code_position_x" 
            :min="0" 
            placeholder="二维码左上角X坐标（像素）"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="二维码Y坐标">
          <el-input-number 
            v-model="editForm.qr_code_position_y" 
            :min="0" 
            placeholder="二维码左上角Y坐标（像素）"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="二维码大小">
          <el-input-number 
            v-model="editForm.qr_code_size" 
            :min="50" 
            :max="1000"
            placeholder="二维码大小（像素）"
            style="width: 100%;"
          />
        </el-form-item>
        <el-divider>文字设置</el-divider>
        <el-form-item label="文字内容">
          <el-input 
            v-model="editForm.text_content" 
            type="textarea"
            :rows="3"
            placeholder="请输入要显示在海报上的文字（选填）"
            maxlength="200"
          />
        </el-form-item>
        <el-form-item label="文字X坐标">
          <el-input-number 
            v-model="editForm.text_position_x" 
            :min="0" 
            placeholder="文字X坐标（像素）"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="文字Y坐标">
          <el-input-number 
            v-model="editForm.text_position_y" 
            :min="0" 
            placeholder="文字Y坐标（像素）"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="文字大小">
          <el-input-number 
            v-model="editForm.text_font_size" 
            :min="12" 
            :max="200"
            placeholder="文字大小（像素）"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="文字颜色">
          <el-color-picker v-model="editForm.text_color" />
        </el-form-item>
        <el-form-item label="文字对齐">
          <el-radio-group v-model="editForm.text_align">
            <el-radio value="left">左对齐</el-radio>
            <el-radio value="center">居中</el-radio>
            <el-radio value="right">右对齐</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-divider>其他设置</el-divider>
        <el-form-item label="排序顺序">
          <el-input-number 
            v-model="editForm.sort_order" 
            :min="0" 
            :max="100"
            placeholder="数字越小越靠前"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="editForm.status">
            <el-radio value="active">激活</el-radio>
            <el-radio value="inactive">未激活</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="previewPosterFromEditForm">预览效果</el-button>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="updatePoster" :loading="updating">
          确定保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 预览对话框 -->
    <el-dialog 
      v-model="showPreviewDialog" 
      title="海报预览" 
      width="500px"
    >
      <div class="preview-wrapper" v-if="previewPosterId">
        <div class="preview-canvas-container">
          <canvas 
            ref="previewCanvas" 
            :width="750" 
            :height="1334"
            style="max-width: 100%; height: auto; border: 1px solid #ddd;"
          ></canvas>
        </div>
        <div class="preview-tip">
          <el-alert
            type="info"
            :closable="false"
            style="margin-top: 15px;"
          >
            <template #default>
              <span>预览效果仅供参考，实际生成的海报会根据用户二维码自动合成</span>
            </template>
          </el-alert>
        </div>
      </div>
      <template #footer>
        <el-button @click="showPreviewDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, UploadFilled } from '@element-plus/icons-vue';
import api from '../../utils/api';

const posters = ref([]);
const loading = ref(false);
const showUploadDialog = ref(false);
const showEditDialog = ref(false);
const uploading = ref(false);
const updating = ref(false);
const uploadForm = ref({
  name: '',
  qr_code_position_x: 0,
  qr_code_position_y: 0,
  qr_code_size: 300,
  text_content: '',
  text_position_x: 0,
  text_position_y: 100,
  text_font_size: 32,
  text_color: '#000000',
  text_align: 'left',
  sort_order: 0,
  status: 'active'
});
const editForm = ref({
  id: null,
  name: '',
  qr_code_position_x: 0,
  qr_code_position_y: 0,
  qr_code_size: 300,
  text_content: '',
  text_position_x: 0,
  text_position_y: 100,
  text_font_size: 32,
  text_color: '#000000',
  text_align: 'left',
  sort_order: 0,
  status: 'active'
});
const showPreviewDialog = ref(false);
const previewPosterId = ref(null);
const previewImage = ref(null);
const selectedFile = ref(null);
const uploadRef = ref(null);
const previewCanvas = ref(null);

const activeCount = computed(() => {
  return posters.value.filter(p => p.status === 'active').length;
});

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
};

const loadPosters = async () => {
  loading.value = true;
  try {
    const res = await api.get('/posters/admin/list');
    if (res.success) {
      posters.value = res.data || [];
      posters.value = posters.value.map(p => ({
        ...p,
        status: String(p.status)
      }));
    } else {
      throw new Error(res.error || '加载失败');
    }
  } catch (error) {
    console.error('加载海报列表失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '加载海报列表失败';
    ElMessage.error(errorMessage);
    posters.value = [];
  } finally {
    loading.value = false;
  }
};

const handleFileChange = (file) => {
  selectedFile.value = file.raw;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.value = e.target.result;
  };
  reader.readAsDataURL(file.raw);
};

const resetUploadForm = () => {
  uploadForm.value = {
    name: '',
    qr_code_position_x: 0,
    qr_code_position_y: 0,
    qr_code_size: 300,
    text_content: '',
    text_position_x: 0,
    text_position_y: 100,
    text_font_size: 32,
    text_color: '#000000',
    text_align: 'left',
    sort_order: 0,
    status: 'active'
  };
  previewImage.value = null;
  selectedFile.value = null;
  if (uploadRef.value) {
    uploadRef.value.clearFiles();
  }
};

const resetEditForm = () => {
  editForm.value = {
    id: null,
    name: '',
    qr_code_position_x: 0,
    qr_code_position_y: 0,
    qr_code_size: 300,
    text_content: '',
    text_position_x: 0,
    text_position_y: 100,
    text_font_size: 32,
    text_color: '#000000',
    text_align: 'left',
    sort_order: 0,
    status: 'active'
  };
};

const uploadPoster = async () => {
  if (!selectedFile.value) {
    ElMessage.warning('请选择要上传的图片');
    return;
  }

  if (!uploadForm.value.name) {
    ElMessage.warning('请输入海报名称');
    return;
  }

  if (selectedFile.value.size > 10 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 10MB');
    return;
  }

  uploading.value = true;
  try {
    const formData = new FormData();
    formData.append('image', selectedFile.value);
    formData.append('name', uploadForm.value.name);
    formData.append('qr_code_position_x', uploadForm.value.qr_code_position_x || 0);
    formData.append('qr_code_position_y', uploadForm.value.qr_code_position_y || 0);
    formData.append('qr_code_size', uploadForm.value.qr_code_size || 300);
    formData.append('text_content', uploadForm.value.text_content || '');
    formData.append('text_position_x', uploadForm.value.text_position_x || 0);
    formData.append('text_position_y', uploadForm.value.text_position_y || 100);
    formData.append('text_font_size', uploadForm.value.text_font_size || 32);
    formData.append('text_color', uploadForm.value.text_color || '#000000');
    formData.append('text_align', uploadForm.value.text_align || 'left');
    formData.append('sort_order', uploadForm.value.sort_order || 0);
    formData.append('status', uploadForm.value.status || 'active');

    const response = await api.post('/posters/admin/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    if (response.success) {
      ElMessage.success(response.message || '上传成功');
      showUploadDialog.value = false;
      loadPosters();
    } else {
      throw new Error(response.error || '上传失败');
    }
  } catch (error) {
    console.error('上传海报失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '上传失败';
    ElMessage.error(errorMessage);
  } finally {
    uploading.value = false;
  }
};

const editPoster = (poster) => {
  editForm.value = {
    id: poster.id,
    name: poster.name,
    qr_code_position_x: poster.qr_code_position_x || 0,
    qr_code_position_y: poster.qr_code_position_y || 0,
    qr_code_size: poster.qr_code_size || 300,
    text_content: poster.text_content || '',
    text_position_x: poster.text_position_x || 0,
    text_position_y: poster.text_position_y || 100,
    text_font_size: poster.text_font_size || 32,
    text_color: poster.text_color || '#000000',
    text_align: poster.text_align || 'left',
    sort_order: poster.sort_order || 0,
    status: poster.status
  };
  showEditDialog.value = true;
};

const updatePoster = async () => {
  updating.value = true;
  try {
    const response = await api.put(`/posters/admin/${editForm.value.id}`, {
      name: editForm.value.name,
      qr_code_position_x: editForm.value.qr_code_position_x,
      qr_code_position_y: editForm.value.qr_code_position_y,
      qr_code_size: editForm.value.qr_code_size,
      text_content: editForm.value.text_content,
      text_position_x: editForm.value.text_position_x,
      text_position_y: editForm.value.text_position_y,
      text_font_size: editForm.value.text_font_size,
      text_color: editForm.value.text_color,
      text_align: editForm.value.text_align,
      sort_order: editForm.value.sort_order,
      status: editForm.value.status
    });

    if (response.success) {
      ElMessage.success(response.message || '更新成功');
      showEditDialog.value = false;
      loadPosters();
    } else {
      throw new Error(response.error || '更新失败');
    }
  } catch (error) {
    console.error('更新海报失败:', error);
    const errorMessage = error.response?.data?.error || 
                        error.response?.data?.details || 
                        error.message || 
                        '更新失败';
    ElMessage.error(errorMessage);
  } finally {
    updating.value = false;
  }
};

const toggleStatus = async (poster, newStatus) => {
  try {
    const response = await api.put(`/posters/admin/${poster.id}`, {
      status: newStatus
    });

    if (response.success) {
      ElMessage.success('状态更新成功');
      loadPosters();
    } else {
      throw new Error(response.error || '更新失败');
    }
  } catch (error) {
    console.error('更新状态失败:', error);
    ElMessage.error(error.response?.data?.error || error.message || '更新失败');
    loadPosters(); // 重新加载以恢复状态
  }
};

const deletePoster = async (poster) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除海报模板"${poster.name}"吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const response = await api.delete(`/posters/admin/${poster.id}`);
    
    if (response.success) {
      ElMessage.success('删除成功');
      loadPosters();
    } else {
      throw new Error(response.error || '删除失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除海报失败:', error);
      ElMessage.error(error.response?.data?.error || error.message || '删除失败');
    }
  }
};

// 从编辑表单预览
const previewPosterFromEditForm = async () => {
  // 使用编辑表单的数据进行预览
  const originalPoster = posters.value.find(p => p.id === editForm.value.id);
  if (!originalPoster) {
    ElMessage.warning('未找到海报信息');
    return;
  }
  
  const previewData = {
    ...originalPoster,
    ...editForm.value, // 使用编辑表单的最新数据
    image_url: originalPoster.image_url
  };
  
  previewPosterId.value = previewData.id;
  showPreviewDialog.value = true;
  
  // 等待DOM更新后再绘制
  await new Promise(resolve => setTimeout(resolve, 300));
  await drawPreview(previewData);
};

// 处理预览对话框打开事件
const handlePreviewDialogOpened = async () => {
  if (!previewPosterId.value) return;
  
  // 如果是从列表点击预览，获取原始数据
  const poster = posters.value.find(p => p.id === previewPosterId.value);
  if (poster) {
    await drawPreview(poster);
  }
};

// 绘制预览的通用函数
const drawPreview = async (poster) => {
  if (!previewCanvas.value) {
    console.error('Canvas未找到');
    return;
  }
  
  const canvas = previewCanvas.value;
  const ctx = canvas.getContext('2d');
  
  // 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 加载海报图片
  const posterImg = new Image();
  posterImg.crossOrigin = 'anonymous';
  
  posterImg.onerror = (error) => {
    console.error('海报图片加载失败:', error);
    ElMessage.error('海报图片加载失败');
  };
  
  posterImg.onload = () => {
    // 计算缩放比例
    const scaleX = canvas.width / posterImg.width;
    const scaleY = canvas.height / posterImg.height;
    
    // 绘制海报背景
    ctx.drawImage(posterImg, 0, 0, canvas.width, canvas.height);
    
    // 绘制二维码占位符（模拟）
    if (poster.qr_code_size) {
      const qrX = (poster.qr_code_position_x || 0) * scaleX;
      const qrY = (poster.qr_code_position_y || 0) * scaleY;
      const scaledQrSize = (poster.qr_code_size || 300) * scaleX;
      
      // 绘制二维码占位框
      ctx.strokeStyle = '#409EFF';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(qrX, qrY, scaledQrSize, scaledQrSize);
      
      // 绘制二维码占位文字
      ctx.fillStyle = '#409EFF';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('二维码位置', qrX + scaledQrSize / 2, qrY + scaledQrSize / 2);
    }
    
    // 绘制文字
    if (poster.text_content && poster.text_content.trim()) {
      const textX = (poster.text_position_x || 0) * scaleX;
      const textY = (poster.text_position_y || 100) * scaleY;
      const scaledFontSize = Math.max(12, (poster.text_font_size || 32) * scaleX);
      
      ctx.fillStyle = poster.text_color || '#000000';
      ctx.font = `bold ${scaledFontSize}px Arial, "Microsoft YaHei", sans-serif`;
      ctx.textBaseline = 'top'; // 设置基线为顶部
      
      console.log('绘制文字:', {
        content: poster.text_content,
        x: textX,
        y: textY,
        fontSize: scaledFontSize,
        color: poster.text_color,
        align: poster.text_align
      });
      
      // 设置文字对齐
      if (poster.text_align === 'center') {
        ctx.textAlign = 'center';
        ctx.fillText(poster.text_content, canvas.width / 2, textY);
      } else if (poster.text_align === 'right') {
        ctx.textAlign = 'right';
        ctx.fillText(poster.text_content, canvas.width, textY);
      } else {
        ctx.textAlign = 'left';
        ctx.fillText(poster.text_content, textX, textY);
      }
    } else {
      console.log('文字内容为空或未设置:', poster.text_content);
    }
  };
  
  posterImg.src = poster.image_url;
};

const previewPoster = async (poster) => {
  previewPosterId.value = poster.id;
  showPreviewDialog.value = true;
  
  // 等待DOM更新
  await new Promise(resolve => setTimeout(resolve, 300));
  await drawPreview(poster);
};

onMounted(() => {
  loadPosters();
});
</script>

<style scoped>
.poster-list {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.poster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.poster-item {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  transition: all 0.3s;
}

.poster-item.active {
  border-color: #67c23a;
  box-shadow: 0 2px 12px rgba(103, 194, 58, 0.2);
}

.poster-image-wrapper {
  position: relative;
  width: 100%;
  height: 200px;
  background: #f5f7fa;
  overflow: hidden;
}

.poster-image {
  width: 100%;
  height: 100%;
}

.poster-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
}

.status-tag {
  font-weight: 500;
}

.poster-info {
  padding: 15px;
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
  min-width: 100px;
  font-weight: 500;
}

.poster-actions {
  padding: 15px;
  border-top: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-container {
  margin-top: 15px;
  text-align: center;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 60px 20px;
}

.el-upload {
  width: 100%;
}

.el-upload-dragger {
  width: 100%;
}

.preview-wrapper {
  text-align: center;
}

.preview-canvas-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;
}

.preview-tip {
  margin-top: 15px;
}
</style>

