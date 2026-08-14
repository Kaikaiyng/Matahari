<?php

use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\EnsurePlatformOwner;
use App\Http\Middleware\EnsureTenantFeatureEnabled;
use App\Http\Middleware\EnsureTenantMembership;
use App\Http\Middleware\EnsureUserHasPermission;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\ResolveSchoolContext;
use App\Http\Middleware\ResolveTenantContext;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(AssignRequestId::class);
        $middleware->api(prepend: [ResolveTenantContext::class]);

        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'tenant.member' => EnsureTenantMembership::class,
            'tenant.feature' => EnsureTenantFeatureEnabled::class,
            'platform.owner' => EnsurePlatformOwner::class,
            'permission' => EnsureUserHasPermission::class,
            'school.context' => ResolveSchoolContext::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        $exceptions->respond(function (
            Response $response,
            Throwable $exception,
            Request $request,
        ): Response {
            $requestId = $request->attributes->get(AssignRequestId::ATTRIBUTE);

            if (is_string($requestId) && Str::isUuid($requestId, 7)) {
                $response->headers->set('X-Request-ID', $requestId);
            }

            return $response;
        });
    })->create();
