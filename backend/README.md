# Fixko Laravel API

This directory is the Laravel 10 backend boundary for the React frontend. Create
the Laravel application here with `composer create-project laravel/laravel .`
on a machine with PHP 8.x and Composer installed, then add Sanctum and configure
the MySQL connection in `.env`.

The API route contract follows `web site guide/fixko-build-plan-mainguide.md`.
The frontend can switch from sample data to this API by calling the endpoints in
`routes/api.php`; the report form already captures the required school ID and
email snapshots.
