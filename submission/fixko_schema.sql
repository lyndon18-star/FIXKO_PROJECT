CREATE TABLE users (
    id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    school_id VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('student','faculty','admin','staff') NOT NULL,
    department VARCHAR(255) NULL,
    email_verified_at TIMESTAMP NULL,
    remember_token VARCHAR(100) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_school_id (school_id)
);

CREATE TABLE rooms (
    id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    building VARCHAR(255) NOT NULL,
    floor VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(255) NOT NULL,
    department VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_rooms_code (code)
);

CREATE TABLE equipment (
    id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    room_id BIGINT(20) UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    asset_tag VARCHAR(255) NOT NULL,
    condition ENUM('excellent','good','fair','poor','damaged') NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_equipment_asset_tag (asset_tag),
    CONSTRAINT fk_equipment_room FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE reports (
    id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    reporter_id BIGINT(20) UNSIGNED NOT NULL,
    reporter_school_id_snapshot VARCHAR(255) NULL,
    reporter_email_snapshot VARCHAR(255) NULL,
    room_id BIGINT(20) UNSIGNED NOT NULL,
    equipment_id BIGINT(20) UNSIGNED NULL,
    category VARCHAR(255) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    condition VARCHAR(255) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('low','medium','high','urgent') NOT NULL,
    status ENUM('new','pending','in_progress','resolved','closed','rejected') NOT NULL,
    handled_by BIGINT(20) UNSIGNED NULL,
    photo_url VARCHAR(500) NULL,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
    CONSTRAINT fk_reports_room FOREIGN KEY (room_id) REFERENCES rooms(id),
    CONSTRAINT fk_reports_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    CONSTRAINT fk_reports_handler FOREIGN KEY (handled_by) REFERENCES users(id)
);

CREATE TABLE comments (
    id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id BIGINT(20) UNSIGNED NOT NULL,
    author_id BIGINT(20) UNSIGNED NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_comments_report FOREIGN KEY (report_id) REFERENCES reports(id),
    CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE TABLE ticket_status_histories (
    id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id BIGINT(20) UNSIGNED NOT NULL,
    old_status VARCHAR(255) NULL,
    new_status VARCHAR(255) NOT NULL,
    changed_by BIGINT(20) UNSIGNED NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_status_report FOREIGN KEY (report_id) REFERENCES reports(id),
    CONSTRAINT fk_status_user FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE TABLE feedback (
    id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    report_id BIGINT(20) UNSIGNED NOT NULL,
    user_id BIGINT(20) UNSIGNED NOT NULL,
    rating TINYINT UNSIGNED NOT NULL,
    comment TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_feedback_report FOREIGN KEY (report_id) REFERENCES reports(id),
    CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE repair_history (
    id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    equipment_id BIGINT(20) UNSIGNED NULL,
    report_id BIGINT(20) UNSIGNED NULL,
    user_id BIGINT(20) UNSIGNED NOT NULL,
    action VARCHAR(255) NOT NULL,
    notes TEXT NULL,
    cost DECIMAL(10,2) NULL,
    repaired_at DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_repair_equipment FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    CONSTRAINT fk_repair_report FOREIGN KEY (report_id) REFERENCES reports(id),
    CONSTRAINT fk_repair_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE notifications (
    id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT(20) UNSIGNED NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    related_report_id BIGINT(20) UNSIGNED NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_notifications_report FOREIGN KEY (related_report_id) REFERENCES reports(id)
);
