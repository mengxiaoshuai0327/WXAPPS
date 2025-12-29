const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置 multer 用于Banner上传
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/banners');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'banner-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadBanner = multer({
  storage: bannerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件 (jpeg, jpg, png, gif)'));
    }
  }
});

// 错误处理中间件
const handleUploadError = (err, req, res, next) => {
  if (err) {
    console.error('上传错误:', err);
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: '文件大小不能超过 5MB' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(400).json({ success: false, error: err.message || '上传失败' });
  }
  next();
};

// 获取完整图片URL
function getFullImageUrl(imageUrl) {
  // 优先使用环境变量中的 BASE_URL，如果没有则使用默认值
  // 本地开发环境使用 HTTP，生产环境使用 HTTPS
  const port = process.env.PORT || 3000;
  let baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
  
  // 如果是 localhost 或 127.0.0.1，强制使用 HTTP（开发环境）
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    baseUrl = baseUrl.replace('https://', 'http://');
  }
  
  // 如果已经是完整的 URL（包含 http:// 或 https://），直接返回
  if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
    // 如果是 localhost，强制使用 HTTP
    if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
      return imageUrl.replace('https://', 'http://');
    }
    return imageUrl;
  }
  
  return imageUrl ? `${baseUrl}/${imageUrl}` : null;
}

// 获取所有Banner（前台使用，最多返回6张启用的）
router.get('/list', async (req, res) => {
  try {
    const [banners] = await db.query(
      'SELECT * FROM banners WHERE status = ? ORDER BY sort_order ASC, created_at DESC LIMIT 6',
      ['active']
    );
    
    const bannersWithUrl = banners.map(banner => ({
      ...banner,
      image_url: getFullImageUrl(banner.image_url)
    }));
    
    res.json({ success: true, data: bannersWithUrl });
  } catch (error) {
    console.error('获取Banner列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 获取所有Banner（管理后台使用）
router.get('/admin/list', async (req, res) => {
  try {
    const [banners] = await db.query(
      'SELECT * FROM banners ORDER BY sort_order ASC, created_at DESC'
    );
    
    const bannersWithUrl = banners.map(banner => ({
      ...banner,
      image_url: getFullImageUrl(banner.image_url)
    }));
    
    res.json({ success: true, data: bannersWithUrl });
  } catch (error) {
    console.error('获取Banner列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 上传Banner
router.post('/upload', uploadBanner.single('image'), handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请选择要上传的图片' });
    }

    // 检查当前激活的Banner数量
    const [activeBanners] = await db.query(
      'SELECT COUNT(*) as count FROM banners WHERE status = ?',
      ['active']
    );
    const activeCount = activeBanners[0].count;

    const imagePath = `uploads/banners/${req.file.filename}`;
    const sortOrder = req.body.sort_order ? parseInt(req.body.sort_order) : activeCount;
    const linkType = req.body.link_type || 'none';
    const linkValue = req.body.link_value || null;
    // 默认状态为active，但如果已经有6张激活的，则设为inactive
    const status = activeCount >= 6 ? 'inactive' : 'active';

    const [result] = await db.query(
      `INSERT INTO banners (image_url, link_type, link_value, sort_order, status) 
       VALUES (?, ?, ?, ?, ?)`,
      [imagePath, linkType, linkValue, sortOrder, status]
    );

    const [banners] = await db.query('SELECT * FROM banners WHERE id = ?', [result.insertId]);
    const banner = banners[0];
    banner.image_url = getFullImageUrl(banner.image_url);

    res.json({
      success: true,
      data: banner,
      message: activeCount >= 6 ? 'Banner上传成功，但当前已有6张激活的Banner，此Banner已设为未激活状态' : 'Banner上传成功'
    });
  } catch (error) {
    console.error('上传Banner错误:', error);
    res.status(500).json({ 
      success: false,
      error: '上传失败', 
      details: error.message 
    });
  }
});

// 更新Banner状态或信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, sort_order, link_type, link_value } = req.body;

    // 如果是要激活Banner，检查是否已有6张激活的
    if (status === 'active') {
      const [currentBanner] = await db.query('SELECT status FROM banners WHERE id = ?', [id]);
      if (currentBanner.length === 0) {
        return res.status(404).json({ success: false, error: 'Banner不存在' });
      }

      // 如果当前Banner不是激活状态，需要检查是否已满6张
      if (currentBanner[0].status !== 'active') {
        const [activeBanners] = await db.query(
          'SELECT COUNT(*) as count FROM banners WHERE status = ? AND id != ?',
          ['active', id]
        );
        if (activeBanners[0].count >= 6) {
          return res.status(400).json({ 
            success: false, 
            error: '最多只能激活6张Banner，请先取消其他Banner的激活状态' 
          });
        }
      }
    }

    const updates = [];
    const values = [];

    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(parseInt(sort_order));
    }
    if (link_type !== undefined) {
      updates.push('link_type = ?');
      values.push(link_type);
    }
    if (link_value !== undefined) {
      updates.push('link_value = ?');
      values.push(link_value);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' });
    }

    values.push(id);
    await db.query(
      `UPDATE banners SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    const [banners] = await db.query('SELECT * FROM banners WHERE id = ?', [id]);
    if (banners.length === 0) {
      return res.status(404).json({ success: false, error: 'Banner不存在' });
    }

    const banner = banners[0];
    banner.image_url = getFullImageUrl(banner.image_url);

    res.json({ success: true, data: banner });
  } catch (error) {
    console.error('更新Banner错误:', error);
    res.status(500).json({ 
      success: false,
      error: '更新失败', 
      details: error.message 
    });
  }
});

// 删除Banner
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 获取Banner信息，以便删除文件
    const [banners] = await db.query('SELECT image_url FROM banners WHERE id = ?', [id]);
    if (banners.length === 0) {
      return res.status(404).json({ success: false, error: 'Banner不存在' });
    }

    // 删除数据库记录
    await db.query('DELETE FROM banners WHERE id = ?', [id]);

    // 尝试删除文件
    const imagePath = banners[0].image_url;
    if (imagePath && !imagePath.startsWith('http')) {
      const fullPath = path.join(__dirname, '..', imagePath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (err) {
          console.error('删除文件失败:', err);
        }
      }
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除Banner错误:', error);
    res.status(500).json({ 
      success: false,
      error: '删除失败', 
      details: error.message 
    });
  }
});

module.exports = router;
