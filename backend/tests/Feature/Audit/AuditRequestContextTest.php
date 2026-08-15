<?php

namespace Tests\Feature\Audit;

use App\Audit\AuditContextFactory;
use App\Audit\AuditContextType;
use App\Http\Middleware\AssignRequestId;
use App\Models\Role;
use App\Models\User;
use Closure;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Middleware\ValidatePathEncoding;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use LogicException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class AuditRequestContextTest extends TestCase
{
    use RefreshDatabase;

    public function test_middleware_ignores_client_request_id_and_returns_server_uuid(): void
    {
        $response = $this
            ->withHeader('X-Request-ID', 'client-controlled')
            ->getJson('/up')
            ->assertOk()
            ->assertHeader('X-Request-ID');

        $requestId = $response->headers->get('X-Request-ID');

        $this->assertNotSame('client-controlled', $requestId);
        $this->assertTrue(Str::isUuid($requestId, 7));
    }

    public function test_rendered_api_404_reuses_assigned_request_id_and_ignores_client_spoof(): void
    {
        $clientRequestId = (string) Str::uuid7();

        Route::get('/api/test/request-id-rendered-exception', function (Request $request): never {
            abort(404, 'Not Found', [
                'X-Test-Assigned-Request-ID' => $request->attributes->get(AssignRequestId::ATTRIBUTE),
            ]);
        });

        $response = $this
            ->withHeader('X-Request-ID', $clientRequestId)
            ->getJson('/api/test/request-id-rendered-exception')
            ->assertNotFound()
            ->assertJson(['message' => 'Not Found'])
            ->assertHeader('X-Request-ID')
            ->assertHeader('X-Test-Assigned-Request-ID');

        $requestId = $response->headers->get('X-Request-ID');

        $this->assertTrue(Str::isUuid($requestId, 7));
        $this->assertNotSame($clientRequestId, $requestId);
        $this->assertSame(
            $response->headers->get('X-Test-Assigned-Request-ID'),
            $requestId,
        );
    }

    public function test_downstream_early_response_includes_request_id(): void
    {
        $kernel = $this->app->make(Kernel::class);
        $middleware = $kernel->getGlobalMiddleware();
        $validatePathIndex = array_search(
            ValidatePathEncoding::class,
            $middleware,
            true,
        );

        $this->assertIsInt($validatePathIndex);

        array_splice(
            $middleware,
            $validatePathIndex + 1,
            0,
            [ReturnEarlyTestMiddleware::class],
        );
        $kernel->setGlobalMiddleware($middleware);

        $response = $this
            ->get('/test/request-id-downstream-early')
            ->assertStatus(429)
            ->assertSeeText('Downstream early response')
            ->assertHeader('X-Request-ID');

        $this->assertTrue(
            Str::isUuid($response->headers->get('X-Request-ID'), 7),
        );
    }

    public function test_exception_response_hook_reuses_validated_request_attribute(): void
    {
        $requestId = (string) Str::uuid7();
        $request = Request::create('/api/missing', 'GET');
        $request->attributes->set(AssignRequestId::ATTRIBUTE, $requestId);

        $response = $this->app
            ->make(ExceptionHandler::class)
            ->render($request, new NotFoundHttpException);

        $this->assertSame($requestId, $response->headers->get('X-Request-ID'));
    }

    public function test_exception_response_hook_does_not_expose_malformed_request_attribute(): void
    {
        $request = Request::create('/api/missing', 'GET');
        $request->attributes->set(AssignRequestId::ATTRIBUTE, 'client-controlled');

        $response = $this->app
            ->make(ExceptionHandler::class)
            ->render($request, new NotFoundHttpException);

        $this->assertFalse($response->headers->has('X-Request-ID'));
    }

    public function test_factory_snapshots_sorted_roles_and_actor_school(): void
    {
        $school = $this->createTenantSchool([
            'code' => 'CTX',
            'name' => 'Context School',
            'receipt_prefix' => 'CTX',
            'invoice_prefix' => 'CTX-INV',
            'status' => 'active',
        ]);
        $user = User::factory()->create(['school_id' => $school->id, 'username' => 'auditor']);
        $roles = collect(['school-admin', 'finance'])->map(fn (string $slug) => Role::query()->create([
            'slug' => $slug,
            'name' => $slug,
        ]));
        $user->roles()->sync($roles->pluck('id')->all());

        $request = Request::create('/api/students', 'PATCH', server: [
            'REMOTE_ADDR' => '127.0.0.9',
            'HTTP_USER_AGENT' => 'Audit Context Test',
        ]);
        $request->attributes->set(AssignRequestId::ATTRIBUTE, (string) Str::uuid7());
        $request->setUserResolver(fn () => $user);

        $context = (new AuditContextFactory)->fromRequest($request);

        $this->assertSame($user->id, $context->actorId);
        $this->assertSame('auditor', $context->actorUsername);
        $this->assertSame(['finance', 'school-admin'], $context->actorRoles);
        $this->assertSame($school->id, $context->actorSchoolId);
        $this->assertSame('PATCH', $context->httpMethod);
        $this->assertSame(AuditContextType::Http, $context->contextType);
    }

    public function test_system_context_is_server_generated_and_has_no_actor(): void
    {
        $context = (new AuditContextFactory)->system(AuditContextType::Console);

        $this->assertTrue(Str::isUuid($context->requestId));
        $this->assertSame(AuditContextType::Console, $context->contextType);
        $this->assertNull($context->actorId);
        $this->assertSame([], $context->actorRoles);
    }

    public function test_factory_rejects_missing_server_request_id(): void
    {
        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Server request ID middleware did not run.');

        (new AuditContextFactory)->fromRequest(Request::create('/api/students', 'GET'));
    }

    public function test_factory_rejects_malformed_server_request_id(): void
    {
        $request = Request::create('/api/students', 'GET');
        $request->attributes->set(AssignRequestId::ATTRIBUTE, 'not-a-uuid');

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Server request ID middleware did not run.');

        (new AuditContextFactory)->fromRequest($request);
    }

    public function test_factory_rejects_valid_non_v7_server_request_id(): void
    {
        $requestId = (string) Str::uuid();
        $this->assertTrue(Str::isUuid($requestId, 4));

        $request = Request::create('/api/students', 'GET');
        $request->attributes->set(AssignRequestId::ATTRIBUTE, $requestId);

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('Server request ID middleware did not run.');

        (new AuditContextFactory)->fromRequest($request);
    }
}

final class ReturnEarlyTestMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        return response('Downstream early response', 429);
    }
}
