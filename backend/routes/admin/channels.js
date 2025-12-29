const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// 生成唯一的渠道方ID（格式：CH + 8位数字）
async function generateChannelId() {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    // 生成8位随机数字
    const randomNum = crypto.randomInt(10000000, 99999999);
    const channelId = `CH${randomNum}`;
    
    // 检查是否已存在
    const [existing] = await db.query(
      'SELECT id FROM users WHERE channel_id = ?',
      [channelId]
    );
    
    if (existing.length === 0) {
      return channelId;
    }
    
    attempts++;
  }
  
  // 如果随机生成失败，使用时间戳作为后备方案
  const timestamp = Date.now().toString().slice(-8);
  return `CH${timestamp}`;
}

// 生成唯一的渠道编码（用于关联渠道推广方案）
async function generateChannelCode(channelShortName = null) {
  let attempts = 0;
  const maxAttempts = 10;
  
  // 如果提供了渠道简称，尝试使用简称生成编码
  let baseCode = '';
  if (channelShortName && channelShortName.trim()) {
    // 将渠道简称转换为小写，移除空格和特殊字符，只保留字母数字
    baseCode = channelShortName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (baseCode.length === 0) {
      baseCode = null;
    }
  }
  
  // 如果没有有效的简称，使用默认前缀
  if (!baseCode) {
    const timestamp = Date.now().toString().slice(-6);
    baseCode = `channel_${timestamp}`;
  }
  
  while (attempts < maxAttempts) {
    let channelCode = baseCode;
    
    // 如果不是第一次尝试，添加随机后缀
    if (attempts > 0) {
      const randomSuffix = crypto.randomInt(100, 999);
      channelCode = `${baseCode}_${randomSuffix}`;
    }
    
    // 检查是否已存在
    const [existing] = await db.query(
      'SELECT id FROM channels WHERE channel_code = ?',
      [channelCode]
    );
    
    if (existing.length === 0) {
      return channelCode;
    }
    
    attempts++;
  }
  
  // 如果都失败，使用时间戳+随机数
  const timestamp = Date.now().toString();
  const randomNum = crypto.randomInt(1000, 9999);
  return `channel_${timestamp.slice(-8)}${randomNum}`;
}

