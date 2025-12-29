-- 添加渠道简称字段
ALTER TABLE `channels` 
  ADD COLUMN `channel_short_name` VARCHAR(100) COMMENT '渠道简称' AFTER `channel_name`;

