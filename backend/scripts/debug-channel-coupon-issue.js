// 排查渠道推广优惠券发放问题
// 用户：赵三（M87844615），邀请码：M85101163（财销1）

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const db = require('../config/database');

async function debugChannelCouponIssue() {
  let connection;
  
  try {
    // 从连接池获取连接
    connection = await db.getConnection();

    console.log('=== 开始排查渠道推广优惠券发放问题 ===\n');
    console.log('用户：赵三（M87844615）');
    console.log('邀请码：M85101163（财销1）\n');

    // 1. 检查被邀请人（赵三）的信息
    console.log('【步骤1】检查被邀请人（M87844615）的信息：');
    const [newUser] = await connection.query(
      'SELECT id, member_id, nickname, real_name, inviter_id, role, created_at FROM users WHERE member_id = ?',
      ['M87844615']
    );

    if (newUser.length === 0) {
      console.log('❌ 未找到用户M87844615');
      return;
    }

    const user = newUser[0];
    console.log(`✓ 找到用户: ID=${user.id}, member_id=${user.member_id}, name=${user.real_name || user.nickname}, inviter_id=${user.inviter_id}, role=${user.role}`);
    console.log(`  注册时间: ${user.created_at}\n`);

    // 2. 检查邀请人（财销1）的信息
    console.log('【步骤2】检查邀请人（M85101163）的信息：');
    const [inviter] = await connection.query(
      'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE member_id = ?',
      ['M85101163']
    );

    if (inviter.length === 0) {
      console.log('❌ 未找到邀请人M85101163');
      return;
    }

    const inviterUser = inviter[0];
    console.log(`✓ 找到邀请人: ID=${inviterUser.id}, member_id=${inviterUser.member_id}, role=${inviterUser.role}, channel_user_id=${inviterUser.channel_user_id}`);
    
    if (!inviterUser.channel_user_id) {
      console.log('❌ 问题：邀请人没有设置channel_user_id，因此无法识别为渠道销售！');
      console.log('   解决方案：需要在users表中为财销1设置正确的channel_user_id（指向对应的渠道方ID）\n');
    } else {
      console.log(`✓ 邀请人是渠道销售，所属渠道方ID: ${inviterUser.channel_user_id}\n`);
    }

    // 3. 检查渠道方信息
    if (inviterUser.channel_user_id) {
      console.log('【步骤3】检查渠道方信息：');
      const [channels] = await connection.query(
        'SELECT id, channel_code, channel_name, channel_short_name FROM channels WHERE id = ?',
        [inviterUser.channel_user_id]
      );

      if (channels.length === 0) {
        console.log(`❌ 未找到channel_user_id=${inviterUser.channel_user_id}对应的渠道方记录`);
        console.log('   问题：channels表中不存在对应的渠道方记录\n');
      } else {
        const channel = channels[0];
        console.log(`✓ 找到渠道方: ID=${channel.id}, channel_code=${channel.channel_code}, channel_name=${channel.channel_name}`);
        
        if (!channel.channel_code) {
          console.log('❌ 问题：渠道方的channel_code为空！');
          console.log('   解决方案：需要在channels表中为渠道方设置channel_code\n');
        } else {
          console.log(`✓ channel_code: ${channel.channel_code}\n`);

          // 4. 检查渠道推广方案
          console.log('【步骤4】检查渠道推广方案配置：');
          const [schemes] = await connection.query(
            'SELECT * FROM channel_promotion_schemes WHERE channel_code = ? AND status = ?',
            [channel.channel_code, 'active']
          );

          if (schemes.length === 0) {
            console.log(`❌ 未找到channel_code=${channel.channel_code}且status=active的渠道推广方案！`);
            console.log('   问题：channel_promotion_schemes表中没有对应的配置');
            console.log(`   解决方案：需要在管理员后台为channel_code=${channel.channel_code}创建激活的渠道推广方案\n`);

            // 检查是否有非激活状态的方案
            const [inactiveSchemes] = await connection.query(
              'SELECT * FROM channel_promotion_schemes WHERE channel_code = ?',
              [channel.channel_code]
            );
            if (inactiveSchemes.length > 0) {
              console.log(`   提示：找到非激活状态的方案: ${JSON.stringify(inactiveSchemes[0], null, 2)}`);
            }
          } else {
            const scheme = schemes[0];
            console.log(`✓ 找到渠道推广方案: ID=${scheme.id}, channel_code=${scheme.channel_code}, amount=${scheme.amount}, expiry_days=${scheme.expiry_days}`);
            console.log(`  方案名称: ${scheme.channel_name}, 状态: ${scheme.status}\n`);

            // 5. 检查是否已经发放优惠券
            console.log('【步骤5】检查优惠券发放情况：');
            const [coupons] = await connection.query(
              `SELECT id, discount_code, amount, source, source_user_id, status, start_date, expiry_date,
                      channel_name_for_promotion, channel_sales_id_for_promotion, channel_sales_name_for_promotion
               FROM discount_coupons 
               WHERE user_id = ? AND source = ? AND source_user_id = ?`,
              [user.id, 'channel_invite', inviterUser.id]
            );

            if (coupons.length === 0) {
              console.log('❌ 未找到渠道推广优惠券记录');
              console.log('   这意味着优惠券确实没有被发放');
              console.log('   可能的原因：');
              console.log('   1. 注册时渠道推广方案还未配置');
              console.log('   2. 渠道推广方案的状态不是active');
              console.log('   3. 渠道推广方案的amount为0');
              console.log('   4. 代码逻辑错误导致发放失败\n');

              // 检查是否有其他来源的优惠券
              const [allCoupons] = await connection.query(
                'SELECT id, discount_code, amount, source, source_user_id, status FROM discount_coupons WHERE user_id = ?',
                [user.id]
              );
              if (allCoupons.length > 0) {
                console.log(`   提示：用户有其他优惠券: ${allCoupons.length}张`);
                allCoupons.forEach(c => {
                  console.log(`     - ID=${c.id}, source=${c.source}, amount=${c.amount}, source_user_id=${c.source_user_id}`);
                });
              }
            } else {
              console.log(`✓ 找到渠道推广优惠券: ${coupons.length}张`);
              coupons.forEach(c => {
                console.log(`   - ID=${c.id}, discount_code=${c.discount_code}, amount=${c.amount}, status=${c.status}`);
                console.log(`     来源渠道: ${c.channel_name_for_promotion}, 渠道销售: ${c.channel_sales_id_for_promotion}(${c.channel_sales_name_for_promotion})`);
                console.log(`     有效期: ${c.start_date} 至 ${c.expiry_date}`);
              });
            }
          }
        }
      }
    }

    // 6. 总结
    console.log('\n=== 排查总结 ===');
    console.log('如果优惠券未发放，请按照以下步骤检查：');
    console.log('1. 确认财销1（M85101163）的channel_user_id是否正确设置');
    console.log('2. 确认channels表中对应的渠道方记录存在且channel_code有值');
    console.log('3. 确认channel_promotion_schemes表中有对应的channel_code且status=active');
    console.log('4. 确认渠道推广方案的amount大于0');
    console.log('5. 查看服务器注册日志，确认是否有错误信息');

  } catch (error) {
    console.error('排查过程中出错:', error);
    console.error('错误堆栈:', error.stack);
  } finally {
    if (connection) {
      connection.release();
    }
    // 不需要关闭pool，让进程自然退出
  }
}

debugChannelCouponIssue();

