const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置 multer 用于头像上传
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/avatars');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 8 * 1024 * 1024 // 8MB
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

// 错误处理中间件（用于处理 multer 错误）
const handleUploadError = (err, req, res, next) => {
  if (err) {
    console.error('上传错误:', err);
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: '文件大小不能超过 8MB' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    // 处理文件类型错误
    return res.status(400).json({ success: false, error: err.message || '上传失败' });
  }
  next();
};

// 上传头像（必须在 /:id 路由之前）
router.post('/upload-avatar', uploadAvatar.single('avatar'), handleUploadError, async (req, res) => {
  try {
    console.log('收到头像上传请求');
    console.log('文件信息:', req.file);
    console.log('请求体:', req.body);
    
    if (!req.file) {
      console.error('未收到文件');
      return res.status(400).json({ error: '请选择要上传的头像', success: false });
    }

    const avatarPath = `uploads/avatars/${req.file.filename}`;
    // 使用环境变量或根据请求头动态获取
    let baseUrl = process.env.BASE_URL;
    if (!baseUrl) {
      // 从请求头获取协议和主机
      const protocol = req.protocol || 'http';
      const port = process.env.PORT || 3000;
      const host = req.get('host') || `localhost:${port}`;
      baseUrl = `${protocol}://${host}`;
    }
    const avatarUrl = `${baseUrl}/${avatarPath}`;

    console.log('头像上传成功:', avatarUrl);

    res.json({
      success: true,
      data: {
        avatar_url: avatarUrl
      }
    });
  } catch (error) {
    console.error('上传头像错误:', error);
    res.status(500).json({ 
      success: false,
      error: '上传失败', 
      details: error.message 
    });
  }
});

// 获取用户信息（必须在 /upload-avatar 之后）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];
    
    // 解析JSON字段
    if (user.member_profile && typeof user.member_profile === 'string') {
      try {
        user.member_profile = JSON.parse(user.member_profile);
      } catch (e) {
        console.warn('解析member_profile JSON失败:', e);
        user.member_profile = null;
      }
    }
    if (user.ability_assessment && typeof user.ability_assessment === 'string') {
      try {
        user.ability_assessment = JSON.parse(user.ability_assessment);
      } catch (e) {
        console.warn('解析ability_assessment JSON失败:', e);
        user.ability_assessment = null;
      }
    }
    
    // 如果是教练，获取教练信息
    if (user.role === 'instructor') {
      const [instructors] = await db.query('SELECT * FROM instructors WHERE user_id = ?', [id]);
      const instructorInfo = instructors[0] || null;
      if (instructorInfo) {
        // 为了兼容前端，将 bio 映射为 course_introduction
        user.instructor_info = {
          ...instructorInfo,
          course_introduction: instructorInfo.bio || ''
        };
      } else {
        user.instructor_info = null;
      }
    }
    
    // 如果是渠道销售（role='member'且channel_user_id不为NULL），获取渠道方信息
    if (user.role === 'member' && user.channel_user_id) {
      const [channels] = await db.query('SELECT channel_name, channel_code, id FROM channels WHERE id = ?', [user.channel_user_id]);
      if (channels.length > 0) {
        user.channel_partner_name = channels[0].channel_name;
        user.channel_partner_code = channels[0].channel_code;
        user.is_channel_sales = true;
      }
    }

    // 获取邀请统计（基于折扣券列表中的实际折扣券来源）
    // 统计注册奖励折扣券数量
    const [registerCoupons] = await db.query(
      `SELECT COUNT(*) as count 
       FROM discount_coupons 
       WHERE user_id = ? AND source = 'invite_register'`,
      [id]
    );
    
    // 统计购券奖励折扣券数量
    const [purchaseCoupons] = await db.query(
      `SELECT COUNT(*) as count 
       FROM discount_coupons 
       WHERE user_id = ? AND source = 'invite_purchase'`,
      [id]
    );
    
    // 统计总邀请人数（去重后的被邀请人数）
    const [totalInvited] = await db.query(
      `SELECT COUNT(DISTINCT source_user_id) as count 
       FROM discount_coupons 
       WHERE user_id = ? AND source IN ('invite_register', 'invite_purchase')`,
      [id]
    );

    user.invite_stats = {
      total: totalInvited[0]?.count || 0,
      registered: registerCoupons[0]?.count || 0,
      purchased: purchaseCoupons[0]?.count || 0
    };

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});


