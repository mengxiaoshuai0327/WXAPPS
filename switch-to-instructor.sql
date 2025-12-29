-- 切换当前用户为授课人角色
-- 请将 <user_id> 替换为实际的用户ID

-- 1. 查看当前用户列表（找到你的用户ID）
SELECT id, openid, nickname, role, member_id FROM users ORDER BY id DESC LIMIT 10;

-- 2. 更新用户角色为授课人（将 4 替换为你的用户ID）
UPDATE users SET role = 'instructor' WHERE id = 4;

-- 3. 如果还没有授课人信息记录，创建一条（将 4 替换为你的用户ID）
INSERT INTO instructors (user_id, bio, background) 
VALUES (4, '授课人简介', '授课人背景介绍')
ON DUPLICATE KEY UPDATE user_id = user_id;

-- 4. 验证更新结果
SELECT id, openid, nickname, role FROM users WHERE id = 4;





























































