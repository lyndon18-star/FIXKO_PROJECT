<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EquipmentController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\TicketController;
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

    Route::apiResource('tickets', TicketController::class);
    Route::patch('tickets/{ticket}/status', [TicketController::class, 'updateStatus']);
    Route::post('tickets/{ticket}/comments', [TicketController::class, 'comment']);
    Route::post('tickets/{ticket}/feedback', [TicketController::class, 'feedback']);
    Route::get('rooms/{room}/qr', [RoomController::class, 'qr']);
    Route::apiResource('rooms', RoomController::class)->only(['index', 'show']);
    Route::get('equipment/{equipment}/repair-log', [EquipmentController::class, 'repairLog']);
    Route::post('equipment/{equipment}/repair-log', [EquipmentController::class, 'storeRepairLog']);
    Route::apiResource('equipment', EquipmentController::class)->only(['index', 'store', 'show', 'update']);
    Route::get('analytics/summary', [AnalyticsController::class, 'summary']);
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [NotificationController::class, 'markRead']);
});
