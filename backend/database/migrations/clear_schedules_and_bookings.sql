-- 清除排课列表和课程预定列表的示例数据
-- 注意：此脚本会删除所有排课和预订数据，请谨慎使用

-- 1. 删除评价数据（依赖 course_bookings）
DELETE FROM evaluations;

-- 2. 删除课程预订数据（依赖 course_schedules）
DELETE FROM course_bookings;

-- 3. 删除排课数据
DELETE FROM course_schedules;

-- 重置自增ID（可选，如果需要重新开始计数）
-- ALTER TABLE evaluations AUTO_INCREMENT = 1;
-- ALTER TABLE course_bookings AUTO_INCREMENT = 1;
-- ALTER TABLE course_schedules AUTO_INCREMENT = 1;

