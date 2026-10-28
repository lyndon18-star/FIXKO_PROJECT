<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RecycleBinController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

// routes/api.php — every API endpoint the frontend can call.
// Routes outside the auth group are public (sign up, sign in, password reset);
// everything else requires a login token and an active account.

// ===== AUTH: sign up, email verification code, sign in, forgot password =====
Route::prefix('auth')->group(function () {
    Route::post('signup', [AuthController::class, 'signup']);
    Route::post('email-otp', [AuthController::class, 'sendEmailOtp']);
    Route::post('email-otp/verify', [AuthController::class, 'verifyEmailOtp']);
    Route::post('login-verified', [AuthController::class, 'loginVerified']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password-otp', [AuthController::class, 'resetPasswordOtp']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);
});

// ===== LOGGED-IN AREA: everything below needs a valid token and an active (not suspended/locked) account =====
Route::middleware(['auth:sanctum', 'account.active'])->group(function () {
    // ===== AUTH: sign out and current user info =====
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);

    // ===== Reports: create/view/update reports, status updates, chat comments, ratings, admin flags =====
    Route::apiResource('reports', ReportController::class);
    Route::patch('reports/{report}/status', [ReportController::class, 'updateStatus']);
    Route::post('reports/{report}/comments', [ReportController::class, 'comment']);
    Route::post('reports/{report}/feedback', [ReportController::class, 'feedback']);
    Route::post('reports/{report}/flag', [ReportController::class, 'flag']);
    Route::post('reports/{report}/unflag', [ReportController::class, 'unflag']);
    // ===== Rooms: room list/details and QR-code links =====
    Route::get('rooms/{room}/qr', [RoomController::class, 'qr']);
    Route::apiResource('rooms', RoomController::class)->only(['index', 'show']);

    // ===== Analytics: admin dashboard stats =====
    Route::get('analytics/summary', [AnalyticsController::class, 'summary']);

    // ===== Notifications: bell-icon alerts (list, mark read, archive, delete) =====
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::delete('notifications', [NotificationController::class, 'destroyAll']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::patch('notifications/{notification}/archive', [NotificationController::class, 'archive']);
    Route::delete('notifications/{notification}', [NotificationController::class, 'destroy']);
    // ===== Users: admin account management (list, suspend/lock, warn, delete) + own profile =====
    Route::get('users', [UserController::class, 'index']);
    Route::patch('users/{user}/status', [UserController::class, 'updateStatus']);
    Route::post('users/{user}/warn', [UserController::class, 'warn']);
    Route::delete('users/{user}', [UserController::class, 'destroy']);
    Route::patch('auth/profile', [UserController::class, 'updateProfile']);

    // ===== Recycle bin: admin-only restore or permanently delete removed accounts/reports =====
    Route::get('recycle-bin', [RecycleBinController::class, 'index']);
    Route::post('recycle-bin/restore', [RecycleBinController::class, 'restore']);
    Route::post('recycle-bin/purge', [RecycleBinController::class, 'purge']);
});
