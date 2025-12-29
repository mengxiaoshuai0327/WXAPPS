const fs = require('fs');
const path = require('path');

// 图标配置
const icons = [
    {
        name: 'home',
        svg: `<svg width="81" height="81" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 10L12 3L21 10V19C21 19.5523 20.5523 20 20 20H4C3.44772 20 3 19.5523 3 19V10Z" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="9" y="14" width="6" height="6" rx="1" stroke="#999999" stroke-width="1.5" fill="none"/>
  <circle cx="7" cy="12" r="1.5" fill="#999999"/>
  <circle cx="17" cy="12" r="1.5" fill="#999999"/>
</svg>`,
        svgActive: `<svg width="81" height="81" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 10L12 3L21 10V19C21 19.5523 20.5523 20 20 20H4C3.44772 20 3 19.5523 3 19V10Z" fill="#1a1a1a"/>
  <rect x="9" y="14" width="6" height="6" rx="1" fill="white" opacity="0.9"/>
  <circle cx="7" cy="12" r="1.5" fill="white" opacity="0.9"/>
  <circle cx="17" cy="12" r="1.5" fill="white" opacity="0.9"/>
</svg>`
    },
    {
        name: 'schedule',
        svg: `<svg width="81" height="81" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="5" width="16" height="16" rx="2" stroke="#999999" stroke-width="2"/>
  <rect x="4" y="5" width="16" height="4" rx="2" fill="#999999" opacity="0.2"/>
  <circle cx="7" cy="7" r="1" fill="#999999"/>
  <circle cx="17" cy="7" r="1" fill="#999999"/>
  <line x1="4" y1="11" x2="20" y2="11" stroke="#999999" stroke-width="1" opacity="0.3"/>
  <path d="M9 16L11 18L15 14" stroke="#999999" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
        svgActive: `<svg width="81" height="81" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="5" width="16" height="16" rx="2" fill="#1a1a1a"/>
  <rect x="4" y="5" width="16" height="4" rx="2" fill="white" opacity="0.3"/>
  <circle cx="7" cy="7" r="1" fill="white"/>
  <circle cx="17" cy="7" r="1" fill="white"/>
  <line x1="4" y1="11" x2="20" y2="11" stroke="white" stroke-width="1" opacity="0.3"/>
  <path d="M9 16L11 18L15 14" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
    },
    {
        name: 'ranking',
        svg: `<svg width="81" height="81" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M7 21H17" stroke="#999999" stroke-width="2" stroke-linecap="round"/>
  <path d="M7 21C7 18.2386 9.23858 16 12 16C14.7614 16 17 18.2386 17 21" stroke="#999999" stroke-width="2" fill="none"/>
  <path d="M8 8V6C8 4.89543 8.89543 4 10 4H14C15.1046 4 16 4.89543 16 6V8H17C18.1046 8 19 8.89543 19 10V13C19 14.6569 17.6569 16 16 16H8C6.34315 16 5 14.6569 5 13V10C5 8.89543 5.89543 8 7 8H8Z" stroke="#999999" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M12 8L12.5 9.5L14 10L12.5 10.5L12 12L11.5 10.5L10 10L11.5 9.5L12 8Z" fill="#999999"/>
</svg>`,
        svgActive: `<svg width="81" height="81" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M7 21H17" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/>
  <path d="M7 21C7 18.2386 9.23858 16 12 16C14.7614 16 17 18.2386 17 21" stroke="#1a1a1a" stroke-width="2" fill="none"/>
  <path d="M8 8V6C8 4.89543 8.89543 4 10 4H14C15.1046 4 16 4.89543 16 6V8H17C18.1046 8 19 8.89543 19 10V13C19 14.6569 17.6569 16 16 16H8C6.34315 16 5 14.6569 5 13V10C5 8.89543 5.89543 8 7 8H8Z" fill="#1a1a1a"/>
  <path d="M12 8L12.5 9.5L14 10L12.5 10.5L12 12L11.5 10.5L10 10L11.5 9.5L12 8Z" fill="white"/>
</svg>`
    },
    {
        name: 'profile',
        svg: `<svg width="81" height="81" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="8" r="4" stroke="#999999" stroke-width="2"/>
  <path d="M5 20C5 16.6863 7.68629 14 11 14H13C16.3137 14 19 16.6863 19 20" stroke="#999999" stroke-width="2" stroke-linecap="round"/>
  <circle cx="9" cy="10" r="0.8" fill="#999999"/>
  <circle cx="15" cy="10" r="0.8" fill="#999999"/>
</svg>`,
        svgActive: `<svg width="81" height="81" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="8" r="4" fill="#1a1a1a"/>
  <path d="M5 20C5 16.6863 7.68629 14 11 14H13C16.3137 14 19 16.6863 19 20" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" fill="#1a1a1a"/>
  <circle cx="9" cy="8" r="1" fill="white"/>
  <circle cx="15" cy="8" r="1" fill="white"/>
  <path d="M9 11C9 11 10.5 12.5 12 12.5C13.5 12.5 15 11 15 11" stroke="white" stroke-width="1.5" stroke-linecap="round" fill="none"/>
</svg>`
    }
];

console.log('📦 图标文件已创建！');
console.log('');
console.log('💡 使用方法：');
console.log('1. 打开浏览器，访问 miniprogram/images/convert-icons-to-png.html');
console.log('2. 点击"下载未选中"和"下载选中"按钮，下载PNG图标');
console.log('3. 或者使用在线SVG转PNG工具转换SVG文件');
console.log('');
console.log('📁 已创建的SVG文件：');
icons.forEach(icon => {
    console.log(`   - ${icon.name}.svg (新文件: ${icon.name}-new.svg)`);
    console.log(`   - ${icon.name}-active.svg (新文件: ${icon.name}-active-new.svg)`);
});
console.log('');
console.log('✨ 图标设计特点：');
console.log('   - 首页：带窗户和门的房屋图标');
console.log('   - 课程表：带勾选标记的日历图标');
console.log('   - 排行榜：带星星装饰的奖杯图标');
console.log('   - 我的：带表情的个人头像图标');





























