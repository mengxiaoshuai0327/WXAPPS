// TabBar 图标下载脚本
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const iconsDir = __dirname;

// 图标配置
const icons = [
  {
    name: 'home',
    url: 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/icons/System/home-line.svg',
    activeUrl: 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/icons/System/home-fill.svg'
  },
  {
    name: 'schedule',
    url: 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/icons/System/calendar-check-line.svg',
    activeUrl: 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/icons/System/calendar-check-fill.svg'
  },
  {
    name: 'ranking',
    url: 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/icons/System/trophy-line.svg',
    activeUrl: 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/icons/System/trophy-fill.svg'
  },
  {
    name: 'profile',
    url: 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/icons/User/user-line.svg',
    activeUrl: 'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/icons/User/user-fill.svg'
  }
];

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function downloadIcons() {
  console.log('开始下载 TabBar 图标...\n');

  for (const icon of icons) {
    try {
      console.log(`下载 ${icon.name} 图标...`);
      
      // 下载未选中状态（SVG格式）
      const svgPath = path.join(iconsDir, `${icon.name}.svg`);
      await downloadFile(icon.url, svgPath);
      console.log(`  ✓ ${icon.name}.svg 下载成功`);

      // 下载选中状态
      const activeSvgPath = path.join(iconsDir, `${icon.name}-active.svg`);
      await downloadFile(icon.activeUrl, activeSvgPath);
      console.log(`  ✓ ${icon.name}-active.svg 下载成功`);
    } catch (error) {
      console.error(`  ✗ ${icon.name} 下载失败:`, error.message);
    }
  }

  console.log('\n下载完成！');
  console.log('\n注意：下载的是 SVG 格式，需要转换为 PNG 格式（81px × 81px）');
  console.log('可以使用在线工具转换：https://cloudconvert.com/svg-to-png');
  console.log('或使用 ImageMagick: convert icon.svg -resize 81x81 icon.png');
}

downloadIcons().catch(console.error);

