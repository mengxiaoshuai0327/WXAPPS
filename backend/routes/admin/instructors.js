const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// 生成唯一的教练ID（格式：I + 8位数字）
async function generateInstructorId() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    // 生成8位随机数字
    const randomNum = crypto.randomInt(10000000, 99999999);
    const instructorId = `I${randomNum}`;
    
    // 检查是否已存在
    const [existing] = await db.query(
      'SELECT id FROM users WHERE instructor_id = ?',
      [instructorId]
    );
    
    if (existing.length === 0) {
      return instructorId;
    }
    
    attempts++;
  }
  
  // 如果随机生成失败，使用时间戳作为后备方案
  const timestamp = Date.now().toString().slice(-8);
  return `I${timestamp}`;
}

// 获取教练列表
router.get('/', async (req, res) => {
  try {
    const [instructors] = await db.query(
      `SELECT u.id, u.instructor_id, u.nickname, u.real_name, u.phone, u.avatar_url, 
              u.password, u.role, i.bio, i.background, COALESCE(i.is_popular, 0) as is_popular
       FROM users u
       LEFT JOIN instructors i ON u.id = i.user_id
       WHERE u.role = 'instructor'
       ORDER BY u.created_at DESC`
    );
    
    // 不返回密码明文，只返回是否有密码
    const result = instructors.map(instructor => ({
      ...instructor,
      has_password: !!instructor.password,
      password: instructor.password ? '已设置' : '未设置'
    }));
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取教练列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 创建教练
router.post('/', async (req, res) => {
  try {
    const { nickname, real_name, phone, password, avatar_url, bio, background, is_popular } = req.body;
    
    // 验证必填字段
    if (!nickname && !real_name) {
      return res.status(400).json({ error: '请至少填写昵称或姓名' });
    }
    
    if (!phone) {
      return res.status(400).json({ error: '请输入手机号' });
    }
    
    if (!password) {
      return res.status(400).json({ error: '请设置密码' });
    }
    
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }
    
    // 检查手机号是否已被使用
    const [existingPhone] = await db.query(
      'SELECT id FROM users WHERE phone = ?',
      [phone]
    );
    if (existingPhone.length > 0) {
      return res.status(400).json({ error: '手机号已被使用' });
    }
    
    // 生成唯一的教练ID
    const instructorId = await generateInstructorId();
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建用户（教练）
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // 插入用户（同步到用户列表）
      // 注意：在users表中创建用户记录后，该教练会自动出现在【用户列表】中（role='instructor'）
      const [userResult] = await connection.query(
        `INSERT INTO users (nickname, real_name, phone, password, avatar_url, role, instructor_id, openid)
         VALUES (?, ?, ?, ?, ?, 'instructor', ?, ?)`,
        [nickname || null, real_name || null, phone, hashedPassword, avatar_url || null, instructorId, null]
      );
      
      const userId = userResult.insertId;
      console.log(`[创建教练] 已在users表中创建用户记录: id=${userId}, instructor_id=${instructorId}, role=instructor, 该用户已同步到【用户列表】`);
      
      // 插入教练信息
      await connection.query(
        'INSERT INTO instructors (user_id, bio, background, is_popular) VALUES (?, ?, ?, ?)',
        [userId, bio || '', background || '', req.body.is_popular ? 1 : 0]
      );
      
      await connection.commit();
      console.log(`[创建教练] 教练创建成功: user_id=${userId}, instructor_id=${instructorId}, name=${real_name || nickname}`);
      
      res.json({
        success: true,
        message: '教练创建成功',
        data: {
          id: userId,
          instructor_id: instructorId
        }
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('创建教练错误:', error);
    res.status(500).json({ error: '创建失败', details: error.message });
  }
});

// 更新教练信息
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, real_name, phone, password, avatar_url, bio, background, is_popular } = req.body;
    
    // 检查用户是否存在且为教练
    const [users] = await db.query(
      'SELECT id, role, instructor_id FROM users WHERE id = ?',
      [id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    if (users[0].role !== 'instructor') {
      return res.status(400).json({ error: '该用户不是教练' });
    }
    
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // 更新用户信息
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
          await connection.rollback();
          return res.status(400).json({ error: '手机号格式不正确' });
        }
        // 检查手机号是否已被其他用户使用
        if (phone) {
          const [existing] = await connection.query(
            'SELECT id FROM users WHERE phone = ? AND id != ?',
            [phone, id]
          );
          if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: '手机号已被其他用户使用' });
          }
        }
        updateFields.push('phone = ?');
        updateValues.push(phone);
      }
      if (password !== undefined && password) {
        // 如果提供了新密码，加密后更新
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push('password = ?');
        updateValues.push(hashedPassword);
      }
      if (avatar_url !== undefined) {
        updateFields.push('avatar_url = ?');
        updateValues.push(avatar_url);
      }
      
      // 如果没有instructor_id，自动生成
      if (!users[0].instructor_id) {
        const instructorId = await generateInstructorId();
        updateFields.push('instructor_id = ?');
        updateValues.push(instructorId);
      }
      
      if (updateFields.length > 0) {
        updateValues.push(id);
        await connection.query(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }
      
      // 更新教练信息
      const instructorUpdateFields = [];
      const instructorUpdateValues = [];
      
      if (bio !== undefined) {
        instructorUpdateFields.push('bio = ?');
        instructorUpdateValues.push(bio);
      }
      if (background !== undefined) {
        instructorUpdateFields.push('background = ?');
        instructorUpdateValues.push(background);
      }
      if (is_popular !== undefined) {
        instructorUpdateFields.push('is_popular = ?');
        instructorUpdateValues.push(is_popular ? 1 : 0);
        console.log('[更新教练] is_popular值:', is_popular, '转换后:', is_popular ? 1 : 0);
      }
      
      if (instructorUpdateFields.length > 0) {
        // 检查是否已有教练信息记录
        const [instructors] = await connection.query(
          'SELECT id FROM instructors WHERE user_id = ?',
          [id]
        );
        
        if (instructors.length === 0) {
          // 创建新记录
          await connection.query(
            'INSERT INTO instructors (user_id, bio, background, is_popular) VALUES (?, ?, ?, ?)',
            [id, bio || '', background || '', is_popular ? 1 : 0]
          );
        } else {
          // 更新现有记录
          instructorUpdateValues.push(id);
          await connection.query(
            `UPDATE instructors SET ${instructorUpdateFields.join(', ')} WHERE user_id = ?`,
            instructorUpdateValues
          );
        }
      }
      
      await connection.commit();
      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('更新教练信息错误:', error);
    console.error('错误堆栈:', error.stack);
    console.error('请求参数:', req.body);
    res.status(500).json({ error: '更新失败', details: error.message });
  }
});

module.exports = router;

