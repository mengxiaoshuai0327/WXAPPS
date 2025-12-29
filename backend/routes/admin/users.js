const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { moment } = require('../../utils/dateHelper');

// 获取用户列表
router.get('/', async (req, res) => {
  try {
    const { role, keyword, page = 1, pageSize = 20 } = req.query;
    
    let query = `
      SELECT u.*, 
             u.member_profile,
             u.ability_assessment,
             (SELECT COUNT(*) FROM course_bookings WHERE user_id = u.id) as booking_count,
             (SELECT COUNT(*) FROM tickets WHERE user_id = u.id) as ticket_count,
             u_inviter.real_name as inviter_real_name,
             u_inviter.nickname as inviter_nickname,
             u_inviter.member_id as inviter_member_id,
             u_inviter.instructor_id as inviter_instructor_id,
             u_inviter.channel_id as inviter_channel_id,
             u_inviter.role as inviter_role,
             u_inviter.channel_user_id as inviter_channel_user_id,
             c.channel_name as channel_partner_name,
             c.channel_code as channel_partner_code,
             c.id as channel_table_id
      FROM users u
      LEFT JOIN users u_inviter ON u.inviter_id = u_inviter.id
      LEFT JOIN channels c ON u.channel_user_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // 角色筛选
    if (role && role !== 'all') {
      query += ' AND u.role = ?';
      params.push(role);
    }

    // 关键词搜索（昵称、姓名、机构/公司、手机号、会员ID、教练ID、渠道方ID）
    if (keyword) {
      query += ' AND (u.nickname LIKE ? OR u.real_name LIKE ? OR u.company LIKE ? OR u.phone LIKE ? OR u.member_id LIKE ? OR u.instructor_id LIKE ? OR u.channel_id LIKE ?)';
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern, keywordPattern, keywordPattern, keywordPattern, keywordPattern);
    }

    // 获取总数
    const countQuery = query.replace(/SELECT u\.\*.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await db.query(countQuery, params);
    const total = countResult && countResult.length > 0 ? countResult[0].total : 0;

    // 分页
    query += ' ORDER BY u.created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [users] = await db.query(query, params);

    // 调试：输出查询结果中的关键字段（仅前5条）
    if (users.length > 0) {
      console.log('[用户列表API] 查询结果示例（第一条）:');
      const sample = users[0];
      console.log(`  inviter_id: ${sample.inviter_id}`);
      console.log(`  inviter_role: ${sample.inviter_role}`);
      console.log(`  inviter_member_id: ${sample.inviter_member_id}`);
      console.log(`  inviter_channel_user_id: ${sample.inviter_channel_user_id} (type: ${typeof sample.inviter_channel_user_id})`);
      if (sample.inviter_member_id && (sample.inviter_member_id === 'M85101163' || sample.inviter_member_id === 'M96143951')) {
        console.log(`  ⚠️  发现目标用户 ${sample.inviter_member_id}，channel_user_id=${sample.inviter_channel_user_id}`);
      }
    }

    // 处理用户数据，添加邀请相关信息
    const processedUsers = users.map((user, index) => {
      const result = { ...user };
      
      // 解析JSON字段
      if (user.member_profile) {
        if (typeof user.member_profile === 'string') {
          try {
            result.member_profile = JSON.parse(user.member_profile);
          } catch (e) {
            console.warn(`解析用户 ${user.id} 的member_profile JSON失败:`, e);
            result.member_profile = {};
          }
        } else if (typeof user.member_profile === 'object' && user.member_profile !== null) {
          result.member_profile = user.member_profile;
        } else {
          result.member_profile = {};
        }
      } else {
        result.member_profile = {};
      }
      
      if (user.ability_assessment) {
        if (typeof user.ability_assessment === 'string') {
          try {
            result.ability_assessment = JSON.parse(user.ability_assessment);
          } catch (e) {
            console.warn(`解析用户 ${user.id} 的ability_assessment JSON失败:`, e);
            result.ability_assessment = {};
          }
        } else if (typeof user.ability_assessment === 'object' && user.ability_assessment !== null) {
          result.ability_assessment = user.ability_assessment;
        } else {
          result.ability_assessment = {};
        }
      } else {
        result.ability_assessment = {};
      }
      
      // 判断是否为渠道销售（role='member'且channel_user_id不为NULL）
      result.is_channel_sales = user.role === 'member' && !!user.channel_user_id;
      
      // 如果是渠道销售，设置机构/公司为渠道方名称和ID
      if (result.is_channel_sales && user.channel_partner_name) {
        // 生成渠道方ID（从channel_code提取或使用id）
        let channelId = null;
        if (user.channel_partner_code) {
          // 尝试从channel_code中提取数字（例如：channel_113379 -> CH113379）
          const match = user.channel_partner_code.match(/\d+/);
          if (match) {
            channelId = `CH${match[0]}`;
          }
        }
        // 如果无法从channel_code提取，使用默认格式
        if (!channelId && user.channel_table_id) {
          channelId = `CH${String(user.channel_table_id).padStart(8, '0')}`;
        }
        
        const channelDisplay = channelId 
          ? `${user.channel_partner_name} (${channelId})`
          : user.channel_partner_name;
        result.company = channelDisplay;
      }
      
      // 是否他人邀请
      result.is_invited = !!user.inviter_id;
      
      // 邀请人编码（根据邀请人角色决定使用member_id、instructor_id还是channel_id）
      if (user.inviter_id) {
        if (user.inviter_role === 'instructor' && user.inviter_instructor_id) {
          result.inviter_code = user.inviter_instructor_id;
        } else if (user.inviter_role === 'channel' && user.inviter_channel_id) {
          result.inviter_code = user.inviter_channel_id;
        } else if (user.inviter_member_id) {
          result.inviter_code = user.inviter_member_id;
        } else {
          result.inviter_code = null;
        }
      } else {
        result.inviter_code = null;
      }
      
      // 邀请人姓名（优先使用real_name，如果没有则使用nickname）
      if (user.inviter_id) {
        result.inviter_name = user.inviter_real_name || user.inviter_nickname || null;
      } else {
        result.inviter_name = null;
      }
      
      // 邀请人角色（如果是渠道销售，显示为渠道方）
      if (user.inviter_id) {
        // 判断邀请人是否为渠道销售（role='member' 且 channel_user_id 不为空）
        // channel_user_id 是数字类型（指向channels.id），需要检查是否为有效的非零数字
        const inviterChannelUserId = user.inviter_channel_user_id;
        // 检查是否为有效的渠道销售：role='member' 且 channel_user_id 不为null且大于0
        // 处理可能的字符串、数字或null值，使用更简单的判断
        const channelUserIdNum = Number(inviterChannelUserId);
        const hasChannelUserId = inviterChannelUserId != null && 
                                 inviterChannelUserId !== '' && 
                                 !isNaN(channelUserIdNum) &&
                                 channelUserIdNum > 0;
        const isInviterChannelSales = user.inviter_role === 'member' && hasChannelUserId;
        
        // 调试日志：输出邀请人信息（对于财销一和联想1）
        if (user.inviter_member_id && (user.inviter_member_id === 'M85101163' || user.inviter_member_id === 'M96143951')) {
          console.log(`[用户列表] 邀请人信息调试 - 用户ID: ${user.id}, member_id: ${user.inviter_member_id}, role: ${user.inviter_role}, channel_user_id: ${inviterChannelUserId} (${typeof inviterChannelUserId}), channelUserIdNum: ${channelUserIdNum}, hasChannelUserId: ${hasChannelUserId}, isChannelSales: ${isInviterChannelSales}`);
          console.log(`[用户列表] 判断结果 - isInviterChannelSales: ${isInviterChannelSales}, 将设置 inviter_role: ${isInviterChannelSales ? 'channel' : user.inviter_role}, inviter_role_text: ${isInviterChannelSales ? '渠道方' : '会员'}`);
        }
        
        // 优先判断渠道销售（必须在判断 member 之前）
        if (isInviterChannelSales) {
          // 渠道销售，显示为渠道方
          result.inviter_role = 'channel';
          result.inviter_role_text = '渠道方';
          // 确保设置了正确的值
          if (user.inviter_member_id && (user.inviter_member_id === 'M85101163' || user.inviter_member_id === 'M96143951')) {
            console.log(`[用户列表] ✓ 已设置渠道方角色: 用户ID=${user.id}, inviter_role=${result.inviter_role}, inviter_role_text=${result.inviter_role_text}`);
          }
        } else if (user.inviter_role === 'instructor') {
          result.inviter_role = 'instructor';
          result.inviter_role_text = '教练';
        } else if (user.inviter_role === 'member') {
          result.inviter_role = 'member';
          result.inviter_role_text = '会员';
        } else {
          result.inviter_role = user.inviter_role || null;
          result.inviter_role_text = user.inviter_role || null;
        }
      } else {
        result.inviter_role = null;
        result.inviter_role_text = null;
      }
      
      // 格式化注册时间为北京时间
      if (user.created_at) {
        result.created_at = moment(user.created_at).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss');
      } else {
        result.created_at = null;
      }
      
      return result;
    });

    res.json({
      success: true,
      data: processedUsers,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 更新用户信息（必须在 GET /:id 之前，避免路由冲突）
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nickname, real_name, company, phone, role, member_id } = req.body;

    // 检查用户是否存在
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
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
    if (company !== undefined) {
      updateFields.push('company = ?');
      updateValues.push(company);
    }
    if (phone !== undefined) {
      // 验证手机号格式
      if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
        return res.status(400).json({ error: '手机号格式不正确' });
      }
      // 检查手机号是否已被其他用户使用
      if (phone) {
        const [existing] = await db.query('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, id]);
        if (existing.length > 0) {
          return res.status(400).json({ error: '手机号已被其他用户使用' });
        }
      }
      updateFields.push('phone = ?');
      updateValues.push(phone);
    }
    if (role !== undefined) {
      // 验证角色值
      const validRoles = ['visitor', 'member', 'instructor'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: '无效的角色值' });
      }
      updateFields.push('role = ?');
      updateValues.push(role);
      
      // 如果切换为教练，确保有教练信息记录
      if (role === 'instructor') {
        const [instructors] = await db.query('SELECT * FROM instructors WHERE user_id = ?', [id]);
        if (instructors.length === 0) {
          await db.query(
            'INSERT INTO instructors (user_id, bio, background) VALUES (?, ?, ?)',
            [id, '教练简介', '教练背景介绍']
          );
        }
      }
    }
    if (member_id !== undefined) {
      // 检查会员ID是否已被其他用户使用
      if (member_id) {
        const [existing] = await db.query('SELECT id FROM users WHERE member_id = ? AND id != ?', [member_id, id]);
        if (existing.length > 0) {
          return res.status(400).json({ error: '会员ID已被其他用户使用' });
        }
      }
      updateFields.push('member_id = ?');
      updateValues.push(member_id);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    updateValues.push(id);
    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    
    console.log('更新用户SQL:', query);
    console.log('更新参数:', updateValues);
    
    await db.query(query, updateValues);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ 
      success: false,
      error: '更新失败', 
      details: error.message 
    });
  }
});

// 获取用户详情（必须在 PUT /:id 和 DELETE /:id 之后）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];

    // 获取相关统计信息
    const [bookings] = await db.query(
      'SELECT COUNT(*) as count FROM course_bookings WHERE user_id = ?',
      [id]
    );
    const [tickets] = await db.query(
      'SELECT COUNT(*) as count FROM tickets WHERE user_id = ?',
      [id]
    );
    const [invitations] = await db.query(
      'SELECT COUNT(*) as count FROM invitations WHERE inviter_id = ?',
      [id]
    );

    user.stats = {
      bookings: bookings[0].count,
      tickets: tickets[0].count,
      invitations: invitations[0].count
    };

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('获取用户详情错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

// 删除用户
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 检查用户是否存在
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = users[0];

    // 检查是否是教练
    if (user.role === 'instructor') {
      // 检查是否有课程
      const [courses] = await db.query('SELECT COUNT(*) as count FROM courses WHERE instructor_id = ?', [id]);
      if (courses[0].count > 0) {
        return res.status(400).json({ error: '该用户是教练且有关联课程，无法删除。请先删除或转移相关课程。' });
      }
    }

    // 开始事务删除用户及相关数据
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // 1. 删除预订记录（释放课券）
      const [bookings] = await connection.query('SELECT ticket_id FROM course_bookings WHERE user_id = ? AND status = ?', [id, 'booked']);
      if (bookings.length > 0) {
        const ticketIds = bookings.map(b => b.ticket_id).filter(tid => tid !== null);
        if (ticketIds.length > 0) {
          await connection.query(
            `UPDATE tickets SET status = 'unused' WHERE id IN (${ticketIds.map(() => '?').join(',')})`,
            ticketIds
          );
        }
      }

      // 2. 删除预订记录
      await connection.query('DELETE FROM course_bookings WHERE user_id = ?', [id]);

      // 3. 删除课券记录
      await connection.query('DELETE FROM tickets WHERE user_id = ?', [id]);

      // 4. 删除评价记录
      // 先删除评价评论（有两种可能：用户创建的评论，以及用户评价下的评论）
      try {
        // 删除用户评价下的评论
        await connection.query(`
          DELETE ec FROM evaluation_comments ec
          INNER JOIN evaluations e ON ec.evaluation_id = e.id
          WHERE e.user_id = ?
        `, [id]);
      } catch (err) {
        // 如果表不存在，忽略错误
        if (err.code !== 'ER_NO_SUCH_TABLE') {
          console.warn('删除评价评论时出错:', err.message);
        }
      }
      
      try {
        // 删除用户创建的评论
        await connection.query('DELETE FROM evaluation_comments WHERE user_id = ?', [id]);
      } catch (err) {
        // 如果表不存在，忽略错误
        if (err.code !== 'ER_NO_SUCH_TABLE') {
          console.warn('删除用户评论时出错:', err.message);
        }
      }
      
      // 然后删除评价记录（表名是 evaluations）
      try {
        await connection.query('DELETE FROM evaluations WHERE user_id = ?', [id]);
      } catch (err) {
        // 如果 evaluations 表不存在，忽略错误（可能没有评价数据）
        if (err.code !== 'ER_NO_SUCH_TABLE') {
          throw err;
        }
        console.warn('评价表不存在，跳过删除评价记录');
      }

      // 5. 删除折扣券记录
      await connection.query('DELETE FROM discount_coupons WHERE user_id = ? OR source_user_id = ?', [id, id]);

      // 6. 删除邀请记录
      await connection.query('DELETE FROM invitations WHERE inviter_id = ? OR invitee_id = ?', [id, id]);

      // 7. 删除系统消息记录（包括用户消息已读记录）
      try {
        await connection.query('DELETE FROM user_message_reads WHERE user_id = ?', [id]);
      } catch (err) {
        // 如果表不存在，忽略错误
        console.warn('删除用户消息已读记录时出错（可能表不存在）:', err.message);
      }
      await connection.query('DELETE FROM system_messages WHERE user_id = ?', [id]);

      // 8. 删除操作日志记录
      await connection.query('DELETE FROM operation_logs WHERE user_id = ?', [id]);

      // 9. 删除发票记录（如果有，需要先检查是否有发票表）
      // 注意：发票可能关联课券，需要先删除发票或更新发票状态
      try {
        await connection.query('DELETE FROM invoices WHERE user_id = ?', [id]);
      } catch (err) {
        // 如果发票表不存在或没有外键约束，忽略错误
        console.warn('删除发票记录时出错（可能表不存在）:', err.message);
      }

      // 10. 删除教练信息（如果有）
      await connection.query('DELETE FROM instructors WHERE user_id = ?', [id]);

      // 11. 更新被邀请人的inviter_id为null
      await connection.query('UPDATE users SET inviter_id = NULL WHERE inviter_id = ?', [id]);

      // 12. 最后删除用户
      await connection.query('DELETE FROM users WHERE id = ?', [id]);

      await connection.commit();
      res.json({ success: true, message: '用户删除成功' });
    } catch (error) {
      await connection.rollback();
      console.error('删除用户事务错误:', error);
      console.error('错误堆栈:', error.stack);
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('删除用户错误:', error);
    console.error('错误堆栈:', error.stack);
    
    // 检查是否是外键约束错误
    let errorMessage = '删除失败';
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_NO_REFERENCED_ROW_2') {
      errorMessage = '删除失败：该用户仍有关联数据，无法删除。请先删除或处理相关数据。';
    } else if (error.message) {
      errorMessage = `删除失败：${error.message}`;
    }
    
    res.status(500).json({ 
      success: false,
      error: errorMessage, 
      details: error.message,
      code: error.code
    });
  }
});

module.exports = router;

