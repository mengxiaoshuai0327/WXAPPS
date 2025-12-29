const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const { moment } = require('../../utils/dateHelper');

// 获取所有优惠券方案配置
router.get('/list', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = 'SELECT * FROM coupon_schemes WHERE 1=1';
    const params = [];
    
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY FIELD(scheme_type, "member_invite", "channel_caifu", "channel_other", "instructor_invite", "admin_special")';
    
    const [schemes] = await db.query(query, params);
    
    res.json({ success: true, data: schemes });
  } catch (error) {
    console.error('获取优惠券方案列表错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 获取指定方案详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [schemes] = await db.query('SELECT * FROM coupon_schemes WHERE id = ?', [id]);
    
    if (schemes.length === 0) {
      return res.status(404).json({ success: false, error: '方案不存在' });
    }
    
    res.json({ success: true, data: schemes[0] });
  } catch (error) {
    console.error('获取优惠券方案详情错误:', error);
    res.status(500).json({ success: false, error: '获取失败', details: error.message });
  }
});

// 更新优惠券方案配置
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // 检查方案是否存在
    const [existing] = await db.query('SELECT id FROM coupon_schemes WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '方案不存在' });
    }
    
    const updateFields = [];
    const updateValues = [];
    
    // 处理教练推广方案的课券数量和单价逻辑（仅用于 instructor_invite 类型）
    let finalInstructorInviteeAmount;
    let finalTicketCount;
    let finalTicketPrice;
    
    // 获取当前数据
    const [current] = await db.query('SELECT instructor_invitee_amount, ticket_count, ticket_price, scheme_type FROM coupon_schemes WHERE id = ?', [id]);
    const currentData = current.length > 0 ? current[0] : { instructor_invitee_amount: 0, ticket_count: 1, ticket_price: 0, scheme_type: '' };
    
    // 如果更新的是教练推广方案，处理课券数量和单价
    if (currentData.scheme_type === 'instructor_invite' && 
        (updateData.ticket_count !== undefined || updateData.ticket_price !== undefined || updateData.instructor_invitee_amount !== undefined)) {
      
      finalTicketCount = updateData.ticket_count !== undefined ? updateData.ticket_count : currentData.ticket_count;
      finalTicketPrice = updateData.ticket_price !== undefined ? updateData.ticket_price : currentData.ticket_price;
      
      // 如果设置了数量和单价，计算总金额
      if (updateData.ticket_count !== undefined || updateData.ticket_price !== undefined) {
        finalInstructorInviteeAmount = finalTicketCount * finalTicketPrice;
      } else if (updateData.instructor_invitee_amount !== undefined) {
        // 如果只设置了金额，使用当前的数量来计算单价
        finalInstructorInviteeAmount = updateData.instructor_invitee_amount;
        finalTicketPrice = finalInstructorInviteeAmount / finalTicketCount;
      } else {
        // 如果没有更新金额相关字段，使用当前值
        finalInstructorInviteeAmount = currentData.instructor_invitee_amount;
        finalTicketCount = currentData.ticket_count;
        finalTicketPrice = currentData.ticket_price;
      }
    }
    
    // 构建更新字段
    const allowedFields = [
      'name', 'description',
      'member_inviter_register_amount', 'member_inviter_purchase_amount', 'member_invitee_amount',
      'channel_caifu_amount', 'channel_other_amount', 'instructor_invitee_amount',
      'inviter_expiry_days', 'invitee_expiry_days', 'admin_special_amount', 'admin_special_expiry_days',
      'status'
    ];
    
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        // 如果是教练推广方案的金额字段，使用计算后的值
        if (field === 'instructor_invitee_amount' && finalInstructorInviteeAmount !== undefined) {
          updateFields.push(`${field} = ?`);
          updateValues.push(finalInstructorInviteeAmount);
        } else {
          updateFields.push(`${field} = ?`);
          updateValues.push(updateData[field]);
        }
      }
    }
    
    // 如果是教练推广方案，添加 ticket_count 和 ticket_price
    if (currentData.scheme_type === 'instructor_invite' && 
        (updateData.ticket_count !== undefined || updateData.ticket_price !== undefined || updateData.instructor_invitee_amount !== undefined)) {
      updateFields.push('ticket_count = ?');
      updateValues.push(finalTicketCount);
      updateFields.push('ticket_price = ?');
      updateValues.push(finalTicketPrice);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: '没有要更新的字段' });
    }
    
    updateValues.push(id);
    const query = `UPDATE coupon_schemes SET ${updateFields.join(', ')} WHERE id = ?`;
    
    await db.query(query, updateValues);
    
    const [schemes] = await db.query('SELECT * FROM coupon_schemes WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: '更新成功',
      data: schemes[0]
    });
  } catch (error) {
    console.error('更新优惠券方案错误:', error);
    res.status(500).json({ success: false, error: '更新失败', details: error.message });
  }
});

module.exports = router;
