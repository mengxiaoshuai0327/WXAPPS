// 检查用户邀请关系及优惠券发放情况
// 用户：赵五（M23201355），邀请码：联想1（M96143951）

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../config/database');

async function checkUserInvitation() {
  let connection;
  
  try {
    connection = await db.getConnection();
    
    console.log('=== 检查用户邀请关系及优惠券发放情况 ===\n');
    console.log('用户：赵五（M23201355）');
    console.log('邀请码：联想1（M96143951）\n');

    // 1. 检查被邀请人（赵五）的信息
    console.log('【步骤1】检查被邀请人（M23201355）的信息：');
    const [newUser] = await connection.query(
      'SELECT id, member_id, nickname, real_name, inviter_id, role, created_at FROM users WHERE member_id = ?',
      ['M23201355']
    );

    if (newUser.length === 0) {
      console.log('❌ 未找到用户M23201355');
      return;
    }

    const user = newUser[0];
    console.log(`✓ 找到用户: ID=${user.id}, member_id=${user.member_id}, name=${user.real_name || user.nickname}, inviter_id=${user.inviter_id}, role=${user.role}`);
    console.log(`  注册时间: ${user.created_at}\n`);

    // 2. 检查邀请人（联想1）的信息
    console.log('【步骤2】检查邀请人（M96143951）的信息：');
    const [inviter] = await connection.query(
      'SELECT id, member_id, instructor_id, channel_id, role, channel_user_id, nickname, real_name FROM users WHERE member_id = ?',
      ['M96143951']
    );

    if (inviter.length === 0) {
      console.log('❌ 未找到邀请人M96143951');
      return;
    }

    const inviterUser = inviter[0];
    console.log(`✓ 找到邀请人: ID=${inviterUser.id}, member_id=${inviterUser.member_id}, role=${inviterUser.role}, channel_user_id=${inviterUser.channel_user_id}`);
    
    // 3. 验证邀请关系
    if (user.inviter_id !== inviterUser.id) {
      console.log(`⚠️  警告：用户的inviter_id(${user.inviter_id})与邀请人ID(${inviterUser.id})不匹配！`);
      console.log('   这可能意味着邀请关系没有正确建立。\n');
    } else {
      console.log(`✓ 邀请关系正确：用户的inviter_id=${user.inviter_id}匹配邀请人ID\n`);
    }
    
    if (!inviterUser.channel_user_id) {
      console.log('❌ 问题：邀请人没有设置channel_user_id，因此无法识别为渠道销售！');
      console.log('   解决方案：需要在users表中为联想1（M96143951）设置正确的channel_user_id（指向对应的渠道方ID）\n');
      return;
    } else {
      console.log(`✓ 邀请人是渠道销售，所属渠道方ID: ${inviterUser.channel_user_id}\n`);
    }

    // 4. 检查渠道方信息
    console.log('【步骤4】检查渠道方信息：');
    const [channels] = await connection.query(
      'SELECT id, channel_code, channel_name, channel_short_name FROM channels WHERE id = ?',
      [inviterUser.channel_user_id]
    );

    if (channels.length === 0) {
      console.log(`❌ 未找到channel_user_id=${inviterUser.channel_user_id}对应的渠道方记录`);
      console.log('   问题：channels表中不存在对应的渠道方记录\n');
      return;
    }

    const channel = channels[0];
    console.log(`✓ 找到渠道方: ID=${channel.id}, channel_code=${channel.channel_code || '(空)'}, channel_name=${channel.channel_name}`);
    
    if (!channel.channel_code) {
      console.log('❌ 问题：渠道方的channel_code为空！');
      console.log('   解决方案：需要在channels表中为渠道方设置channel_code\n');
      return;
    } else {
      console.log(`✓ channel_code: ${channel.channel_code}\n`);

      // 5. 检查渠道推广方案
      console.log('【步骤5】检查渠道推广方案配置：');
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
          console.log(`   提示：找到非激活状态的方案: ID=${inactiveSchemes[0].id}, status=${inactiveSchemes[0].status}`);
        }
      } else {
        const scheme = schemes[0];
        console.log(`✓ 找到渠道推广方案: ID=${scheme.id}, channel_code=${scheme.channel_code}, amount=${scheme.amount}, expiry_days=${scheme.expiry_days}`);
        console.log(`  方案名称: ${scheme.channel_name}, 状态: ${scheme.status}\n`);

        // 6. 检查是否已经发放优惠券
        console.log('【步骤6】检查优惠券发放情况：');
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
          console.log('   1. 注册时渠道推广方案还未配置或状态不是active');
          console.log('   2. 渠道推广方案的amount为0');
          console.log('   3. 代码逻辑错误导致发放失败');
          console.log('   4. 注册时inviter_id没有正确设置\n');

          // 检查是否有其他来源的优惠券
          const [allCoupons] = await connection.query(
            'SELECT id, discount_code, amount, source, source_user_id, status FROM discount_coupons WHERE user_id = ?',
            [user.id]
          );
          if (allCoupons.length > 0) {
            console.log(`   提示：用户有其他优惠券: ${allCoupons.length}张`);
            allCoupons.forEach(c => {
              console.log(`     - ID=${c.id}, source=${c.source}, amount=${c.amount}, source_user_id=${c.source_user_id}, status=${c.status}`);
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

    console.log('\n=== 排查总结 ===');
    console.log('如果优惠券未发放，请按照以下步骤检查：');
    console.log('1. 确认联想1（M96143951）的channel_user_id是否正确设置');
    console.log('2. 确认channels表中对应的渠道方记录存在且channel_code有值');
    console.log('3. 确认channel_promotion_schemes表中有对应的channel_code且status=active');
    console.log('4. 确认渠道推广方案的amount大于0');
    console.log('5. 查看服务器注册日志，确认是否有错误信息');
    console.log('6. 确认用户注册时的inviter_id是否正确设置');

  } catch (error) {
    console.error('排查过程中出错:', error);
    console.error('错误堆栈:', error.stack);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

checkUserInvitation();

