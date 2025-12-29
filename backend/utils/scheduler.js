// 定时任务：自动处理课券过期、课程状态更新等

const db = require('../config/database');
const moment = require('moment-timezone');

// 设置默认时区为东八区（北京时间）
moment.tz.setDefault('Asia/Shanghai');

// 自动将已预订转为已使用（课程开始后）
async function autoUseTickets() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const now = moment.tz('Asia/Shanghai');
    const today = now.format('YYYY-MM-DD');
    const currentTime = now.format('HH:mm');
    const currentDateTime = now.format('YYYY-MM-DD HH:mm:ss');

    console.log(`[自动核销] 开始检查 ${today} ${currentTime} 的课程`);

    // 查找今天已预订但未核销的课程
    const [bookings] = await connection.query(
      `SELECT cb.id as booking_id, cb.ticket_id, cb.user_id, cb.schedule_id,
              cs.id as schedule_id, cs.schedule_date, cs.time_slot, cs.start_time, cs.end_time,
              cs.status as schedule_status,
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted
       FROM course_bookings cb
       JOIN course_schedules cs ON cb.schedule_id = cs.id
       WHERE DATE(cs.schedule_date) = ? 
       AND cb.status = 'booked'
       AND cb.ticket_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM tickets t 
         WHERE t.id = cb.ticket_id AND t.status = 'booked'
       )`,
      [today]
    );

    console.log(`[自动核销] 找到 ${bookings.length} 个待核销的预订`);

    let processedCount = 0;

    for (const booking of bookings) {
      let shouldUse = false;
      
      // 使用实际课程开始时间来判断是否应该核销（而不是仅根据时间段）
      // 只有当当前时间 >= 课程开始时间时，才应该核销
      if (booking.start_time) {
        // 解析日期
        let scheduleDateStr = booking.schedule_date_formatted || '';
        if (!scheduleDateStr && booking.schedule_date) {
          const dateStr = booking.schedule_date.toString();
          if (dateStr.includes('T')) {
            scheduleDateStr = dateStr.split('T')[0];
          } else if (dateStr.includes(' ')) {
            scheduleDateStr = dateStr.split(' ')[0];
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            scheduleDateStr = dateStr;
          }
        }
        
        if (scheduleDateStr) {
          // 构建完整的开始时间
          const startTimeStr = booking.start_time.toString();
          const startDateTimeStr = `${scheduleDateStr} ${startTimeStr}`;
          const startDateTime = moment.tz(startDateTimeStr, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
          
          if (startDateTime.isValid()) {
            // 检查当前时间是否已经到达或超过课程开始时间
            if (now.isAfter(startDateTime) || now.isSame(startDateTime)) {
              shouldUse = true;
              console.log(`[自动核销] 课程 ${booking.schedule_id}（开始时间: ${startDateTime.format('YYYY-MM-DD HH:mm:ss')}）在 ${currentDateTime} 核销`);
            }
          }
        }
      }
      
      // 如果没有开始时间，使用旧的时间段逻辑作为后备（向后兼容）
      if (!shouldUse && !booking.start_time) {
        const timeSlot = booking.time_slot;
        if (timeSlot === 'morning') {
          // 上午课程（9-12点）：在9:00自动核销
          if (currentTime >= '09:00') {
            shouldUse = true;
            console.log(`[自动核销] 上午课程 ${booking.schedule_id}（无开始时间）在 ${currentTime} 核销`);
          }
        } else if (timeSlot === 'afternoon') {
          // 下午课程（14-17点）：在14:00自动核销
          if (currentTime >= '14:00') {
            shouldUse = true;
            console.log(`[自动核销] 下午课程 ${booking.schedule_id}（无开始时间）在 ${currentTime} 核销`);
          }
        } else if (timeSlot === 'full_day') {
          // 全天课程（9-17点）：在17:00自动核销
          if (currentTime >= '17:00') {
            shouldUse = true;
            console.log(`[自动核销] 全天课程 ${booking.schedule_id}（无开始时间）在 ${currentTime} 核销`);
          }
        }
      }

      if (shouldUse) {
        // 更新课券状态：从 booked 改为 used
        await connection.query(
          'UPDATE tickets SET status = ?, used_at = ? WHERE id = ? AND status = ?',
          ['used', currentDateTime, booking.ticket_id, 'booked']
        );

        // 更新预订状态：从 booked 改为 completed
        await connection.query(
          'UPDATE course_bookings SET status = ? WHERE id = ?',
          ['completed', booking.booking_id]
        );

        // 如果课程状态还是 scheduled，更新为 completed
        if (booking.schedule_status === 'scheduled') {
          await connection.query(
          'UPDATE course_schedules SET status = ? WHERE id = ?',
            ['completed', booking.schedule_id]
        );
        }

        processedCount++;
        console.log(`[自动核销] 成功核销预订 ${booking.booking_id}，课券 ${booking.ticket_id}`);
      }
    }

    await connection.commit();
    console.log(`[自动核销] 完成，共处理 ${processedCount} 个预订`);
    
    return {
      success: true,
      processed: processedCount,
      total: bookings.length
    };
  } catch (error) {
    await connection.rollback();
    console.error('[自动核销] 错误:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 处理过期课券退款
async function processExpiredTickets() {
  try {
    const today = moment.tz('Asia/Shanghai').format('YYYY-MM-DD');

    // 查找今天过期的未使用课券
    const [tickets] = await db.query(
      `SELECT * FROM tickets 
       WHERE expiry_date = ? 
       AND status = 'unused' 
       AND actual_amount > 0`,
      [today]
    );

    for (const ticket of tickets) {
      // 更新课券状态
      await db.query(
        'UPDATE tickets SET status = ? WHERE id = ?',
        ['expired', ticket.id]
      );

      // 记录退款日志（实际退款需要调用支付接口）
      await db.query(
        `INSERT INTO operation_logs (action, table_name, record_id, data) 
         VALUES ('refund_expired_ticket', 'tickets', ?, ?)`,
        [ticket.id, JSON.stringify({ 
          amount: ticket.actual_amount,
          ticket_code: ticket.ticket_code
        })]
      );
    }
  } catch (error) {
    console.error('处理过期课券错误:', error);
  }
}

// 发送课券即将过期提醒
async function sendExpiringTicketReminders() {
  try {
    const oneMonthLater = moment.tz('Asia/Shanghai').add(1, 'month').format('YYYY-MM-DD');
    const oneWeekLater = moment.tz('Asia/Shanghai').add(1, 'week').format('YYYY-MM-DD');

    // 查找1个月内即将过期的课券
    const [tickets] = await db.query(
      `SELECT * FROM tickets 
       WHERE expiry_date BETWEEN ? AND ? 
       AND status = 'unused'`,
      [oneWeekLater, oneMonthLater]
    );

    for (const ticket of tickets) {
      // 检查是否已发送过提醒（这里简化处理，实际应该记录发送时间）
      // 创建系统消息
      await db.query(
        `INSERT INTO system_messages (user_id, type, title, content) 
         VALUES (?, 'ticket_expiring', ?, ?)`,
        [
          ticket.user_id,
          '课券即将过期提醒',
          `您有1张课券将在${ticket.expiry_date}过期，请尽快使用`
        ]
      );
    }
  } catch (error) {
    console.error('发送过期提醒错误:', error);
  }
}

// 自动更新已结束的课程状态为已完成
async function autoCompleteCourses() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const now = moment.tz('Asia/Shanghai');
    
    console.log(`[自动完成课程] 开始检查 ${now.format('YYYY-MM-DD HH:mm:ss')} 的课程`);

    // 查找所有状态为 scheduled 的课程排课
    // 使用 DATE_FORMAT 确保日期格式正确，避免时区问题
    const [schedules] = await connection.query(
      `SELECT cs.id as schedule_id, 
              cs.schedule_date, 
              DATE_FORMAT(cs.schedule_date, '%Y-%m-%d') as schedule_date_formatted,
              cs.start_time, 
              cs.end_time,
              cs.status as schedule_status
       FROM course_schedules cs
       WHERE cs.status = 'scheduled'
       AND cs.end_time IS NOT NULL
       AND cs.schedule_date IS NOT NULL`,
      []
    );

    console.log(`[自动完成课程] 找到 ${schedules.length} 个待检查的排课`);

    let processedCount = 0;

    for (const schedule of schedules) {
      try {
        // 解析日期和结束时间（优先使用格式化后的日期，避免时区问题）
        let scheduleDateStr = '';
        if (schedule.schedule_date_formatted) {
          scheduleDateStr = schedule.schedule_date_formatted;
        } else if (schedule.schedule_date) {
          const dateStr = schedule.schedule_date.toString();
          if (dateStr.includes('T')) {
            scheduleDateStr = dateStr.split('T')[0];
          } else if (dateStr.includes(' ')) {
            scheduleDateStr = dateStr.split(' ')[0];
          } else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            scheduleDateStr = dateStr;
          } else {
            scheduleDateStr = moment(schedule.schedule_date, 'YYYY-MM-DD', 'Asia/Shanghai').format('YYYY-MM-DD');
          }
        }
        
        if (!scheduleDateStr) {
          console.log(`[自动完成课程] 排课 ${schedule.schedule_id} 日期格式无效，跳过`);
          continue;
        }

        // 解析结束时间
        const endTimeStr = schedule.end_time ? schedule.end_time.toString() : null;
        if (!endTimeStr) {
          console.log(`[自动完成课程] 排课 ${schedule.schedule_id} 没有结束时间，跳过`);
          continue;
        }

        // 构建完整的结束时间（日期 + 时间）
        const endDateTimeStr = `${scheduleDateStr} ${endTimeStr}`;
        const endDateTime = moment.tz(endDateTimeStr, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
        
        if (!endDateTime.isValid()) {
          console.log(`[自动完成课程] 排课 ${schedule.schedule_id} 结束时间无效: ${endDateTimeStr}，跳过`);
          continue;
        }

        // 检查当前时间是否已经超过结束时间
        if (now.isAfter(endDateTime) || now.isSame(endDateTime)) {
          console.log(`[自动完成课程] 排课 ${schedule.schedule_id} 已结束（结束时间: ${endDateTime.format('YYYY-MM-DD HH:mm:ss')}），更新状态为已完成`);

          // 更新课程排课状态为 completed
          await connection.query(
            'UPDATE course_schedules SET status = ? WHERE id = ? AND status = ?',
            ['completed', schedule.schedule_id, 'scheduled']
          );

          // 更新所有相关的预订状态为 completed（如果状态是 booked），同时更新课券状态为 used
          const [bookings] = await connection.query(
            'SELECT id, ticket_id FROM course_bookings WHERE schedule_id = ? AND status = ?',
            [schedule.schedule_id, 'booked']
          );

          if (bookings.length > 0) {
            const bookingIds = bookings.map(b => b.id);
            const placeholders = bookingIds.map(() => '?').join(',');
            
            // 更新预订状态为 completed
            await connection.query(
              `UPDATE course_bookings SET status = ? WHERE id IN (${placeholders}) AND status = ?`,
              ['completed', ...bookingIds, 'booked']
            );
            console.log(`[自动完成课程] 已更新 ${bookings.length} 个预订状态为已完成`);

            // 更新相关的课券状态为 used（从 booked 变为 used）
            const ticketIds = bookings.map(b => b.ticket_id).filter(id => id !== null);
            if (ticketIds.length > 0) {
              const ticketPlaceholders = ticketIds.map(() => '?').join(',');
              const usedAt = now.format('YYYY-MM-DD HH:mm:ss');
              const [ticketUpdateResult] = await connection.query(
                `UPDATE tickets SET status = ?, used_at = ? 
                 WHERE id IN (${ticketPlaceholders}) AND status = ?`,
                ['used', usedAt, ...ticketIds, 'booked']
              );
              console.log(`[自动完成课程] 已更新 ${ticketUpdateResult.affectedRows || ticketIds.length} 张课券状态为已使用`);
            }
          }

          processedCount++;
        }
      } catch (error) {
        console.error(`[自动完成课程] 处理排课 ${schedule.schedule_id} 时出错:`, error);
        // 继续处理下一个，不中断整个流程
      }
    }

    await connection.commit();
    console.log(`[自动完成课程] 完成，共处理 ${processedCount} 个排课`);
    
    return {
      success: true,
      processed: processedCount,
      total: schedules.length
    };
  } catch (error) {
    await connection.rollback();
    console.error('[自动完成课程] 错误:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 导出定时任务函数
module.exports = {
  autoUseTickets,
  processExpiredTickets,
  sendExpiringTicketReminders,
  autoCompleteCourses
};

