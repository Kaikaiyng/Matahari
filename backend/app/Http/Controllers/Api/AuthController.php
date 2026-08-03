<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();
        $throttleKey = $this->loginThrottleKey($credentials['username'], $request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            return response()->json([
                'message' => 'Too many login attempts. Please try again later.',
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        if (! Auth::guard('web')->attempt($credentials)) {
            RateLimiter::hit($throttleKey, 60);

            throw ValidationException::withMessages([
                'username' => 'The username or password is incorrect.',
            ]);
        }

        $request->session()->regenerate();

        /** @var User $user */
        $user = $request->user();

        if ($user->status !== 'active') {
            RateLimiter::hit($throttleKey, 60);
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'username' => 'The username or password is incorrect.',
            ]);
        }

        RateLimiter::clear($throttleKey);

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'user' => $this->userPayload($user),
        ]);
    }

    private function loginThrottleKey(string $username, ?string $ipAddress): string
    {
        return 'login:'.Str::lower($username).'|'.($ipAddress ?? 'unknown');
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => $this->userPayload($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Logged out.',
        ]);
    }

    /**
     * @return array{
     *     id: int,
     *     name: string,
     *     username: string,
     *     school_id: int|null,
     *     status: string,
     *     last_login_at: string|null,
     *     roles: array<int, string>,
     *     permissions: array<int, string>
     * }
     */
    private function userPayload(User $user): array
    {
        $user->loadMissing('roles.permissions');

        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'school_id' => $user->school_id,
            'status' => $user->status,
            'last_login_at' => $user->last_login_at?->toISOString(),
            'roles' => $user->roles->pluck('slug')->values()->all(),
            'permissions' => $user->roles
                ->flatMap(fn ($role) => $role->permissions->pluck('slug'))
                ->unique()
                ->sort()
                ->values()
                ->all(),
        ];
    }
}
