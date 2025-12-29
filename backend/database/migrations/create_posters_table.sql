-- 创建海报模板表
CREATE TABLE IF NOT EXISTS `posters` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL COMMENT '海报名称',
  `image_url` VARCHAR(500) NOT NULL COMMENT '海报图片URL',
  `qr_code_position_x` INT DEFAULT 0 COMMENT '二维码X坐标位置（像素）',
  `qr_code_position_y` INT DEFAULT 0 COMMENT '二维码Y坐标位置（像素）',
  `qr_code_size` INT DEFAULT 300 COMMENT '二维码大小（像素）',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态：激活/未激活',
  `sort_order` INT DEFAULT 0 COMMENT '排序顺序',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_status` (`status`),
  INDEX `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请海报模板表';

