const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

// 确保加载 .env 文件
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath });

// 如果环境变量未设置，直接从 .env 文件读取
if (!process.env.DB_PASSWORD && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key === 'DB_PASSWORD' && valueParts.length > 0) {
        process.env.DB_PASSWORD = valueParts.join('=').trim();
        break;
      }
    }
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'xiaocx_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00' // 设置数据库时区为东八区（北京时间）
});

// 确保每次连接都设置时区为东八区
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+08:00'");
});

module.exports = pool;

