// 插入示例排行榜数据
const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertRankingData() {
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

    // 先清空现有排行榜数据（可选）
    await connection.query('DELETE FROM rankings');
    console.log('✓ 已清空现有排行榜数据');

    // 获取现有数据
    const [themes] = await connection.query('SELECT id, name FROM course_themes ORDER BY id LIMIT 10');
    const [courses] = await connection.query('SELECT id, title FROM courses ORDER BY id LIMIT 10');
    const [instructors] = await connection.query(
      `SELECT u.id, u.nickname 
       FROM users u 
       WHERE u.role = 'instructor' 
       ORDER BY u.id LIMIT 10`
    );

    console.log(`\n找到 ${themes.length} 个主题, ${courses.length} 个课程, ${instructors.length} 个授课人`);

    const rankingData = [];
    
    // 主题排行榜
    themes.forEach((theme, index) => {
      rankingData.push([
        'theme',
        theme.id,
        (100 - index * 5).toFixed(2), // score
        index + 1, // rank
        JSON.stringify({ name: theme.name }),
        'all',
        1 // published
      ]);
    });
    
    // 课程排行榜
    courses.forEach((course, index) => {
      rankingData.push([
        'course',
        course.id,
        (95 - index * 3).toFixed(2), // score
        index + 1, // rank
        JSON.stringify({ title: course.title }),
        'all',
        1 // published
      ]);
    });
    
    // 授课人排行榜
    instructors.forEach((instructor, index) => {
      rankingData.push([
        'instructor',
        instructor.id,
        (90 - index * 2).toFixed(2), // score
        index + 1, // rank
        JSON.stringify({ name: instructor.nickname }),
        'all',
        1 // published
      ]);
    });

    if (rankingData.length > 0) {
      await connection.query(
        'INSERT INTO rankings (type, target_id, score, `rank`, data, time_range, published) VALUES ?',
        [rankingData]
      );
      console.log(`\n✓ 成功插入 ${rankingData.length} 条排行榜数据`);
      console.log(`  - 主题排行榜: ${themes.length} 条`);
      console.log(`  - 课程排行榜: ${courses.length} 条`);
      console.log(`  - 授课人排行榜: ${instructors.length} 条`);
    } else {
      console.log('\n⚠ 没有找到可用的数据，请先运行 npm run insert-sample 插入示例数据');
    }
    
    await connection.end();
    process.exit(0);

  } catch (error) {
    console.error('\n✗ 插入排行榜数据失败:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n请检查：');
      console.error('1. MySQL 服务是否已启动');
      console.error('2. .env 文件中的数据库配置是否正确');
    }
    
    if (connection) {
      await connection.end();
    }
    process.exit(1);
  }
}

insertRankingData();

