// 创建发票表
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createInvoicesTable() {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'xiaocx_db'
    });

    console.log('✓ 数据库连接成功');

    // 创建发票表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`invoices\` (
        \`id\` INT PRIMARY KEY AUTO_INCREMENT,
        \`user_id\` INT NOT NULL COMMENT '用户ID',
        \`invoice_header\` VARCHAR(200) NOT NULL COMMENT '发票抬头',
        \`tax_number\` VARCHAR(50) COMMENT '税号',
        \`email\` VARCHAR(100) NOT NULL COMMENT '收发票邮箱',
        \`amount\` DECIMAL(10,2) NOT NULL COMMENT '发票金额（折扣后净额）',
        \`ticket_ids\` JSON COMMENT '课券ID列表',
        \`ticket_codes\` TEXT COMMENT '课券编号（逗号分隔）',
        \`status\` ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending' COMMENT '发票状态',
        \`invoice_number\` VARCHAR(50) COMMENT '发票号码',
        \`issued_at\` DATETIME COMMENT '开票时间',
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`),
        INDEX \`idx_user_id\` (\`user_id\`),
        INDEX \`idx_status\` (\`status\`),
        INDEX \`idx_created_at\` (\`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发票表';
    `);

    console.log('✓ 发票表创建成功');
    
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 创建发票表失败:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

createInvoicesTable();






























































