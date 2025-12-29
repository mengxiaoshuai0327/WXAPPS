const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const axios = require('axios');

// 配置 multer 用于海报上传
const posterStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/posters');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'poster-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadPoster = multer({
  storage: posterStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
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
        return res.status(400).json({ success: false, error: '文件大小不能超过 10MB' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    return res.status(400).json({ success: false, error: err.message || '上传失败' });
  }
  next();
};

// 获取完整图片URL
function getFullImageUrl(imageUrl) {
  const port = process.env.PORT || 8080;
  let baseUrl = process.env.BASE_URL || `http://localhost:${port}`;
  
  if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
    baseUrl = baseUrl.replace('https://', 'http://');
  }
  
  if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
    if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
      return imageUrl.replace('https://', 'http://');
    }
    return imageUrl;
  }
  
  return imageUrl ? `${baseUrl}/${imageUrl}` : null;
}

// 获取所有海报模板（小程序使用，只返回激活的）
router.get('/list', async (req, res) => {
  try {
    const [posters] = await db.query(
      'SELECT * FROM posters WHERE status = ? ORDER BY sort_order ASC, created_at DESC',
      ['active']
    );
    
    const postersWithUrl = posters.map(poster => ({
      ...poster,
      image_url: getFullImageUrl(poster.image_url)
    }));
    
    res.json({ success: true, data: postersWithUrl });
  } catch (error) {
    console.error('获取海报列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 管理员：获取所有海报（包括未激活的）
router.get('/admin/list', async (req, res) => {
  try {
    const [posters] = await db.query(
      'SELECT * FROM posters ORDER BY sort_order ASC, created_at DESC'
    );
    
    const postersWithUrl = posters.map(poster => ({
      ...poster,
      image_url: getFullImageUrl(poster.image_url)
    }));
    
    res.json({ success: true, data: postersWithUrl });
  } catch (error) {
    console.error('获取海报列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 管理员：上传海报模板
router.post('/admin/upload', uploadPoster.single('image'), handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请选择要上传的图片' });
    }

    const imagePath = `uploads/posters/${req.file.filename}`;
    const name = req.body.name || `海报模板-${Date.now()}`;
    const qrCodePositionX = req.body.qr_code_position_x ? parseInt(req.body.qr_code_position_x) : 0;
    const qrCodePositionY = req.body.qr_code_position_y ? parseInt(req.body.qr_code_position_y) : 0;
    const qrCodeSize = req.body.qr_code_size ? parseInt(req.body.qr_code_size) : 300;
    const sortOrder = req.body.sort_order ? parseInt(req.body.sort_order) : 0;
    const status = req.body.status || 'active';
    const textContent = req.body.text_content || null;
    const textPositionX = req.body.text_position_x ? parseInt(req.body.text_position_x) : 0;
    const textPositionY = req.body.text_position_y ? parseInt(req.body.text_position_y) : 0;
    const textFontSize = req.body.text_font_size ? parseInt(req.body.text_font_size) : 32;
    const textColor = req.body.text_color || '#000000';
    const textAlign = req.body.text_align || 'left';

    const [result] = await db.query(
      `INSERT INTO posters (name, image_url, qr_code_position_x, qr_code_position_y, qr_code_size, text_content, text_position_x, text_position_y, text_font_size, text_color, text_align, status, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, imagePath, qrCodePositionX, qrCodePositionY, qrCodeSize, textContent, textPositionX, textPositionY, textFontSize, textColor, textAlign, status, sortOrder]
    );

    const [posters] = await db.query('SELECT * FROM posters WHERE id = ?', [result.insertId]);
    const poster = posters[0];
    poster.image_url = getFullImageUrl(poster.image_url);

    res.json({ 
      success: true, 
      message: '上传成功',
      data: poster
    });
  } catch (error) {
    console.error('上传海报错误:', error);
    res.status(500).json({ success: false, error: '上传失败', details: error.message });
  }
});

// 管理员：更新海报信息
router.put('/admin/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, qr_code_position_x, qr_code_position_y, qr_code_size, status, sort_order, text_content, text_position_x, text_position_y, text_font_size, text_color, text_align } = req.body;

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (qr_code_position_x !== undefined) {
      updateFields.push('qr_code_position_x = ?');
      updateValues.push(parseInt(qr_code_position_x));
    }
    if (qr_code_position_y !== undefined) {
      updateFields.push('qr_code_position_y = ?');
      updateValues.push(parseInt(qr_code_position_y));
    }
    if (qr_code_size !== undefined) {
      updateFields.push('qr_code_size = ?');
      updateValues.push(parseInt(qr_code_size));
    }
    if (text_content !== undefined) {
      updateFields.push('text_content = ?');
      updateValues.push(text_content || null);
    }
    if (text_position_x !== undefined) {
      updateFields.push('text_position_x = ?');
      updateValues.push(parseInt(text_position_x));
    }
    if (text_position_y !== undefined) {
      updateFields.push('text_position_y = ?');
      updateValues.push(parseInt(text_position_y));
    }
    if (text_font_size !== undefined) {
      updateFields.push('text_font_size = ?');
      updateValues.push(parseInt(text_font_size));
    }
    if (text_color !== undefined) {
      updateFields.push('text_color = ?');
      updateValues.push(text_color);
    }
    if (text_align !== undefined) {
      updateFields.push('text_align = ?');
      updateValues.push(text_align);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      updateValues.push(parseInt(sort_order));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }

    updateValues.push(id);
    const query = `UPDATE posters SET ${updateFields.join(', ')} WHERE id = ?`;

    await db.query(query, updateValues);

    const [posters] = await db.query('SELECT * FROM posters WHERE id = ?', [id]);
    if (posters.length === 0) {
      return res.status(404).json({ success: false, error: '海报不存在' });
    }

    const poster = posters[0];
    poster.image_url = getFullImageUrl(poster.image_url);

    res.json({ 
      success: true, 
      message: '更新成功',
      data: poster
    });
  } catch (error) {
    console.error('更新海报错误:', error);
    res.status(500).json({ success: false, error: '更新失败', details: error.message });
  }
});

// 管理员：删除海报
router.delete('/admin/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 获取海报信息（用于删除文件）
    const [posters] = await db.query('SELECT * FROM posters WHERE id = ?', [id]);
    if (posters.length === 0) {
      return res.status(404).json({ success: false, error: '海报不存在' });
    }

    const poster = posters[0];

    // 删除数据库记录
    await db.query('DELETE FROM posters WHERE id = ?', [id]);

    // 删除文件
    if (poster.image_url && !poster.image_url.startsWith('http')) {
      const filePath = path.join(__dirname, '../', poster.image_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除海报错误:', error);
    res.status(500).json({ success: false, error: '删除失败', details: error.message });
  }
});

// 生成最终海报（小程序使用）
router.post('/generate', async (req, res) => {
  try {
    const { poster_id, qr_code_url, invite_code } = req.body;

    if (!poster_id || !qr_code_url) {
      return res.status(400).json({ success: false, error: '缺少必要参数：poster_id 和 qr_code_url' });
    }

    // 获取海报模板
    const [posters] = await db.query('SELECT * FROM posters WHERE id = ? AND status = ?', [poster_id, 'active']);
    if (posters.length === 0) {
      return res.status(404).json({ success: false, error: '海报模板不存在或未激活' });
    }

    const poster = posters[0];
    
    // 调试：打印海报数据
    console.log('[生成海报] 海报模板数据:', {
      id: poster.id,
      name: poster.name,
      text_content: poster.text_content,
      text_position_x: poster.text_position_x,
      text_position_y: poster.text_position_y,
      text_font_size: poster.text_font_size,
      text_color: poster.text_color,
      text_align: poster.text_align
    });
    
    const posterImagePath = path.join(__dirname, '../', poster.image_url);

    if (!fs.existsSync(posterImagePath)) {
      return res.status(404).json({ success: false, error: '海报模板图片不存在' });
    }

    // 下载二维码图片
    let qrCodeBuffer;
    try {
      const qrResponse = await axios.get(qr_code_url, { responseType: 'arraybuffer' });
      qrCodeBuffer = Buffer.from(qrResponse.data);
    } catch (error) {
      console.error('下载二维码失败:', error);
      return res.status(400).json({ success: false, error: '下载二维码失败' });
    }

    // 使用sharp合成海报
    const posterImage = sharp(posterImagePath);
    const posterMetadata = await posterImage.metadata();
    
    console.log('[生成海报] 海报图片尺寸:', {
      width: posterMetadata.width,
      height: posterMetadata.height
    });

    // 调整二维码大小
    const qrCodeResized = sharp(qrCodeBuffer)
      .resize(poster.qr_code_size, poster.qr_code_size);

    // 准备合成图像
    const composites = [
      {
        input: await qrCodeResized.toBuffer(),
        left: poster.qr_code_position_x,
        top: poster.qr_code_position_y
      }
    ];

    // 如果有文字内容，添加文字水印（使用SVG）
    if (poster.text_content && poster.text_content.trim()) {
      console.log('[生成海报] 准备添加文字:', {
        content: poster.text_content,
        x: poster.text_position_x,
        y: poster.text_position_y,
        fontSize: poster.text_font_size,
        color: poster.text_color,
        align: poster.text_align,
        imageWidth: posterMetadata.width,
        imageHeight: posterMetadata.height
      });

      // 计算文字X坐标
      let textX;
      if (poster.text_align === 'center') {
        textX = posterMetadata.width / 2;
      } else if (poster.text_align === 'right') {
        // 右对齐：从右边开始计算
        textX = posterMetadata.width - (poster.text_position_x || 0);
        // 确保不超出边界
        if (textX < 0) textX = posterMetadata.width;
      } else {
        // 左对齐：直接使用x坐标
        textX = poster.text_position_x || 0;
        // 确保不超出边界
        if (textX > posterMetadata.width) textX = 0;
      }

      // SVG的text元素的y坐标是基线位置（文字底部）
      // text_position_y是管理员设置的文字顶部位置
      // 所以需要加上字体大小的一部分来定位到文字顶部
      // 通常字体大小的80%左右是基线到顶部的距离
      let textY = poster.text_position_y || 0;
      
      // 边界检查
      if (textY < 0) {
        textY = poster.text_font_size || 32;
      }
      const fontSize = poster.text_font_size || 32;
      if (textY + fontSize > posterMetadata.height) {
        textY = Math.max(0, posterMetadata.height - fontSize);
      }
      
      // 调整Y坐标：SVG的y是基线，需要加上字体大小来定位
      // 使用字体大小的0.8倍作为基线偏移
      const actualTextY = textY + fontSize * 0.8;

      // 转义特殊字符
      const escapedText = poster.text_content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      // 创建文字SVG
      const textSvg = `<svg width="${posterMetadata.width}" height="${posterMetadata.height}" xmlns="http://www.w3.org/2000/svg">
  <text 
    x="${textX}" 
    y="${actualTextY}" 
    font-size="${fontSize}" 
    fill="${poster.text_color || '#000000'}" 
    text-anchor="${poster.text_align === 'center' ? 'middle' : poster.text_align === 'right' ? 'end' : 'start'}"
    font-family="Arial, Helvetica, sans-serif"
    font-weight="bold"
  >${escapedText}</text>
</svg>`;

      console.log('[生成海报] 生成的SVG文字位置:', {
        textX: textX,
        textY: textY,
        actualTextY: actualTextY,
        fontSize: poster.text_font_size,
        color: poster.text_color,
        align: poster.text_align,
        content: poster.text_content,
        svgLength: textSvg.length
      });

      try {
        const svgBuffer = Buffer.from(textSvg);
        
        // 直接添加SVG到合成列表
        composites.push({
          input: svgBuffer,
          left: 0,
          top: 0
        });
        console.log('[生成海报] 文字SVG已添加到合成列表，buffer大小:', svgBuffer.length);
      } catch (svgError) {
        console.error('[生成海报] 添加文字SVG失败:', svgError);
      }
    } else {
      console.log('[生成海报] 没有文字内容或文字为空');
    }

    // 合成图像
    console.log('[生成海报] 开始合成图像，composites数量:', composites.length);
    console.log('[生成海报] composites详情:', composites.map((c, i) => ({
      index: i,
      type: i === 0 ? '二维码' : '文字',
      hasInput: !!c.input,
      inputSize: c.input ? c.input.length : 0,
      left: c.left,
      top: c.top
    })));
    
    const finalImage = await posterImage
      .composite(composites)
      .png()
      .toBuffer();
    
    console.log('[生成海报] 图像合成完成，最终图片大小:', finalImage.length, 'bytes');

    // 保存生成的图片到文件系统
    const outputFileName = `poster-generated-${Date.now()}-${Math.round(Math.random() * 1E9)}.png`;
    const outputPath = path.join(__dirname, '../uploads/posters/generated', outputFileName);
    const outputDir = path.dirname(outputPath);
    
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, finalImage);
    
    // 返回图片URL
    const imageUrl = `uploads/posters/generated/${outputFileName}`;
    res.json({
      success: true,
      data: {
        image_url: getFullImageUrl(imageUrl)
      }
    });
  } catch (error) {
    console.error('生成海报错误:', error);
    res.status(500).json({ success: false, error: '生成海报失败', details: error.message });
  }
});

module.exports = router;

