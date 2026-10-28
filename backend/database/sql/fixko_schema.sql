-- Fixko MySQL schema and campus room inventory for XAMPP/phpMyAdmin.
-- This is the final schema represented by the Laravel migrations. Import this
-- file OR run `php artisan migrate --seed`; do not use both setup paths.

CREATE DATABASE IF NOT EXISTS `fixko`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `fixko`;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `migrations`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `repair_history`;
DROP TABLE IF EXISTS `feedback`;
DROP TABLE IF EXISTS `ticket_status_histories`;
DROP TABLE IF EXISTS `comments`;
DROP TABLE IF EXISTS `reports`;
DROP TABLE IF EXISTS `rooms`;
DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `cache_locks`;
DROP TABLE IF EXISTS `cache`;
DROP TABLE IF EXISTS `personal_access_tokens`;
DROP TABLE IF EXISTS `password_reset_tokens`;
DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(60) NULL,
  `last_name` VARCHAR(60) NULL,
  `middle_name` VARCHAR(60) NULL,
  `email` VARCHAR(255) NOT NULL,
  `school_id` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `department` VARCHAR(255) NULL,
  `email_verified_at` TIMESTAMP NULL,
  `remember_token` VARCHAR(100) NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  UNIQUE KEY `users_school_id_unique` (`school_id`),
  CONSTRAINT `users_school_email_format_check`
    CHECK (`role` = 'admin' OR `email` REGEXP '^[A-Za-z]+(\\.[A-Za-z]+)+@phinmaed\\.com$')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `rooms` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `building` VARCHAR(255) NOT NULL,
  `floor` VARCHAR(255) NULL,
  `name` VARCHAR(255) NOT NULL,
  `code` VARCHAR(255) NULL,
  `department` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rooms_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reports` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reporter_id` BIGINT UNSIGNED NOT NULL,
  `reporter_school_id_snapshot` VARCHAR(255) NOT NULL,
  `reporter_email_snapshot` VARCHAR(255) NOT NULL,
  `room_id` BIGINT UNSIGNED NOT NULL,
  `equipment_id` BIGINT UNSIGNED NULL,
  `category` VARCHAR(255) NULL,
  `item_name` VARCHAR(255) NULL,
  `condition` VARCHAR(255) NULL,
  `quantity` INT UNSIGNED NULL,
  `description` TEXT NOT NULL,
  `priority` ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
  `status` ENUM('pending', 'under_review', 'in_progress', 'resolved') NOT NULL DEFAULT 'pending',
  `handled_by` BIGINT UNSIGNED NULL,
  `photo_url` VARCHAR(255) NULL,
  `resolved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `reports_reporter_id_foreign` (`reporter_id`),
  KEY `reports_room_id_foreign` (`room_id`),
  KEY `reports_handled_by_foreign` (`handled_by`),
  KEY `reports_status_priority_index` (`status`, `priority`),
  CONSTRAINT `reports_reporter_id_foreign`
    FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reports_room_id_foreign`
    FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `reports_handled_by_foreign`
    FOREIGN KEY (`handled_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `comments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `report_id` BIGINT UNSIGNED NOT NULL,
  `author_id` BIGINT UNSIGNED NOT NULL,
  `message` TEXT NOT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `comments_report_id_foreign` (`report_id`),
  KEY `comments_author_id_foreign` (`author_id`),
  CONSTRAINT `comments_report_id_foreign`
    FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_author_id_foreign`
    FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ticket_status_histories` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `report_id` BIGINT UNSIGNED NOT NULL,
  `old_status` VARCHAR(255) NULL,
  `new_status` VARCHAR(255) NOT NULL,
  `changed_by` BIGINT UNSIGNED NULL,
  `changed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ticket_status_histories_report_id_foreign` (`report_id`),
  KEY `ticket_status_histories_changed_by_foreign` (`changed_by`),
  CONSTRAINT `ticket_status_histories_report_id_foreign`
    FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ticket_status_histories_changed_by_foreign`
    FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `feedback` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `report_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `rating` TINYINT UNSIGNED NOT NULL,
  `comment` TEXT NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `feedback_report_id_unique` (`report_id`),
  KEY `feedback_user_id_foreign` (`user_id`),
  CONSTRAINT `feedback_report_id_foreign`
    FOREIGN KEY (`report_id`) REFERENCES `reports` (`id`) ON DELETE CASCADE,
  CONSTRAINT `feedback_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `related_report_id` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `notifications_user_id_foreign` (`user_id`),
  KEY `notifications_related_report_id_foreign` (`related_report_id`),
  CONSTRAINT `notifications_user_id_foreign`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_related_report_id_foreign`
    FOREIGN KEY (`related_report_id`) REFERENCES `reports` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_reset_tokens` (
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `personal_access_tokens` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tokenable_type` VARCHAR(255) NOT NULL,
  `tokenable_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `token` VARCHAR(64) NOT NULL,
  `abilities` TEXT NULL,
  `last_used_at` TIMESTAMP NULL,
  `expires_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NULL,
  `updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`, `tokenable_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cache` (
  `key` VARCHAR(255) NOT NULL,
  `value` MEDIUMTEXT NOT NULL,
  `expiration` INT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cache_locks` (
  `key` VARCHAR(255) NOT NULL,
  `owner` VARCHAR(255) NOT NULL,
  `expiration` INT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sessions` (
  `id` VARCHAR(255) NOT NULL,
  `user_id` BIGINT UNSIGNED NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `payload` TEXT NOT NULL,
  `last_activity` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Match migration 000007: fallback room records remain alongside the full layout.
INSERT INTO `rooms` (`building`, `floor`, `name`, `code`, `department`, `created_at`, `updated_at`)
VALUES
  ('CMA BUILDING', '1', 'Main Room', CONCAT('ROOM-', UPPER(SUBSTRING(MD5('CMA BUILDING'), 1, 8))), NULL, NOW(), NOW()),
  ('PTC BUILDING', '1', 'Main Room', CONCAT('ROOM-', UPPER(SUBSTRING(MD5('PTC BUILDING'), 1, 8))), NULL, NOW(), NOW()),
  ('BASIC ED BUILDING', '1', 'Main Room', CONCAT('ROOM-', UPPER(SUBSTRING(MD5('BASIC ED BUILDING'), 1, 8))), NULL, NOW(), NOW()),
  ('CHS BUILDING', '1', 'Main Room', CONCAT('ROOM-', UPPER(SUBSTRING(MD5('CHS BUILDING'), 1, 8))), NULL, NOW(), NOW()),
  ('NORTH HALL BUILDING', '1', 'Main Room', CONCAT('ROOM-', UPPER(SUBSTRING(MD5('NORTH HALL BUILDING'), 1, 8))), NULL, NOW(), NOW()),
  ('GYM', '1', 'Main Room', CONCAT('ROOM-', UPPER(SUBSTRING(MD5('GYM'), 1, 8))), NULL, NOW(), NOW());

CREATE TEMPORARY TABLE `fixko_room_floors` (
  `building` VARCHAR(255) NOT NULL,
  `floor` INT NOT NULL
);

INSERT INTO `fixko_room_floors` (`building`, `floor`) VALUES
  ('CMA BUILDING', 1), ('CMA BUILDING', 2), ('CMA BUILDING', 3), ('CMA BUILDING', 4),
  ('BASIC ED BUILDING', 1), ('BASIC ED BUILDING', 2), ('BASIC ED BUILDING', 3), ('BASIC ED BUILDING', 4),
  ('PTC BUILDING', 1), ('PTC BUILDING', 2), ('PTC BUILDING', 3), ('PTC BUILDING', 4),
  ('NORTH HALL BUILDING', 1), ('NORTH HALL BUILDING', 2), ('NORTH HALL BUILDING', 3), ('NORTH HALL BUILDING', 4),
  ('CHS BUILDING', 1), ('CHS BUILDING', 2), ('CHS BUILDING', 3), ('CHS BUILDING', 4),
  ('MDA HALL BUILDING', 1), ('MDA HALL BUILDING', 2), ('MDA HALL BUILDING', 3), ('MDA HALL BUILDING', 4), ('MDA HALL BUILDING', 5),
  ('MBA HALL BUILDING', 1), ('MBA HALL BUILDING', 2), ('MBA HALL BUILDING', 3), ('MBA HALL BUILDING', 4), ('MBA HALL BUILDING', 5),
  ('RIVER SIDE BUILDING', 1), ('RIVER SIDE BUILDING', 2), ('RIVER SIDE BUILDING', 3), ('RIVER SIDE BUILDING', 4),
  ('RIVER SIDE BUILDING', 5), ('RIVER SIDE BUILDING', 6), ('RIVER SIDE BUILDING', 7);

INSERT INTO `rooms` (`building`, `floor`, `name`, `code`, `department`, `created_at`, `updated_at`)
SELECT
  `fixko_room_floors`.`building`,
  CAST(`fixko_room_floors`.`floor` AS CHAR),
  CONCAT('Room ', `fixko_room_floors`.`floor` * 100 + `room_numbers`.`room_number`),
  CONCAT(`fixko_room_floors`.`building`, '-Room ', `fixko_room_floors`.`floor` * 100 + `room_numbers`.`room_number`),
  NULL,
  NOW(),
  NOW()
FROM `fixko_room_floors`
CROSS JOIN (
  SELECT `ones`.`digit` + `tens`.`digit` * 10 + 1 AS `room_number`
  FROM (
    SELECT 0 AS `digit` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
  ) AS `ones`
  CROSS JOIN (
    SELECT 0 AS `digit` UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
  ) AS `tens`
) AS `room_numbers`
WHERE `room_numbers`.`room_number` <= 99;

INSERT INTO `rooms` (`building`, `floor`, `name`, `code`, `department`, `created_at`, `updated_at`)
SELECT
  `boundary_floors`.`building`,
  CAST(`boundary_floors`.`floor` AS CHAR),
  CONCAT('Room ', `boundary_floors`.`floor` * 100),
  CONCAT(`boundary_floors`.`building`, '-Room ', `boundary_floors`.`floor` * 100),
  NULL,
  NOW(),
  NOW()
FROM (
  SELECT 'CMA BUILDING' AS `building`, 1 AS `floor` UNION ALL SELECT 'CMA BUILDING', 2 UNION ALL SELECT 'CMA BUILDING', 3 UNION ALL SELECT 'CMA BUILDING', 4
  UNION ALL SELECT 'BASIC ED BUILDING', 1 UNION ALL SELECT 'BASIC ED BUILDING', 2 UNION ALL SELECT 'BASIC ED BUILDING', 3 UNION ALL SELECT 'BASIC ED BUILDING', 4
  UNION ALL SELECT 'PTC BUILDING', 1 UNION ALL SELECT 'PTC BUILDING', 2 UNION ALL SELECT 'PTC BUILDING', 3 UNION ALL SELECT 'PTC BUILDING', 4
  UNION ALL SELECT 'NORTH HALL BUILDING', 1 UNION ALL SELECT 'NORTH HALL BUILDING', 2 UNION ALL SELECT 'NORTH HALL BUILDING', 3 UNION ALL SELECT 'NORTH HALL BUILDING', 4
  UNION ALL SELECT 'CHS BUILDING', 1 UNION ALL SELECT 'CHS BUILDING', 2 UNION ALL SELECT 'CHS BUILDING', 3 UNION ALL SELECT 'CHS BUILDING', 4
  UNION ALL SELECT 'MDA HALL BUILDING', 1 UNION ALL SELECT 'MDA HALL BUILDING', 2 UNION ALL SELECT 'MDA HALL BUILDING', 3 UNION ALL SELECT 'MDA HALL BUILDING', 4 UNION ALL SELECT 'MDA HALL BUILDING', 5
  UNION ALL SELECT 'MBA HALL BUILDING', 1 UNION ALL SELECT 'MBA HALL BUILDING', 2 UNION ALL SELECT 'MBA HALL BUILDING', 3 UNION ALL SELECT 'MBA HALL BUILDING', 4 UNION ALL SELECT 'MBA HALL BUILDING', 5
) AS `boundary_floors`;

INSERT INTO `rooms` (`building`, `floor`, `name`, `code`, `department`, `created_at`, `updated_at`)
VALUES
  ('RIVER SIDE BUILDING', '8', 'Room 801', 'RIVER SIDE BUILDING-Room 801', NULL, NOW(), NOW()),
  ('RIVER SIDE BUILDING', '8', 'Room 802', 'RIVER SIDE BUILDING-Room 802', NULL, NOW(), NOW()),
  ('RIVER SIDE BUILDING', '8', 'Room 803', 'RIVER SIDE BUILDING-Room 803', NULL, NOW(), NOW()),
  ('RIVER SIDE BUILDING', '8', 'Open Field', 'RIVER SIDE BUILDING-Open Field', NULL, NOW(), NOW()),
  ('ITS CSDL BUILDING', '1', 'Room 101', 'ITS CSDL BUILDING-Room 101', NULL, NOW(), NOW()),
  ('ITS CSDL BUILDING', '2', 'Room 201', 'ITS CSDL BUILDING-Room 201', NULL, NOW(), NOW()),
  ('ITS CSDL BUILDING', '2', 'Room 202', 'ITS CSDL BUILDING-Room 202', NULL, NOW(), NOW()),
  ('GYM', '1', 'Gym', 'GYM-Gym', NULL, NOW(), NOW());

DROP TEMPORARY TABLE `fixko_room_floors`;

CREATE TABLE `migrations` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `migration` VARCHAR(255) NOT NULL,
  `batch` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`migration`, `batch`) VALUES
  ('2019_12_14_000001_create_personal_access_tokens_table', 1),
  ('2024_01_01_000001_create_users_table', 1),
  ('2024_01_01_000002_create_rooms_table', 1),
  ('2024_01_01_000003_create_equipment_table', 1),
  ('2024_01_01_000004_create_tickets_table', 1),
  ('2024_01_01_000005_create_ticket_related_tables', 1),
  ('2024_01_01_000006_create_framework_tables', 1),
  ('2026_09_18_000007_add_missing_campus_buildings', 1),
  ('2026_09_18_000008_remove_faculty_role', 1),
  ('2026_09_23_000009_normalize_user_roles', 1),
  ('2026_09_23_000010_rename_report_terminology', 1),
  ('2026_09_23_000011_remove_unused_queue_tables', 1),
  ('2026_09_23_000012_seed_campus_room_layout', 1),
  ('2026_09_23_000013_add_floor_boundary_rooms', 1),
  ('2026_09_26_000014_add_separated_name_fields_to_users', 1);

SET FOREIGN_KEY_CHECKS = 1;
