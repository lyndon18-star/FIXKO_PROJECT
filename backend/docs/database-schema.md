# Fixko Database Entity Relationship Diagram

This document is the current application database reference for the `fixko` MySQL database. It describes the tables, relationships, constraints, report workflow, image storage, and campus room layout implemented by the Laravel migrations.

The ERD below is a domain ERD. Laravel framework/support tables are documented separately because they support the application but are not part of the facilities-reporting domain.

```mermaid
erDiagram
    USERS ||--o{ REPORTS : submits
    USERS ||--o{ REPORTS : handles
    USERS ||--o{ COMMENTS : writes
    USERS ||--o{ TICKET_STATUS_HISTORIES : changes
    USERS ||--o{ FEEDBACK : gives
    USERS ||--o{ REPAIR_HISTORY : records
    USERS ||--o{ NOTIFICATIONS : receives
    ROOMS ||--o{ REPORTS : contains
    ROOMS ||--o{ EQUIPMENT : contains
    EQUIPMENT ||--o{ REPORTS : concerns
    EQUIPMENT ||--o{ REPAIR_HISTORY : has
    REPORTS ||--o{ COMMENTS : has
    REPORTS ||--o{ TICKET_STATUS_HISTORIES : tracks
    REPORTS ||--o| FEEDBACK : receives
    REPORTS ||--o{ REPAIR_HISTORY : references
    REPORTS ||--o{ NOTIFICATIONS : triggers

    USERS {
        bigint id PK
        varchar name
        varchar email UK
        varchar school_id UK
        varchar password
        enum role
        varchar department
        timestamp email_verified_at
        varchar remember_token
        timestamp created_at
        timestamp updated_at
    }

    ROOMS {
        bigint id PK
        varchar building
        varchar floor
        varchar name
        varchar code UK
        varchar department
        timestamp created_at
        timestamp updated_at
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
        timestamp created_at
        timestamp updated_at
    }

    REPORTS {
        bigint id PK
        bigint reporter_id FK
        varchar reporter_school_id_snapshot
        varchar reporter_email_snapshot
        bigint room_id FK
        bigint equipment_id FK
        varchar category
        varchar item_name
        varchar condition
        unsigned_int quantity
        text description
        enum priority
        enum status
        bigint handled_by FK
        varchar photo_url
        timestamp resolved_at
        timestamp created_at
        timestamp updated_at
    }

    COMMENTS {
        bigint id PK
        bigint report_id FK
        bigint author_id FK
        text message
        timestamp created_at
        timestamp updated_at
    }

    TICKET_STATUS_HISTORIES {
        bigint id PK
        bigint report_id FK
        varchar old_status
        varchar new_status
        bigint changed_by FK
        timestamp changed_at
    }

    FEEDBACK {
        bigint id PK
        bigint report_id FK UK
        bigint user_id FK
        unsigned_tinyint rating
        text comment
        timestamp created_at
        timestamp updated_at
    }

    REPAIR_HISTORY {
        bigint id PK
        bigint equipment_id FK
        bigint report_id FK
        bigint user_id FK
        varchar action
        text notes
        decimal cost
        date repaired_at
        timestamp created_at
        timestamp updated_at
    }

    NOTIFICATIONS {
        bigint id PK
        bigint user_id FK
        text message
        boolean is_read
        bigint related_report_id FK
        timestamp created_at
        timestamp updated_at
    }
```

## Domain behavior represented by the schema

### Reports and comments

- `reports.description` stores the original problem description submitted by the user.
- `reports.category` stores the report category.
- `comments.message` stores follow-up discussion attached to a report.
- `comments.report_id` identifies the report being discussed.
- `comments.author_id` identifies the user or administrator who wrote the comment.
- A user may comment on their own report, and an administrator may comment as part of report handling.
- `ticket_status_histories` records status changes for a report.
- `feedback` stores the user's report feedback and rating after resolution.

### Report images

- `reports.photo_url` is nullable.
- The database stores only a relative public-disk path, for example:
  `report-photos/abc123.jpg`.
- The binary image is stored by Laravel in:
  `backend/storage/app/public/report-photos`.