// 获取渠道方列表
router.get('/', async (req, res) => {
  try {
    // 生成渠道方ID（从channel_code生成，如果没有则使用id）
    const [channels] = await db.query(
      `SELECT c.id, c.channel_code, c.channel_name, c.channel_short_name, 
              c.contact_person, c.contact_phone, c.description,
              c.created_at
       FROM channels c
       ORDER BY c.created_at DESC`
    );
    
    // 为每个渠道方生成channel_id（从channel_code提取或使用id）
    const formattedChannels = channels.map(c => {
      // 从channel_code提取数字部分作为channel_id，如果没有channel_code则使用id
      let channelId = null;
      if (c.channel_code) {
        // 尝试从channel_code中提取数字（例如：channel_113379 -> CH113379）
        const match = c.channel_code.match(/\d+/);
        if (match) {
          channelId = `CH${match[0]}`;
        }
      }
      // 如果无法从channel_code提取，使用默认格式
      if (!channelId) {
        channelId = `CH${String(c.id).padStart(8, '0')}`;
      }
      
      return {
        id: c.id,
        channel_id: channelId,
        channel_code: c.channel_code,
        channel_name: c.channel_name,
        channel_short_name: c.channel_short_name,
        contact_person: c.contact_person,
        contact_phone: c.contact_phone,
        description: c.description
      };
    });
    
    res.json({ success: true, data: formattedChannels });
  } catch (error) {
    console.error('获取渠道方列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 创建渠道方
router.post('/', async (req, res) => {
  try {
    const { channel_name, channel_short_name, contact_person, contact_phone, description } = req.body;
    
    // 验证必填字段
    if (!channel_name) {
      return res.status(400).json({ success: false, error: '请输入渠道名称' });
    }
    
    // 生成唯一的渠道方ID
    const channelId = await generateChannelId();
    
    // 生成唯一的渠道编码（用于关联渠道推广方案）
    const channelCode = await generateChannelCode(channel_short_name);
      
    // 创建渠道方信息（不创建用户记录，因为渠道方不能登录小程序）
    // 直接创建渠道方信息，user_id为NULL
    const [result] = await db.query(
      `INSERT INTO channels (user_id, channel_code, channel_name, channel_short_name, contact_person, contact_phone, description) 
       VALUES (NULL, ?, ?, ?, ?, ?, ?)`,
      [channelCode, channel_name, channel_short_name || null, contact_person || null, contact_phone || null, description || null]
      );
      
    const channelTableId = result.insertId;
      
      res.json({ 
        success: true, 
        message: '创建成功',
      data: { id: channelTableId, channel_id: channelId, channel_code: channelCode }
    });
  } catch (error) {
    console.error('创建渠道方错误:', error);
    res.status(500).json({ success: false, error: '创建失败', details: error.message });
  }
});

// 更新渠道方
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { channel_name, channel_short_name, contact_person, contact_phone, description } = req.body;
    
    // 验证渠道方是否存在（id是channels表的id）
    const [existingChannel] = await db.query(
      'SELECT id FROM channels WHERE id = ?',
      [id]
    );
    
    if (existingChannel.length === 0) {
      return res.status(404).json({ success: false, error: '渠道方不存在' });
    }
    
    // 更新渠道方信息（channel_code不可修改）
      const channelUpdateFields = [];
      const channelUpdateValues = [];
      
      if (channel_name !== undefined) {
        channelUpdateFields.push('channel_name = ?');
        channelUpdateValues.push(channel_name);
      }
    if (channel_short_name !== undefined) {
      channelUpdateFields.push('channel_short_name = ?');
      channelUpdateValues.push(channel_short_name);
    }
      if (contact_person !== undefined) {
        channelUpdateFields.push('contact_person = ?');
        channelUpdateValues.push(contact_person);
      }
      if (contact_phone !== undefined) {
        channelUpdateFields.push('contact_phone = ?');
        channelUpdateValues.push(contact_phone);
      }
      if (description !== undefined) {
        channelUpdateFields.push('description = ?');
        channelUpdateValues.push(description);
      }
      
    if (channelUpdateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }
    
        channelUpdateValues.push(id);
    await db.query(
      `UPDATE channels SET ${channelUpdateFields.join(', ')} WHERE id = ?`,
            channelUpdateValues
          );
      
      res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新渠道方错误:', error);
    res.status(500).json({ success: false, error: '更新失败', details: error.message });
  }
});

// 删除渠道方
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证渠道方是否存在
    const [existingChannel] = await db.query(
      'SELECT id, channel_name FROM channels WHERE id = ?',
      [id]
    );
    
    if (existingChannel.length === 0) {
      return res.status(404).json({ success: false, error: '渠道方不存在' });
    }
    
    // 检查是否有关联的渠道销售
    const [channelSales] = await db.query(
      'SELECT COUNT(*) as count FROM users WHERE channel_user_id = ? AND role = ?',
      [id, 'member']
    );
    
    const salesCount = channelSales[0]?.count || 0;
    if (salesCount > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `无法删除：该渠道方下还有 ${salesCount} 个渠道销售，请先删除或转移这些渠道销售` 
      });
    }
    
    // 检查是否有关联的渠道推广方案（通过channel_code关联）
    const channel = existingChannel[0];
    const [channelInfo] = await db.query(
      'SELECT channel_code FROM channels WHERE id = ?',
      [id]
    );
    
    if (channelInfo.length > 0 && channelInfo[0].channel_code) {
      const [promotionSchemes] = await db.query(
        'SELECT COUNT(*) as count FROM channel_promotion_schemes WHERE channel_code = ?',
        [channelInfo[0].channel_code]
      );
      
      const schemeCount = promotionSchemes[0]?.count || 0;
      if (schemeCount > 0) {
        return res.status(400).json({ 
          success: false, 
          error: `无法删除：该渠道方下还有 ${schemeCount} 个推广方案，请先删除这些推广方案` 
        });
      }
    }
    
    // 删除渠道方
    await db.query('DELETE FROM channels WHERE id = ?', [id]);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除渠道方错误:', error);
    res.status(500).json({ success: false, error: '删除失败', details: error.message });
  }
});

module.exports = router;
