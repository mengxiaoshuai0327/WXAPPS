const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 使用与主应用相同的数据库配置
const db = require('../config/database');

async function fixChannelCoupons() {
  try {
    console.log('开始修复渠道推广优惠券...');
    
    // 查找所有渠道邀请的优惠券（金额大于200的，可能是合并发放的）
    const [coupons] = await db.query(
      `SELECT dc.*, 
       (SELECT channel_code FROM channels WHERE id = (SELECT channel_user_id FROM users WHERE id = dc.source_user_id)) as channel_code
       FROM discount_coupons dc 
       WHERE dc.source = 'channel_invite' 
       AND dc.amount >= 200
       ORDER BY dc.created_at DESC`
    );

    console.log(`找到 ${coupons.length} 条可能的渠道推广优惠券记录`);

    for (const coupon of coupons) {
      if (!coupon.channel_code) {
        console.log(`跳过：优惠券ID ${coupon.id} 无法找到对应的channel_code`);
        continue;
      }

      // 查找对应的渠道推广方案
      const [schemes] = await db.query(
        'SELECT * FROM channel_promotion_schemes WHERE channel_code = ? AND status = ?',
        [coupon.channel_code, 'active']
      );

      if (schemes.length === 0) {
        console.log(`跳过：优惠券ID ${coupon.id} 无法找到对应的渠道推广方案 (channel_code: ${coupon.channel_code})`);
        continue;
      }

      const scheme = schemes[0];
      const ticket_count = parseInt(scheme.ticket_count) || 1;
      const ticket_price = parseFloat(scheme.ticket_price) || scheme.amount;
      const expected_total = ticket_count * ticket_price;

      // 如果优惠券金额等于总金额，说明可能是合并发放的，需要拆分
      if (Math.abs(parseFloat(coupon.amount) - expected_total) < 0.01 && ticket_count > 1) {
        console.log(`\n处理优惠券ID ${coupon.id}:`);
        console.log(`  - 用户ID: ${coupon.user_id}`);
        console.log(`  - 当前金额: ¥${coupon.amount}`);
        console.log(`  - 应该发放: ${ticket_count}张，每张¥${ticket_price}`);

        // 检查是否已经有正确数量的优惠券
        const [existing] = await db.query(
          'SELECT COUNT(*) as count FROM discount_coupons WHERE user_id = ? AND source = ? AND source_user_id = ?',
          [coupon.user_id, 'channel_invite', coupon.source_user_id]
        );

        if (existing[0].count >= ticket_count) {
          console.log(`  - 跳过：用户已有 ${existing[0].count} 张优惠券，不需要修复`);
          continue;
        }

        // 删除旧的优惠券
        console.log(`  - 删除旧优惠券ID ${coupon.id}`);
        await db.query('DELETE FROM discount_coupons WHERE id = ?', [coupon.id]);

        // 创建新的优惠券
        const expiry_date = coupon.expiry_date;
        const newCouponIds = [];
        
        for (let i = 0; i < ticket_count; i++) {
          // 先插入获取ID，然后生成编号
          const [result] = await db.query(
            `INSERT INTO discount_coupons 
             (user_id, amount, source, source_user_id, start_date, expiry_date, status,
              promotion_type, instructor_id_for_promotion, instructor_name_for_promotion, 
              channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion,
              created_at) 
             VALUES (?, ?, 'channel_invite', ?, ?, ?, 'unused', 
                     ?, ?, ?, ?, ?, ?)`,
            [
              coupon.user_id, 
              ticket_price,
              coupon.source_user_id, 
              coupon.start_date, 
              expiry_date,
              coupon.promotion_type,
              coupon.instructor_id_for_promotion,
              coupon.instructor_name_for_promotion,
              coupon.channel_name_for_promotion,
              coupon.channel_sales_id_for_promotion,
              coupon.channel_sales_name_for_promotion,
              coupon.created_at
            ]
          );

          // 更新优惠券编号
          const discount_code = `DC${result.insertId}`;
          await db.query('UPDATE discount_coupons SET discount_code = ? WHERE id = ?', [discount_code, result.insertId]);
          newCouponIds.push(result.insertId);
          
          console.log(`  - 创建新优惠券ID ${result.insertId}, 编号 ${discount_code}, 金额 ¥${ticket_price}`);
        }

        console.log(`  ✓ 完成：已创建 ${ticket_count} 张优惠券 (IDs: ${newCouponIds.join(', ')})`);
      } else {
        console.log(`跳过：优惠券ID ${coupon.id} 金额 (¥${coupon.amount}) 与方案配置不匹配或不需要拆分`);
      }
    }

    console.log('\n修复完成！');
  } catch (error) {
    console.error('修复失败:', error);
    throw error;
  }
}

// 执行修复
fixChannelCoupons().then(() => {
  console.log('脚本执行完成');
  process.exit(0);
}).catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});

