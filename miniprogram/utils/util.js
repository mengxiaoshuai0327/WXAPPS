// utils/util.js

// 格式化日期
function formatDate(date, format = 'YYYY-MM-DD') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day);
}

// 格式化时间
function formatTime(time) {
  const t = new Date(time);
  const hours = String(t.getHours()).padStart(2, '0');
  const minutes = String(t.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 获取星期
function getWeekday(date) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(date);
  return weekdays[d.getDay()];
}

module.exports = {
  formatDate,
  formatTime,
  getWeekday
};

