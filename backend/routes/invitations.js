const express = require('express');
const router = express.Router();
const db = require('../config/database');
const QRCode = require('qrcode');

// 创建邀请
router.post('/create', async (req, res) => {
  try {
    const { inviter_id, course_id, custom_message } = req.body;

    // 获取用户信息（会员ID和教练ID）
    const [users] = await db.query('SELECT member_id, instructor_id, role FROM users WHERE id = ?', [inviter_id]);
    if (users.length === 0) {
      return res.status(400).json({ error: '用户不存在' });
    }

    const user = users[0];
    const userRole = user.role;

    // 检查用户角色（会员或教练都可以邀请）
    if (userRole !== 'member' && userRole !== 'instructor') {
      return res.status(400).json({ error: '只有会员和教练可以邀请好友' });
    }

    // 根据角色选择邀请码：会员使用 member_id，教练使用 instructor_id
    let invite_code = null;
    if (userRole === 'instructor') {
      if (!user.instructor_id) {
        return res.status(400).json({ error: '教练编码不存在，无法创建邀请' });
      }
      invite_code = user.instructor_id;
    } else if (userRole === 'member') {
      if (!user.member_id) {
        return res.status(400).json({ error: '会员编码不存在，无法创建邀请' });
      }
      invite_code = user.member_id;
    }

    // 获取课程信息（如果有）
    let course_info = null;
    if (course_id) {
      const [courses] = await db.query(
        `SELECT c.title, c.subtitle, u.nickname as instructor_name 
         FROM courses c 
         JOIN users u ON c.instructor_id = u.id 
         WHERE c.id = ?`,
        [course_id]
      );
      course_info = courses[0];
    }

    res.json({ 
      success: true, 
      invite_code,
      course_info,
      custom_message 
    });
  } catch (error) {
    console.error('创建邀请错误:', error);
    res.status(500).json({ error: '创建失败', details: error.message });
  }
});

// 获取邀请列表
router.get('/list', async (req, res) => {
  try {
    const { inviter_id, invitee_id, status } = req.query;
    let query = `
      SELECT i.*, 
             u1.nickname as inviter_nickname,
             u2.nickname as invitee_nickname,
             u2.member_id as invitee_member_id
      FROM invitations i
      LEFT JOIN users u1 ON i.inviter_id = u1.id
      LEFT JOIN users u2 ON i.invitee_id = u2.id
      WHERE 1=1
    `;
    const params = [];

    if (inviter_id) {
      query += ' AND i.inviter_id = ?';
      params.push(inviter_id);
    }

    if (invitee_id) {
      query += ' AND i.invitee_id = ?';
      params.push(invitee_id);
    }

    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }

    query += ' ORDER BY i.created_at DESC';

    const [invitations] = await db.query(query, params);
    res.json({ success: true, data: invitations });
  } catch (error) {
    console.error('获取邀请列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 获取邀请统计信息
router.get('/stats', async (req, res) => {
  try {
    const { inviter_id } = req.query;
    
    let query = `
      SELECT 
        COUNT(*) as total_invitations,
        COUNT(CASE WHEN status = 'registered' THEN 1 END) as registered_count,
        COUNT(CASE WHEN status = 'purchased' THEN 1 END) as purchased_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count
      FROM invitations
      WHERE 1=1
    `;
    const params = [];

    if (inviter_id) {
      query += ' AND inviter_id = ?';
      params.push(inviter_id);
    }

    const [stats] = await db.query(query, params);

    res.json({
      success: true,
      data: stats[0] || {
        total_invitations: 0,
        registered_count: 0,
        purchased_count: 0,
        pending_count: 0
      }
    });
  } catch (error) {
    console.error('获取邀请统计错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 生成邀请二维码
router.get('/qrcode/:inviteCode', async (req, res) => {
  try {
    const { inviteCode } = req.params;
    
    if (!inviteCode) {
      return res.status(400).json({ error: '邀请码不能为空' });
    }

    // 生成小程序路径，包含邀请码参数
    // 格式：pages/register/register?invite_code=XXX
    const miniProgramPath = `pages/register/register?invite_code=${inviteCode}`;
    
    // 生成二维码图片（PNG格式，base64编码）
    const qrCodeDataURL = await QRCode.toDataURL(miniProgramPath, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // 将base64数据URL转换为Buffer
    const base64Data = qrCodeDataURL.replace(/^data:image\/png;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // 设置响应头
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=3600' // 缓存1小时
    });

    // 返回图片
    res.send(imageBuffer);
  } catch (error) {
    console.error('生成二维码错误:', error);
    res.status(500).json({ error: '生成二维码失败', details: error.message });
  }
});

module.exports = router;

