<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\FeeAgreementController;
use App\Http\Controllers\Api\FeeItemController;
use App\Http\Controllers\Api\InvoiceGenerationController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\StudentController;
use App\Http\Controllers\Api\StudentFeeAgreementController;
use App\Http\Controllers\Api\StudentStatusController;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;

$sessionMiddleware = [
    EncryptCookies::class,
    AddQueuedCookiesToResponse::class,
    StartSession::class,
];

Route::middleware($sessionMiddleware)->group(function (): void {
    Route::post('/login', [AuthController::class, 'login']);

    Route::middleware('auth')->group(function (): void {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::get('/dashboard/school', [DashboardController::class, 'school']);

Route::post('/invoices/generate-monthly', [InvoiceGenerationController::class, 'store']);

Route::middleware([...$sessionMiddleware, 'auth'])->group(function (): void {
    Route::get('/students', [StudentController::class, 'index'])
        ->middleware('permission:students.view');
    Route::post('/students', [StudentController::class, 'store'])
        ->middleware('permission:students.create');
    Route::get('/students/{student}', [StudentController::class, 'show'])
        ->middleware('permission:students.view');
    Route::patch('/students/{student}', [StudentController::class, 'update'])
        ->middleware('permission:students.update');
    Route::patch('/students/{student}/status', [StudentStatusController::class, 'update'])
        ->middleware('permission:students.update_status');

    Route::get('/students/{student}/fee-agreements', [StudentFeeAgreementController::class, 'index'])
        ->middleware('permission:fee_agreements.view');
    Route::post('/students/{student}/fee-agreements', [StudentFeeAgreementController::class, 'store'])
        ->middleware('permission:fee_agreements.create');
    Route::get('/fee-agreements/{feeAgreement}', [FeeAgreementController::class, 'show'])
        ->middleware('permission:fee_agreements.view');
    Route::post('/fee-agreements/{feeAgreement}/supersede', [FeeAgreementController::class, 'supersede'])
        ->middleware('permission:fee_agreements.update');

    Route::get('/fee-items', [FeeItemController::class, 'index'])
        ->middleware('permission:fee_items.view');

    Route::get('/students/{student}/payments', [PaymentController::class, 'index'])
        ->middleware('permission:payments.view');
    Route::post('/students/{student}/payments', [PaymentController::class, 'store'])
        ->middleware('permission:payments.create');
    Route::post('/payments/{payment}/verify', [PaymentController::class, 'verify'])
        ->middleware('permission:payments.verify');
    Route::post('/payments/{payment}/void', [PaymentController::class, 'void'])
        ->middleware('permission:payments.void');
});
