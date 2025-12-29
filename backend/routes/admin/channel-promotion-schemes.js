const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const crypto = require('crypto');

// 生成唯一的方案编码（格式：CPS + 8位数字）
async function generateSchemeCode() {
  let attempts = 0;
  const maxAttempts = 20;
  
  // 方法1：使用随机数生成
  while (attempts < maxAttempts) {
    const randomNum = crypto.randomInt(10000000, 99999999);
    const schemeCode = `CPS${randomNum}`;
    
    const [existing] = await db.query(
      'SELECT id FROM channel_promotion_schemes WHERE scheme_code = ?',
      [schemeCode]
    );
    
    if (existing.length === 0) {
      return schemeCode;
    }
    
    attempts++;
  }
  
  // 方法2：如果随机生成失败，使用时间戳+随机数
  attempts = 0;
  while (attempts < maxAttempts) {
    const timestamp = Date.now().toString().slice(-6); // 取后6位
    const randomSuffix = crypto.randomInt(10, 99); // 2位随机数
    const schemeCode = `CPS${timestamp}${randomSuffix}`;
    
    const [existing] = await db.query(
      'SELECT id FROM channel_promotion_schemes WHERE scheme_code = ?',
      [schemeCode]
    );
    
    if (existing.length === 0) {
      return schemeCode;
    }
    
    attempts++;
  }
  
  // 方法3：最后的后备方案 - 使用完整时间戳+随机数
  const timestamp = Date.now().toString();
  const randomSuffix = crypto.randomInt(100, 999);
  return `CPS${timestamp.slice(-5)}${randomSuffix}`;
}

// 获取所有渠道推广方案
router.get('/list', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT cps.id, cps.scheme_code, cps.channel_code, 
             COALESCE(c.channel_name, cps.channel_name) as channel_name,
             cps.amount, cps.ticket_count, cps.ticket_price, cps.expiry_days, cps.description, cps.status,
             cps.created_at, cps.updated_at,
             CASE 
               WHEN c.channel_code IS NOT NULL THEN 
                 CONCAT('CH', COALESCE(
                   SUBSTRING_INDEX(c.channel_code, '_', -1),
                   LPAD(c.id, 8, '0')
                 ))
               ELSE NULL 
             END as channel_id
      FROM channel_promotion_schemes cps
      LEFT JOIN channels c ON cps.channel_code = c.channel_code
      WHERE 1=1
    `;
    const params = [];
    
    if (status && status !== 'all') {
      query += ' AND cps.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY cps.created_at DESC';
    
    const [schemes] = await db.query(query, params);
    
    res.json({ success: true, data: schemes });
  } catch (error) {
    console.error('获取渠道推广方案列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 获取指定方案详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [schemes] = await db.query('SELECT * FROM channel_promotion_schemes WHERE id = ?', [id]);
    
    if (schemes.length === 0) {
      return res.status(404).json({ success: false, error: '方案不存在' });
    }
    
    res.json({ success: true, data: schemes[0] });
  } catch (error) {
    console.error('获取渠道推广方案详情错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 创建渠道推广方案
router.post('/', async (req, res) => {
  try {
    const { channel_code, channel_name, amount, ticket_count, ticket_price, expiry_days, description, status } = req.body;
    
    if (!channel_code || !channel_name || !expiry_days) {
      return res.status(400).json({ success: false, error: '请填写完整信息：渠道方、渠道简称、有效期' });
    }
    
    // 验证课券数量和单价
    const count = ticket_count !== undefined ? ticket_count : 1;
    let finalAmount;
    let finalTicketPrice;
    
    // 如果设置了数量和单价，优先使用这两个字段，计算总金额
    if (ticket_count !== undefined && ticket_price !== undefined) {
      finalTicketPrice = ticket_price;
      finalAmount = count * finalTicketPrice;
    } else if (amount !== undefined) {
      // 如果只设置了金额，默认1张，单价等于金额
      finalAmount = amount;
      finalTicketPrice = amount;
    } else {
      return res.status(400).json({ success: false, error: '请设置奖励金额，或设置课券数量和单价' });
    }
    
    // 验证渠道编码是否在channels表中存在（必须存在，因为只能为已创建的渠道方添加方案）
    const [channels] = await db.query(
      'SELECT id FROM channels WHERE channel_code = ?',
      [channel_code]
    );
    
    if (channels.length === 0) {
      return res.status(400).json({ success: false, error: '所选渠道方不存在，请先在"渠道方列表"中创建渠道方' });
    }
    
    // 如果要激活新方案，需要先停用该渠道方的其他激活方案（每个渠道方只能有一个激活方案）
    const finalStatus = status || 'active';
    if (finalStatus === 'active') {
      await db.query(
        'UPDATE channel_promotion_schemes SET status = ? WHERE channel_code = ? AND status = ?',
        ['inactive', channel_code, 'active']
      );
    }
    
    // 生成唯一的方案编码
    const schemeCode = await generateSchemeCode();
    
    // 插入新方案
    const [result] = await db.query(
      `INSERT INTO channel_promotion_schemes 
       (scheme_code, channel_code, channel_name, amount, ticket_count, ticket_price, expiry_days, description, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [schemeCode, channel_code, channel_name, finalAmount, count, finalTicketPrice, expiry_days, description || null, finalStatus]
    );
    
    const [schemes] = await db.query('SELECT * FROM channel_promotion_schemes WHERE id = ?', [result.insertId]);
    
    res.json({
      success: true,
      message: '创建成功',
      data: schemes[0]
    });
  } catch (error) {
    console.error('创建渠道推广方案错误:', error);
    res.status(500).json({ success: false, error: '创建失败', details: error.message });
  }
});

