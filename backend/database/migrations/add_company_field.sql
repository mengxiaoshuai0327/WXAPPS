-- 添加机构/公司字段到users表

ALTER TABLE `users` 
  ADD COLUMN `company` VARCHAR(200) COMMENT '所在机构或公司' AFTER `real_name`;


