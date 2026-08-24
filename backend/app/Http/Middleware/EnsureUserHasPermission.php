<?php

namespace App\Http\Middleware;

use App\Support\SchoolContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasPermission
{
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();
        $schoolId = $request->attributes->get(SchoolContext::ATTRIBUTE)?->schoolId;

        if (! $user || ! collect($permissions)->contains(fn (string $permission): bool => $user->hasPermissionTo($permission, $schoolId))) {
            abort(403, 'This action is not permitted.');
        }

        return $next($request);
    }
}