// 更新渠道推广方案
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // 检查方案是否存在，并获取当前的channel_code和status
    const [existing] = await db.query('SELECT id, channel_code, status FROM channel_promotion_schemes WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '方案不存在' });
    }
    
    const currentChannelCode = existing[0].channel_code;
    const currentStatus = existing[0].status;
    
    // 如果更新channel_code，检查是否与其他方案冲突
    if (updateData.channel_code && updateData.channel_code !== currentChannelCode) {
      const [conflict] = await db.query(
        'SELECT id FROM channel_promotion_schemes WHERE channel_code = ? AND id != ?',
        [updateData.channel_code, id]
      );
      if (conflict.length > 0) {
        return res.status(400).json({ success: false, error: '该渠道编码已被其他方案使用' });
      }
    }
    
    // 如果要将状态更新为激活，需要先停用该渠道方的其他激活方案（每个渠道方只能有一个激活方案）
    const targetChannelCode = updateData.channel_code || currentChannelCode;
    if (updateData.status === 'active' && currentStatus !== 'active') {
      // 如果要激活当前方案，需要停用该渠道方的其他激活方案
      await db.query(
        'UPDATE channel_promotion_schemes SET status = ? WHERE channel_code = ? AND status = ? AND id != ?',
        ['inactive', targetChannelCode, 'active', id]
      );
    }
    
    const updateFields = [];
    const updateValues = [];
    
    // 处理课券数量和单价逻辑
    // 如果设置了 ticket_count 和 ticket_price，自动计算 amount
    let finalAmount;
    let finalTicketCount;
    let finalTicketPrice;
    
    // 获取当前数据以支持部分更新
    const [current] = await db.query('SELECT amount, ticket_count, ticket_price FROM channel_promotion_schemes WHERE id = ?', [id]);
    const currentData = current.length > 0 ? current[0] : { amount: 0, ticket_count: 1, ticket_price: 0 };
    
    // 确定要使用的值（优先使用新值，否则使用当前值）
    finalTicketCount = updateData.ticket_count !== undefined ? updateData.ticket_count : currentData.ticket_count;
    finalTicketPrice = updateData.ticket_price !== undefined ? updateData.ticket_price : currentData.ticket_price;
    
    // 如果设置了数量和单价（或其中任意一个），计算总金额
    if (updateData.ticket_count !== undefined || updateData.ticket_price !== undefined) {
      finalAmount = finalTicketCount * finalTicketPrice;
    } else if (updateData.amount !== undefined) {
      // 如果只设置了金额，使用当前的数量来计算单价
      finalAmount = updateData.amount;
      finalTicketPrice = finalAmount / finalTicketCount;
    } else {
      // 如果没有更新金额相关字段，使用当前值（但不会进入这个分支，因为不会更新这些字段）
      finalAmount = currentData.amount;
      finalTicketCount = currentData.ticket_count;
      finalTicketPrice = currentData.ticket_price;
    }
    
    // 构建更新字段
    const allowedFields = ['channel_code', 'channel_name', 'expiry_days', 'description', 'status'];
    
    // 先处理普通字段
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        updateFields.push(`${field} = ?`);
        updateValues.push(updateData[field]);
      }
    }
    
    // 然后处理金额相关字段（如果被更新）
    if (updateData.amount !== undefined || updateData.ticket_count !== undefined || updateData.ticket_price !== undefined) {
      updateFields.push('amount = ?');
      updateValues.push(finalAmount);
      updateFields.push('ticket_count = ?');
      updateValues.push(finalTicketCount);
      updateFields.push('ticket_price = ?');
      updateValues.push(finalTicketPrice);
      
      console.log('[更新渠道推广方案] 金额相关字段更新:', {
        id,
        finalAmount,
        finalTicketCount,
        finalTicketPrice,
        updateDataAmount: updateData.amount,
        updateDataTicketCount: updateData.ticket_count,
        updateDataTicketPrice: updateData.ticket_price
      });
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }
    
    updateValues.push(id);
    const query = `UPDATE channel_promotion_schemes SET ${updateFields.join(', ')} WHERE id = ?`;
    
    console.log('[更新渠道推广方案] SQL:', query);
    console.log('[更新渠道推广方案] 参数:', updateValues);
    
    await db.query(query, updateValues);
    
    const [schemes] = await db.query('SELECT * FROM channel_promotion_schemes WHERE id = ?', [id]);
    console.log('[更新渠道推广方案] 更新后的数据:', schemes[0]);
    
    res.json({
      success: true,
      message: '更新成功',
      data: schemes[0]
    });
  } catch (error) {
    console.error('更新渠道推广方案错误:', error);
    res.status(500).json({ success: false, error: '更新失败', details: error.message });
  }
});

// 删除渠道推广方案
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查方案是否存在
    const [existing] = await db.query('SELECT id FROM channel_promotion_schemes WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '方案不存在' });
    }
    
    await db.query('DELETE FROM channel_promotion_schemes WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    console.error('删除渠道推广方案错误:', error);
    res.status(500).json({ success: false, error: '删除失败', details: error.message });
  }
});

// 根据渠道编码获取推广方案（用于优惠券发放逻辑）
router.get('/by-code/:channel_code', async (req, res) => {
  try {
    const { channel_code } = req.params;
    
    const [schemes] = await db.query(
      'SELECT * FROM channel_promotion_schemes WHERE channel_code = ? AND status = ?',
      [channel_code, 'active']
    );
    
    if (schemes.length === 0) {
      return res.json({ success: true, data: null });
    }
    
    res.json({ success: true, data: schemes[0] });
  } catch (error) {
    console.error('根据渠道编码获取推广方案错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

module.exports = router;

