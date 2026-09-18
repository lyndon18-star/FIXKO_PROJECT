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

The migrations in `database/migrations` are the source of truth. A readable
table-by-table schema and ERD are in `docs/database-schema.md`. Run
`php artisan migrate:fresh --seed` only when you intentionally want to drop
and recreate all application data.

## Endpoint summary

### Public authentication

- `POST /auth/signup` — name, email, school ID, password, confirmation
- `POST /auth/login` — email and password
- `POST /auth/forgot-password` — email; sends a reset token
- `POST /auth/reset-password` — token, email, password, confirmation

### Authenticated endpoints

- `GET|POST|PUT|PATCH|DELETE /tickets`
- `PATCH /tickets/{ticket}/status`
- `POST /tickets/{ticket}/comments`
- `POST /tickets/{ticket}/feedback`
- `GET /rooms`, `GET /rooms/{room}`, `GET /rooms/{room}/qr`
- `GET|POST|GET|PUT /equipment`
- `GET|POST /equipment/{equipment}/repair-log`
- `GET /analytics/summary` — staff-only dashboard aggregates
- `GET /notifications`, `PATCH /notifications/{notification}/read`
- `POST /auth/logout`, `GET /auth/me`

Ticket creation accepts `school_id`, `email`, `room_id`, `description`,
`priority` (`low`, `medium`, `high`, `critical`), and optional `equipment_id`,
`category`, `item_name`, `condition`, `quantity`, and image `photo`.
School ID and email are stored as immutable reporter snapshots.

## Structure

- `app/Models` contains users, tickets, rooms, equipment, comments, feedback,
  notifications, status history, and repair-log models.
- `database/migrations` defines the relational schema, Sanctum tokens, and
  password reset table.
- Controllers apply request validation and role/ownership authorization.
- `EnsureRole` is available as the `role` middleware alias.

PHP and Composer are not installed in the current development environment, so
runtime migrations and HTTP tests must be run after installing them.
