<?php

namespace App\Providers;

use App\Contracts\AuditLoggerContract;
use App\Services\Audit\AuditLogger;
use App\Services\Notifications\InAppChannel;
use App\Services\Notifications\NotificationDispatcher;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(AuditLoggerContract::class, AuditLogger::class);
        $this->app->singleton(NotificationDispatcher::class, fn ($app): NotificationDispatcher => new NotificationDispatcher([
            $app->make(InAppChannel::class),
        ]));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
