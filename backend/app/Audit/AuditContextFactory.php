<?php

namespace App\Audit;

use App\Http\Middleware\AssignRequestId;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use LogicException;

final class AuditContextFactory
{
    public function fromRequest(Request $request, ?string $anonymousUsername = null): AuditContext
    {
        $requestId = $request->attributes->get(AssignRequestId::ATTRIBUTE);

        if (! is_string($requestId) || ! Str::isUuid($requestId)) {
            throw new LogicException('Server request ID middleware did not run.');
        }

        $user = $request->user();

        if ($user !== null && ! $user instanceof User) {
            throw new LogicException('Authenticated audit actor must be an App\\Models\\User.');
        }

        $roles = $user === null
            ? []
            : $user->roles()
                ->pluck('slug')
                ->sort()
                ->values()
                ->all();

        return new AuditContext(
            requestId: $requestId,
            contextType: AuditContextType::Http,
            actorId: $user?->id,
            actorUsername: $user?->username ?? $anonymousUsername,
            actorRoles: $roles,
            actorSchoolId: $user?->school_id,
            ipAddress: $request->ip(),
            userAgent: $request->userAgent(),
            routeName: $request->route()?->getName(),
            httpMethod: strtoupper($request->method()),
        );
    }

    public function system(AuditContextType $contextType = AuditContextType::System): AuditContext
    {
        if ($contextType === AuditContextType::Http) {
            throw new LogicException('HTTP audit context must be created from a request.');
        }

        return new AuditContext(
            requestId: (string) Str::uuid7(),
            contextType: $contextType,
        );
    }
}
