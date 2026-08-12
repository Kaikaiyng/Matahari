<?php

namespace App\Http\Middleware;

use App\Support\SchoolContext;
use App\Support\SchoolScopeResolver;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveSchoolContext
{
    public function __construct(private readonly SchoolScopeResolver $resolver) {}

    public function handle(Request $request, Closure $next): Response
    {
        $requestedSchoolId = $request->input('school_id', $request->query('school_id'));
        $schoolId = $this->resolver->resolve($request->user(), $requestedSchoolId);
        $request->attributes->set(SchoolContext::ATTRIBUTE, new SchoolContext($schoolId));

        return $next($request);
    }
}
