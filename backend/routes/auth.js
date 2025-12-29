const express = require('express');
const router = express.Router();
const db = require('../config/database');
const axios = require('axios');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { moment } = require('../utils/dateHelper');

// 微信登录
router.post('/wxlogin', async (req, res) => {
  try {
    const { code, userInfo } = req.body;
    
    // 调用微信API获取openid
    const wxResponse = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: process.env.WX_APPID,
        secret: process.env.WX_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      }
    });

    if (wxResponse.data.errcode) {
      return res.status(400).json({ error: '微信登录失败', details: wxResponse.data });
    }

    const { openid, session_key } = wxResponse.data;

    // 查找或创建用户（优先通过openid查找，如果不存在则查找手机号）
    let [users] = await db.query('SELECT * FROM users WHERE openid = ?', [openid]);
    let user = users[0];
    
    // 如果没有找到用户，且请求中有手机号，尝试通过手机号查找
    if (!user && req.body.phone) {
      const [phoneUsers] = await db.query('SELECT * FROM users WHERE phone = ? AND role != ?', [req.body.phone, 'visitor']);
      if (phoneUsers.length > 0) {
        // 找到手机号对应的用户，更新其openid
        user = phoneUsers[0];
        await db.query('UPDATE users SET openid = ? WHERE id = ?', [openid, user.id]);
        user.openid = openid;
      }
    }

    if (!user) {
      // 新用户，创建游客账号，如果有用户信息则更新
      const updateData = { openid, role: 'visitor' };
      if (userInfo) {
        if (userInfo.nickname) updateData.nickname = userInfo.nickname;
        if (userInfo.avatar_url) updateData.avatar_url = userInfo.avatar_url;
      }
      // 如果有手机号，添加到创建数据中
      if (req.body.phone) {
        updateData.phone = req.body.phone;
        // 如果手机号已存在对应的会员用户，直接使用会员角色
        const [phoneUsers] = await db.query('SELECT role FROM users WHERE phone = ? AND role = ?', [req.body.phone, 'member']);
        if (phoneUsers.length > 0) {
          updateData.role = 'member';
        }
      }
      
      const fields = Object.keys(updateData).join(', ');
      const values = Object.values(updateData);
      const placeholders = values.map(() => '?').join(', ');
      
      const [result] = await db.query(
        `INSERT INTO users (${fields}) VALUES (${placeholders})`,
        values
      );
      user = { id: result.insertId, ...updateData };
    } else {
      // 已存在用户，如果有新的用户信息则更新
      if (userInfo) {
        const updateFields = [];
        const updateValues = [];
        if (userInfo.nickname && userInfo.nickname !== user.nickname) {
          updateFields.push('nickname = ?');
          updateValues.push(userInfo.nickname);
        }
        if (userInfo.avatar_url && userInfo.avatar_url !== user.avatar_url) {
          updateFields.push('avatar_url = ?');
          updateValues.push(userInfo.avatar_url);
        }
        if (updateFields.length > 0) {
          updateValues.push(openid);
          await db.query(
            `UPDATE users SET ${updateFields.join(', ')} WHERE openid = ?`,
            updateValues
          );
          // 更新本地user对象
          if (userInfo.nickname) user.nickname = userInfo.nickname;
          if (userInfo.avatar_url) user.avatar_url = userInfo.avatar_url;
        }
      }
      // 如果有手机号且用户还没有手机号，更新手机号
      if (req.body.phone && !user.phone) {
        await db.query('UPDATE users SET phone = ? WHERE openid = ?', [req.body.phone, openid]);
        user.phone = req.body.phone;
      }
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        openid: user.openid,
        role: user.role,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        phone: user.phone,
        real_name: user.real_name,
        member_id: user.member_id,
        instructor_id: user.instructor_id,
        channel_id: user.channel_id
      },
      session_key: session_key // 返回session_key用于解密手机号（前端需要时使用）
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '登录失败', details: error.message });
  }
});

// 发送验证码
router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // TODO: 存储验证码到Redis，设置5分钟过期
    // 暂时存储到内存（生产环境应使用Redis）
    if (!global.verificationCodes) {
      global.verificationCodes = new Map();
    }
    global.verificationCodes.set(phone, {
      code: code,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5分钟过期
    });
    
    // TODO: 发送短信验证码
    console.log(`[验证码] 手机号: ${phone}, 验证码: ${code} (仅开发环境)`);

    res.json({ success: true, message: '验证码已发送', code: process.env.NODE_ENV === 'development' ? code : undefined });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({ error: '发送失败', details: error.message });
  }
});

// 验证验证码
function verifyCode(phone, code) {
  if (!global.verificationCodes) {
    return false;
  }
  const stored = global.verificationCodes.get(phone);
  if (!stored) {
    return false;
  }
  if (Date.now() > stored.expiresAt) {
    global.verificationCodes.delete(phone);
    return false;
  }
  if (stored.code !== code) {
    return false;
  }
  // 验证成功后删除验证码
  global.verificationCodes.delete(phone);
  return true;
}

// 导出验证码验证函数供其他路由使用（在module.exports = router之前）

// 检查手机号是否已注册
router.post('/check-phone', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: '请输入手机号' });
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    // 检查手机号是否已被注册
    const [existing] = await db.query(
      'SELECT id, role FROM users WHERE phone = ? AND role IN (?, ?)', 
      [phone, 'member', 'instructor']
    );

    res.json({
      success: true,
      exists: existing.length > 0,
      user: existing.length > 0 ? {
        id: existing[0].id,
        role: existing[0].role
      } : null
    });
  } catch (error) {
    console.error('检查手机号错误:', error);
    res.status(500).json({ error: '检查失败', details: error.message });
  }
});

// 手机号+密码登录
router.post('/login-password', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: '请输入手机号和密码' });
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    // 查找用户（包含会员、教练和渠道销售）
    // 注意：渠道销售是member角色但有channel_user_id，所以不需要单独查询
    const [users] = await db.query(
      'SELECT * FROM users WHERE phone = ? AND role IN (?, ?)',
      [phone, 'member', 'instructor']
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '手机号输入错误或您输入的手机号暂未注册，请注册后登录' });
    }

    const user = users[0];

    // 检查是否有密码
    if (!user.password) {
      return res.status(400).json({ error: '该账号未设置密码，请使用验证码登录' });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '密码错误' });
    }

    // 登录成功，返回用户信息
    res.json({
      success: true,
      user: {
        id: user.id,
        role: user.role,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        phone: user.phone,
        real_name: user.real_name,
        member_id: user.member_id,
        instructor_id: user.instructor_id,
        channel_id: user.channel_id
      }
    });
  } catch (error) {
    console.error('密码登录错误:', error);
    res.status(500).json({ error: '登录失败', details: error.message });
  }
});

