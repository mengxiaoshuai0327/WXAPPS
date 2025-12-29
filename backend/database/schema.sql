-- CFO高手私教小班课数据库结构

-- 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `openid` VARCHAR(100) UNIQUE NOT NULL COMMENT '微信openid',
  `nickname` VARCHAR(100) COMMENT '昵称',
  `real_name` VARCHAR(50) COMMENT '真实姓名',
  `phone` VARCHAR(20) UNIQUE COMMENT '手机号',
  `avatar_url` VARCHAR(500) COMMENT '头像',
  `role` ENUM('visitor', 'member', 'instructor') DEFAULT 'visitor' COMMENT '角色：游客/会员/教练',
  `inviter_id` INT COMMENT '邀请人ID',
  `member_id` VARCHAR(50) UNIQUE COMMENT '会员ID',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_openid` (`openid`),
  INDEX `idx_member_id` (`member_id`),
  INDEX `idx_inviter_id` (`inviter_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 教练信息表
CREATE TABLE IF NOT EXISTS `instructors` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `bio` TEXT COMMENT '个人简介',
  `background` TEXT COMMENT '背景介绍',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教练信息表';

-- 课程模块表
CREATE TABLE IF NOT EXISTS `course_modules` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '模块名称',
  `description` TEXT COMMENT '模块描述',
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程模块表';

-- 课程主题表
CREATE TABLE IF NOT EXISTS `course_themes` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `module_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL COMMENT '主题简称',
  `full_name` VARCHAR(200) NULL COMMENT '主题名称（完整名称）',
  `description` TEXT COMMENT '主题描述，解决什么问题',
  `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态：active=激活，inactive=未激活',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程主题表';

-- 课程表
CREATE TABLE IF NOT EXISTS `courses` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `theme_id` INT NOT NULL,
  `instructor_id` INT NOT NULL,
  `course_code` VARCHAR(50) NOT NULL COMMENT '课程编号',
  `title` VARCHAR(200) NOT NULL COMMENT '课程标题',
  `subtitle` VARCHAR(200) COMMENT '副标题',
  `instructor_intro` TEXT COMMENT '针对此课程的教练简介',
  `course_intro` TEXT COMMENT '课程简介',
  `questionnaire_config` JSON COMMENT '问卷配置（可变内容）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`theme_id`) REFERENCES `course_themes`(`id`),
  FOREIGN KEY (`instructor_id`) REFERENCES `users`(`id`),
  INDEX `idx_course_code` (`course_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程表';

-- 排课表
CREATE TABLE IF NOT EXISTS `course_schedules` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `course_id` INT NOT NULL,
  `schedule_date` DATE NULL COMMENT '上课日期（预排课可为空）',
  `time_slot` ENUM('morning', 'afternoon', 'full_day') NULL COMMENT '时间段：上午/下午/全天（预排课可为空）',
  `start_time` TIME COMMENT '开始时间',
  `end_time` TIME COMMENT '结束时间',
  `max_students` INT NULL COMMENT '最大报名人数（预排课可为空）',
  `location` VARCHAR(200) NULL COMMENT '线下上课地址',
  `current_students` INT DEFAULT 0 COMMENT '当前报名人数',
  `status` ENUM('draft', 'scheduled', 'cancelled', 'completed') DEFAULT 'draft' COMMENT '状态：draft=预排课，scheduled=已排课，cancelled=已取消，completed=已完成',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`),
  INDEX `idx_schedule_date` (`schedule_date`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='排课表';

-- 课程预订表
CREATE TABLE IF NOT EXISTS `course_bookings` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `schedule_id` INT NOT NULL,
  `ticket_id` INT COMMENT '使用的课券ID',
  `status` ENUM('booked', 'cancelled', 'completed') DEFAULT 'booked',
  `booked_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `cancelled_at` DATETIME,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`schedule_id`) REFERENCES `course_schedules`(`id`),
  FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_schedule_id` (`schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程预订表';

-- 课券表
CREATE TABLE IF NOT EXISTS `tickets` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL COMMENT '拥有者',
  `ticket_code` VARCHAR(50) UNIQUE NOT NULL COMMENT '课券编号',
  `source` ENUM('purchase', 'gift', 'admin', 'instructor_reward') NOT NULL COMMENT '来源',
  `source_user_id` INT COMMENT '来源用户ID（如赠予人）',
  `status` ENUM('unused', 'booked', 'used', 'expired', 'gifted') DEFAULT 'unused' COMMENT '状态',
  `gift_status` ENUM('waiting', 'unused', 'booked', 'used', 'expired') COMMENT '赠予状态',
  `purchase_amount` DECIMAL(10,2) DEFAULT 0 COMMENT '购买金额',
  `actual_amount` DECIMAL(10,2) DEFAULT 0 COMMENT '实际支付金额',
  `start_date` DATE COMMENT '有效期开始',
  `expiry_date` DATE COMMENT '有效期结束',
  `purchased_at` DATETIME COMMENT '购买时间',
  `used_at` DATETIME COMMENT '使用时间',
  `gifted_at` DATETIME COMMENT '赠予时间',
  `invoice_status` ENUM('unissued', 'issued') DEFAULT 'unissued' COMMENT '发票状态',
  `invoice_amount` DECIMAL(10,2) COMMENT '发票金额',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`source_user_id`) REFERENCES `users`(`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_expiry_date` (`expiry_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课券表';

-- 折扣券表
CREATE TABLE IF NOT EXISTS `discount_coupons` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `amount` DECIMAL(10,2) NOT NULL COMMENT '折扣金额',
  `source` ENUM('invite_register', 'invite_purchase', 'instructor_reward', 'admin') NOT NULL COMMENT '来源',
  `source_user_id` INT COMMENT '来源用户ID',
  `status` ENUM('unused', 'used', 'expired') DEFAULT 'unused',
  `expiry_date` DATE COMMENT '过期时间',
  `used_at` DATETIME COMMENT '使用时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='折扣券表';

-- 评价表
CREATE TABLE IF NOT EXISTS `evaluations` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `schedule_id` INT NOT NULL,
  `course_id` INT NOT NULL,
  `answers` JSON COMMENT '选择题答案',
  `feedback` TEXT COMMENT '开放题反馈',
  `status` ENUM('draft', 'submitted', 'hidden') DEFAULT 'submitted',
  `submitted_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`schedule_id`) REFERENCES `course_schedules`(`id`),
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`),
  INDEX `idx_schedule_id` (`schedule_id`),
  INDEX `idx_course_id` (`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评价表';

-- 评价评论表
CREATE TABLE IF NOT EXISTS `evaluation_comments` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `evaluation_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `parent_id` INT COMMENT '父评论ID（回复）',
  `content` TEXT NOT NULL,
  `status` ENUM('normal', 'hidden', 'deleted') DEFAULT 'normal',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`evaluation_id`) REFERENCES `evaluations`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`parent_id`) REFERENCES `evaluation_comments`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评价评论表';

