-- 为instructors表添加is_popular字段（是否热门教练）
ALTER TABLE `instructors`
  ADD COLUMN `is_popular` TINYINT(1) DEFAULT 0 COMMENT '是否热门教练：0=否，1=是' AFTER `background`,
  ADD INDEX `idx_is_popular` (`is_popular`);