// 获取热门教练列表（公共API，无需登录）
router.get('/instructors/popular', async (req, res) => {
  try {
    const { limit = 6 } = req.query;
    
    // 获取热门教练：只返回is_popular=1的教练，按课程数量、评价数量排序
    const [instructors] = await db.query(
      `SELECT 
        u.id,
        u.instructor_id,
        u.nickname,
        u.real_name,
        u.avatar_url,
        i.background,
        (SELECT COUNT(*) FROM courses WHERE instructor_id = u.id) as course_count,
        (SELECT COUNT(*) FROM evaluations e
         JOIN courses c ON e.course_id = c.id 
         WHERE c.instructor_id = u.id) as evaluation_count
       FROM users u
       LEFT JOIN instructors i ON u.id = i.user_id
       WHERE u.role = 'instructor' AND COALESCE(i.is_popular, 0) = 1
       ORDER BY course_count DESC, evaluation_count DESC
       LIMIT ?`,
      [parseInt(limit)]
    );
    
    // 格式化返回数据
    const result = instructors.map(instructor => ({
      id: instructor.id,
      instructor_id: instructor.instructor_id,
      nickname: instructor.nickname,
      real_name: instructor.real_name,
      avatar_url: instructor.avatar_url,
      background: instructor.background || '',
      course_count: instructor.course_count || 0,
      evaluation_count: instructor.evaluation_count || 0,
      display_name: instructor.nickname || instructor.real_name || '教练'
    }));
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取热门教练错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 更新教练信息（必须在 /:id PUT 之前）
router.put('/instructor/profile', async (req, res) => {
  try {
    const { user_id, bio, background } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: '缺少用户ID' });
    }

    // 验证用户是否为教练
    const [users] = await db.query('SELECT role FROM users WHERE id = ?', [user_id]);
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    if (users[0].role !== 'instructor') {
      return res.status(403).json({ error: '只有教练才能更新此信息' });
    }

    // 检查是否已有教练信息记录
    const [instructors] = await db.query('SELECT id FROM instructors WHERE user_id = ?', [user_id]);
    
    if (instructors.length === 0) {
      // 创建新记录
      await db.query(
        'INSERT INTO instructors (user_id, bio, background) VALUES (?, ?, ?)',
        [user_id, bio || '', background || '']
      );
    } else {
      // 更新现有记录
      const updateFields = [];
      const updateValues = [];

      if (bio !== undefined) {
        updateFields.push('bio = ?');
        updateValues.push(bio);
      }
      if (background !== undefined) {
        updateFields.push('background = ?');
        updateValues.push(background);
      }

      if (updateFields.length > 0) {
        updateValues.push(user_id);
        await db.query(
          `UPDATE instructors SET ${updateFields.join(', ')} WHERE user_id = ?`,
          updateValues
        );
      }
    }

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新教练信息错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

// 更新用户信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, real_name, phone, avatar_url, role, member_profile, ability_assessment } = req.body;

    // 构建更新字段
    const updateFields = [];
    const updateValues = [];

    if (nickname !== undefined) {
      updateFields.push('nickname = ?');
      updateValues.push(nickname);
    }
    if (real_name !== undefined) {
      updateFields.push('real_name = ?');
      updateValues.push(real_name);
    }
    if (phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (avatar_url !== undefined) {
      updateFields.push('avatar_url = ?');
      updateValues.push(avatar_url);
    }
    if (role !== undefined) {
      // 验证角色值
      const validRoles = ['visitor', 'member', 'instructor'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: '无效的角色值' });
      }
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (member_profile !== undefined) {
      // 如果是对象，转换为JSON字符串
      const profileJson = typeof member_profile === 'string' 
        ? member_profile 
        : JSON.stringify(member_profile);
      updateFields.push('member_profile = ?');
      updateValues.push(profileJson);
    }
    if (ability_assessment !== undefined) {
      // 如果是对象，转换为JSON字符串
      const assessmentJson = typeof ability_assessment === 'string'
        ? ability_assessment
        : JSON.stringify(ability_assessment);
      updateFields.push('ability_assessment = ?');
      updateValues.push(assessmentJson);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updateValues.push(id);
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    
    await db.query(query, updateValues);

    res.json({ success: true });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

module.exports = router;

