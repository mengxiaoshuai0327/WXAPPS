const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const moment = require('moment-timezone');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// 设置默认时区为东八区（北京时间）
moment.tz.setDefault('Asia/Shanghai');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/discounts', require('./routes/discounts'));
app.use('/api/evaluations', require('./routes/evaluations'));
app.use('/api/invitations', require('./routes/invitations'));
app.use('/api/rankings', require('./routes/rankings'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/posters', require('./routes/posters'));
app.use('/api/protocols', require('./routes/protocols')); // 协议和隐私条款（小程序前端）
app.use('/api/admin', require('./routes/admin')); // 管理后台通用路由
app.use('/api/courses/admin', require('./routes/admin/courses'));
app.use('/api/admin/instructors', require('./routes/admin/instructors'));
app.use('/api/admin/channels', require('./routes/admin/channels'));
app.use('/api/admin/modules', require('./routes/admin/modules'));
app.use('/api/admin/themes', require('./routes/admin/themes'));
app.use('/api/admin/users', require('./routes/admin/users'));
app.use('/api/admin/bookings', require('./routes/admin/bookings'));
app.use('/api/admin/messages', require('./routes/admin/messages')); // Admin messages management
app.use('/api/admin/discounts', require('./routes/admin/discounts')); // Admin discounts management
app.use('/api/admin/tickets', require('./routes/admin/tickets')); // Admin tickets management
app.use('/api/admin/invoices', require('./routes/admin/invoices')); // Admin invoices management
app.use('/api/admin/evaluations', require('./routes/admin/evaluations')); // Admin evaluations management
app.use('/api/admin/invitations', require('./routes/admin/invitations')); // Admin invitations management
app.use('/api/admin/marketing', require('./routes/admin/marketing')); // Admin marketing campaigns management
app.use('/api/admin/rankings', require('./routes/admin/rankings')); // Admin rankings management
app.use('/api/admin/protocols', require('./routes/admin/protocols')); // Admin protocols management
app.use('/api/admin/coupon-schemes', require('./routes/admin/coupon-schemes')); // Admin coupon schemes management
app.use('/api/admin/channel-promotion-schemes', require('./routes/admin/channel-promotion-schemes')); // Admin channel promotion schemes management
app.use('/api/admin/channel-sales', require('./routes/admin/channel-sales')); // Admin channel sales management
app.use('/api/intentions', require('./routes/intentions')); // Course intentions
app.use('/api/admin/intentions', require('./routes/admin/intentions')); // Admin course intentions management
app.use('/api/schedule-interests', require('./routes/schedule-interests')); // Schedule interests
app.use('/api/cron', require('./routes/cron')); // Cron jobs for scheduled tasks

// 根路径
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'CFO高手私教小班课后端服务运行正常',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/*'
    }
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '服务运行正常' });
});

// 定时任务：自动核销课券和自动完成课程
// 每5分钟执行一次，检查是否有需要核销的课程
const { autoUseTickets, autoCompleteCourses } = require('./utils/scheduler');

if (process.env.NODE_ENV !== 'test') {
  // 每5分钟执行一次自动核销任务
  cron.schedule('*/5 * * * *', async () => {
    try {
      await autoUseTickets();
    } catch (error) {
      console.error('[定时任务] 自动核销失败:', error);
    }
  });
  console.log('定时任务已启动：每5分钟自动核销课券');

  // 每1分钟执行一次自动完成课程任务
  cron.schedule('* * * * *', async () => {
    try {
      await autoCompleteCourses();
    } catch (error) {
      console.error('[定时任务] 自动完成课程失败:', error);
    }
  });
  console.log('定时任务已启动：每分钟自动完成已结束的课程');
}

// 处理未捕获的异常，防止服务器崩溃
process.on('uncaughtException', (error) => {
  console.error('========================================');
  console.error('未捕获的异常:', error);
  console.error('错误堆栈:', error.stack);
  console.error('时间:', new Date().toISOString());
  console.error('========================================');
  // 不退出进程，让服务器继续运行（可以通过日志监控）
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('========================================');
  console.error('未处理的Promise拒绝:', reason);
  if (reason instanceof Error) {
    console.error('错误堆栈:', reason.stack);
  }
  console.error('时间:', new Date().toISOString());
  console.error('========================================');
  // 不退出进程
});

// 定期检查数据库连接（每5分钟）
// 注意：这个检查在服务器启动后才执行，避免阻塞启动
setTimeout(() => {
  const db = require('./config/database');
  setInterval(async () => {
    try {
      await db.query('SELECT 1');
    } catch (error) {
      console.error('数据库连接检查失败:', error.message);
    }
  }, 5 * 60 * 1000);
}, 10000); // 延迟10秒后开始检查

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口，允许从其他设备访问

const server = app.listen(PORT, HOST, () => {
  console.log(`服务器运行在 http://${HOST}:${PORT}`);
  console.log(`本地访问: http://localhost:${PORT}`);
  console.log(`进程ID: ${process.pid}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});

