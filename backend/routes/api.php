<?php

use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InvoiceGenerationController;
use App\Http\Controllers\Api\PaymentController;
use Illuminate\Support\Facades\Route;

Route::get('/dashboard/school', [DashboardController::class, 'school']);

Route::post('/invoices/generate-monthly', [InvoiceGenerationController::class, 'store']);

Route::post('/payments', [PaymentController::class, 'store']);