- The public browser URL is exposed through Laravel's storage link:
  `backend/public/storage`.
- Do not store a Windows local path or image binary directly in `reports.photo_url`.
- Accepted upload formats are JPEG and PNG, with a maximum size of 5 MB.

### Building and room grouping

Every report belongs to one `rooms` record through `reports.room_id`. The `rooms.building` value is the authoritative building category used to group reports; room names must not be used alone because the same room name can exist in multiple buildings.

The applied campus room layout is:

| Building | Floors | Rooms |
|---|---:|---|
| CMA BUILDING | 1-4 | `Room 100`-`Room 499` |
| BASIC ED BUILDING | 1-4 | `Room 100`-`Room 499` |
| PTC BUILDING | 1-4 | `Room 100`-`Room 499` |
| NORTH HALL BUILDING | 1-4 | `Room 100`-`Room 499` |
| MDA HALL BUILDING | 1-5* | `Room 100`-`Room 599` |
| MBA HALL BUILDING | 1-5 | `Room 100`-`Room 599` |
| CHS BUILDING | 1-4 | `Room 100`-`Room 499` |
| ITS CSDL BUILDING | 1-2 | Floor 1: `Room 101`; floor 2: `Room 201`, `Room 202` |
| GYM | 1 | `Gym` |
| RIVER SIDE BUILDING | 1-8 | Floors 1-7 use the numbered room ranges; floor 8 has `Room 801`, `Room 802`, `Room 803`, and `Open Field` |

`MDA HALL BUILDING` and `CHS BUILDING` floor limits follow the existing project configuration. If the physical campus inventory differs, update migrations `000012` and `000013` before recreating or extending the database.

For standard numbered floors, the room range is based on the floor number:

- Floor 1: `100`-`199`
- Floor 2: `200`-`299`
- Floor 3: `300`-`399`
- Floor 4: `400`-`499`
- Floor 5: `500`-`599`
- Floor 6: `600`-`699`
- Floor 7: `700`-`799`
- Floor 8: special River Side inventory listed above

The exact boundary rooms (`Room 100`, `Room 200`, `Room 300`, and so on) are included by migration `2026_09_23_000013_add_floor_boundary_rooms`. The main room inventory is seeded by migration `2026_09_23_000012_seed_campus_room_layout`.

## Key constraints

- `users.email` and `users.school_id` are unique.
- `rooms.code` and `equipment.asset_tag` are unique.
- Each report can have at most one feedback record because `feedback.report_id` is unique.
- `reports.equipment_id`, `reports.handled_by`, `repair_history.report_id`, and `notifications.related_report_id` may be null.
- `reports.photo_url` may be null when a report has no image.
- Deleting a user cascades to their reports, comments, feedback, and notifications where the corresponding foreign key uses `ON DELETE CASCADE`; user references in repair history remain restricted.
- Deleting a room is restricted when reports reference it, unless the database operation is handled by the application or migration.
- Deleting a report cascades to its comments, status history, and feedback; related repair history and notifications are set to null where the foreign key is nullable.

## Laravel support tables

These tables exist in the database but are omitted from the domain ERD:

- `cache`
- `cache_locks`
- `migrations`
- `password_reset_tokens`
- `personal_access_tokens`
- `sessions`

They are framework infrastructure and do not represent Fixko business entities.

## Applying the schema

### Recommended: Laravel migrations

From the repository root:

```powershell
php backend\artisan migrate
```

This creates or updates the database schema and applies the campus room migrations. The currently applied room migrations are:

- `2026_09_23_000012_seed_campus_room_layout`
- `2026_09_23_000013_add_floor_boundary_rooms`

### Manual phpMyAdmin import

`backend\database\sql\fixko_schema.sql` contains the table structure for manual MySQL/phpMyAdmin setup, including `reports.photo_url` and the comments/report relationships. It does not contain the large campus room inventory because that inventory is maintained by Laravel migrations.

For a complete schema including the seeded room layout, use the Laravel migration path above. Importing the SQL file alone creates the tables but does not create the canonical campus rooms. Do not run the SQL file against a database that already contains the same tables unless the database is intentionally being recreated; the SQL file drops and recreates application tables.
