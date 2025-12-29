// 使用 Node.js 生成简单的 TabBar 图标
// 需要安装: npm install canvas

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const icons = [
  { name: 'home', symbol: '🏠', text: '首页' },
  { name: 'schedule', symbol: '📅', text: '课程表' },
  { name: 'ranking', symbol: '🏆', text: '排行榜' },
  { name: 'profile', symbol: '👤', text: '我的' }
];

const size = 81;

function createIcon(name, symbol, isActive) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // 背景色
  const bgColor = isActive ? '#1a1a1a' : '#999999';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  
  // 绘制图标（使用emoji或文字）
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, size / 2, size / 2);
  
  return canvas;
}

// 生成所有图标
icons.forEach(icon => {
  // 未选中状态
  const canvas1 = createIcon(icon.name, icon.symbol, false);
  const buffer1 = canvas1.toBuffer('image/png');
  fs.writeFileSync(path.join(__dirname, `${icon.name}.png`), buffer1);
  console.log(`✓ 生成 ${icon.name}.png`);
  
  // 选中状态
  const canvas2 = createIcon(icon.name, icon.symbol, true);
  const buffer2 = canvas2.toBuffer('image/png');
  fs.writeFileSync(path.join(__dirname, `${icon.name}-active.png`), buffer2);
  console.log(`✓ 生成 ${icon.name}-active.png`);
});

console.log('\n所有图标已生成完成！');

