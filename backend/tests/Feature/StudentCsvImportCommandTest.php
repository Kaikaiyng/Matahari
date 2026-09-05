<?php

namespace Tests\Feature;

use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Contracts\AuditLoggerContract;
use App\Models\AuditLog;
use App\Models\Permission;
use App\Models\Role;
use App\Models\School;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\Tenant;
use App\Models\TenantUserMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class StudentCsvImportCommandTest extends TestCase
{
    use RefreshDatabase;

    /** @var array<int, string> */
    private array $temporaryFiles = [];

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'tenancy.mode' => 'dedicated',
            'tenancy.dedicated_tenant_slug' => 'mis',
        ]);
    }

    protected function tearDown(): void
    {
        foreach ($this->temporaryFiles as $path) {
            @unlink($path);
        }

        parent::tearDown();
    }

    public function test_dry_run_accepts_utf8_bom_and_writes_nothing(): void
    {
        $this->tenantSchoolAndActor();
        $path = $this->csv([
            $this->headers(),
            ['MIS-NEW-001', 'Sample Student', 'primary', 'MA1', '', '2015-02-03', '2026-01-05', 'active', ''],
        ], withBom: true);

        $this->artisan('students:import-csv', $this->commandOptions($path))
            ->expectsOutputToContain('Dry run passed: 1 student row(s) validated; no data was written.')
            ->assertSuccessful();

        $this->assertDatabaseCount('students', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_commit_creates_students_with_actor_audits_and_no_related_finance_or_guardian_data(): void
    {
        [, $school, $actor] = $this->tenantSchoolAndActor();
        $path = $this->csv([
            $this->headers(),
            ['MIS-NEW-001', 'Sample Student One', 'primary', 'MA1', 'female', '2015-02-03', '2026-01-05', 'active', 'Imported sample'],
            ['MIS-NEW-002', 'Sample Student Two', 'secondary', '', '', '', '2026-01-06', 'inactive', ''],
        ]);

        $this->artisan('students:import-csv', $this->commandOptions($path, commit: true))
            ->expectsOutputToContain('Imported 2 student(s) into tenant [mis], school [MIS].')
            ->assertSuccessful();

        $this->assertDatabaseHas('students', [
            'school_id' => $school->id,
            'student_no' => 'MIS-NEW-001',
            'full_name' => 'Sample Student One',
            'level_group' => 'primary',
            'status' => 'active',
        ]);
        $this->assertDatabaseHas('students', [
            'school_id' => $school->id,
            'student_no' => 'MIS-NEW-002',
            'class_id' => null,
            'status' => 'inactive',
        ]);
        $this->assertDatabaseCount('students', 2);
        $this->assertDatabaseCount('audit_logs', 2);
        $this->assertDatabaseHas('audit_logs', [
            'school_id' => $school->id,
            'user_id' => $actor->id,
            'actor_username' => 'import.admin',
            'action' => 'student.created',
            'entity_type' => 'student',
            'context_type' => 'console',
        ]);
        $this->assertDatabaseCount('parents', 0);
        $this->assertDatabaseCount('fee_agreements', 0);
        $this->assertDatabaseCount('student_fee_assignments', 0);
    }

    public function test_complete_preflight_reports_each_invalid_row_and_prevents_all_writes(): void
    {
        [, $school] = $this->tenantSchoolAndActor();
        Student::query()->create([
            'school_id' => $school->id,
            'student_no' => 'MIS-EXISTING-001',
            'full_name' => 'Existing Student',
            'level_group' => 'primary',
            'status' => 'active',
        ]);
        $path = $this->csv([
            [...$this->headers(), 'opening_balance', 'guardian_name'],
            ['MIS-EXISTING-001', 'Invalid Student One', 'primary', 'UNKNOWN', '', 'not-a-date', '2026-01-05', 'pending', '', '10.00', 'Sample Guardian'],
            ['MIS-EXISTING-001', 'Invalid Student Two', 'primary', 'MA1', '', '2015-02-30', 'not-a-date', 'active', '', '20.00', 'Sample Guardian'],
        ]);

        $this->assertSame(1, Artisan::call('students:import-csv', $this->commandOptions($path, commit: true)));
        $output = Artisan::output();
        foreach ([
            'Row 2:', 'Row 3:', 'Unsupported column [opening_balance].',
            'Unsupported column [guardian_name].',
            'student_no is duplicated in this file (rows 2, 3).',
            'student_no already exists in target school [MIS].',
            'class_name [UNKNOWN] is not an active class in target school [MIS].',
            'status must be one of: active, withdraw, graduate, inactive.',
            'dob must use a valid YYYY-MM-DD date.',
            'registration_date must use a valid YYYY-MM-DD date.',
        ] as $message) {
            $this->assertStringContainsString($message, $output);
        }

        $this->assertDatabaseCount('students', 1);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_scope_preflight_rejects_other_tenants_and_schools(): void
    {
        [$tenant] = $this->tenantSchoolAndActor();
        $otherSchool = $this->school($tenant, 'MIS-OTHER');
        $this->tenantSchoolAndActor('other', 'OTHER', 'other.admin');
        $path = $this->csv([
            $this->headers(),
            ['NEW-001', 'Sample Student', 'primary', '', '', '', '', 'active', ''],
        ]);

        $this->artisan('students:import-csv', $this->commandOptions($path, tenant: 'other', school: 'OTHER', actor: 'other.admin', commit: true))
            ->expectsOutputToContain('Tenant [other] does not match the configured dedicated tenant [mis].')
            ->assertFailed();

        $this->artisan('students:import-csv', $this->commandOptions($path, school: 'OTHER', commit: true))
            ->expectsOutputToContain('Active school [OTHER] was not found in tenant [mis].')
            ->assertFailed();

        $this->artisan('students:import-csv', $this->commandOptions($path, school: $otherSchool->code, commit: true))
            ->expectsOutputToContain('Actor [import.admin] is not allowed to access school [MIS-OTHER] in tenant [mis].')
            ->assertFailed();

        $this->assertDatabaseCount('students', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_file_transaction_rolls_back_every_student_and_audit_when_a_later_audit_fails(): void
    {
        $this->tenantSchoolAndActor();
        $path = $this->csv([
            $this->headers(),
            ['MIS-NEW-001', 'Sample Student One', 'primary', 'MA1', '', '', '', 'active', ''],
            ['MIS-NEW-002', 'Sample Student Two', 'primary', 'MA1', '', '', '', 'active', ''],
        ]);
        $delegate = $this->app->make(AuditLoggerContract::class);
        $this->app->instance(AuditLoggerContract::class, new class($delegate) implements AuditLoggerContract
        {
            private int $records = 0;

            public function __construct(private readonly AuditLoggerContract $delegate) {}

            public function record(AuditEvent $event, AuditContext $context): AuditLog
            {
                $this->records++;
                if ($this->records === 2) {
                    throw new RuntimeException('Forced audit failure.');
                }

                return $this->delegate->record($event, $context);
            }
        });

        $this->artisan('students:import-csv', $this->commandOptions($path, commit: true))
            ->expectsOutputToContain('Import failed; the transaction was rolled back.')
            ->assertFailed();

        $this->assertDatabaseCount('students', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_all_scope_and_file_options_are_required(): void
    {
        $this->artisan('students:import-csv')
            ->expectsOutputToContain('The --tenant option is required.')
            ->expectsOutputToContain('The --school option is required.')
            ->expectsOutputToContain('The --actor option is required.')
            ->expectsOutputToContain('The --file option is required.')
            ->assertFailed();
    }

    public function test_validation_errors_with_supported_headers_are_reported_without_writes(): void
    {
        $this->tenantSchoolAndActor();
        $path = $this->csv([
            $this->headers(),
            ['NEW-001', '', 'primary', '', '', '2026-02-30', '', 'pending', ''],
        ]);
        $this->assertSame(1, Artisan::call('students:import-csv', $this->commandOptions($path, commit: true)));
        $output = Artisan::output();
        $this->assertStringContainsString('Row 2:', $output);
        $this->assertStringContainsString('dob must use a valid YYYY-MM-DD date.', $output);
        $this->assertStringContainsString('Preflight failed:', $output);
        $this->assertDatabaseCount('students', 0);
    }

    public function test_invalid_configuration_and_revoked_authority_fail_closed(): void
    {
        [, , $actor] = $this->tenantSchoolAndActor();
        $path = $this->csv([$this->headers(), ['NEW-001', 'Sample Student', 'primary', '', '', '', '', 'active', '']]);
        config(['tenancy.mode' => 'invalid']);
        $this->artisan('students:import-csv', $this->commandOptions($path, commit: true))->assertFailed();
        config(['tenancy.mode' => 'dedicated']);
        Permission::query()->where('slug', 'students.create')->firstOrFail()->roles()->detach();
        $this->artisan('students:import-csv', $this->commandOptions($path, commit: true))
            ->expectsOutputToContain('does not have [students.create]')->assertFailed();
        $actor->tenantMemberships()->update(['status' => 'inactive']);
        $this->artisan('students:import-csv', $this->commandOptions($path, commit: true))
            ->expectsOutputToContain('is not allowed to access school')->assertFailed();
        $actor->update(['status' => 'inactive']);
        $this->artisan('students:import-csv', $this->commandOptions($path, commit: true))
            ->expectsOutputToContain('Active actor [import.admin] was not found.')->assertFailed();
        $this->assertDatabaseCount('students', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    /** @return array{Tenant, School, User} */
    private function tenantSchoolAndActor(
        string $tenantSlug = 'mis',
        string $schoolCode = 'MIS',
        string $username = 'import.admin',
    ): array {
        $tenant = Tenant::query()->create([
            'slug' => $tenantSlug,
            'name' => strtoupper($tenantSlug).' Test Tenant',
            'status' => 'active',
        ]);
        $school = $this->school($tenant, $schoolCode);
        SchoolClass::query()->create([
            'school_id' => $school->id,
            'name' => 'MA1',
            'status' => 'active',
        ]);
        $permission = Permission::query()->firstOrCreate(
            ['slug' => 'students.create'],
            ['name' => 'Create students'],
        );
        $role = Role::query()->create([
            'slug' => 'importer-'.Str::lower(Str::random(12)),
            'name' => 'Student Importer',
        ]);
        $role->permissions()->attach($permission);
        $actor = User::factory()->create([
            'school_id' => $school->id,
            'username' => $username,
            'status' => 'active',
        ]);
        $actor->roles()->attach($role);
        $membership = TenantUserMembership::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $actor->id,
            'default_school_id' => $school->id,
            'access_all_schools' => false,
            'status' => 'active',
        ]);
        $membership->schools()->attach($school->id, ['tenant_id' => $tenant->id]);
        $membership->roles()->attach($role);

        return [$tenant, $school, $actor];
    }

    private function school(Tenant $tenant, string $code): School
    {
        return School::query()->create([
            'tenant_id' => $tenant->id,
            'code' => $code,
            'name' => $code.' Test School',
            'receipt_prefix' => $code,
            'invoice_prefix' => $code.'-INV',
            'status' => 'active',
        ]);
    }

    /** @return array<int, string> */
    private function headers(): array
    {
        return [
            'student_no',
            'full_name',
            'level_group',
            'class_name',
            'gender',
            'dob',
            'registration_date',
            'status',
            'notes',
        ];
    }

    /** @param array<int, array<int, string>> $rows */
    private function csv(array $rows, bool $withBom = false): string
    {
        $directory = storage_path('framework/testing');
        if (! is_dir($directory)) {
            mkdir($directory, 0777, true);
        }
        $path = $directory.DIRECTORY_SEPARATOR.'student-import-'.Str::uuid().'.csv';
        $handle = fopen($path, 'wb');
        if ($handle === false) {
            throw new RuntimeException('Unable to create the test CSV.');
        }
        if ($withBom) {
            fwrite($handle, "\xEF\xBB\xBF");
        }
        foreach ($rows as $row) {
            fputcsv($handle, $row, ',', '"', '', "\n");
        }
        fclose($handle);
        $this->temporaryFiles[] = $path;

        return $path;
    }

    /** @return array<string, mixed> */
    private function commandOptions(
        string $path,
        string $tenant = 'mis',
        string $school = 'MIS',
        string $actor = 'import.admin',
        bool $commit = false,
    ): array {
        return [
            '--tenant' => $tenant,
            '--school' => $school,
            '--actor' => $actor,
            '--file' => $path,
            '--commit' => $commit,
        ];
    }
}
