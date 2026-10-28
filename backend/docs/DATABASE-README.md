# Fixko Database — How It Works and How the Backend Connects

This is the plain-language guide to the Fixko database and the connection
between the database and the Laravel backend.

For the full table-by-table reference (entity names, columns, ERD diagram),
see [`database-schema.md`](./database-schema.md) in this same folder.

---

## 1. What the database is

Fixko uses **MySQL** (run through XAMPP / phpMyAdmin). The database is named
**`fixko`** and it stores everything the app needs:

| Table | What it stores |
|---|---|
| `users` | Every account: students (`user`), maintenance personnel (`maintenance`), and `admin`. Includes name, school email, school ID, hashed password, role, account status. |
| `rooms` | Campus locations (building + floor + room name/code). Reports are filed for a room. |
| `equipment` | Inventory items inside each room (asset tag, condition, quantity). |
| `reports` | The main thing the app is about — one row per maintenance ticket: who reported it (`reporter_id`), which room (`room_id`), item, description, priority, status, assigned maintenance worker (`handled_by`), and the photo path (`photo_url`). |
| `comments` | Chat messages between the reporter, maintenance, and admin on a report. |
| `ticket_status_histories` | Audit trail of status changes (pending → in progress → resolved…), including who made the change. |
| `feedback` | The reporter's 1–5 star rating + review after a report is resolved. One per report. |
| `repair_history` | Repair log per equipment item (action, notes, cost). |
| `notifications` | The bell-icon alerts ("your report was resolved…"). |

There are also a few **Laravel framework tables** (`sessions`,
`password_reset_tokens`, `personal_access_tokens`, `cache`, `migrations`)
that the framework uses for logins and infrastructure — they are not part of
the Fixko business data.

### Important relationships

- One `user` submits many `reports`; one `user` (maintenance) handles many `reports`.
- One `room` contains many `reports` — reports are grouped by `rooms.building`.
- One `report` has many `comments`, many `status history` rows, and at most one `feedback` row.
- Deleted users/reports are **soft-deleted** (kept in the tables so the admin Recycle Bin can restore them).

### Where report photos are kept

The database stores only a **relative path** in `reports.photo_url`
(e.g. `report-photos/abc123.jpg`). The actual image files live in
`backend/storage/app/public/report-photos/` and are served through the
`backend/public/storage` link. JPEG/PNG only, max 5 MB.

---

## 2. How the database connects into the backend

The backend is a **Laravel (PHP) API**. The connection chain works like this:

```
XAMPP MySQL server (fixko database)
        │
        ▼
backend/.env                  ← credentials (DB_HOST, DB_DATABASE, DB_USERNAME, DB_PASSWORD)
        │
        ▼
backend/config/database.php   ← Laravel reads those .env values here
        │
        ▼
backend/app/Models/*.php      ← Eloquent models (User, Report, Room, …) map to tables
        │
        ▼
backend/app/Http/Controllers/*.php  ← controllers use the models to query/save data
        │
        ▼
backend/routes/api.php        ← the /api/... endpoints the frontend calls
```

In short:

1. **`.env` holds the credentials.** The default local values are:
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=fixko
   DB_USERNAME=root
   DB_PASSWORD=
   ```
2. **`config/database.php` reads them.** You never edit the config for a new
   computer — you only change `.env`.
3. **Models talk to the tables.** Each class in `backend/app/Models/`
   corresponds to one table (e.g. `app/Models/Report.php` ↔ `reports` table).
   Code like `Report::where('status', 'pending')` becomes a SQL query
   automatically — no raw SQL is written anywhere.
4. **Controllers use the models.** Example: the `Submit Report` button in the
   frontend calls `POST /api/reports`, which runs `ReportController@store`;
   that controller validates the input, saves a `Report` row (and photo),
   writes the first `status history` row, and creates `Notification` rows for
   the admins.
5. **The frontend never touches the database directly.** The Next.js frontend
   (`frontend/lib/api.ts`) only sends HTTP requests to
   `http://127.0.0.1:8000/api/...`; Laravel answers with JSON.

---

## 3. Setting up the database connection on a new PC

1. Start **XAMPP** and run Apache + MySQL.
2. In phpMyAdmin, create an empty database named `fixko` (utf8mb4).
3. Create `backend/.env` from `backend/.env.example` and fill the `DB_*`
   values (usually the defaults above work with XAMPP's root user with no
   password).
4. Create the tables — choose one:
   - **Laravel migrations (recommended):**
     ```bash
     php backend/artisan migrate
     ```
   - **Manual phpMyAdmin import:** import `backend/database/sql/fixko_schema.sql`
     (⚠ it drops and recreates the tables — use only when recreating the database).
5. Quick connection test:
   ```bash
   php backend/artisan migrate:status
   ```
   If that lists the applied migrations without an error, the backend can see the database.

---

## 4. Common connection problems

| Symptom | Cause / fix |
|---|---|
| `SQLSTATE[HY000] [2002] Connection refused` | MySQL is not running — start it in XAMPP. |
| `Unknown database 'fixko'` | The database doesn't exist yet — create it in phpMyAdmin. |
| `Access denied for user 'root'` | Wrong `DB_USERNAME`/`DB_PASSWORD` in `backend/.env`. |
| Tables missing / `no such table` | Run `php backend/artisan migrate` (or import the SQL file). |
| Report photos 404 in the browser | The storage link is missing — run `php backend/artisan storage:link`. |
