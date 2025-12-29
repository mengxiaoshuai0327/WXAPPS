// 日期工具：统一使用东八区（北京时间）
const moment = require('moment-timezone');

// 设置默认时区为东八区（北京时间）
moment.tz.setDefault('Asia/Shanghai');

/**
 * 获取当前时间（东八区）
 */
function getNow() {
  return moment.tz('Asia/Shanghai');
}

/**
 * 格式化日期为 YYYY-MM-DD（东八区）
 */
function formatDate(date, format = 'YYYY-MM-DD') {
  if (!date) return null;
  return moment.tz(date, 'Asia/Shanghai').format(format);
}

/**
 * 解析日期字符串（东八区）
 */
function parseDate(dateString, format = 'YYYY-MM-DD') {
  if (!dateString) return null;
  return moment.tz(dateString, format, 'Asia/Shanghai');
}

/**
 * 获取今天的日期（东八区）
 */
function today() {
  return moment.tz('Asia/Shanghai').startOf('day');
}

/**
 * 比较日期（东八区）
 */
function isBefore(date1, date2) {
  // 如果传入的是moment对象，直接使用；否则转换为moment对象
  const d1 = moment.isMoment(date1) ? date1.tz('Asia/Shanghai') : moment.tz(date1, 'Asia/Shanghai');
  const d2 = moment.isMoment(date2) ? date2.tz('Asia/Shanghai') : moment.tz(date2, 'Asia/Shanghai');
  return d1.isBefore(d2);
}

/**
 * 比较日期（东八区）
 */
function isAfter(date1, date2) {
  // 如果传入的是moment对象，直接使用；否则转换为moment对象
  const d1 = moment.isMoment(date1) ? date1.tz('Asia/Shanghai') : moment.tz(date1, 'Asia/Shanghai');
  const d2 = moment.isMoment(date2) ? date2.tz('Asia/Shanghai') : moment.tz(date2, 'Asia/Shanghai');
  return d1.isAfter(d2);
}

/**
 * 比较日期（东八区）
 */
function isSame(date1, date2, unit = 'day') {
  // 如果传入的是moment对象，直接使用；否则转换为moment对象
  const d1 = moment.isMoment(date1) ? date1.tz('Asia/Shanghai') : moment.tz(date1, 'Asia/Shanghai');
  const d2 = moment.isMoment(date2) ? date2.tz('Asia/Shanghai') : moment.tz(date2, 'Asia/Shanghai');
  return d1.isSame(d2, unit);
}

/**
 * 格式化日期时间字符串（处理各种格式，统一返回 YYYY-MM-DD，使用东八区）
 * 关键：对于纯日期字符串（如"2025-12-10"），直接返回，不进行时区转换
 */
function normalizeDateString(dateString) {
  if (!dateString) return '';
  
  const str = dateString.toString().trim();
  
  // 如果已经是 YYYY-MM-DD 格式，直接返回（不进行任何时区转换）
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return str;
  }
  
  // 如果是Date对象，使用东八区转换
  if (dateString instanceof Date) {
    // 获取年月日，使用本地时区（避免时区转换问题）
    const year = dateString.getFullYear();
    const month = String(dateString.getMonth() + 1).padStart(2, '0');
    const day = String(dateString.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // 如果是 ISO 格式（包含T），提取日期部分，避免时区转换
  if (str.includes('T')) {
    // 先提取日期部分（T之前的部分）
    const datePart = str.split('T')[0];
    // 如果日期部分格式正确，直接返回
    if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return datePart;
    }
    // 否则尝试解析
    const parsed = moment.tz(str, 'Asia/Shanghai');
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
    return datePart;
  }
  
  // 如果包含空格（日期时间格式），提取日期部分
  if (str.includes(' ')) {
    const datePart = str.split(' ')[0];
    // 如果日期部分格式正确，直接返回
    if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return datePart;
    }
    // 否则尝试解析
    const parsed = moment.tz(str, 'YYYY-MM-DD HH:mm:ss', 'Asia/Shanghai');
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
    return datePart;
  }
  
  // 尝试使用moment解析并格式化（使用东八区）
  const parsed = moment.tz(str, 'YYYY-MM-DD', 'Asia/Shanghai');
  if (parsed.isValid()) {
    return parsed.format('YYYY-MM-DD');
  }
  
  // 最后尝试默认格式
  const parsed2 = moment.tz(str, 'Asia/Shanghai');
  if (parsed2.isValid()) {
    return parsed2.format('YYYY-MM-DD');
  }
  
  return str;
}

module.exports = {
  moment, // 导出 moment 本身，不是 moment.tz
  now: getNow,
  formatDate,
  parseDate,
  today,
  isBefore,
  isAfter,
  isSame,
  normalizeDateString
};

