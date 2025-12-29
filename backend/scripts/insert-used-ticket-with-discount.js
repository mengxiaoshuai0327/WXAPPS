// 插入已使用且使用了500元折扣券的课券示例
const mysql = require('mysql2/promise');
require('dotenv').config();
const moment = require('moment');

async function insertUsedTicketWithDiscount() {
  let connection;
  
  try {
    // 连接数据库
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'xiaocx_db'
    });

    console.log('✓ 数据库连接成功');

    await connection.beginTransaction();

    // 1. 查找或创建测试用户
    let [users] = await connection.query("SELECT id, nickname, member_id FROM users WHERE role = 'member' LIMIT 1");
    let testUserId;

    if (users.length === 0) {
      console.log('\n创建测试会员用户...');
      const memberId = `M${moment().format('YYYYMMDD')}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const [userResult] = await connection.query(
        `INSERT INTO users (openid, nickname, real_name, phone, role, member_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [`test_user_${Date.now()}`, '测试会员', '测试用户', `138${Date.now().toString().slice(-8)}`, 'member', memberId]
      );
      testUserId = userResult.insertId;
      console.log(`✓ 创建了测试用户 (ID: ${testUserId}, 会员ID: ${memberId})`);
    } else {
      testUserId = users[0].id;
      console.log(`\n使用现有用户: ${users[0].nickname} (ID: ${testUserId}, 会员ID: ${users[0].member_id})`);
    }

    // 2. 创建已使用的500元折扣券
    console.log('\n创建已使用的500元折扣券...');
    const discountStartDate = moment().subtract(30, 'days').format('YYYY-MM-DD');
    const discountExpiryDate = moment().add(60, 'days').format('YYYY-MM-DD');
    const discountUsedDate = moment().subtract(20, 'days').format('YYYY-MM-DD HH:mm:ss');
    // 生成折扣券编号
    const discountCode = `DC${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;

    const [discountResult] = await connection.query(
      `INSERT INTO discount_coupons (discount_code, user_id, amount, source, start_date, expiry_date, status, used_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [discountCode, testUserId, 500, 'admin', discountStartDate, discountExpiryDate, 'used', discountUsedDate]
    );
    const discountId = discountResult.insertId;
    console.log(`✓ 创建了已使用的折扣券 (ID: ${discountId}, 面值: 500元, 状态: used)`);

    // 3. 创建已使用的课券（使用了500元折扣券）
    console.log('\n创建已使用的课券...');
    const ticketCode = `T${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const ticketPrice = 1500; // 原价
    const discountAmount = 500; // 折扣金额
    const actualAmount = ticketPrice - discountAmount; // 实际支付金额：1000元
    const ticketStartDate = moment().subtract(90, 'days').format('YYYY-MM-DD');
    const ticketExpiryDate = moment().add(90, 'days').format('YYYY-MM-DD');
    const purchasedDate = moment().subtract(20, 'days').format('YYYY-MM-DD HH:mm:ss');
    const usedDate = moment().subtract(10, 'days').format('YYYY-MM-DD HH:mm:ss');

    const [ticketResult] = await connection.query(
      `INSERT INTO tickets (user_id, ticket_code, source, purchase_amount, actual_amount, start_date, expiry_date, purchased_at, used_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [testUserId, ticketCode, 'purchase', ticketPrice, actualAmount, ticketStartDate, ticketExpiryDate, purchasedDate, usedDate, 'used']
    );
    const ticketId = ticketResult.insertId;
    console.log(`✓ 创建了已使用的课券 (ID: ${ticketId}, 课券码: ${ticketCode}, 状态: used)`);
    console.log(`  原价: ¥${ticketPrice}, 折扣: ¥${discountAmount}, 实付: ¥${actualAmount}`);

    await connection.commit();
    console.log('\n✓ 已使用且使用了500元折扣券的课券示例创建成功！');
    console.log('\n数据摘要：');
    console.log(`- 用户ID: ${testUserId}`);
    console.log(`- 折扣券ID: ${discountId} (面值: 500元, 状态: used)`);
    console.log(`- 课券ID: ${ticketId} (课券码: ${ticketCode}, 状态: used)`);
    console.log(`- 购买价格: ¥${ticketPrice}`);
    console.log(`- 折扣金额: ¥${discountAmount}`);
    console.log(`- 实际支付: ¥${actualAmount}`);
    console.log(`- 购买时间: ${purchasedDate}`);
    console.log(`- 使用时间: ${usedDate}`);
    
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 插入数据失败:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    if (connection) {
      await connection.rollback();
      await connection.end();
    }
    process.exit(1);
  }
}

insertUsedTicketWithDiscount();












