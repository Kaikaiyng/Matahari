<?php

namespace Tests\Feature;

use App\Models\FeeItem;
use App\Models\School;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        RateLimiter::clear('login:admin|127.0.0.1');

        parent::tearDown();
    }

    public function test_school_admin_can_login_and_read_current_user(): void
    {
        $this->seed();

        $this->postJson('/api/login', [
            'username' => ' ADMIN ',
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonPath('user.username', 'admin')
            ->assertJsonMissingPath('user.email')
            ->assertJsonPath('user.roles.0', 'school-admin')
            ->assertJson(fn ($json) => $json
                ->has('user.permissions')
                ->where('user.school_id', 1)
                ->etc());

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.username', 'admin')
            ->assertJsonMissingPath('user.email')
            ->assertJson(fn ($json) => $json
                ->whereContains('user.permissions', 'students.view')
                ->whereContains('user.permissions', 'fee_agreements.create')
                ->etc());
    }

    public function test_platform_owner_identity_and_effective_permissions_are_returned_to_the_admin_client(): void
    {
        $this->seed();

        $this->postJson('/api/login', [
            'username' => 'superadmin',
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonPath('user.is_platform_owner', true)
            ->assertJson(fn ($json) => $json
                ->whereContains('user.permissions', 'school.settings.manage')
                ->etc());
    }

    public function test_logout_clears_authenticated_session(): void
    {
        $this->seed();

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'password',
        ])->assertOk();

        $this->postJson('/api/logout')->assertOk()->assertJsonPath('message', 'Logged out.');

        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_invalid_login_returns_validation_error(): void
    {
        $this->seed();

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'wrong-password',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The username or password is incorrect.')
            ->assertJsonValidationErrors(['username']);
    }

    public function test_legacy_email_login_payload_is_rejected(): void
    {
        $this->seed();

        $this->postJson('/api/login', [
            'email' => 'admin@mis.test',
            'password' => 'password',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['username']);
    }

    public function test_inactive_account_uses_the_generic_credentials_error(): void
    {
        $this->seed();

        User::query()->where('username', 'admin')->update(['status' => 'inactive']);

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'password',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The username or password is incorrect.')
            ->assertJsonValidationErrors(['username']);
    }

    public function test_login_is_throttled_by_normalized_username_and_ip(): void
    {
        $this->seed();

        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/login', [
                'username' => ' ADMIN ',
                'password' => 'wrong-password',
            ])->assertUnprocessable();
        }

        $tenantId = Tenant::query()->where('slug', 'mis')->value('id');
        $this->assertSame(5, RateLimiter::attempts("login:{$tenantId}|admin|127.0.0.1"));

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'wrong-password',
        ])
            ->assertTooManyRequests()
            ->assertJsonMissingPath('errors.username');
    }

    public function test_successful_login_clears_previous_failed_attempts(): void
    {
        $this->seed();

        foreach (range(1, 4) as $attempt) {
            $this->postJson('/api/login', [
                'username' => 'admin',
                'password' => 'wrong-password',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'password',
        ])->assertOk();

        $this->postJson('/api/logout')->assertOk();

        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/login', [
                'username' => 'admin',
                'password' => 'wrong-password',
            ])->assertUnprocessable();
        }
    }

    public function test_existing_session_is_invalidated_when_account_becomes_inactive(): void
    {
        $this->seed();

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'password',
        ])->assertOk();

        User::query()->where('username', 'admin')->update(['status' => 'inactive']);

        $this->getJson('/api/me')->assertUnauthorized();
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_unauthenticated_students_api_returns_401(): void
    {
        $this->seed();

        $this->getJson('/api/students')->assertUnauthorized();
    }

    public function test_legacy_dashboard_and_invoice_generation_require_authentication(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();

        $this->getJson('/api/dashboard/school?school_id='.$school->id.'&invoice_month=2026-07')
            ->assertUnauthorized();

        $this->postJson('/api/invoices/generate-monthly', [
            'school_id' => $school->id,
            'invoice_month' => '2026-07',
            'issue_date' => '2026-07-01',
            'due_date' => '2026-07-10',
        ])->assertUnauthorized();
    }

    public function test_authenticated_school_admin_can_access_students_api(): void
    {
        $this->seed();

        $this->postJson('/api/login', [
            'username' => 'admin',
            'password' => 'password',
        ])->assertOk();

        $this->getJson('/api/students')
            ->assertOk()
            ->assertJsonPath('data.0.student_no', 'MIS-2026-001');
    }

    public function test_finance_can_create_fee_agreement_after_login_as_advanced_admin(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $student = Student::query()->where('school_id', $school->id)->firstOrFail();
        $tuition = FeeItem::query()->where('school_id', $school->id)->where('code', 'TUITION')->firstOrFail();
        $misc = FeeItem::query()->where('school_id', $school->id)->where('code', 'MISC')->firstOrFail();

        $this->postJson('/api/login', [
            'username' => 'finance',
            'password' => 'password',
        ])->assertOk();

        $this->postJson("/api/students/{$student->id}/fee-agreements", [
            'academic_year' => '2026',
            'payment_plan' => 'monthly',
            'effective_from' => '2026-07-05',
            'items' => [
                ['fee_item_id' => $tuition->id, 'amount' => 800],
                ['fee_item_id' => $misc->id, 'amount' => 90],
            ],
        ])->assertCreated();
    }

    public function test_login_preflight_allows_react_dev_server_credentials(): void
    {
        $this
            ->withHeaders([
                'Origin' => 'http://localhost:5173',
                'Access-Control-Request-Method' => 'POST',
                'Access-Control-Request-Headers' => 'content-type',
            ])
            ->options('/api/login')
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }
}
