-- 为排课表添加draft状态，支持预排课
ALTER TABLE `course_schedules` 
MODIFY COLUMN `status` ENUM('draft', 'scheduled', 'cancelled', 'completed') DEFAULT 'draft' COMMENT '状态：draft=预排课，scheduled=已排课，cancelled=已取消，completed=已完成';

-- 允许预排课的日期、时间、人数字段为NULL
ALTER TABLE `course_schedules` 
MODIFY COLUMN `schedule_date` DATE NULL COMMENT '上课日期（预排课可为空）',
MODIFY COLUMN `time_slot` ENUM('morning', 'afternoon', 'full_day') NULL COMMENT '时间段：上午/下午/全天（预排课可为空）',
MODIFY COLUMN `max_students` INT NULL COMMENT '最大报名人数（预排课可为空）';

