<?php

namespace App\Http\Controllers\Api;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditContextFactory;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuditLoggerContract $auditLogger,
        private readonly AuditContextFactory $contextFactory,
    ) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();
        $throttleKey = $this->loginThrottleKey($credentials['username'], $request->ip());

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $this->auditLoginFailure($request, $credentials['username'], 'throttled');

            return response()->json([
                'message' => 'Too many login attempts. Please try again later.',
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        if (! Auth::guard('web')->attempt($credentials)) {
            RateLimiter::hit($throttleKey, 60);
            $this->auditLoginFailure($request, $credentials['username'], 'invalid_credentials');

            throw ValidationException::withMessages([
                'username' => 'The username or password is incorrect.',
            ]);
        }

        $request->session()->regenerate();

        /** @var User $user */
        $user = $request->user();

        if ($user->status !== 'active') {
            RateLimiter::hit($throttleKey, 60);
            $context = $this->contextFactory->fromRequest($request);
            $this->recordBestEffort(new AuditEvent(
                action: AuditAction::LoginFailed,
                module: AuditModule::Authentication,
                schoolId: $user->school_id,
                subjectType: AuditSubject::User,
                subjectId: $user->id,
                metadata: ['reason' => 'inactive_account'],
            ), $context);
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'username' => 'The username or password is incorrect.',
            ]);
        }

        RateLimiter::clear($throttleKey);

        $user->forceFill(['last_login_at' => now()])->save();
        $this->recordBestEffort(new AuditEvent(
            action: AuditAction::LoginSucceeded,
            module: AuditModule::Authentication,
            schoolId: $user->school_id,
            subjectType: AuditSubject::User,
            subjectId: $user->id,
            newValues: [
                'username' => $user->username,
                'status' => $user->status,
                'last_login_at' => $user->last_login_at?->toISOString(),
            ],
        ), $this->contextFactory->fromRequest($request));

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
        /** @var User|null $user */
        $user = $request->user();
        $context = $this->contextFactory->fromRequest($request);

        try {
            if ($user) {
                $this->recordBestEffort(new AuditEvent(
                    action: AuditAction::Logout,
                    module: AuditModule::Authentication,
                    schoolId: $user->school_id,
                    subjectType: AuditSubject::User,
                    subjectId: $user->id,
                    newValues: ['logged_out' => true],
                ), $context);
            }
        } finally {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'message' => 'Logged out.',
        ]);
    }

    private function auditLoginFailure(Request $request, string $username, string $reason): void
    {
        $candidate = User::query()->where('username', $username)->first();
        $this->recordBestEffort(new AuditEvent(
            action: AuditAction::LoginFailed,
            module: AuditModule::Authentication,
            schoolId: $candidate?->school_id,
            subjectType: $candidate ? AuditSubject::User : null,
            subjectId: $candidate?->id,
            metadata: ['reason' => $reason],
        ), $this->contextFactory->fromRequest($request, $username));
    }

    private function recordBestEffort(AuditEvent $event, AuditContext $context): void
    {
        try {
            $this->auditLogger->record($event, $context);
        } catch (Throwable $exception) {
            try {
                Log::channel('security')->warning('audit.write_failed', [
                    'request_id' => $context->requestId,
                    'action' => $event->action->value,
                    'actor_id' => $context->actorId,
                    'exception_class' => $exception::class,
                ]);
            } catch (Throwable) {
                // Authentication and logout must remain safe if both audit sinks are unavailable.
            }
        }
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
