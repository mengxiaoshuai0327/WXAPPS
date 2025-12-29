/**
 * 验证优惠券使用逻辑
 * 检查一次性购买多张课券时，优惠券是否正确标记在一张课券上，并正确计算实际支付金额
 */

const db = require('../config/database');
require('dotenv').config();

async function verifyCouponUsageLogic() {
  try {
    console.log('=== 验证优惠券使用逻辑 ===\n');
    
    // 1. 查找最近使用优惠券的购买记录
    console.log('1. 查找最近使用优惠券的购买记录：\n');
    
    const [recentPurchases] = await db.query(
      `SELECT ol.id, ol.user_id, ol.record_id, ol.data, ol.created_at
       FROM operation_logs ol
       WHERE ol.action = 'purchase_tickets'
       AND JSON_EXTRACT(ol.data, '$.discount_coupon_id') IS NOT NULL
       ORDER BY ol.created_at DESC
       LIMIT 5`
    );
    
    if (recentPurchases.length === 0) {
      console.log('  未找到使用优惠券的购买记录');
    } else {
      for (const purchase of recentPurchases) {
        const data = JSON.parse(purchase.data);
        console.log(`  购买记录 ID: ${purchase.id}`);
        console.log(`  用户ID: ${purchase.user_id}`);
        console.log(`  购买数量: ${data.quantity || 'N/A'}`);
        console.log(`  优惠券ID: ${data.discount_coupon_id || 'N/A'}`);
        console.log(`  总实际支付金额: ¥${data.total_amount || 'N/A'}`);
        console.log(`  折扣金额: ¥${data.discount_amount || 0}`);
        console.log(`  优惠券应用到的课券ID: ${data.discount_coupon_applied_to_ticket_id || 'N/A'}`);
        
        if (data.ticket_ids && Array.isArray(data.ticket_ids)) {
          console.log(`  创建的课券数量: ${data.ticket_ids.length}`);
          
          // 2. 检查每张课券的优惠券标记和实际支付金额
          console.log(`\n  2. 检查每张课券的优惠券标记和实际支付金额：\n`);
          
          for (let i = 0; i < data.ticket_ids.length; i++) {
            const ticketId = data.ticket_ids[i];
            const [tickets] = await db.query(
              `SELECT id, ticket_code, purchase_amount, actual_amount, discount_coupon_id 
               FROM tickets WHERE id = ?`,
              [ticketId]
            );
            
            if (tickets.length > 0) {
              const ticket = tickets[0];
              console.log(`    第${i + 1}张课券 (ID: ${ticket.id}, 编号: ${ticket.ticket_code}):`);
              console.log(`      原价: ¥${ticket.purchase_amount || 0}`);
              console.log(`      实际支付: ¥${ticket.actual_amount || 0}`);
              console.log(`      优惠券ID: ${ticket.discount_coupon_id || 'NULL'}`);
              
              // 验证逻辑
              const shouldHaveCoupon = (i === 0 && data.discount_coupon_id);
              const hasCoupon = ticket.discount_coupon_id !== null;
              
              if (shouldHaveCoupon && !hasCoupon) {
                console.log(`      ❌ 错误：第一张课券应该有优惠券标记，但没有！`);
              } else if (!shouldHaveCoupon && hasCoupon) {
                console.log(`      ❌ 错误：第${i + 1}张课券不应该有优惠券标记，但有！`);
              } else if (shouldHaveCoupon && hasCoupon) {
                console.log(`      ✓ 正确：第一张课券正确标记了优惠券`);
              } else {
                console.log(`      ✓ 正确：第${i + 1}张课券没有优惠券标记（符合预期）`);
              }
              
              // 验证金额计算
              const expectedAmount = i === 0 
                ? (ticket.purchase_amount - (data.discount_amount || 0))
                : ticket.purchase_amount;
              
              if (Math.abs(parseFloat(ticket.actual_amount) - expectedAmount) > 0.01) {
                console.log(`      ⚠️  金额验证：期望实际支付¥${expectedAmount}，实际为¥${ticket.actual_amount}`);
              } else {
                console.log(`      ✓ 金额正确：实际支付金额符合预期`);
              }
              
              console.log('');
            }
          }
          
          // 3. 验证总金额
          console.log(`  3. 验证总实际支付金额：\n`);
          let calculatedTotal = 0;
          for (const ticketId of data.ticket_ids) {
            const [tickets] = await db.query(
              'SELECT actual_amount FROM tickets WHERE id = ?',
              [ticketId]
            );
            if (tickets.length > 0) {
              calculatedTotal += parseFloat(tickets[0].actual_amount || 0);
            }
          }
          
          const loggedTotal = parseFloat(data.total_amount || 0);
          console.log(`    日志记录的总金额: ¥${loggedTotal}`);
          console.log(`    计算得出的总金额: ¥${calculatedTotal}`);
          
          if (Math.abs(calculatedTotal - loggedTotal) > 0.01) {
            console.log(`    ❌ 错误：总金额不匹配！`);
          } else {
            console.log(`    ✓ 总金额正确`);
          }
        }
        
        console.log('\n' + '='.repeat(60) + '\n');
      }
    }
    
    // 4. 检查发票开具逻辑
    console.log('\n4. 检查发票开具逻辑：\n');
    
    const [invoices] = await db.query(
      `SELECT id, ticket_ids, amount, created_at 
       FROM invoices 
       ORDER BY created_at DESC 
       LIMIT 3`
    );
    
    if (invoices.length === 0) {
      console.log('  未找到发票记录');
    } else {
      for (const invoice of invoices) {
        console.log(`  发票 ID: ${invoice.id}`);
        console.log(`  发票总额: ¥${invoice.amount}`);
        
        const ticketIds = typeof invoice.ticket_ids === 'string' 
          ? JSON.parse(invoice.ticket_ids) 
          : invoice.ticket_ids;
        
        if (Array.isArray(ticketIds)) {
          console.log(`  包含课券数量: ${ticketIds.length}`);
          
          let invoiceTotalFromTickets = 0;
          for (const ticketId of ticketIds) {
            const [tickets] = await db.query(
              `SELECT ticket_code, purchase_amount, actual_amount, invoice_amount, discount_coupon_id 
               FROM tickets WHERE id = ?`,
              [ticketId]
            );
            
            if (tickets.length > 0) {
              const ticket = tickets[0];
              invoiceTotalFromTickets += parseFloat(ticket.invoice_amount || ticket.actual_amount || 0);
              console.log(`    课券 ${ticket.ticket_code}: 原价¥${ticket.purchase_amount}, 实际支付¥${ticket.actual_amount}, 发票金额¥${ticket.invoice_amount || ticket.actual_amount || 0}${ticket.discount_coupon_id ? ' (使用优惠券)' : ''}`);
            }
          }
          
          console.log(`  从课券计算的发票总额: ¥${invoiceTotalFromTickets}`);
          
          if (Math.abs(parseFloat(invoice.amount) - invoiceTotalFromTickets) > 0.01) {
            console.log(`  ❌ 错误：发票总额不匹配！`);
          } else {
            console.log(`  ✓ 发票总额正确`);
          }
        }
        
        console.log('');
      }
    }
    
    console.log('\n=== 验证完成 ===');
    
  } catch (error) {
    console.error('验证失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

verifyCouponUsageLogic();

