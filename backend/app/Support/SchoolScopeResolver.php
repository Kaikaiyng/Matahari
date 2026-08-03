<?php

namespace App\Support;

use App\Models\School;
use App\Models\User;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Validation\ValidationException;

class SchoolScopeResolver
{
    public function resolve(?User $user, mixed $requestedSchoolId): int
    {
        if (! $user) {
            throw new AuthenticationException;
        }

        if ($user->school_id !== null) {
            if ($requestedSchoolId !== null && (int) $requestedSchoolId !== (int) $user->school_id) {
                abort(403, 'This school scope is not permitted.');
            }

            return (int) $user->school_id;
        }

        if (! is_numeric($requestedSchoolId) || (int) $requestedSchoolId < 1) {
            throw ValidationException::withMessages([
                'school_id' => 'A valid school selection is required.',
            ]);
        }

        $schoolId = (int) $requestedSchoolId;

        if (! School::query()->whereKey($schoolId)->exists()) {
            throw ValidationException::withMessages([
                'school_id' => 'The selected school is invalid.',
            ]);
        }

        return $schoolId;
    }
}
