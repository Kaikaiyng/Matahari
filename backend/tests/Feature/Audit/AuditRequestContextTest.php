<?php

namespace Tests\Feature\Audit;

use App\Audit\AuditContextFactory;
use App\Audit\AuditContextType;
use App\Http\Middleware\AssignRequestId;
use App\Models\Role;
use App\Models\School;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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
        $this->assertTrue(Str::isUuid($requestId));
    }

    public function test_factory_snapshots_sorted_roles_and_actor_school(): void
    {
        $school = School::query()->create([
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

        $context = (new AuditContextFactory())->fromRequest($request);

        $this->assertSame($user->id, $context->actorId);
        $this->assertSame('auditor', $context->actorUsername);
        $this->assertSame(['finance', 'school-admin'], $context->actorRoles);
        $this->assertSame($school->id, $context->actorSchoolId);
        $this->assertSame('PATCH', $context->httpMethod);
        $this->assertSame(AuditContextType::Http, $context->contextType);
    }

    public function test_system_context_is_server_generated_and_has_no_actor(): void
    {
        $context = (new AuditContextFactory())->system(AuditContextType::Console);

        $this->assertTrue(Str::isUuid($context->requestId));
        $this->assertSame(AuditContextType::Console, $context->contextType);
        $this->assertNull($context->actorId);
        $this->assertSame([], $context->actorRoles);
    }
}
