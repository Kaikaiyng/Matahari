<?php

namespace Tests\Feature;

use App\Models\FeeItem;
use App\Models\School;
use App\Models\Student;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_school_admin_can_login_and_read_current_user(): void
    {
        $this->seed();

        $this->postJson('/api/login', [
            'email' => 'admin@mis.test',
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonPath('user.email', 'admin@mis.test')
            ->assertJsonPath('user.roles.0', 'school-admin')
            ->assertJson(fn ($json) => $json
                ->has('user.permissions')
                ->where('user.school_id', 1)
                ->etc());

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'admin@mis.test')
            ->assertJson(fn ($json) => $json
                ->whereContains('user.permissions', 'students.view')
                ->whereContains('user.permissions', 'fee_agreements.create')
                ->etc());
    }

    public function test_logout_clears_authenticated_session(): void
    {
        $this->seed();

        $this->postJson('/api/login', [
            'email' => 'admin@mis.test',
            'password' => 'password',
        ])->assertOk();

        $this->postJson('/api/logout')->assertOk()->assertJsonPath('message', 'Logged out.');

        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_invalid_login_returns_validation_error(): void
    {
        $this->seed();

        $this->postJson('/api/login', [
            'email' => 'admin@mis.test',
            'password' => 'wrong-password',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
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
            'email' => 'admin@mis.test',
            'password' => 'password',
        ])->assertOk();

        $this->getJson('/api/students')
            ->assertOk()
            ->assertJsonPath('data.0.student_no', 'MIS-2026-001');
    }

    public function test_finance_still_cannot_create_fee_agreement_after_login(): void
    {
        $this->seed();

        $school = School::query()->where('code', 'MIS')->firstOrFail();
        $student = Student::query()->where('school_id', $school->id)->firstOrFail();
        $tuition = FeeItem::query()->where('school_id', $school->id)->where('code', 'TUITION')->firstOrFail();
        $misc = FeeItem::query()->where('school_id', $school->id)->where('code', 'MISC')->firstOrFail();

        $this->postJson('/api/login', [
            'email' => 'finance@mis.test',
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
        ])->assertForbidden();
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