// 手机号+验证码登录
router.post('/login-code', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: '请输入手机号和验证码' });
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    // 验证验证码
    if (!verifyCode(phone, code)) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    // 查找用户（包含会员、教练和渠道销售）
    // 注意：渠道销售是member角色但有channel_user_id，所以不需要单独查询
    const [users] = await db.query(
      'SELECT * FROM users WHERE phone = ? AND role IN (?, ?)',
      [phone, 'member', 'instructor']
    );

    if (users.length === 0) {
      return res.status(404).json({ error: '手机号输入错误或您输入的手机号暂未注册，请注册后登录' });
    }

    const user = users[0];

    // 登录成功，返回用户信息
    res.json({
      success: true,
      user: {
        id: user.id,
        role: user.role,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        phone: user.phone,
        real_name: user.real_name,
        member_id: user.member_id,
        instructor_id: user.instructor_id,
        channel_id: user.channel_id
      }
    });
  } catch (error) {
    console.error('验证码登录错误:', error);
    res.status(500).json({ error: '登录失败', details: error.message });
  }
});

// 注册会员（不需要user_id，直接注册）
router.post('/register', async (req, res) => {
  try {
    const { nickname, real_name, company, phone, password, invite_code: raw_invite_code, verification_code, avatar_url } = req.body;
    
    // 处理邀请码（去除首尾空格，如果为空字符串则设为null）
    const invite_code = raw_invite_code ? raw_invite_code.trim() : null;
    // 如果处理后为空字符串，也设为null
    const final_invite_code = invite_code && invite_code.length > 0 ? invite_code : null;
    console.log(`[注册] 接收到的邀请码: "${raw_invite_code}" (原始), "${invite_code}" (trim后), "${final_invite_code}" (最终)`);

    // 验证必填字段
    if (!nickname || !real_name || !phone || !password || !verification_code) {
      return res.status(400).json({ error: '请填写完整信息' });
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: '手机号格式不正确' });
    }

    // 验证密码长度（至少6位）
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }

    // 验证验证码
    if (!verifyCode(phone, verification_code)) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }

    // 检查手机号是否已被注册
    const [existing] = await db.query('SELECT id, role, nickname, member_id FROM users WHERE phone = ? AND role IN (?, ?)', [phone, 'member', 'instructor']);
    if (existing.length > 0) {
      const user = existing[0];
      return res.status(400).json({ 
        error: '该手机号已被注册',
        message: '您已经注册过账号，请直接登录',
        user_info: {
          nickname: user.nickname,
          member_id: user.member_id
        }
      });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 查找邀请人（邀请码可以是会员号、教练编号或渠道方编号）
    let inviter_id = null;
    let inviter_role = null;
    let first_purchase_discount_rate = null;
    let inviter_channel_user_id = null; // 如果邀请人是渠道销售，记录其所属渠道方ID
    
    // 推广来源信息
    let promotion_type = null;
    let instructor_id_for_promotion = null;
    let instructor_name_for_promotion = null;
    let channel_name_for_promotion = null;
    let channel_code_for_promotion = null; // 保存channel_code，用于后续优惠券发放
    let channel_sales_id_for_promotion = null;
    let channel_sales_name_for_promotion = null;
    
    if (final_invite_code) {
      const invite_code = final_invite_code; // 使用最终处理后的邀请码
      console.log(`[注册] ========== 开始匹配邀请码: ${invite_code} ==========`);
      
      // 简化：直接使用ID查找（支持纯数字ID，也兼容旧的member_id格式）
      let inviters = [];
      
      // 先尝试作为数据库ID查找（纯数字）
      if (/^\d+$/.test(invite_code)) {
        console.log(`[注册] 步骤1: 作为数据库ID查找 (id=${invite_code})`);
        const [result] = await db.query(
          'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE id = ? AND role IN (?, ?)', 
          [parseInt(invite_code), 'member', 'instructor']
        );
        inviters = result || [];
        console.log(`[注册] 查询结果: 找到 ${inviters.length} 条记录`);
      }
      
      // 如果没找到，尝试作为member_id查找（兼容旧格式，如M12345678）
      // 添加重试机制，处理可能的时序问题（新创建的渠道销售可能还未完全同步）
      if (inviters.length === 0) {
        console.log(`[注册] 步骤1（兼容）: 作为member_id查找 (member_id='${invite_code}')`);
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 50;
        
        while (retryCount <= maxRetries && inviters.length === 0) {
          if (retryCount > 0) {
            console.log(`[注册] 第${retryCount}次重试查询member_id（延迟${retryDelay}ms）...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
          
          const [result] = await db.query(
            'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE member_id = ? AND role = ?', 
            [invite_code, 'member']
          );
          inviters = result || [];
          console.log(`[注册] 查询结果: 找到 ${inviters.length} 条记录 (尝试 ${retryCount + 1}/${maxRetries + 1})`);
          
          if (inviters.length > 0) {
            break; // 找到了，退出循环
          }
          
          retryCount++;
        }
      }
      
      if (inviters.length > 0) {
        const inviter = inviters[0];
        console.log(`[注册] ✓ 找到邀请人:`);
        console.log(`  - 用户ID: ${inviter.id}`);
        console.log(`  - 角色: ${inviter.role}`);
        console.log(`  - 渠道销售? channel_user_id: ${inviter.channel_user_id || 'NULL'}`);
        console.log(`  - 姓名: ${inviter.real_name || inviter.nickname || '未知'}`);
        if (inviter.channel_user_id) {
          const [channels] = await db.query('SELECT channel_name, channel_code FROM channels WHERE id = ?', [inviter.channel_user_id]);
          if (channels.length > 0) {
            console.log(`  - 所属渠道方: ${channels[0].channel_name} (channel_code=${channels[0].channel_code})`);
          }
        }
      } else {
        console.log(`[注册] ✗ 未找到邀请人: ${invite_code}`);
      }
      
      // 如果没找到，尝试匹配 instructor_id（教练邀请码）
      // 支持两种格式：I73084993 或 73084993（自动处理I前缀）
      if (inviters.length === 0) {
        console.log(`[注册] 开始尝试匹配instructor_id，邀请码=${invite_code}`);
        
        // 先尝试使用原邀请码匹配
        console.log(`[注册] 第一次尝试：使用原邀请码匹配instructor_id='${invite_code}' AND role='instructor'`);
        const [result1] = await db.query(
          'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE instructor_id = ? AND role = ?', 
          [invite_code, 'instructor']
        );
        inviters = result1 || [];
        console.log(`[注册] 第一次查询结果: 找到${inviters.length}条记录`);
        
        // 如果没找到，尝试去掉I前缀后匹配（如果邀请码以I开头）
        if (inviters.length === 0 && invite_code.startsWith('I')) {
          const withoutPrefix = invite_code.substring(1);
          console.log(`[注册] 第二次尝试：去掉I前缀后匹配instructor_id='${withoutPrefix}' AND role='instructor'`);
          const [result2] = await db.query(
            'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE instructor_id = ? AND role = ?', 
            [withoutPrefix, 'instructor']
          );
          inviters = result2 || [];
          console.log(`[注册] 第二次查询结果: 找到${inviters.length}条记录`);
        }
        
        // 如果还是没找到且是纯数字，尝试添加I前缀匹配
        if (inviters.length === 0 && /^\d+$/.test(invite_code)) {
          const withPrefix = `I${invite_code}`;
          console.log(`[注册] 第三次尝试：添加I前缀后匹配instructor_id='${withPrefix}' AND role='instructor'`);
          const [result3] = await db.query(
            'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE instructor_id = ? AND role = ?', 
            [withPrefix, 'instructor']
          );
          inviters = result3 || [];
          console.log(`[注册] 第三次查询结果: 找到${inviters.length}条记录`);
        }
        
        if (inviters.length > 0) {
          console.log(`[注册] ✓ 找到教练: id=${inviters[0].id}, instructor_id=${inviters[0].instructor_id}, name=${inviters[0].real_name || inviters[0].nickname}, role=${inviters[0].role}`);
        } else {
          console.log(`[注册] ✗ 未找到教练，邀请码=${invite_code}（已尝试原格式、去掉I前缀、添加I前缀三种方式）`);
        }
      }
      
      // 如果还没找到，尝试匹配渠道方（通过channel_code或生成的channel_id）
      if (inviters.length === 0) {
        console.log(`[注册] 尝试通过渠道方匹配邀请码: ${invite_code}`);
        
        // 先尝试通过channel_code匹配（去掉CH前缀，匹配channel_code中的数字）
        let channelCodePattern = invite_code;
        if (invite_code.startsWith('CH')) {
          // 如果输入的是CH981189格式，提取数字部分，匹配channel_code如channel_981189
          const channelNum = invite_code.substring(2);
          channelCodePattern = `channel_${channelNum}`;
        }
        
        // 查找渠道方（通过channel_code匹配）
        let [channels] = await db.query(
          'SELECT id, channel_code, channel_name FROM channels WHERE channel_code = ?',
          [channelCodePattern]
        );
        
        // 如果还是没找到，尝试直接匹配channel_code（用户可能输入的是完整的channel_code）
        if (channels.length === 0) {
          [channels] = await db.query(
            'SELECT id, channel_code, channel_name FROM channels WHERE channel_code = ?',
            [invite_code]
          );
        }
        
        // 如果找到了渠道方，查找该渠道方的渠道销售
        if (channels.length > 0) {
          const channel = channels[0];
          console.log(`[注册] 找到渠道方: id=${channel.id}, channel_code=${channel.channel_code}, channel_name=${channel.channel_name}`);
          
          // 查找该渠道方的渠道销售（选择第一个作为邀请人）
          const [channelSales] = await db.query(
            'SELECT id, role, channel_user_id, nickname, real_name FROM users WHERE channel_user_id = ? AND role = ? ORDER BY created_at ASC LIMIT 1',
            [channel.id, 'member']
          );
          
          if (channelSales.length > 0) {
            inviters = channelSales;
            console.log(`[注册] 找到渠道方的渠道销售作为邀请人: id=${channelSales[0].id}, name=${channelSales[0].real_name || channelSales[0].nickname}`);
          } else {
            console.warn(`[注册] 警告：渠道方 id=${channel.id} (${channel.channel_name}) 没有找到渠道销售，无法建立邀请关系`);
          }
        } else {
          console.log(`[注册] 未找到渠道方，邀请码=${invite_code}，尝试的pattern=${channelCodePattern}`);
        }
      }
      
      if (inviters.length > 0) {
        inviter_id = inviters[0].id;
        inviter_role = inviters[0].role;
        inviter_channel_user_id = inviters[0].channel_user_id; // 如果邀请人是渠道销售，记录所属渠道方ID
        console.log(`[注册] ✓ 找到邀请人: ID=${inviter_id}, role=${inviter_role}, channel_user_id=${inviter_channel_user_id || 'NULL'}, 邀请码=${invite_code}`);
        console.log(`[注册] 设置邀请人变量: inviter_id=${inviter_id}, inviter_role=${inviter_role}, inviter_channel_user_id=${inviter_channel_user_id}`);
        
        // 根据邀请人角色记录推广来源信息
        if (inviter_role === 'instructor') {
          // 教练推广
          promotion_type = 'instructor';
          instructor_id_for_promotion = inviters[0].instructor_id;
          instructor_name_for_promotion = inviters[0].real_name || inviters[0].nickname;
          console.log(`[教练推广] 设置推广信息: promotion_type=${promotion_type}, instructor_id=${instructor_id_for_promotion}, instructor_name=${instructor_name_for_promotion}`);
        } else if (inviter_role === 'member' && inviter_channel_user_id) {
          // ========== 步骤2：识别邀请人角色和渠道方 ==========
          console.log(`[注册] ========== 步骤2：识别邀请人角色和渠道方 ==========`);
          console.log(`[注册] 步骤2.1：判断邀请人类型`);
          console.log(`  - 邀请人role: ${inviter_role}`);
          console.log(`  - 邀请人channel_user_id: ${inviter_channel_user_id}`);
          console.log(`  - 结论：邀请人是渠道销售（role='member'且channel_user_id不为NULL）`);
          
          // 渠道销售推广
          promotion_type = 'channel';
          channel_sales_id_for_promotion = inviters[0].id.toString(); // 使用数据库ID
          channel_sales_name_for_promotion = inviters[0].real_name || inviters[0].nickname;
          
          console.log(`[注册] 步骤2.2：查询渠道方信息（channels表）`);
          console.log(`  查询条件: id=${inviter_channel_user_id}`);
          // 查询渠道方名称和channel_code（保存起来，供后续优惠券发放使用）
          const [channels] = await db.query('SELECT channel_name, channel_code FROM channels WHERE id = ?', [inviter_channel_user_id]);
          if (channels.length > 0) {
            channel_name_for_promotion = channels[0].channel_name;
            channel_code_for_promotion = channels[0].channel_code; // 保存channel_code
            console.log(`[注册] 步骤2.2完成：找到渠道方信息`);
            console.log(`  - 渠道方ID: ${inviter_channel_user_id}`);
            console.log(`  - 渠道方名称: ${channel_name_for_promotion}`);
            console.log(`  - channel_code: ${channel_code_for_promotion}`);
            console.log(`[注册] ✓ 步骤2完成：邀请人是渠道销售，已找到对应的渠道方`);
          } else {
            console.warn(`[注册] 步骤2.2失败：未找到channel_user_id=${inviter_channel_user_id}对应的渠道方信息`);
            console.warn(`  请检查【渠道方列表】中是否存在对应的渠道方（ID: ${inviter_channel_user_id}）`);
          }
        } else if (inviter_role === 'member' && !inviter_channel_user_id) {
          // 普通会员推广（promotion_type字段只支持'instructor'和'channel'，普通会员推广设为NULL）
          promotion_type = null;
          console.log(`[普通会员推广] 邀请人ID=${inviters[0].id}是普通会员，非渠道销售，设置promotion_type=NULL`);
        }
        
        // 如果邀请人是教练或渠道方，获取该用户激活的营销方案的折扣比例
        if (inviter_role === 'instructor' || inviter_role === 'channel') {
          try {
            const today = moment().format('YYYY-MM-DD');
            const [campaigns] = await db.query(
              `SELECT discount_rate FROM marketing_campaigns 
               WHERE user_id = ?
               AND status = 'active'
               AND (start_date IS NULL OR start_date <= ?)
               AND (end_date IS NULL OR end_date >= ?)
               ORDER BY created_at DESC 
               LIMIT 1`,
              [inviter_id, today, today]
            );
            
            if (campaigns.length > 0) {
              first_purchase_discount_rate = parseFloat(campaigns[0].discount_rate);
              console.log(`找到邀请人 ${inviter_id} 的营销方案，折扣比例: ${first_purchase_discount_rate * 100}%`);
            } else {
              console.warn(`未找到邀请人 ${inviter_id} 在当前时间生效的激活营销方案`);
            }
          } catch (campaignError) {
            console.error('查询营销方案失败:', campaignError);
          }
        }
      } else {
        console.warn(`[注册] ⚠️  警告：未找到邀请码 ${invite_code} 对应的邀请人（必须是会员号、教练编号或渠道方编号）`);
        console.warn(`[注册] inviter_id 保持为 NULL`);
      }
    } else {
      console.log(`[注册] 未提供邀请码或邀请码为空，inviter_id 为 NULL`);
    }

    // 简化：使用数据库ID生成member_id（格式：M + 数据库ID，例如 M108）
    // 注意：由于需要先插入获取数据库ID，所以先插入用户，然后更新member_id
    console.log(`[注册] 准备插入用户: phone=${phone}, inviter_id=${inviter_id || 'NULL'}, promotion_type=${promotion_type || 'NULL'}`);
    if (final_invite_code && !inviter_id) {
      console.warn(`[注册] ⚠️  警告：提供了邀请码 "${final_invite_code}" 但未找到邀请人，inviter_id 将为 NULL`);
    }
    
    let result;
    let newUserId;
    try {
      // 先插入用户（member_id暂时为NULL，后续更新）
      [result] = await db.query(
        `INSERT INTO users (nickname, real_name, company, phone, password, role, inviter_id, avatar_url, first_purchase_discount_applied, first_purchase_discount_rate,
         promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion) 
         VALUES (?, ?, ?, ?, ?, 'member', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nickname, real_name, company || null, phone, hashedPassword, inviter_id || null, avatar_url || null, false, first_purchase_discount_rate || null,
         promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion]
      );
      newUserId = result.insertId;
      
      // 生成member_id：M + 数据库ID（简化版本，直接使用数据库ID）
      const memberId = `M${newUserId}`;
      
      // 更新member_id
      await db.query('UPDATE users SET member_id = ? WHERE id = ?', [memberId, newUserId]);
      
      console.log(`[注册] ✓ 用户插入成功: user_id=${newUserId}, member_id=${memberId}, inviter_id=${inviter_id || 'NULL'}`);
    } catch (insertError) {
      console.error('插入用户失败:', insertError);
      throw insertError;
    }

    // 使用事务处理邀请记录和折扣券创建
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 如果有邀请人，创建邀请记录
      if (inviter_id) {
        // 检查是否已存在相同的邀请记录（避免重复）
        const [existingInvitations] = await connection.query(
          'SELECT id FROM invitations WHERE inviter_id = ? AND invitee_id = ? AND invite_code = ?',
          [inviter_id, newUserId, final_invite_code]
        );

        if (existingInvitations.length === 0) {
          try {
            // 使用 INSERT IGNORE 避免重复插入（基于 inviter_id + invitee_id + invite_code 的组合）
            // 因为同一个邀请码（邀请人会员ID）可能被多个被邀请人使用
            await connection.query(
              'INSERT IGNORE INTO invitations (inviter_id, invitee_id, invite_code, status, registered_at) VALUES (?, ?, ?, ?, NOW())',
              [inviter_id, newUserId, final_invite_code, 'registered']
            );
            
            // 创建营销方案统计记录
            try {
              await connection.query(
                `INSERT INTO marketing_campaign_stats (inviter_id, inviter_role, invitee_id, invite_code, registered_at, first_purchase_discount_rate) 
                 VALUES (?, ?, ?, ?, NOW(), ?)`,
                [inviter_id, inviter_role, newUserId, final_invite_code, first_purchase_discount_rate || null]
              );
              console.log(`✓ 创建营销方案统计记录: 邀请人 ${inviter_id} (${inviter_role}) 邀请用户 ${newUserId} 注册`);
            } catch (statsError) {
              // 如果表不存在，只记录警告，不影响注册流程
              console.warn(`创建营销方案统计记录失败: ${statsError.message}`);
            }
          } catch (inviteError) {
            // 如果仍然失败，记录警告但继续处理折扣券发放
            console.warn(`创建邀请记录失败: ${inviteError.message}，但继续处理折扣券发放`);
          }
        }

        // 根据邀请人角色发放奖励
        // 普通会员邀请：给邀请人注册奖励，给被邀请人注册奖励（按照会员推广方案配置）
        // 渠道销售邀请：只给被邀请人注册奖励（按照渠道推广方案配置），不给邀请人优惠券
        // 教练邀请：给被邀请人注册奖励（按照教练推广方案配置），不给邀请人优惠券
        if (inviter_role === 'member' && !inviter_channel_user_id) {
          // 普通会员邀请（非渠道销售）
          try {
            // 查找会员推广方案配置
            const [memberSchemes] = await connection.query(
              'SELECT * FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
              ['member_invite', 'active']
            );
            
            if (memberSchemes.length > 0) {
              console.log(`[注册] 找到会员推广方案: ID=${memberSchemes[0].id}, 邀请人奖励=¥${memberSchemes[0].member_inviter_register_amount || 0}, 被邀请人奖励=¥${memberSchemes[0].member_invitee_amount || 0}`);
              const scheme = memberSchemes[0];
              
              // 给邀请人发放注册奖励
              const inviterAmount = parseFloat(scheme.member_inviter_register_amount) || 100;
              const inviterExpiryDays = parseInt(scheme.inviter_expiry_days) || 90;
              
              if (inviterAmount > 0) {
                const [existingInviterCoupons] = await connection.query(
                  'SELECT id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
                  [inviter_id, 'invite_register', newUserId]
                );

                if (existingInviterCoupons.length === 0) {
                  // 生成优惠券编码：先插入获取ID，然后生成 DC{id}
                  const inviterExpiryDate = moment().add(inviterExpiryDays, 'days').format('YYYY-MM-DD');
                  
                  const [inviterCouponResult] = await connection.query(
                    `INSERT INTO discount_coupons (user_id, amount, source, source_user_id, start_date, expiry_date, status,
                     promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion) 
                     VALUES (?, ?, 'invite_register', ?, CURDATE(), ?, 'unused', ?, ?, ?, ?, ?, ?)`,
                    [inviter_id, inviterAmount, newUserId, inviterExpiryDate,
                     promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion]
                  );
                  
                  // 生成并更新优惠券编号
                  const inviterDiscountCode = `DC${inviterCouponResult.insertId}`;
                  await connection.query(
                    'UPDATE discount_coupons SET discount_code = ? WHERE id = ?',
                    [inviterDiscountCode, inviterCouponResult.insertId]
                  );
                  
                  console.log(`✓ 已为会员邀请人 ${inviter_id} 发放注册奖励优惠券：优惠券ID=${inviterCouponResult.insertId}，编号=${inviterDiscountCode}，金额¥${inviterAmount}，有效期${inviterExpiryDays}天，被邀请人: ${newUserId}（按照会员推广方案配置）`);
                }
              }
              
              // 给被邀请人发放注册奖励
              const inviteeAmount = parseFloat(scheme.member_invitee_amount) || 500;
              const inviteeExpiryDays = parseInt(scheme.invitee_expiry_days) || 30;
              
              if (inviteeAmount > 0) {
                const [existingInviteeCoupons] = await connection.query(
                  'SELECT id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
                  [newUserId, 'invite_register', inviter_id]
                );

                if (existingInviteeCoupons.length === 0) {
                  // 生成优惠券编码：先插入获取ID，然后生成 DC{id}
                  const inviteeExpiryDate = moment().add(inviteeExpiryDays, 'days').format('YYYY-MM-DD');
                  
                  const [inviteeCouponResult] = await connection.query(
                    `INSERT INTO discount_coupons (user_id, amount, source, source_user_id, start_date, expiry_date, status,
                     promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion) 
                     VALUES (?, ?, 'invite_register', ?, CURDATE(), ?, 'unused', ?, ?, ?, ?, ?, ?)`,
                    [newUserId, inviteeAmount, inviter_id, inviteeExpiryDate,
                     promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion]
                  );
                  
                  // 生成并更新优惠券编号
                  const inviteeDiscountCode = `DC${inviteeCouponResult.insertId}`;
                  await connection.query(
                    'UPDATE discount_coupons SET discount_code = ? WHERE id = ?',
                    [inviteeDiscountCode, inviteeCouponResult.insertId]
                  );
                  
                  console.log(`✓ 已为被邀请人 ${newUserId} 发放注册奖励优惠券：优惠券ID=${inviteeCouponResult.insertId}，编号=${inviteeDiscountCode}，金额¥${inviteeAmount}，有效期${inviteeExpiryDays}天（会员推广，按照会员推广方案配置）`);
                }
              }
            } else {
              console.warn(`⚠️  未找到激活的会员推广方案 (scheme_type='member_invite', status='active')，无法为邀请人和被邀请人发放优惠券。邀请人ID: ${inviter_id}, 被邀请人ID: ${newUserId}`);
              console.warn(`⚠️  请在 coupon_schemes 表中创建或激活会员推广方案，否则无法发放注册奖励优惠券。`);
            }
          } catch (couponError) {
            console.error('发放优惠券失败:', couponError);
            // 如果是因为 discount_code 字段不存在，给出更友好的错误
            if (couponError.message && couponError.message.includes('discount_code')) {
              throw new Error('数据库配置错误：优惠券编号字段不存在，请联系管理员执行数据库迁移');
            }
            throw couponError;
          }
        } else if (inviter_role === 'instructor' || (inviter_role === 'member' && inviter_channel_user_id)) {
          // 教练/渠道方邀请：不给邀请人折扣券，但记录邀请关系
          console.log(`✓ 教练/渠道方 ${inviter_id} 邀请注册完成，被邀请人 ${newUserId} 将在首次购买时享受 ${first_purchase_discount_rate ? (first_purchase_discount_rate * 100) : 0}% 折扣`);
          
          // 如果是教练邀请，根据教练推广方案给被邀请人发放优惠券
          if (inviter_role === 'instructor') {
            console.log(`[教练优惠券发放] 开始处理教练邀请，inviter_id=${inviter_id}, inviter_role=${inviter_role}, promotion_type=${promotion_type}, instructor_id_for_promotion=${instructor_id_for_promotion}`);
            try {
              // 查找教练推广方案
              console.log(`[教练优惠券发放] 查找教练推广方案: scheme_type='instructor_invite', status='active'`);
              const [schemes] = await connection.query(
                'SELECT * FROM coupon_schemes WHERE scheme_type = ? AND status = ?',
                ['instructor_invite', 'active']
              );
              
              if (schemes.length > 0) {
                const scheme = schemes[0];
                const amount = parseFloat(scheme.instructor_invitee_amount);
                const expiry_days = parseInt(scheme.invitee_expiry_days) || 30;
                // 获取课券数量和单价
                const ticket_count = parseInt(scheme.ticket_count) || 1;
                const ticket_price = parseFloat(scheme.ticket_price) || amount;
                
                console.log(`[教练优惠券发放] 找到教练推广方案: ID=${scheme.id}, 总被邀请人金额=¥${amount}, 课券数量=${ticket_count}张, 每张课券价格=¥${ticket_price}, 有效期=${expiry_days}天`);
                
                if (amount > 0 && ticket_count > 0 && ticket_price > 0) {
                  // 检查是否已经发放过（避免重复发放）
                  console.log(`[教练优惠券发放] 检查是否已存在优惠券: user_id=${newUserId}, source='instructor_invite', source_user_id=${inviter_id}`);
                  const [existingCoupons] = await connection.query(
                    'SELECT id, user_id, source, source_user_id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
                    [newUserId, 'instructor_invite', inviter_id]
                  );
                  console.log(`[教练优惠券发放] 重复检查结果: 找到${existingCoupons.length}条已存在的优惠券记录`);
                  if (existingCoupons.length > 0) {
                    console.log(`[教练优惠券发放] 已存在的优惠券详情:`, existingCoupons.map(c => ({
                      id: c.id,
                      user_id: c.user_id,
                      source: c.source,
                      source_user_id: c.source_user_id
                    })));
                  }
                  
                  if (existingCoupons.length === 0) {
                    const expiry_date = moment().add(expiry_days, 'days').format('YYYY-MM-DD');
                    
                    console.log(`[教练优惠券发放] 准备发放${ticket_count}张优惠券: user_id=${newUserId}, 每张金额=¥${ticket_price}, source='instructor_invite', source_user_id=${inviter_id}, expiry_date=${expiry_date}`);
                    
                    try {
                      // 根据 ticket_count 发放多张优惠券
                      const couponIds = [];
                      const discountCodes = [];
                      
                      for (let i = 0; i < ticket_count; i++) {
                        // 生成优惠券编码：先插入获取ID，然后生成 DC{id}
                        const [couponResult] = await connection.query(
                          `INSERT INTO discount_coupons (user_id, amount, source, source_user_id, start_date, expiry_date, status,
                           promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion) 
                           VALUES (?, ?, 'instructor_invite', ?, CURDATE(), ?, 'unused', ?, ?, ?, ?, ?, ?)`,
                          [newUserId, ticket_price, inviter_id, expiry_date,
                           promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion]
                        );
                        
                        // 生成并更新优惠券编号
                        const discount_code = `DC${couponResult.insertId}`;
                        await connection.query(
                          'UPDATE discount_coupons SET discount_code = ? WHERE id = ?',
                          [discount_code, couponResult.insertId]
                        );
                        
                        couponIds.push(couponResult.insertId);
                        discountCodes.push(discount_code);
                        
                        console.log(`[教练优惠券发放] 已发放第${i + 1}张优惠券: ID=${couponResult.insertId}, 编号=${discount_code}, 金额=¥${ticket_price}`);
                      }
                      
                      console.log(`✓ 已为被邀请人 ${newUserId} 发放${ticket_count}张教练推广优惠券`);
                      console.log(`  总结信息:`);
                      console.log(`    - 优惠券数量: ${ticket_count}张`);
                      console.log(`    - 优惠券ID列表: ${couponIds.join(', ')}`);
                      console.log(`    - 优惠券编号列表: ${discountCodes.join(', ')}`);
                      console.log(`    - 邀请人ID：${inviter_id}，邀请人姓名：${instructor_name_for_promotion}`);
                      console.log(`    - 每张优惠券金额: ¥${ticket_price}`);
                      console.log(`    - 总金额: ¥${amount}`);
                      console.log(`    - 有效期: ${expiry_days}天`);
                    } catch (insertError) {
                      console.error(`[教练优惠券发放] 插入优惠券失败:`, insertError);
                      console.error(`[教练优惠券发放] 错误详情:`, insertError.message);
                      console.error(`[教练优惠券发放] 错误堆栈:`, insertError.stack);
                      // 继续抛出错误，让外层catch处理
                      throw insertError;
                    }
                  } else {
                    console.warn(`⚠️  被邀请人 ${newUserId} 已存在教练推广优惠券（已发放ID：${existingCoupons[0].id}），跳过重复发放`);
                  }
                } else {
                  console.warn(`⚠️  教练推广方案的金额为0或负数，或课券配置无效，不发放优惠券。邀请人ID: ${inviter_id}, 被邀请人ID: ${newUserId}, amount=${amount}, ticket_count=${ticket_count}, ticket_price=${ticket_price}`);
                }
              } else {
                console.error(`⚠️  未找到激活的教练推广方案 (scheme_type='instructor_invite', status='active')，无法为被邀请人 ${newUserId} 发放优惠券。邀请人ID: ${inviter_id}`);
                console.error(`⚠️  请在 coupon_schemes 表中创建或激活教练推广方案，否则被邀请人将无法获得注册奖励优惠券。`);
              }
            } catch (instructorCouponError) {
              console.error('[教练优惠券发放] ❌ 发放教练推广优惠券失败:', instructorCouponError);
              console.error('[教练优惠券发放] 错误详情:', instructorCouponError.message);
              console.error('[教练优惠券发放] 错误堆栈:', instructorCouponError.stack);
              // 重要：优惠券发放失败不应该静默失败，应该记录到数据库或至少记录详细错误
              // 但为了不影响注册流程，这里只记录错误，不抛出异常
              // 可以考虑将错误记录到专门的错误日志表
            }
          } else {
            console.log(`[教练优惠券发放] 跳过：inviter_role=${inviter_role}，不是教练邀请`);
          }
          
          // ========== 步骤3：根据推广方案发放优惠券 ==========
          // 如果是渠道邀请，根据渠道推广方案给被邀请人发放优惠券
          // 邀请人是渠道销售（role='member'且channel_user_id不为NULL）
          if (inviter_role === 'member' && inviter_channel_user_id) {
            console.log(`[渠道优惠券发放] ========== 步骤3：根据渠道推广方案发放优惠券 ==========`);
            console.log(`[渠道优惠券发放] 邀请人是渠道销售，inviter_id=${inviter_id}, inviter_channel_user_id=${inviter_channel_user_id}, channel_code_for_promotion=${channel_code_for_promotion || 'NULL'}`);
            
            // 使用之前查询到的channel_code，如果为空则再次查询
            let channelCode = channel_code_for_promotion;
            
            if (!channelCode) {
              // 如果之前没有查询到channel_code，在事务内再次查询（步骤2：查找渠道方信息）
              console.log(`[渠道优惠券发放] 步骤2（补充）：channel_code_for_promotion为空，在事务内重新查询渠道方信息`);
              const [channels] = await connection.query(
                'SELECT channel_code, channel_name FROM channels WHERE id = ?',
                [inviter_channel_user_id]
              );
              
              if (channels.length > 0 && channels[0].channel_code) {
                channelCode = channels[0].channel_code;
                channel_code_for_promotion = channelCode; // 更新保存的channel_code
                if (!channel_name_for_promotion) {
                  channel_name_for_promotion = channels[0].channel_name;
                }
                console.log(`[渠道优惠券发放] 步骤2完成：找到渠道方信息`);
                console.log(`  - 渠道方ID: ${inviter_channel_user_id}`);
                console.log(`  - 渠道方名称: ${channels[0].channel_name}`);
                console.log(`  - channel_code: ${channelCode}`);
              } else {
                console.error(`[渠道优惠券发放] 步骤2失败：未找到channel_user_id=${inviter_channel_user_id}对应的渠道方记录或channel_code为空`);
              }
            } else {
              console.log(`[渠道优惠券发放] 步骤2已完成：使用之前查询到的channel_code=${channelCode}`);
            }
            
            if (!channelCode) {
              console.error(`[渠道优惠券发放] 步骤3无法继续：channel_code为空，无法查找渠道推广方案。inviter_channel_user_id=${inviter_channel_user_id}`);
            } else {
              try {
                // 步骤3：查找对应的渠道推广方案（在channel_promotion_schemes表中）
                console.log(`[渠道优惠券发放] 步骤3.1：查找渠道推广方案（channel_promotion_schemes表）`);
                console.log(`  查询条件: channel_code='${channelCode}', status='active'`);
                const [schemes] = await connection.query(
                  'SELECT * FROM channel_promotion_schemes WHERE channel_code = ? AND status = ?',
                  [channelCode, 'active']
                );
                
                if (schemes.length > 0) {
                  const scheme = schemes[0];
                  const amount = parseFloat(scheme.amount);
                  const expiry_days = parseInt(scheme.expiry_days) || 30;
                  // 获取课券数量和单价
                  const ticket_count = parseInt(scheme.ticket_count) || 1;
                  const ticket_price = parseFloat(scheme.ticket_price) || amount;
                  
                  console.log(`[渠道优惠券发放] 步骤3.1完成：找到渠道推广方案`);
                  console.log(`  - 方案编码: ${scheme.scheme_code || scheme.id}`);
                  console.log(`  - channel_code: ${scheme.channel_code}`);
                  console.log(`  - 总奖励金额: ¥${amount}`);
                  console.log(`  - 课券数量: ${ticket_count}张`);
                  console.log(`  - 每张课券价格: ¥${ticket_price}`);
                  console.log(`  - 有效期: ${expiry_days}天`);
                  
                  if (amount > 0 && ticket_count > 0 && ticket_price > 0) {
                    // 检查是否已经发放过（避免重复发放）
                    console.log(`[渠道优惠券发放] 步骤3.2：检查是否已存在优惠券`);
                    console.log(`  查询条件: user_id=${newUserId}, source='channel_invite', source_user_id=${inviter_id}`);
                    const [existingCoupons] = await connection.query(
                      'SELECT id FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
                      [newUserId, 'channel_invite', inviter_id]
                    );
                    
                    if (existingCoupons.length === 0) {
                      const expiry_date = moment().add(expiry_days, 'days').format('YYYY-MM-DD');
                      
                      console.log(`[渠道优惠券发放] 步骤3.3：发放${ticket_count}张优惠券`);
                      console.log(`  - 被邀请人ID: ${newUserId}`);
                      console.log(`  - 优惠券数量: ${ticket_count}张`);
                      console.log(`  - 每张优惠券金额: ¥${ticket_price}`);
                      console.log(`  - 有效期: ${expiry_date}`);
                      
                      // 根据 ticket_count 发放多张优惠券
                      const couponIds = [];
                      const discountCodes = [];
                      
                      for (let i = 0; i < ticket_count; i++) {
                        // 生成优惠券编码：先插入获取ID，然后生成 DC{id}
                        const [couponResult] = await connection.query(
                          `INSERT INTO discount_coupons (user_id, amount, source, source_user_id, start_date, expiry_date, status,
                           promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion) 
                           VALUES (?, ?, 'channel_invite', ?, CURDATE(), ?, 'unused', ?, ?, ?, ?, ?, ?)`,
                          [newUserId, ticket_price, inviter_id, expiry_date,
                           promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion]
                        );
                        
                        // 生成并更新优惠券编号
                        const discount_code = `DC${couponResult.insertId}`;
                        await connection.query(
                          'UPDATE discount_coupons SET discount_code = ? WHERE id = ?',
                          [discount_code, couponResult.insertId]
                        );
                        
                        couponIds.push(couponResult.insertId);
                        discountCodes.push(discount_code);
                        
                        console.log(`[渠道优惠券发放] 已发放第${i + 1}张优惠券: ID=${couponResult.insertId}, 编号=${discount_code}, 金额=¥${ticket_price}`);
                      }
                      
                      console.log(`[渠道优惠券发放] ✓ 步骤3完成：已为被邀请人 ${newUserId} 发放${ticket_count}张渠道推广优惠券`);
                      console.log(`  总结信息:`);
                      console.log(`    - 优惠券数量: ${ticket_count}张`);
                      console.log(`    - 优惠券ID列表: ${couponIds.join(', ')}`);
                      console.log(`    - 优惠券编号列表: ${discountCodes.join(', ')}`);
                      console.log(`    - 邀请人ID: ${inviter_id}`);
                      console.log(`    - 渠道方ID: ${inviter_channel_user_id}`);
                      console.log(`    - channel_code: ${channelCode}`);
                      console.log(`    - 每张优惠券金额: ¥${ticket_price}`);
                      console.log(`    - 总金额: ¥${amount}`);
                      console.log(`    - 有效期: ${expiry_days}天`);
                    } else {
                      console.log(`[渠道优惠券发放] 步骤3.2：用户${newUserId}已经存在渠道推广优惠券，跳过重复发放`);
                    }
                  } else {
                    console.warn(`[渠道优惠券发放] 步骤3.1警告：渠道推广方案的金额为0或负数，或课券配置无效，不发放优惠券。channel_code=${channelCode}, amount=${amount}, ticket_count=${ticket_count}, ticket_price=${ticket_price}`);
                  }
                } else {
                  console.error(`[渠道优惠券发放] 步骤3.1失败：未找到channel_code='${channelCode}'且status='active'的渠道推广方案`);
                  console.error(`  请检查【渠道推广方案管理】页面中是否存在对应的配置（渠道方ID: ${inviter_channel_user_id}, channel_code: ${channelCode}）`);
                }
              } catch (channelCouponError) {
                console.error('[渠道优惠券发放] 步骤3执行失败:', channelCouponError);
                console.error('[渠道优惠券发放] 错误堆栈:', channelCouponError.stack);
                // 不影响注册流程，只记录错误
              }
            }
          } else {
            if (inviter_role === 'member') {
              console.log(`[渠道优惠券发放] 跳过：邀请人member_id=${inviter_id}是普通会员（非渠道销售），不发放渠道推广优惠券`);
            }
          }
        }

        // 验证优惠券是否成功发放（用于调试）
        if (inviter_id) {
          let expectedCouponSource = null;
          if (inviter_role === 'instructor') {
            expectedCouponSource = 'instructor_invite';
          } else if (inviter_role === 'member' && inviter_channel_user_id) {
            expectedCouponSource = 'channel_invite';
          } else if (inviter_role === 'member' && !inviter_channel_user_id) {
            expectedCouponSource = 'invite_register';
          }
          
          if (expectedCouponSource) {
            const [verifyCoupons] = await connection.query(
              'SELECT id, amount FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
              [newUserId, expectedCouponSource, inviter_id]
            );
            
            if (verifyCoupons.length > 0) {
              console.log(`✓ [验证] 优惠券发放成功: user_id=${newUserId}, source=${expectedCouponSource}, amount=¥${verifyCoupons[0].amount}`);
            } else {
              console.error(`❌ [验证] 优惠券发放失败: user_id=${newUserId}, source=${expectedCouponSource}, 未找到优惠券记录！`);
              console.error(`❌ [验证] 这可能是严重问题，请检查上面的错误日志！`);
            }
          }
        }

        // 创建消息提醒给邀请人（仅会员邀请时）
        if (inviter_role === 'member' && !inviter_channel_user_id) {
          try {
            // 获取被邀请人信息
            const [newUser] = await connection.query(
              'SELECT real_name, nickname, member_id FROM users WHERE id = ?',
              [newUserId]
            );
            
            if (newUser.length > 0) {
              const inviteeName = newUser[0].real_name || newUser[0].nickname || '新用户';
              const inviteeMemberId = newUser[0].member_id || '';
              
              // 创建邀请注册成功消息
              await connection.query(
                `INSERT INTO system_messages (user_id, type, title, content, published, created_at) 
                 VALUES (?, ?, ?, ?, 1, NOW())`,
                [
                  inviter_id,
                  'invite_reward',
                  '邀请成功！获得注册奖励',
                  `恭喜！您邀请的会员${inviteeName}${inviteeMemberId ? '（' + inviteeMemberId + '）' : ''}已成功注册，您已获得100元折扣券奖励，可在"我的折扣券"中查看使用。`
                ]
              );
              console.log(`✓ 已为会员邀请人 ${inviter_id} 创建注册奖励消息提醒`);
            }
          } catch (messageError) {
            console.error('创建消息提醒失败:', messageError);
            // 消息创建失败不影响注册流程，只记录错误
          }
        }
      }

      // 为新注册的会员创建补充资料通知消息
      try {
        await connection.query(
          `INSERT INTO system_messages (user_id, type, title, content, published, created_at) 
           VALUES (?, ?, ?, ?, 1, NOW())`,
          [
            newUserId,
            'system',
            '完善会员详细资料',
            '为了更好地为您提供服务，请完善您的会员详细资料和能力自评。您可以在"我的"-"个人信息"页面中补充相关信息。'
          ]
        );
        console.log(`✓ 已为新注册会员 ${newUserId} 创建补充资料通知消息`);
      } catch (messageError) {
        console.error('创建补充资料通知消息失败:', messageError);
        // 消息创建失败不影响注册流程，只记录错误
      }

      await connection.commit();
      res.json({ success: true, user_id: newUserId, id: newUserId });
    } catch (transactionError) {
      await connection.rollback();
      console.error('注册事务失败:', transactionError);
      // 如果用户已创建但后续步骤失败，尝试删除用户（可选，根据业务需求）
      // 这里我们只记录错误，不删除用户，因为用户已经成功创建
      throw transactionError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '注册失败', details: error.message });
  }
});

// 获取手机号（解密微信加密数据）
router.post('/get-phone', async (req, res) => {
  try {
    const { encryptedData, iv, session_key } = req.body;
    
    if (!encryptedData || !iv || !session_key) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 解密手机号
    const sessionKey = Buffer.from(session_key, 'base64');
    const encrypted = Buffer.from(encryptedData, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');

    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKey, ivBuffer);
      decipher.setAutoPadding(true);
      let decrypted = decipher.update(encrypted, 'binary', 'utf8');
      decrypted += decipher.final('utf8');
      const phoneData = JSON.parse(decrypted);
      
      res.json({
        success: true,
        data: {
          phone: phoneData.phoneNumber
        }
      });
    } catch (decryptError) {
      console.error('解密手机号失败:', decryptError);
      return res.status(400).json({ error: '解密失败', details: decryptError.message });
    }
  } catch (error) {
    console.error('获取手机号错误:', error);
    res.status(500).json({ error: '获取失败', details: error.message });
  }
});

module.exports = router;

