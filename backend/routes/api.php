<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EquipmentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('signup', [AuthController::class, 'signup']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);

    Route::apiResource('reports', ReportController::class);
    Route::patch('reports/{report}/status', [ReportController::class, 'updateStatus']);
    Route::post('reports/{report}/comments', [ReportController::class, 'comment']);
    Route::post('reports/{report}/feedback', [ReportController::class, 'feedback']);
    Route::get('rooms/{room}/qr', [RoomController::class, 'qr']);
    Route::apiResource('rooms', RoomController::class)->only(['index', 'show']);
    Route::get('equipment/{equipment}/repair-history', [EquipmentController::class, 'repairHistory']);
    Route::post('equipment/{equipment}/repair-history', [EquipmentController::class, 'storeRepairHistory']);
    Route::apiResource('equipment', EquipmentController::class)->only(['index', 'store', 'show', 'update']);
    Route::get('analytics/summary', [AnalyticsController::class, 'summary']);
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
});
