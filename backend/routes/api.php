<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TicketController;

Route::prefix('auth')->group(function () {
    Route::post('/signup', [AuthController::class, 'signup']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('tickets', TicketController::class)->only(['index', 'store', 'show']);
    Route::patch('/tickets/{ticket}/status', [TicketController::class, 'updateStatus']);
    Route::post('/tickets/{ticket}/comments', [TicketController::class, 'comment']);
    Route::post('/tickets/{ticket}/feedback', [TicketController::class, 'feedback']);
    Route::get('/equipment', [EquipmentController::class, 'index']);
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::get('/analytics/summary', [AnalyticsController::class, 'summary']);
    Route::get('/notifications', [NotificationController::class, 'index']);
});
