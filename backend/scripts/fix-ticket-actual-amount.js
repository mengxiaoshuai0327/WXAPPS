/**
 * 修复课券实际支付金额脚本
 * 将按平均分摊计算的实际支付金额修复为：折扣券只从第一张课券扣除，其他课券保持原价
 */

const db = require('../config/database');
const moment = require('moment');

async function fixTicketActualAmount() {
  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 查找所有使用折扣券购买的课券批次
    // 通过 operation_logs 表找到购买记录，这些记录中包含 discount_coupon_id 和 ticket_ids
    const [purchaseLogs] = await connection.query(
      `SELECT id, record_id, data, created_at, user_id
       FROM operation_logs
       WHERE action = 'purchase_tickets'
       AND table_name = 'tickets'
       AND JSON_EXTRACT(data, '$.discount_coupon_id') IS NOT NULL
       ORDER BY created_at DESC`
    );
    
    console.log(`找到 ${purchaseLogs.length} 条使用折扣券的购买记录`);
    
    let fixedCount = 0;
    let skippedCount = 0;
    
    for (const log of purchaseLogs) {
      try {
        const logData = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;
        const discount_coupon_id = logData.discount_coupon_id;
        const ticket_ids = logData.ticket_ids || [];
        
        if (!discount_coupon_id || !ticket_ids || ticket_ids.length === 0) {
          continue;
        }
        
        // 获取折扣券金额
        const [coupons] = await connection.query(
          'SELECT amount FROM discount_coupons WHERE id = ?',
          [discount_coupon_id]
        );
        
        if (coupons.length === 0) {
          console.log(`折扣券 ${discount_coupon_id} 不存在，跳过`);
          skippedCount++;
          continue;
        }
        
        const discount_amount = parseFloat(coupons[0].amount);
        
        // 获取这批课券的信息
        const placeholders = ticket_ids.map(() => '?').join(',');
        const [tickets] = await connection.query(
          `SELECT id, ticket_code, purchase_amount, actual_amount, discount_coupon_id
           FROM tickets
           WHERE id IN (${placeholders})
           ORDER BY id ASC`,
          ticket_ids
        );
        
        if (tickets.length === 0) {
          console.log(`课券批次 ${ticket_ids.join(',')} 不存在，跳过`);
          skippedCount++;
          continue;
        }
        
        // 检查第一张课券是否已经有 discount_coupon_id
        const firstTicket = tickets[0];
        if (firstTicket.discount_coupon_id != discount_coupon_id) {
          console.log(`第一张课券 ${firstTicket.id} 的 discount_coupon_id 不匹配，可能需要手动检查`);
        }
        
        // 计算正确的实际支付金额
        const ticket_price = parseFloat(firstTicket.purchase_amount);
        const first_ticket_actual_amount = Math.max(0, ticket_price - discount_amount);
        const other_tickets_actual_amount = ticket_price;
        
        // 检查是否需要修复
        const currentFirstActual = parseFloat(firstTicket.actual_amount);
        const needsFix = Math.abs(currentFirstActual - first_ticket_actual_amount) > 0.01;
        
        if (!needsFix && tickets.every(t => {
          const currentActual = parseFloat(t.actual_amount);
          const expectedActual = t.id === firstTicket.id ? first_ticket_actual_amount : other_tickets_actual_amount;
          return Math.abs(currentActual - expectedActual) < 0.01;
        })) {
          console.log(`课券批次 ${ticket_ids.join(',')} 已正确，跳过`);
          skippedCount++;
          continue;
        }
        
        // 修复第一张课券
        await connection.query(
          'UPDATE tickets SET actual_amount = ? WHERE id = ?',
          [first_ticket_actual_amount, firstTicket.id]
        );
        console.log(`修复第一张课券 ${firstTicket.id} (${firstTicket.ticket_code}): ${currentFirstActual} -> ${first_ticket_actual_amount}`);
        
        // 修复其他课券
        for (let i = 1; i < tickets.length; i++) {
          const ticket = tickets[i];
          const currentActual = parseFloat(ticket.actual_amount);
          await connection.query(
            'UPDATE tickets SET actual_amount = ? WHERE id = ?',
            [other_tickets_actual_amount, ticket.id]
          );
          console.log(`修复第${i + 1}张课券 ${ticket.id} (${ticket.ticket_code}): ${currentActual} -> ${other_tickets_actual_amount}`);
        }
        
        fixedCount++;
        console.log(`✓ 已修复课券批次: ${ticket_ids.join(',')}, 折扣券金额: ${discount_amount}元`);
        
      } catch (error) {
        console.error(`处理购买日志 ${log.id} 时出错:`, error.message);
        skippedCount++;
      }
    }
    
    await connection.commit();
    connection.release();
    
    console.log(`\n修复完成！`);
    console.log(`修复批次: ${fixedCount}`);
    console.log(`跳过批次: ${skippedCount}`);
    
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('修复失败:', error);
    process.exit(1);
  }
}

// 运行修复脚本
fixTicketActualAmount()
  .then(() => {
    console.log('脚本执行完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });

