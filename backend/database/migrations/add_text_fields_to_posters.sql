-- 为海报表添加文字相关字段
ALTER TABLE `posters`
ADD COLUMN `text_content` TEXT NULL COMMENT '海报文字内容' AFTER `qr_code_size`,
ADD COLUMN `text_position_x` INT DEFAULT 0 COMMENT '文字X坐标位置（像素）' AFTER `text_content`,
ADD COLUMN `text_position_y` INT DEFAULT 0 COMMENT '文字Y坐标位置（像素）' AFTER `text_position_x`,
ADD COLUMN `text_font_size` INT DEFAULT 32 COMMENT '文字大小（像素）' AFTER `text_position_y`,
ADD COLUMN `text_color` VARCHAR(20) DEFAULT '#000000' COMMENT '文字颜色（十六进制）' AFTER `text_font_size`,
ADD COLUMN `text_align` VARCHAR(20) DEFAULT 'left' COMMENT '文字对齐方式：left, center, right' AFTER `text_color`;

