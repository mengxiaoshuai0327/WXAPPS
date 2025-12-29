const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { moment } = require('../../utils/dateHelper');

// 生成唯一的会员ID（格式：M + 8位数字）
async function generateMemberId() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    // 生成8位随机数字
    const randomNum = crypto.randomInt(10000000, 99999999);
    const memberId = `M${randomNum}`;
    
    // 检查是否已存在
    const [existing] = await db.query(
      'SELECT id FROM users WHERE member_id = ?',
      [memberId]
    );
    
    if (existing.length === 0) {
      return memberId;
    }
    
    attempts++;
  }
  
  // 如果随机生成失败，使用时间戳作为后备方案
  const timestamp = Date.now().toString().slice(-8);
  return `M${timestamp}`;
}

// 获取渠道销售列表
router.get('/', async (req, res) => {
  try {
    const { channel_user_id, keyword, page = 1, pageSize = 20 } = req.query;
    
    let query = `
      SELECT u.id, u.member_id, u.nickname, u.real_name, u.phone, u.avatar_url, 
             u.password, u.channel_user_id, u.created_at,
             c.channel_code,
             c.channel_name,
             c.id as channel_table_id
      FROM users u
      LEFT JOIN channels c ON u.channel_user_id = c.id
      WHERE u.role = 'member' AND u.channel_user_id IS NOT NULL
    `;
    const params = [];
    
    // 按渠道方筛选
    if (channel_user_id) {
      query += ' AND u.channel_user_id = ?';
      params.push(channel_user_id);
    }
    
    // 关键词搜索（会员ID、昵称、手机号）
    if (keyword) {
      query += ' AND (u.member_id LIKE ? OR u.nickname LIKE ? OR u.real_name LIKE ? OR u.phone LIKE ?)';
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern);
    }
    
    // 获取总数
    let countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countQueryMatch = countQuery.match(/ORDER BY.*/);
    if (countQueryMatch) {
      countQuery = countQuery.replace(/ORDER BY.*/, '');
    }
    const [countResult] = await db.query(countQuery, params);
    const total = countResult[0]?.total || 0;
    
    // 分页
    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    const [sales] = await db.query(query, params);
    
    // 不返回密码明文，只返回是否有密码，并生成渠道方ID
    const result = sales.map(sale => {
      // 生成渠道方ID（从channel_code提取或使用id）
      let channelId = null;
      if (sale.channel_code) {
        // 尝试从channel_code中提取数字（例如：channel_113379 -> CH113379）
        const match = sale.channel_code.match(/\d+/);
        if (match) {
          channelId = `CH${match[0]}`;
        }
      }
      // 如果无法从channel_code提取，使用默认格式
      if (!channelId && sale.channel_table_id) {
        channelId = `CH${String(sale.channel_table_id).padStart(8, '0')}`;
      }
      
      // 格式化创建时间为北京时间
      let created_at_formatted = null;
      if (sale.created_at) {
        created_at_formatted = moment(sale.created_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      }
      
      return {
        ...sale,
        has_password: !!sale.password,
        password: sale.password ? '已设置' : '未设置',
        channel_name: sale.channel_name || '未知渠道',
        channel_code: sale.channel_code || null,
        channel_id: channelId,
        created_at: created_at_formatted || sale.created_at
      };
    });
    
    res.json({
      success: true,
      data: result,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取渠道销售列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 获取单个渠道销售详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [sales] = await db.query(
      `SELECT u.*, 
              c.channel_code,
              c.channel_name,
              c.id as channel_table_id
       FROM users u
       LEFT JOIN channels c ON u.channel_user_id = c.id
       WHERE u.id = ? AND u.role = 'member' AND u.channel_user_id IS NOT NULL`,
      [id]
    );
    
    if (sales.length === 0) {
      return res.status(404).json({ success: false, error: '渠道销售不存在' });
    }
    
    const sale = sales[0];
    // 不返回密码
    delete sale.password;
    
    // 生成渠道方ID（从channel_code提取或使用id）
    let channelId = null;
    if (sale.channel_code) {
      const match = sale.channel_code.match(/\d+/);
      if (match) {
        channelId = `CH${match[0]}`;
      }
    }
    if (!channelId && sale.channel_table_id) {
      channelId = `CH${String(sale.channel_table_id).padStart(8, '0')}`;
    }
    
    sale.channel_id = channelId;
    
    res.json({ success: true, data: sale });
  } catch (error) {
    console.error('获取渠道销售详情错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 创建渠道销售
router.post('/', async (req, res) => {
  try {
    const { nickname, real_name, phone, password, avatar_url, channel_user_id } = req.body;
    
    // 验证必填字段
    if (!phone) {
      return res.status(400).json({ success: false, error: '请输入手机号' });
    }
    
    if (!password) {
      return res.status(400).json({ success: false, error: '请设置密码' });
    }
    
    if (!channel_user_id) {
      return res.status(400).json({ success: false, error: '请选择所属渠道方' });
    }
    
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, error: '手机号格式不正确' });
    }
    
    // 检查手机号是否已被使用
    const [existingPhone] = await db.query(
      'SELECT id FROM users WHERE phone = ?',
      [phone]
    );
    if (existingPhone.length > 0) {
      return res.status(400).json({ success: false, error: '手机号已被使用' });
    }
    
    // 验证渠道方是否存在（从channels表查询，因为渠道方不再创建用户记录）
    const [channels] = await db.query(
      'SELECT id FROM channels WHERE id = ?',
      [channel_user_id]
    );
    if (channels.length === 0) {
      return res.status(400).json({ success: false, error: '指定的渠道方不存在或不是有效的渠道方' });
    }
    
    // 生成唯一的会员ID
    const memberId = await generateMemberId();
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建渠道销售（角色为member，但关联到渠道方）
    // 注意：在users表中创建用户记录后，该渠道销售会自动出现在【用户列表】中（role='member', channel_user_id不为NULL）
    const [result] = await db.query(
      `INSERT INTO users (nickname, real_name, phone, password, role, member_id, channel_user_id, avatar_url) 
       VALUES (?, ?, ?, ?, 'member', ?, ?, ?)`,
      [nickname || null, real_name || null, phone, hashedPassword, memberId, channel_user_id, avatar_url || null]
    );
    
    const userId = result.insertId;
    console.log(`[创建渠道销售] 已在users表中创建用户记录: id=${userId}, member_id=${memberId}, role=member, channel_user_id=${channel_user_id}, 该用户已同步到【用户列表】`);
    console.log(`[创建渠道销售] 渠道销售创建成功: user_id=${userId}, member_id=${memberId}, name=${real_name || nickname}, channel_user_id=${channel_user_id}`);
    
    res.json({
      success: true,
      message: '创建成功',
      data: { id: userId, member_id: memberId }
    });
  } catch (error) {
    console.error('创建渠道销售错误:', error);
    res.status(500).json({ success: false, error: '创建失败', details: error.message });
  }
});

// 更新渠道销售
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, real_name, phone, password, avatar_url, channel_user_id } = req.body;
    
    // 验证渠道销售是否存在
    const [sales] = await db.query(
      'SELECT id, role, channel_user_id FROM users WHERE id = ? AND role = ? AND channel_user_id IS NOT NULL',
      [id, 'member']
    );
    
    if (sales.length === 0) {
      return res.status(404).json({ success: false, error: '渠道销售不存在' });
    }
    
    // 如果更新渠道方，验证渠道方是否存在（从channels表查询）
    if (channel_user_id !== undefined && channel_user_id !== sales[0].channel_user_id) {
      const [channels] = await db.query(
        'SELECT id FROM channels WHERE id = ?',
        [channel_user_id]
      );
      if (channels.length === 0) {
        return res.status(400).json({ success: false, error: '指定的渠道方不存在或不是有效的渠道方' });
      }
    }
    
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
      // 验证手机号格式
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ success: false, error: '手机号格式不正确' });
      }
      // 检查手机号是否已被其他用户使用
      if (phone) {
        const [existing] = await db.query(
          'SELECT id FROM users WHERE phone = ? AND id != ?',
          [phone, id]
        );
        if (existing.length > 0) {
          return res.status(400).json({ success: false, error: '手机号已被其他用户使用' });
        }
      }
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (avatar_url !== undefined) {
      updateFields.push('avatar_url = ?');
      updateValues.push(avatar_url);
    }
    if (channel_user_id !== undefined) {
      updateFields.push('channel_user_id = ?');
      updateValues.push(channel_user_id);
    }
    if (password !== undefined && password !== '') {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }
    
    updateValues.push(id);
    await db.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新渠道销售错误:', error);
    res.status(500).json({ success: false, error: '更新失败', details: error.message });
  }
});

// 删除渠道销售
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证渠道销售是否存在
    const [sales] = await db.query(
      'SELECT id FROM users WHERE id = ? AND role = ? AND channel_user_id IS NOT NULL',
      [id, 'member']
    );
    
    if (sales.length === 0) {
      return res.status(404).json({ success: false, error: '渠道销售不存在' });
    }
    
    // 删除渠道销售（注意：由于外键约束，可能需要先处理相关数据）
    await db.query('DELETE FROM users WHERE id = ?', [id]);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除渠道销售错误:', error);
    res.status(500).json({ success: false, error: '删除失败', details: error.message });
  }
});

module.exports = router;

