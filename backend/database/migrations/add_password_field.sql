-- 添加密码字段到users表
-- 注意：openid改为可空，因为不再强制使用微信认证

ALTER TABLE `users` 
  MODIFY COLUMN `openid` VARCHAR(100) UNIQUE COMMENT '微信openid（可选）',
  ADD COLUMN `password` VARCHAR(255) COMMENT '密码（加密存储）' AFTER `phone`;