-- 邀请表
CREATE TABLE IF NOT EXISTS `invitations` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `inviter_id` INT NOT NULL COMMENT '邀请人',
  `invitee_id` INT COMMENT '被邀请人',
  `course_id` INT COMMENT '邀请的课程ID',
  `invite_code` VARCHAR(50) UNIQUE NOT NULL COMMENT '邀请码',
  `custom_message` TEXT COMMENT '个性化邀请文字',
  `status` ENUM('pending', 'registered', 'purchased') DEFAULT 'pending',
  `registered_at` DATETIME COMMENT '注册时间',
  `purchased_at` DATETIME COMMENT '购券时间',
  `reward_issued` BOOLEAN DEFAULT FALSE COMMENT '奖励是否发放',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`inviter_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`invitee_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`),
  INDEX `idx_inviter_id` (`inviter_id`),
  INDEX `idx_invite_code` (`invite_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请表';

-- 排行榜表
CREATE TABLE IF NOT EXISTS `rankings` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `type` ENUM('theme', 'course', 'instructor', 'member_study', 'member_invite') NOT NULL,
  `target_id` INT NOT NULL COMMENT '目标ID',
  `score` DECIMAL(10,2) COMMENT '评分',
  `rank` INT COMMENT '排名',
  `data` JSON COMMENT '排行榜数据',
  `time_range` ENUM('month', 'quarter', 'all') DEFAULT 'all',
  `published` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_type` (`type`),
  INDEX `idx_published` (`published`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='排行榜表';

-- 系统消息表
CREATE TABLE IF NOT EXISTS `system_messages` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT COMMENT '用户ID，NULL表示全体',
  `type` ENUM('system', 'course_cancelled', 'evaluation_reminder', 'ticket_expiring', 'invite_reward') NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT,
  `read` BOOLEAN DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_read` (`read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统消息表';

-- 问卷配置表
CREATE TABLE IF NOT EXISTS `questionnaire_config` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `question_id` VARCHAR(50) NOT NULL,
  `question_text` VARCHAR(500) NOT NULL,
  `question_type` ENUM('single', 'multiple', 'text') DEFAULT 'single',
  `options` JSON COMMENT '选项（选择题）',
  `sort_order` INT DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='问卷配置表';

-- Banner配置表
CREATE TABLE IF NOT EXISTS `banners` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `image_url` VARCHAR(500) NOT NULL,
  `link_type` ENUM('none', 'course', 'url') DEFAULT 'none',
  `link_value` VARCHAR(500),
  `sort_order` INT DEFAULT 0,
  `status` ENUM('active', 'inactive') DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Banner配置表';

-- 邀请背景图配置
CREATE TABLE IF NOT EXISTS `invitation_backgrounds` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `image_url` VARCHAR(500) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邀请背景图配置';

-- 操作日志表
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT,
  `action` VARCHAR(100) NOT NULL,
  `table_name` VARCHAR(50),
  `record_id` INT,
  `data` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

