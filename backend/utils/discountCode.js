const db = require('../config/database');
const crypto = require('crypto');

// 生成唯一的折扣券编号（格式：DC + 8位数字）
async function generateDiscountCode() {
  let attempts = 0;
  const maxAttempts = 20;
  
  // 方法1：使用随机数生成
  while (attempts < maxAttempts) {
    const randomNum = crypto.randomInt(10000000, 99999999);
    const discountCode = `DC${randomNum}`;
    
    try {
      const [existing] = await db.query(
        'SELECT id FROM discount_coupons WHERE discount_code = ?',
        [discountCode]
      );
      
      if (existing.length === 0) {
        return discountCode;
      }
    } catch (error) {
      // 如果 discount_code 字段不存在，使用备用方案（基于ID生成）
      if (error.message && error.message.includes('discount_code')) {
        console.warn('discount_code 字段不存在，使用备用编号生成方案');
        // 查询当前最大ID，生成基于ID的编号
        const [maxResult] = await db.query('SELECT MAX(id) as max_id FROM discount_coupons');
        const maxId = (maxResult[0]?.max_id || 0) + 1;
        return `DC${String(maxId).padStart(8, '0')}`;
      }
      throw error;
    }
    
    attempts++;
  }
  
  // 方法2：如果随机生成失败，使用时间戳+随机数
  attempts = 0;
  while (attempts < maxAttempts) {
    const timestamp = Date.now().toString().slice(-6); // 取后6位
    const randomSuffix = crypto.randomInt(10, 99); // 2位随机数
    const discountCode = `DC${timestamp}${randomSuffix}`;
    
    try {
      const [existing] = await db.query(
        'SELECT id FROM discount_coupons WHERE discount_code = ?',
        [discountCode]
      );
      
      if (existing.length === 0) {
        return discountCode;
      }
    } catch (error) {
      if (error.message && error.message.includes('discount_code')) {
        const [maxResult] = await db.query('SELECT MAX(id) as max_id FROM discount_coupons');
        const maxId = (maxResult[0]?.max_id || 0) + 1;
        return `DC${String(maxId).padStart(8, '0')}`;
      }
      throw error;
    }
    
    attempts++;
  }
  
  // 方法3：最后的后备方案 - 使用完整时间戳+随机数
  const timestamp = Date.now().toString();
  const randomSuffix = crypto.randomInt(100, 999);
  return `DC${timestamp.slice(-5)}${randomSuffix}`;
}

module.exports = { generateDiscountCode };

