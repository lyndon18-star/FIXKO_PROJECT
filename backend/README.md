# Fixko Laravel API

Laravel 10-compatible backend for the Fixko facilities reporting application.
Install PHP 8.1+ and Composer before running it.

## Setup

Start **Apache** and **MySQL** in the XAMPP Control Panel, then create an
empty database named `fixko` in phpMyAdmin. Alternatively, import
`database/sql/fixko_schema.sql` from phpMyAdmin. The default XAMPP MySQL
credentials are `root` with an empty password; change the values in `.env` if
your installation uses a password.

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

Use only one database setup path: either import the SQL schema or run
`php artisan migrate --seed` against an empty database. Do not run both on the
same database.

The API is available at `http://localhost:8000/api`. Open phpMyAdmin at
`http://localhost/phpmyadmin` to inspect the `fixko` schema. Configure the
frontend origin in `SANCTUM_STATEFUL_DOMAINS` and `config/cors.php`. API token
authentication uses `Authorization: Bearer <token>`.

## Database design

The migrations in `database/migrations` are the main reference for database
changes. A readable table-by-table schema and relationship map are in
`docs/database-schema.md`. Run
`php artisan migrate:fresh --seed` only when you intentionally want to drop
and recreate all application data.

## Endpoint summary

### Public authentication

- `POST /auth/signup` — name, email, school ID, password, confirmation
- `POST /auth/login` — email and password
- `POST /auth/forgot-password` — email; sends a reset token
- `POST /auth/reset-password` — token, email, password, confirmation

### Authenticated endpoints

- `GET|POST|PUT|PATCH|DELETE /reports`
- `PATCH /reports/{report}/status`
- `POST /reports/{report}/comments`
- `POST /reports/{report}/feedback`
- `GET /rooms`, `GET /rooms/{room}`, `GET /rooms/{room}/qr`
- `GET|POST|GET|PUT /equipment`
- `GET|POST /equipment/{equipment}/repair-history`
- `GET /analytics/summary` — admin-only dashboard aggregates
- `GET /notifications`, `PATCH /notifications/{notification}/read`
- `POST /auth/logout`, `GET /auth/me`

Report creation accepts `school_id`, `email`, `room_id`, `description`,
`priority` (`low`, `medium`, `high`, `critical`), and optional `equipment_id`,
`category`, `item_name`, `condition`, `quantity`, and image `photo`.
School ID and email are stored as immutable reporter snapshots.
Uploaded report images are stored on the configured public filesystem disk.
The `reports.photo_url` column stores only the relative path, for example
`report-photos/abc123.jpg`; the API returns the public URL in `photo_url`.
The browser sends the image as multipart form data; the database does not
store the binary image or a path from the user's computer.

## Error responses and logging

API errors use a consistent JSON shape:

```json
{
  "message": "The requested item could not be found.",
  "code": "NOT_FOUND",
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Validation failures additionally include an `errors` object keyed by field.
Every API error includes an `X-Request-ID` response header; clients may send
their own safe request ID to correlate frontend and backend logs. Unexpected
database and server exceptions are logged with the request ID and return a
generic `SERVER_ERROR` response without exposing internal details. Login
successes, failed credentials, signups, logouts, and failed password resets are
also logged without recording passwords or tokens.

Database writes that span multiple records use Laravel transactions; failed
queries are logged by the API exception handler and return the same safe error
shape. Database structure is still managed by the migrations and
`database/sql/fixko_schema.sql`; no error record is written back to the
database when the database itself is unavailable.

Login failures always use the message `Incorrect username or password.` so
the system does not reveal whether an email address exists. Other errors use
plain-language categories such as validation, permission, not found, conflict,
network, and server errors.

## Structure

- `app/Models` contains users, reports, rooms, equipment, comments, feedback,
  notifications, status history, and repair-history models.
- `database/migrations` defines the relational schema, Sanctum tokens, and
  password reset table.
- Controllers apply request validation and user/admin ownership authorization.
- `EnsureRole` is available as the `role` middleware alias.

PHP and Composer are not installed in the current development environment, so
runtime migrations and HTTP tests must be run after installing them.
