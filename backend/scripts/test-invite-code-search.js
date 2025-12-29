const db = require('../config/database');

async function testInviteCodeSearch() {
  try {
    const inviteCode = 'M31463846';
    
    console.log(`=== 测试邀请码查找逻辑：${inviteCode} ===\n`);
    
    // 1. 查找 member_id
    console.log('1. 查找 member_id:');
    const [members] = await db.query(
      'SELECT id, member_id, instructor_id, role, channel_user_id, real_name FROM users WHERE member_id = ? AND role = ?',
      [inviteCode, 'member']
    );
    console.log(`   结果: ${members.length} 条记录`);
    if (members.length > 0) {
      const m = members[0];
      console.log(`   ✓ 找到会员: id=${m.id}, member_id=${m.member_id}, role=${m.role}, channel_user_id=${m.channel_user_id || 'NULL'}, name=${m.real_name}`);
      
      if (m.channel_user_id) {
        const [channels] = await db.query(
          'SELECT id, channel_code, channel_name FROM channels WHERE id = ?',
          [m.channel_user_id]
        );
        if (channels.length > 0) {
          console.log(`   所属渠道方: ${channels[0].channel_name} (channel_code=${channels[0].channel_code})`);
        }
      }
    }
    
    // 2. 查找 instructor_id（多种格式）
    console.log('\n2. 查找 instructor_id:');
    const formats = [inviteCode, inviteCode.startsWith('I') ? inviteCode.substring(1) : null, /^\d+$/.test(inviteCode) ? `I${inviteCode}` : null].filter(Boolean);
    for (const format of formats) {
      const [instructors] = await db.query(
        'SELECT id, member_id, instructor_id, role, real_name FROM users WHERE instructor_id = ? AND role = ?',
        [format, 'instructor']
      );
      console.log(`   格式 "${format}": ${instructors.length} 条记录`);
      if (instructors.length > 0) {
        console.log(`   ✓ 找到授课人: id=${instructors[0].id}, instructor_id=${instructors[0].instructor_id}, name=${instructors[0].real_name}`);
      }
    }
    
    // 3. 查找渠道方
    console.log('\n3. 查找渠道方:');
    let channelCodePattern = inviteCode;
    if (inviteCode.startsWith('CH')) {
      const channelNum = inviteCode.substring(2);
      channelCodePattern = `channel_${channelNum}`;
    }
    
    const [channels] = await db.query(
      'SELECT id, channel_code, channel_name FROM channels WHERE channel_code = ? OR channel_code = ?',
      [channelCodePattern, inviteCode]
    );
    console.log(`   结果: ${channels.length} 条记录`);
    if (channels.length > 0) {
      const c = channels[0];
      console.log(`   ✓ 找到渠道方: id=${c.id}, channel_code=${c.channel_code}, name=${c.channel_name}`);
      
      // 查找该渠道方的渠道销售
      const [sales] = await db.query(
        'SELECT id, member_id, real_name FROM users WHERE channel_user_id = ? AND role = ? ORDER BY created_at ASC LIMIT 1',
        [c.id, 'member']
      );
      console.log(`   该渠道方的渠道销售: ${sales.length} 条记录`);
      if (sales.length > 0) {
        console.log(`   ✓ 找到渠道销售: id=${sales[0].id}, member_id=${sales[0].member_id}, name=${sales[0].real_name}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('测试失败:', error);
    process.exit(1);
  }
}

testInviteCodeSearch();

