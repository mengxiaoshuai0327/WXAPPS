-- 创建渠道推广方案表（支持动态添加渠道）
CREATE TABLE IF NOT EXISTS `channel_promotion_schemes` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `channel_code` VARCHAR(50) NOT NULL COMMENT '渠道编码（关联channels表的channel_code，唯一标识渠道）',
  `channel_name` VARCHAR(200) NOT NULL COMMENT '渠道名称',
  `amount` DECIMAL(10,2) NOT NULL DEFAULT 500.00 COMMENT '被邀请人注册奖励金额',
  `expiry_days` INT NOT NULL DEFAULT 30 COMMENT '优惠券有效期（天数，默认1个月）',
  `description` TEXT COMMENT '方案描述',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态：激活/未激活',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_channel_code` (`channel_code`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='渠道推广方案配置表（支持动态添加渠道）';

-- 注意：初始数据需要根据实际的channel_code来插入
-- 这里假设财能渠道的channel_code为'caifu'，其他渠道为'other'
-- 如果实际channel_code不同，需要在管理页面手动添加或修改
INSERT INTO `channel_promotion_schemes` (`channel_code`, `channel_name`, `amount`, `expiry_days`, `description`, `status`) 
SELECT 'caifu', '财能渠道', 500.00, 30, '财能渠道推广方案', 'active'
WHERE NOT EXISTS (SELECT 1 FROM `channel_promotion_schemes` WHERE `channel_code` = 'caifu')
LIMIT 1;

INSERT INTO `channel_promotion_schemes` (`channel_code`, `channel_name`, `amount`, `expiry_days`, `description`, `status`) 
SELECT 'other', '其他渠道', 500.00, 30, '其他渠道推广方案', 'active'
WHERE NOT EXISTS (SELECT 1 FROM `channel_promotion_schemes` WHERE `channel_code` = 'other')
LIMIT 1;
