<?php

namespace Tests\Feature;

use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Http\Request;
use Tests\TestCase;

class CsrfMiddlewareTest extends TestCase
{
    public function test_every_session_api_route_uses_request_forgery_protection(): void
    {
        $router = app('router');

        foreach ([
            Request::create('/api/login', 'POST'),
            Request::create('/api/logout', 'POST'),
            Request::create('/api/students', 'POST'),
        ] as $request) {
            $route = $router->getRoutes()->match($request);

            $this->assertContains(PreventRequestForgery::class, $route->gatherMiddleware());
        }
    }

    public function test_csrf_bootstrap_route_is_safe_and_returns_xsrf_cookie(): void
    {
        $this->get('/api/csrf-cookie')
            ->assertNoContent()
            ->assertCookie('XSRF-TOKEN');
    }
}
