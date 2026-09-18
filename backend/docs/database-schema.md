# Fixko database schema and ERD

The application uses MySQL/MariaDB through XAMPP. Laravel migrations are the
source of truth; phpMyAdmin is used to create the database and inspect the
resulting tables.

## Database

| Setting | Value |
| --- | --- |
| Database | `fixko` |
| Character set | `utf8mb4` |
| Collation | `utf8mb4_unicode_ci` |
| Local host | `127.0.0.1` |
| Port | `3306` |

## Entity relationship diagram

```mermaid
erDiagram
    USERS ||--o{ TICKETS : reports
    USERS ||--o{ TICKETS : assigned_to
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ TICKET_STATUS_HISTORIES : changes
    USERS ||--o{ FEEDBACK : gives
    USERS ||--o{ REPAIR_LOGS : records
    USERS ||--o{ NOTIFICATIONS : receives
    ROOMS ||--o{ TICKETS : contains
    ROOMS ||--o{ EQUIPMENT : contains
    EQUIPMENT ||--o{ TICKETS : concerns
    EQUIPMENT ||--o{ REPAIR_LOGS : has
    TICKETS ||--o{ COMMENTS : has
    TICKETS ||--o{ TICKET_STATUS_HISTORIES : tracks
    TICKETS ||--o| FEEDBACK : receives
    TICKETS ||--o{ REPAIR_LOGS : references
    TICKETS ||--o{ NOTIFICATIONS : triggers

    USERS {
        bigint id PK
        varchar name
        varchar email UK
        varchar school_id UK
        enum role
        varchar department
        varchar password
        timestamps
    }
    ROOMS {
        bigint id PK
        varchar building
        varchar floor
        varchar name
        varchar code UK
        varchar department
        timestamps
    }
    EQUIPMENT {
        bigint id PK
        bigint room_id FK
        varchar name
        varchar category
        varchar asset_tag UK
        enum condition
        unsigned_int quantity
        text description
        timestamps
    }
    TICKETS {
        bigint id PK
        bigint reporter_id FK
        bigint room_id FK
        bigint equipment_id FK
        bigint assigned_to FK
        varchar reporter_school_id_snapshot
        varchar reporter_email_snapshot
        varchar category
        varchar item_name
        varchar condition
        unsigned_int quantity
        text description
        enum priority
        enum status
        varchar photo_url
        timestamp resolved_at
        timestamps
    }
    COMMENTS {
        bigint id PK
        bigint ticket_id FK
        bigint author_id FK
        text message
        timestamps
    }
    TICKET_STATUS_HISTORIES {
        bigint id PK
        bigint ticket_id FK
        bigint changed_by FK
        varchar old_status
        varchar new_status
        timestamp changed_at
    }
    FEEDBACK {
        bigint id PK
        bigint ticket_id FK UK
        bigint user_id FK
        tinyint rating
        text comment
        timestamps
    }
    REPAIR_LOGS {
        bigint id PK
        bigint equipment_id FK
        bigint ticket_id FK
        bigint user_id FK
        varchar action
        text notes
        decimal cost
        date repaired_at
        timestamps
    }
    NOTIFICATIONS {
        bigint id PK
        bigint user_id FK
        bigint related_ticket_id FK
        text message
        boolean is_read
        timestamps
    }
```

## Application tables

### `users`

Authentication and authorization records. Roles are `student`, `technician`,
and `admin`. `school_id` and `email` are unique.

### `rooms`

Campus locations used by reports and equipment. `code` is an optional unique
QR-friendly identifier.

### `equipment`

Inventory assigned to a room. `condition` is one of `new`, `good`, `fair`,
`poor`, or `broken`.

### `tickets`

The central report table. `reporter_school_id_snapshot` and
`reporter_email_snapshot` preserve the reporter details at submission time.
`status` is `pending`, `under_review`, `in_progress`, or `resolved`.
`priority` is `low`, `medium`, `high`, or `critical`.

### `comments`, `ticket_status_histories`, and `feedback`

These tables store ticket communication, every status transition, and one
post-resolution rating per ticket.

### `repair_logs`

Maintenance actions for equipment, optionally linked to the ticket that
requested the repair.

### `notifications`

Per-user messages optionally linked to a ticket. `is_read` supports the
notification inbox.

## Framework tables

Laravel also creates `password_reset_tokens`, `personal_access_tokens`,
`cache`, `cache_locks`, `sessions`, `jobs`, and `failed_jobs`. These support
password resets, Sanctum, sessions, caching, queues, and failed job tracking.

## XAMPP and phpMyAdmin setup

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Open `http://localhost/phpmyadmin`.
3. Choose **Import**, select `backend/database/sql/fixko_schema.sql`, and run it.
   The script creates the `fixko` database with `utf8mb4` and all application
   and Laravel framework tables.
4. Copy `backend/.env.example` to `backend/.env` and keep the MySQL values
   aligned with the XAMPP installation:

   ```dotenv
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=fixko
   DB_USERNAME=root
   DB_PASSWORD=
   ```

5. Run `php artisan db:seed` if sample users and rooms are needed.

For a clean Laravel-managed setup, create an empty `fixko` database in
phpMyAdmin and run `php artisan migrate --seed` instead of importing the SQL
file. The migrations remain the source of truth for future schema changes.
