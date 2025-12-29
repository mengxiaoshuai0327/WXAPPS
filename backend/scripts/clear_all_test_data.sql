-- 清空所有测试数据脚本
-- 注意：此脚本会删除所有数据，但保留表结构
-- 按照外键依赖顺序删除，避免外键约束错误

-- 1. 删除操作日志（没有外键依赖）
DELETE FROM operation_logs;

-- 2. 删除系统消息（依赖 users）
DELETE FROM system_messages;

-- 3. 删除课程评价（依赖 users, courses, course_schedules）
DELETE FROM evaluations;

-- 4. 删除课程预订（依赖 tickets, course_schedules, users）
DELETE FROM course_bookings;

-- 5. 删除排课（依赖 courses）
DELETE FROM course_schedules;

-- 6. 删除课程意向（依赖 users）
DELETE FROM course_intentions;

-- 7. 删除发票（依赖 users, tickets）
DELETE FROM invoices;

-- 8. 删除课券（依赖 users）
DELETE FROM tickets;

-- 9. 删除折扣券（依赖 users）
DELETE FROM discount_coupons;

-- 10. 删除邀请记录（依赖 users）
DELETE FROM invitations;

-- 11. 删除课程（依赖 course_themes, users）
DELETE FROM courses;

-- 注意：以下表通常包含配置数据，根据需求决定是否清空
-- course_themes (主题) - 通常保留配置数据
-- course_modules (模块) - 通常保留配置数据
-- users (用户) - 根据需求决定是否清空

-- 重置自增ID（可选，如果需要从1开始计数）
-- ALTER TABLE operation_logs AUTO_INCREMENT = 1;
-- ALTER TABLE system_messages AUTO_INCREMENT = 1;
-- ALTER TABLE evaluations AUTO_INCREMENT = 1;
-- ALTER TABLE course_bookings AUTO_INCREMENT = 1;
-- ALTER TABLE course_schedules AUTO_INCREMENT = 1;
-- ALTER TABLE course_intentions AUTO_INCREMENT = 1;
-- ALTER TABLE invoices AUTO_INCREMENT = 1;
-- ALTER TABLE tickets AUTO_INCREMENT = 1;
-- ALTER TABLE discount_coupons AUTO_INCREMENT = 1;
-- ALTER TABLE invitations AUTO_INCREMENT = 1;
-- ALTER TABLE courses AUTO_INCREMENT = 1;

SELECT '✓ 所有测试数据已清空' as result;

