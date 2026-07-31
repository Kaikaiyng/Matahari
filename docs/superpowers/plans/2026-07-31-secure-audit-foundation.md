# Secure Audit Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 append-only audit foundation on the existing `audit_logs` table without yet adding business-flow audit integrations, Audit Log APIs, UI, or correction endpoints.

**Architecture:** Upgrade the existing schema with a forward-only additive migration, then route all new audit inserts through typed value objects and `AuditLoggerContract`. A server-generated request ID and trusted request context provide actor/provenance snapshots; a recursive sanitizer removes secrets. The model rejects instance mutation, while Production table grants documented separately provide the database-runtime boundary.

**Tech Stack:** PHP 8.3, Laravel 13.8, PHPUnit 12.5, SQLite fast tests, MariaDB integration tests, native Laravel only.

## Global Constraints

- Preserve the existing `audit_logs`, `user_id`, `entity_type`, and `entity_id` schema contracts.
- Do not add a second role system or a third-party audit package.
- Do not add Audit Log list/detail/correction routes or frontend UI in Phase 1.
- Do not deploy, push, alter Production grants, install cron jobs, or touch a Production database.
- Treat model guards as application-level append-only protection, not cryptographic immutability.
- New HTTP request IDs and event UUIDs are server-generated UUIDv7 values.
- `school_id` identifies the affected business record's school; the actor school is only a fallback.
- Audit values contain changed fields only and must pass the recursive sanitizer.
- Use TDD: write each failing test, run it and confirm the expected failure, then implement the minimum passing code.
- Use `tools\php\php-local.cmd` from the repository root for PHP/Artisan commands.
- Preserve unrelated untracked files, including `backend/database/on` and `frontend/test-results/`.

---

### Task 1: Additive Audit Schema Upgrade

**Files:**
- Create: `backend/database/migrations/2026_07_31_000001_expand_audit_logs_for_secure_events.php`
- Create: `backend/tests/Feature/Audit/AuditLogSchemaTest.php`
- Create: `backend/tests/Feature/Audit/AuditLogUpgradeMigrationTest.php`
- Create: `backend/tests/Feature/Audit/AuditMariaDbSchemaTest.php`
- Modify: `backend/app/Models/AuditLog.php`

**Interfaces:**
- Consumes: the legacy `audit_logs` table created by `2026_06_26_000001_create_school_finance_tables.php`.
- Produces: new secure-event columns, indexes, model fillable fields, and array casts consumed by Tasks 2–5.

- [ ] **Step 1: Write the failing SQLite schema tests**

Create `backend/tests/Feature/Audit/AuditLogSchemaTest.php`:

```php
<?php

namespace Tests\Feature\Audit;

use App\Models\AuditLog;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuditLogSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_fresh_schema_contains_secure_audit_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('audit_logs', [
            'event_uuid',
            'request_id',
            'batch_id',
            'actor_username',
            'actor_roles',
            'module',
            'metadata',
            'reason',
            'related_audit_id',
            'route_name',
            'http_method',
            'context_type',
            'schema_version',
        ]));
    }

    public function test_event_uuid_is_unique(): void
    {
        $uuid = (string) Str::uuid7();
        $base = [
            'event_uuid' => $uuid,
            'request_id' => (string) Str::uuid7(),
            'action' => 'legacy.test',
            'module' => 'legacy',
            'context_type' => 'system',
            'schema_version' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ];

        DB::table('audit_logs')->insert($base);

        $this->expectException(QueryException::class);
        DB::table('audit_logs')->insert([
            ...$base,
            'request_id' => (string) Str::uuid7(),
        ]);
    }

    public function test_model_casts_json_snapshots_and_metadata_to_arrays(): void
    {
        $log = AuditLog::query()->create([
            'event_uuid' => (string) Str::uuid7(),
            'request_id' => (string) Str::uuid7(),
            'action' => 'legacy.test',
            'module' => 'legacy',
            'old_values' => ['status' => 'active'],
            'new_values' => ['status' => 'inactive'],
            'metadata' => ['source' => 'test'],
            'actor_roles' => ['super-admin'],
            'context_type' => 'system',
            'schema_version' => 1,
        ]);

        $this->assertSame(['status' => 'active'], $log->old_values);
        $this->assertSame(['status' => 'inactive'], $log->new_values);
        $this->assertSame(['source' => 'test'], $log->metadata);
        $this->assertSame(['super-admin'], $log->actor_roles);
    }
}
```

- [ ] **Step 2: Write the populated legacy-schema upgrade test**

Create `backend/tests/Feature/Audit/AuditLogUpgradeMigrationTest.php`:

```php
<?php

namespace Tests\Feature\Audit;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuditLogUpgradeMigrationTest extends TestCase
{
    public function test_upgrade_preserves_and_backfills_existing_audit_rows(): void
    {
        Config::set('database.connections.audit_upgrade', [
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
            'foreign_key_constraints' => true,
        ]);
        DB::purge('audit_upgrade');
        $originalDefault = DB::getDefaultConnection();
        DB::setDefaultConnection('audit_upgrade');

        try {
            Schema::create('audit_logs', function (Blueprint $table): void {
                $table->id();
                $table->string('action', 100);
                $table->json('old_values')->nullable();
                $table->json('new_values')->nullable();
                $table->timestamps();
            });

            $legacyId = DB::table('audit_logs')->insertGetId([
                'action' => 'student.updated',
                'old_values' => json_encode(['notes' => 'A'], JSON_THROW_ON_ERROR),
                'new_values' => json_encode(['notes' => 'B'], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $migration = require database_path('migrations/2026_07_31_000001_expand_audit_logs_for_secure_events.php');
            $migration->up();

            $legacy = DB::table('audit_logs')->where('id', $legacyId)->firstOrFail();

            $this->assertSame('student.updated', $legacy->action);
            $this->assertTrue(Str::isUuid($legacy->event_uuid));
            $this->assertSame('legacy', $legacy->module);
            $this->assertSame('system', $legacy->context_type);
            $this->assertSame(1, $legacy->schema_version);
            $this->assertTrue(Schema::hasColumns('audit_logs', [
                'request_id',
                'actor_roles',
                'metadata',
                'related_audit_id',
            ]));
        } finally {
            DB::setDefaultConnection($originalDefault);
            DB::purge('audit_upgrade');
        }
    }
}
```

- [ ] **Step 3: Run the SQLite schema tests and verify RED**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\Audit\AuditLogSchemaTest.php backend\tests\Feature\Audit\AuditLogUpgradeMigrationTest.php
```

Expected: FAIL because `event_uuid` and the other secure columns do not exist.

- [ ] **Step 4: Write the MariaDB-only schema test before implementation**

Create `backend/tests/Feature/Audit/AuditMariaDbSchemaTest.php`:

```php
<?php

namespace Tests\Feature\Audit;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('mariadb')]
class AuditMariaDbSchemaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        if (! in_array(DB::getDriverName(), ['mariadb', 'mysql'], true)) {
            $this->markTestSkipped('Run with DB_CONNECTION=mariadb or mysql.');
        }
    }

    public function test_secure_audit_json_and_unique_uuid_use_real_mariadb(): void
    {
        $eventUuid = (string) Str::uuid7();

        $log = AuditLog::query()->create([
            'event_uuid' => $eventUuid,
            'request_id' => (string) Str::uuid7(),
            'action' => 'legacy.test',
            'module' => 'legacy',
            'old_values' => ['amount' => '100.00'],
            'new_values' => ['amount' => '120.00'],
            'metadata' => ['driver' => DB::getDriverName()],
            'actor_roles' => ['super-admin'],
            'context_type' => 'system',
            'schema_version' => 1,
        ]);

        $this->assertSame(['amount' => '100.00'], $log->old_values);
        $this->assertSame(['amount' => '120.00'], $log->new_values);
        $this->assertSame($eventUuid, $log->event_uuid);
        $this->assertSame(1, DB::table('audit_logs')->where('event_uuid', $eventUuid)->count());
    }
}
```

Do not treat a skipped SQLite execution as MariaDB evidence. The MariaDB command is executed in Task 8 against a configured disposable database.

- [ ] **Step 5: Implement the additive migration**

Create `backend/database/migrations/2026_07_31_000001_expand_audit_logs_for_secure_events.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->uuid('event_uuid')->nullable();
            $table->uuid('request_id')->nullable();
            $table->uuid('batch_id')->nullable();
            $table->string('actor_username', 50)->nullable();
            $table->json('actor_roles')->nullable();
            $table->string('module', 100)->nullable();
            $table->json('metadata')->nullable();
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('related_audit_id')->nullable();
            $table->string('route_name')->nullable();
            $table->string('http_method', 10)->nullable();
            $table->string('context_type', 20)->default('system');
            $table->unsignedSmallInteger('schema_version')->default(1);
        });

        DB::table('audit_logs')
            ->whereNull('event_uuid')
            ->orderBy('id')
            ->chunkById(500, function ($rows): void {
                foreach ($rows as $row) {
                    DB::table('audit_logs')
                        ->where('id', $row->id)
                        ->update([
                            'event_uuid' => (string) Str::uuid7(),
                            'module' => 'legacy',
                            'context_type' => 'system',
                            'schema_version' => 1,
                        ]);
                }
            });

        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->uuid('event_uuid')->nullable(false)->change();
            $table->string('module', 100)->nullable(false)->change();
            $table->unique('event_uuid', 'audit_logs_event_uuid_unique');
            $table->index('created_at', 'audit_logs_created_at_index');
            $table->index('request_id', 'audit_logs_request_id_index');
            $table->index('batch_id', 'audit_logs_batch_id_index');
            $table->index('module', 'audit_logs_module_index');
            $table->index('action', 'audit_logs_action_index');
            $table->index('related_audit_id', 'audit_logs_related_audit_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table): void {
            $table->dropUnique('audit_logs_event_uuid_unique');
            $table->dropIndex('audit_logs_created_at_index');
            $table->dropIndex('audit_logs_request_id_index');
            $table->dropIndex('audit_logs_batch_id_index');
            $table->dropIndex('audit_logs_module_index');
            $table->dropIndex('audit_logs_action_index');
            $table->dropIndex('audit_logs_related_audit_id_index');
            $table->dropColumn([
                'event_uuid',
                'request_id',
                'batch_id',
                'actor_username',
                'actor_roles',
                'module',
                'metadata',
                'reason',
                'related_audit_id',
                'route_name',
                'http_method',
                'context_type',
                'schema_version',
            ]);
        });
    }
};
```

- [ ] **Step 6: Expand the existing AuditLog model**

Replace the `$fillable` and `casts()` members in `backend/app/Models/AuditLog.php` with:

```php
protected $fillable = [
    'event_uuid',
    'request_id',
    'batch_id',
    'school_id',
    'user_id',
    'actor_username',
    'actor_roles',
    'action',
    'module',
    'entity_type',
    'entity_id',
    'old_values',
    'new_values',
    'metadata',
    'reason',
    'related_audit_id',
    'ip_address',
    'user_agent',
    'route_name',
    'http_method',
    'context_type',
    'schema_version',
];

protected function casts(): array
{
    return [
        'actor_roles' => 'array',
        'old_values' => 'array',
        'new_values' => 'array',
        'metadata' => 'array',
        'schema_version' => 'integer',
    ];
}
```

- [ ] **Step 7: Run schema tests and verify GREEN**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\Audit\AuditLogSchemaTest.php backend\tests\Feature\Audit\AuditLogUpgradeMigrationTest.php
```

Expected: PASS. If SQLite rejects the `change()` operation, keep the test unchanged and adjust only the migration into separate portable schema operations until the same assertions pass.

- [ ] **Step 8: Run migration rollback/fresh verification against an explicit temporary SQLite database**

Run:

```powershell
$auditMigrationDb = Join-Path (Resolve-Path 'backend\database') 'audit-phase1-test.sqlite'
New-Item -ItemType File -Force -Path $auditMigrationDb | Out-Null
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = $auditMigrationDb
tools\php\php-local.cmd backend\artisan migrate:fresh --force
tools\php\php-local.cmd backend\artisan migrate:rollback --step=1 --env=testing
tools\php\php-local.cmd backend\artisan migrate --env=testing
Remove-Item -LiteralPath $auditMigrationDb
Remove-Item Env:DB_CONNECTION
Remove-Item Env:DB_DATABASE
```

Expected: all commands exit successfully and the final schema contains the secure audit columns. Resolve and inspect `$auditMigrationDb` before running; it must end in `backend\database\audit-phase1-test.sqlite`. The command must not run if it resolves anywhere else.

- [ ] **Step 9: Commit Task 1**

```powershell
git add backend/database/migrations/2026_07_31_000001_expand_audit_logs_for_secure_events.php backend/app/Models/AuditLog.php backend/tests/Feature/Audit/AuditLogSchemaTest.php backend/tests/Feature/Audit/AuditLogUpgradeMigrationTest.php backend/tests/Feature/Audit/AuditMariaDbSchemaTest.php
git commit -m "feat: expand secure audit schema"
```

---

### Task 2: Typed Audit Vocabulary, Value Objects, and Secret Sanitizer

**Files:**
- Create: `backend/app/Audit/AuditAction.php`
- Create: `backend/app/Audit/AuditModule.php`
- Create: `backend/app/Audit/AuditSubject.php`
- Create: `backend/app/Audit/AuditContextType.php`
- Create: `backend/app/Audit/AuditEvent.php`
- Create: `backend/app/Audit/AuditContext.php`
- Create: `backend/app/Audit/AuditPayloadSanitizer.php`
- Create: `backend/tests/Unit/Audit/AuditEventTest.php`
- Create: `backend/tests/Unit/Audit/AuditPayloadSanitizerTest.php`

**Interfaces:**
- Consumes: secure schema vocabulary from Task 1.
- Produces: immutable `AuditEvent`, immutable `AuditContext`, stable enums, and `AuditPayloadSanitizer::sanitize(array $payload): array`.

- [ ] **Step 1: Write failing value-object tests**

Create `backend/tests/Unit/Audit/AuditEventTest.php`:

```php
<?php

namespace Tests\Unit\Audit;

use App\Audit\AuditAction;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class AuditEventTest extends TestCase
{
    public function test_subject_type_and_id_must_be_supplied_together(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new AuditEvent(
            action: AuditAction::StudentUpdated,
            module: AuditModule::Students,
            schoolId: 4,
            subjectType: AuditSubject::Student,
        );
    }

    public function test_blank_reason_is_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new AuditEvent(
            action: AuditAction::PaymentVoided,
            module: AuditModule::Payments,
            schoolId: 4,
            subjectType: AuditSubject::Payment,
            subjectId: 12,
            reason: '   ',
        );
    }

    public function test_valid_event_preserves_affected_school_and_changed_fields(): void
    {
        $event = new AuditEvent(
            action: AuditAction::StudentUpdated,
            module: AuditModule::Students,
            schoolId: 4,
            subjectType: AuditSubject::Student,
            subjectId: 12,
            oldValues: ['notes' => 'A'],
            newValues: ['notes' => 'B'],
        );

        $this->assertSame(4, $event->schoolId);
        $this->assertSame(['notes' => 'A'], $event->oldValues);
        $this->assertSame(['notes' => 'B'], $event->newValues);
    }
}
```

- [ ] **Step 2: Write failing recursive sanitizer tests**

Create `backend/tests/Unit/Audit/AuditPayloadSanitizerTest.php`:

```php
<?php

namespace Tests\Unit\Audit;

use App\Audit\AuditPayloadSanitizer;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use stdClass;

class AuditPayloadSanitizerTest extends TestCase
{
    public function test_recursively_removes_mixed_case_and_nested_secrets(): void
    {
        $result = (new AuditPayloadSanitizer())->sanitize([
            'student_no' => 'MIS-001',
            'Password' => 'plain',
            'profile' => [
                'phone' => '0123',
                'remember_token' => 'secret',
                'AUTHORIZATION-header' => 'Bearer secret',
                'nested' => [
                    'csrfToken' => 'secret',
                    'safe' => true,
                ],
            ],
        ]);

        $this->assertSame([
            'student_no' => 'MIS-001',
            'profile' => [
                'phone' => '0123',
                'nested' => [
                    'safe' => true,
                ],
            ],
        ], $result);
    }

    public function test_rejects_objects_instead_of_serializing_unknown_data(): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new AuditPayloadSanitizer())->sanitize(['payload' => new stdClass()]);
    }
}
```

- [ ] **Step 3: Run unit tests and verify RED**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Unit\Audit
```

Expected: FAIL because the audit enums and value objects do not exist.

- [ ] **Step 4: Add the stable enums**

Create `backend/app/Audit/AuditAction.php`:

```php
<?php

namespace App\Audit;

enum AuditAction: string
{
    case LoginSucceeded = 'auth.login_succeeded';
    case LoginFailed = 'auth.login_failed';
    case Logout = 'auth.logout';
    case StudentCreated = 'student.created';
    case StudentUpdated = 'student.updated';
    case StudentStatusChanged = 'student.status_changed';
    case StudentStatusCorrected = 'student.status_corrected';
    case FeeAgreementCreated = 'fee_agreement.created';
    case FeeAgreementSuperseded = 'fee_agreement.superseded';
    case FeeAgreementCorrected = 'fee_agreement.corrected';
    case PaymentRecorded = 'payment.recorded';
    case PaymentVerified = 'payment.verified';
    case PaymentVoided = 'payment.voided';
    case PaymentReversed = 'payment.reversed';
    case PaymentCorrected = 'payment.corrected';
    case ReceiptIssued = 'receipt.issued';
    case ReceiptVoided = 'receipt.voided';
    case ReceiptReplaced = 'receipt.replaced';
    case UserCreated = 'user.created';
    case UserActivated = 'user.activated';
    case UserDeactivated = 'user.deactivated';
    case UserRoleChanged = 'user.role_changed';
    case UserPasswordReset = 'user.password_reset';
    case ReportExported = 'report.exported';
    case ReportPrinted = 'report.printed';
    case BatchChanged = 'batch.changed';
}
```

Create `backend/app/Audit/AuditModule.php`:

```php
<?php

namespace App\Audit;

enum AuditModule: string
{
    case Legacy = 'legacy';
    case Authentication = 'authentication';
    case Students = 'students';
    case FeeAgreements = 'fee_agreements';
    case Payments = 'payments';
    case Receipts = 'receipts';
    case Users = 'users';
    case Reports = 'reports';
    case Batch = 'batch';
}
```

Create `backend/app/Audit/AuditSubject.php`:

```php
<?php

namespace App\Audit;

enum AuditSubject: string
{
    case Student = 'student';
    case FeeAgreement = 'fee_agreement';
    case Payment = 'payment';
    case Receipt = 'receipt';
    case User = 'user';
    case Report = 'report';
    case Batch = 'batch';
}
```

Create `backend/app/Audit/AuditContextType.php`:

```php
<?php

namespace App\Audit;

enum AuditContextType: string
{
    case Http = 'http';
    case Console = 'console';
    case Queue = 'queue';
    case System = 'system';
}
```

- [ ] **Step 5: Add immutable AuditEvent and AuditContext**

Create `backend/app/Audit/AuditEvent.php`:

```php
<?php

namespace App\Audit;

use InvalidArgumentException;

final readonly class AuditEvent
{
    public function __construct(
        public AuditAction $action,
        public AuditModule $module,
        public ?int $schoolId = null,
        public ?AuditSubject $subjectType = null,
        public ?int $subjectId = null,
        public array $oldValues = [],
        public array $newValues = [],
        public array $metadata = [],
        public ?string $reason = null,
        public ?int $relatedAuditId = null,
        public ?string $batchId = null,
    ) {
        if (($this->subjectType === null) !== ($this->subjectId === null)) {
            throw new InvalidArgumentException('Audit subject type and ID must be provided together.');
        }

        if ($this->reason !== null && trim($this->reason) === '') {
            throw new InvalidArgumentException('Audit reason cannot be blank.');
        }
    }
}
```

Create `backend/app/Audit/AuditContext.php`:

```php
<?php

namespace App\Audit;

final readonly class AuditContext
{
    /**
     * @param array<int, string> $actorRoles
     */
    public function __construct(
        public string $requestId,
        public AuditContextType $contextType,
        public ?int $actorId = null,
        public ?string $actorUsername = null,
        public array $actorRoles = [],
        public ?int $actorSchoolId = null,
        public ?string $ipAddress = null,
        public ?string $userAgent = null,
        public ?string $routeName = null,
        public ?string $httpMethod = null,
    ) {
    }
}
```

- [ ] **Step 6: Implement the recursive fail-closed sanitizer**

Create `backend/app/Audit/AuditPayloadSanitizer.php`:

```php
<?php

namespace App\Audit;

use InvalidArgumentException;

final class AuditPayloadSanitizer
{
    private const SENSITIVE_FRAGMENTS = [
        'password',
        'token',
        'authorization',
        'cookie',
        'session',
        'csrf',
        'xsrf',
        'otp',
        'apikey',
        'credential',
        'secret',
        'privatekey',
    ];

    /**
     * @param array<array-key, mixed> $payload
     * @return array<array-key, mixed>
     */
    public function sanitize(array $payload): array
    {
        $sanitized = [];

        foreach ($payload as $key => $value) {
            if (is_string($key) && $this->isSensitiveKey($key)) {
                continue;
            }

            $sanitized[$key] = $this->sanitizeValue($value);
        }

        return $sanitized;
    }

    private function isSensitiveKey(string $key): bool
    {
        $normalized = strtolower((string) preg_replace('/[^a-z0-9]/i', '', $key));

        foreach (self::SENSITIVE_FRAGMENTS as $fragment) {
            if (str_contains($normalized, $fragment)) {
                return true;
            }
        }

        return false;
    }

    private function sanitizeValue(mixed $value): mixed
    {
        if (is_array($value)) {
            return $this->sanitize($value);
        }

        if (is_object($value) || is_resource($value)) {
            throw new InvalidArgumentException('Audit payload values must be scalar, null, or arrays.');
        }

        return $value;
    }
}
```

- [ ] **Step 7: Run unit tests and verify GREEN**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Unit\Audit
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```powershell
git add backend/app/Audit backend/tests/Unit/Audit
git commit -m "feat: define typed audit events"
```

---

### Task 3: Server Request ID and Trusted Audit Context

**Files:**
- Create: `backend/app/Http/Middleware/AssignRequestId.php`
- Create: `backend/app/Audit/AuditContextFactory.php`
- Create: `backend/tests/Feature/Audit/AuditRequestContextTest.php`
- Modify: `backend/bootstrap/app.php`

**Interfaces:**
- Consumes: `AuditContext`, `AuditContextType` from Task 2 and existing authenticated `User`.
- Produces: `AssignRequestId::ATTRIBUTE`, `AuditContextFactory::fromRequest(Request): AuditContext`, and `AuditContextFactory::system(AuditContextType): AuditContext`.

- [ ] **Step 1: Write failing request-ID/context tests**

Create `backend/tests/Feature/Audit/AuditRequestContextTest.php`:

```php
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
```

- [ ] **Step 2: Run context tests and verify RED**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\Audit\AuditRequestContextTest.php
```

Expected: FAIL because `AssignRequestId` and `AuditContextFactory` do not exist.

- [ ] **Step 3: Implement AssignRequestId**

Create `backend/app/Http/Middleware/AssignRequestId.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class AssignRequestId
{
    public const ATTRIBUTE = 'server_request_id';

    public function handle(Request $request, Closure $next): Response
    {
        $requestId = (string) Str::uuid7();
        $request->attributes->set(self::ATTRIBUTE, $requestId);

        $response = $next($request);
        $response->headers->set('X-Request-ID', $requestId);

        return $response;
    }
}
```

In `backend/bootstrap/app.php`, import the middleware:

```php
use App\Http\Middleware\AssignRequestId;
```

Then append it inside `withMiddleware` before the alias registration:

```php
$middleware->append(AssignRequestId::class);
```

- [ ] **Step 4: Implement AuditContextFactory**

Create `backend/app/Audit/AuditContextFactory.php`:

```php
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
```

- [ ] **Step 5: Run context tests and verify GREEN**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\Audit\AuditRequestContextTest.php
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```powershell
git add backend/app/Http/Middleware/AssignRequestId.php backend/app/Audit/AuditContextFactory.php backend/bootstrap/app.php backend/tests/Feature/Audit/AuditRequestContextTest.php
git commit -m "feat: add trusted audit request context"
```

---

### Task 4: Central Audit Logger Contract and Service

**Files:**
- Create: `backend/app/Contracts/AuditLoggerContract.php`
- Create: `backend/app/Services/Audit/AuditLogger.php`
- Create: `backend/tests/Feature/Audit/AuditLoggerTest.php`
- Modify: `backend/app/Providers/AppServiceProvider.php`

**Interfaces:**
- Consumes: Task 1 schema and model, Task 2 event/context/sanitizer.
- Produces: `AuditLoggerContract::record(AuditEvent $event, AuditContext $context): AuditLog`, bound to `AuditLogger`.

- [ ] **Step 1: Write failing logger tests**

Create `backend/tests/Feature/Audit/AuditLoggerTest.php`:

```php
<?php

namespace Tests\Feature\Audit;

use App\Audit\AuditAction;
use App\Audit\AuditContext;
use App\Audit\AuditContextType;
use App\Audit\AuditEvent;
use App\Audit\AuditModule;
use App\Audit\AuditSubject;
use App\Contracts\AuditLoggerContract;
use App\Models\School;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuditLoggerTest extends TestCase
{
    use RefreshDatabase;

    public function test_container_binds_the_logger_contract(): void
    {
        $this->assertInstanceOf(AuditLogger::class, app(AuditLoggerContract::class));
    }

    public function test_logger_uses_affected_school_and_sanitizes_payloads(): void
    {
        $school = School::query()->create([
            'code' => 'AUD',
            'name' => 'Audit School',
            'receipt_prefix' => 'AUD',
            'invoice_prefix' => 'AUD-INV',
            'status' => 'active',
        ]);
        $actor = User::factory()->create([
            'school_id' => null,
            'username' => 'superadmin',
        ]);
        $requestId = (string) Str::uuid7();
        $context = new AuditContext(
            requestId: $requestId,
            contextType: AuditContextType::Http,
            actorId: $actor->id,
            actorUsername: 'superadmin',
            actorRoles: ['super-admin'],
            actorSchoolId: null,
            ipAddress: '127.0.0.1',
            userAgent: 'Audit Test',
            routeName: 'students.update',
            httpMethod: 'PATCH',
        );
        $event = new AuditEvent(
            action: AuditAction::StudentUpdated,
            module: AuditModule::Students,
            schoolId: $school->id,
            subjectType: AuditSubject::Student,
            subjectId: 44,
            oldValues: ['notes' => 'A', 'password' => 'remove-me'],
            newValues: ['notes' => 'B', 'nested' => ['csrf_token' => 'remove-me']],
            metadata: ['source' => 'test', 'Cookie' => 'remove-me'],
        );

        $log = app(AuditLoggerContract::class)->record($event, $context);

        $this->assertTrue(Str::isUuid($log->event_uuid));
        $this->assertSame($requestId, $log->request_id);
        $this->assertSame($school->id, $log->school_id);
        $this->assertSame(['notes' => 'A'], $log->old_values);
        $this->assertSame(['notes' => 'B', 'nested' => []], $log->new_values);
        $this->assertSame(['source' => 'test'], $log->metadata);
        $this->assertSame(['super-admin'], $log->actor_roles);
        $this->assertSame('student', $log->entity_type);
        $this->assertSame(44, $log->entity_id);
    }
}
```

- [ ] **Step 2: Run logger tests and verify RED**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\Audit\AuditLoggerTest.php
```

Expected: FAIL because the contract and logger service do not exist.

- [ ] **Step 3: Add AuditLoggerContract**

Create `backend/app/Contracts/AuditLoggerContract.php`:

```php
<?php

namespace App\Contracts;

use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Models\AuditLog;

interface AuditLoggerContract
{
    public function record(AuditEvent $event, AuditContext $context): AuditLog;
}
```

- [ ] **Step 4: Implement AuditLogger**

Create `backend/app/Services/Audit/AuditLogger.php`:

```php
<?php

namespace App\Services\Audit;

use App\Audit\AuditContext;
use App\Audit\AuditEvent;
use App\Audit\AuditPayloadSanitizer;
use App\Contracts\AuditLoggerContract;
use App\Models\AuditLog;
use Illuminate\Support\Str;

final class AuditLogger implements AuditLoggerContract
{
    public function __construct(
        private readonly AuditPayloadSanitizer $sanitizer,
    ) {
    }

    public function record(AuditEvent $event, AuditContext $context): AuditLog
    {
        return AuditLog::query()->create([
            'event_uuid' => (string) Str::uuid7(),
            'request_id' => $context->requestId,
            'batch_id' => $event->batchId,
            'school_id' => $event->schoolId ?? $context->actorSchoolId,
            'user_id' => $context->actorId,
            'actor_username' => $context->actorUsername,
            'actor_roles' => $context->actorRoles,
            'action' => $event->action->value,
            'module' => $event->module->value,
            'entity_type' => $event->subjectType?->value,
            'entity_id' => $event->subjectId,
            'old_values' => $this->sanitizer->sanitize($event->oldValues),
            'new_values' => $this->sanitizer->sanitize($event->newValues),
            'metadata' => $this->sanitizer->sanitize($event->metadata),
            'reason' => $event->reason === null ? null : trim($event->reason),
            'related_audit_id' => $event->relatedAuditId,
            'ip_address' => $context->ipAddress,
            'user_agent' => $context->userAgent === null ? null : mb_substr($context->userAgent, 0, 1000),
            'route_name' => $context->routeName,
            'http_method' => $context->httpMethod,
            'context_type' => $context->contextType->value,
            'schema_version' => 1,
        ]);
    }
}
```

- [ ] **Step 5: Bind the contract**

In `backend/app/Providers/AppServiceProvider.php`, add imports:

```php
use App\Contracts\AuditLoggerContract;
use App\Services\Audit\AuditLogger;
```

Replace `register()` with:

```php
public function register(): void
{
    $this->app->bind(AuditLoggerContract::class, AuditLogger::class);
}
```

- [ ] **Step 6: Run logger and audit unit tests**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\Audit\AuditLoggerTest.php backend\tests\Unit\Audit
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```powershell
git add backend/app/Contracts/AuditLoggerContract.php backend/app/Services/Audit/AuditLogger.php backend/app/Providers/AppServiceProvider.php backend/tests/Feature/Audit/AuditLoggerTest.php
git commit -m "feat: centralize audit log inserts"
```

---

### Task 5: Enforce Application-Level Append-Only Model Behavior

**Files:**
- Create: `backend/tests/Feature/Audit/AuditLogImmutabilityTest.php`
- Modify: `backend/app/Models/AuditLog.php`

**Interfaces:**
- Consumes: logger-created `AuditLog` rows from Task 4.
- Produces: model-instance update/saveQuietly/delete rejection while preserving create behavior.

- [ ] **Step 1: Write failing immutability tests**

Create `backend/tests/Feature/Audit/AuditLogImmutabilityTest.php`:

```php
<?php

namespace Tests\Feature\Audit;

use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use LogicException;
use Tests\TestCase;

class AuditLogImmutabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_existing_log_cannot_be_updated(): void
    {
        $log = $this->auditLog();

        try {
            $log->update(['action' => 'tampered']);
            $this->fail('Audit update should throw.');
        } catch (LogicException $exception) {
            $this->assertSame('Audit logs are append-only and cannot be updated.', $exception->getMessage());
        }

        $this->assertSame('legacy.test', $log->fresh()->action);
    }

    public function test_existing_log_cannot_be_saved_quietly(): void
    {
        $log = $this->auditLog();
        $log->action = 'tampered';

        $this->expectException(LogicException::class);
        $log->saveQuietly();
    }

    public function test_existing_log_cannot_be_deleted(): void
    {
        $log = $this->auditLog();

        try {
            $log->delete();
            $this->fail('Audit delete should throw.');
        } catch (LogicException $exception) {
            $this->assertSame('Audit logs are append-only and cannot be deleted.', $exception->getMessage());
        }

        $this->assertDatabaseHas('audit_logs', ['id' => $log->id]);
    }

    private function auditLog(): AuditLog
    {
        return AuditLog::query()->create([
            'event_uuid' => (string) Str::uuid7(),
            'request_id' => (string) Str::uuid7(),
            'action' => 'legacy.test',
            'module' => 'legacy',
            'context_type' => 'system',
            'schema_version' => 1,
        ]);
    }
}
```

- [ ] **Step 2: Run immutability tests and verify RED**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\Audit\AuditLogImmutabilityTest.php
```

Expected: FAIL because existing rows can currently be updated and deleted.

- [ ] **Step 3: Override instance persistence methods**

Add the import to `backend/app/Models/AuditLog.php`:

```php
use LogicException;
```

Add these methods before the relationships:

```php
public function save(array $options = [])
{
    if ($this->exists) {
        throw new LogicException('Audit logs are append-only and cannot be updated.');
    }

    return parent::save($options);
}

public function delete()
{
    throw new LogicException('Audit logs are append-only and cannot be deleted.');
}
```

- [ ] **Step 4: Run immutability and logger tests**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\Audit\AuditLogImmutabilityTest.php backend\tests\Feature\Audit\AuditLoggerTest.php
```

Expected: PASS, proving new inserts still work while instance mutation fails.

- [ ] **Step 5: Commit Task 5**

```powershell
git add backend/app/Models/AuditLog.php backend/tests/Feature/Audit/AuditLogImmutabilityTest.php
git commit -m "feat: guard audit logs from mutation"
```

---

### Task 6: Seed Audit Permissions for Super Admin Only

**Files:**
- Create: `backend/tests/Feature/Audit/AuditPermissionSeedTest.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`

**Interfaces:**
- Consumes: existing `Role`, `Permission`, and permission middleware model.
- Produces: `audit.view` and `audit.correct_generic`, granted only to `super-admin`.

- [ ] **Step 1: Write the failing permission matrix test**

Create `backend/tests/Feature/Audit/AuditPermissionSeedTest.php`:

```php
<?php

namespace Tests\Feature\Audit;

use App\Models\Role;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuditPermissionSeedTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_super_admin_receives_audit_permissions(): void
    {
        $this->seed();

        foreach (['super-admin', 'ceo', 'school-admin', 'finance'] as $roleSlug) {
            $permissions = Role::query()
                ->where('slug', $roleSlug)
                ->firstOrFail()
                ->permissions()
                ->pluck('slug')
                ->all();

            if ($roleSlug === 'super-admin') {
                $this->assertContains('audit.view', $permissions);
                $this->assertContains('audit.correct_generic', $permissions);
            } else {
                $this->assertNotContains('audit.view', $permissions);
                $this->assertNotContains('audit.correct_generic', $permissions);
            }
        }
    }
}
```

- [ ] **Step 2: Run permission test and verify RED**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\Audit\AuditPermissionSeedTest.php
```

Expected: FAIL because the two permission rows do not exist.

- [ ] **Step 3: Add the permissions to the authoritative seed list**

In the `$permissions` collection in `backend/database/seeders/DatabaseSeeder.php`, add:

```php
'audit.view' => 'View global audit logs',
'audit.correct_generic' => 'Correct approved low-risk fields from audit history',
```

Do not add them to the CEO, School Admin, or Finance `only()` lists. The existing Super Admin `sync($permissions->pluck('id')->all())` grants both automatically.

- [ ] **Step 4: Run permission test and verify GREEN**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\Audit\AuditPermissionSeedTest.php
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```powershell
git add backend/database/seeders/DatabaseSeeder.php backend/tests/Feature/Audit/AuditPermissionSeedTest.php
git commit -m "feat: restrict audit permissions to super admin"
```

---

### Task 7: Correct CEO Calendar Permissions to Read-Only

**Files:**
- Modify: `backend/tests/Feature/CalendarEventApiTest.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`

**Interfaces:**
- Consumes: existing calendar permission routes and role seeds.
- Produces: CEO retains `calendar.view` but loses create/update/delete; other seeded roles keep their existing calendar behavior.

- [ ] **Step 1: Replace the broad seeded-role assertion with an explicit matrix**

Replace `test_every_initial_role_has_calendar_crud_permissions()` in `backend/tests/Feature/CalendarEventApiTest.php` with:

```php
public function test_initial_roles_have_the_approved_calendar_permission_matrix(): void
{
    $this->seed();

    $expected = [
        'super-admin' => ['calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete'],
        'ceo' => ['calendar.view'],
        'school-admin' => ['calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete'],
        'finance' => ['calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete'],
    ];

    foreach ($expected as $roleSlug => $expectedCalendarPermissions) {
        $actual = Role::query()
            ->where('slug', $roleSlug)
            ->firstOrFail()
            ->permissions()
            ->whereIn('slug', ['calendar.view', 'calendar.create', 'calendar.update', 'calendar.delete'])
            ->pluck('slug')
            ->sort()
            ->values()
            ->all();

        sort($expectedCalendarPermissions);
        $this->assertSame($expectedCalendarPermissions, $actual, "Unexpected calendar permissions for {$roleSlug}");
    }
}
```

- [ ] **Step 2: Run the calendar matrix test and verify RED**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test --filter=test_initial_roles_have_the_approved_calendar_permission_matrix
```

Expected: FAIL because CEO still has create/update/delete.

- [ ] **Step 3: Remove CEO calendar write permissions from the seed**

Replace the CEO permission list in `backend/database/seeders/DatabaseSeeder.php` with:

```php
$roles['ceo']->permissions()->sync($permissions->only([
    'fee_record.view',
    'calendar.view',
])->pluck('id')->all());
```

- [ ] **Step 4: Run all calendar and auth regression tests**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Feature\CalendarEventApiTest.php backend\tests\Feature\AuthApiTest.php
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```powershell
git add backend/database/seeders/DatabaseSeeder.php backend/tests/Feature/CalendarEventApiTest.php
git commit -m "fix: keep ceo calendar access read only"
```

---

### Task 8: Operations Documentation, MariaDB Evidence, and Phase 1 Verification

**Files:**
- Create: `docs/AUDIT_LOG_OPERATIONS.md`
- Modify: `docs/DEVELOPMENT_SETUP.md`
- Verify: all Task 1–7 files

**Interfaces:**
- Consumes: completed Phase 1 foundation.
- Produces: operator-safe grant guidance, trusted-proxy warning, repeatable MariaDB test command, and complete verification evidence.

- [ ] **Step 1: Write the operational boundary document**

Create `docs/AUDIT_LOG_OPERATIONS.md` with these exact sections and content:

````markdown
# Audit Log Operations

## Security Boundary

Matahari treats `audit_logs` as append-only for the application runtime. Laravel model guards prevent ordinary instance updates and deletes, but they do not stop bulk queries, raw SQL, migration credentials, or database administrators.

Before Production launch, use separate deployment and runtime database identities. Replace `matahari` and `matahari_app` below with the deployed database and runtime account:

```sql
REVOKE UPDATE, DELETE ON `matahari`.`audit_logs` FROM 'matahari_app'@'%';
GRANT SELECT, INSERT ON `matahari`.`audit_logs` TO 'matahari_app'@'%';
SHOW GRANTS FOR 'matahari_app'@'%';
```

Do not run these statements until the actual hosting account, host pattern, migration process, and recovery access are confirmed. Keep migration credentials outside the web runtime.

## Trusted Proxy Requirement

Audit IP addresses are reliable only when Laravel trusts the exact reverse proxies controlled by the deployment. Never trust forwarded headers from every address on a publicly reachable origin. Local development records the direct peer address.

## Runtime Failure Behavior

Material business mutations must write their audit event inside the same database transaction and roll back if the write fails. Authentication audit writes are best-effort and use the dedicated redacted security log fallback introduced with authentication integration.

## Verification Before Launch

1. Confirm the runtime account can select and insert an audit row.
2. Confirm the runtime account cannot update or delete an audit row.
3. Confirm migration credentials can run forward migrations during a controlled release.
4. Confirm audit rows are included in encrypted off-site backups and MariaDB binary logs.
5. Restore a backup into a temporary database and confirm audit rows are readable.
````

- [ ] **Step 2: Add the MariaDB test procedure to development setup**

Append this section to `docs/DEVELOPMENT_SETUP.md`:

````markdown
## Audit MariaDB Integration Test

The default PHPUnit suite uses in-memory SQLite and cannot prove MariaDB JSON, index, row-lock, or concurrency behavior. Run audit database integration tests against a disposable MariaDB database:

```powershell
$env:DB_CONNECTION='mariadb'
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3306'
$env:DB_DATABASE='matahari_audit_test'
$env:DB_USERNAME='matahari_test'
$env:DB_PASSWORD='matahari_test'
tools\php\php-local.cmd backend\artisan migrate:fresh --env=testing
tools\php\php-local.cmd backend\artisan test --group=mariadb
```

The database must contain no valuable data because `migrate:fresh` drops its tables. Clear the temporary environment variables after the run. A skipped MariaDB-group test under SQLite is not acceptance evidence.
````

- [ ] **Step 3: Run the MariaDB schema test against a disposable database**

First verify that `matahari_audit_test` resolves to a disposable test database. Then run the commands documented above.

Expected: migrations pass and `AuditMariaDbSchemaTest` passes without being skipped. If no MariaDB test server is available, record Phase 1 as incomplete rather than treating SQLite as substitute evidence.

- [ ] **Step 4: Run focused audit tests**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test backend\tests\Unit\Audit backend\tests\Feature\Audit
```

Expected: PASS; only the MariaDB-group test may be skipped in the SQLite run.

- [ ] **Step 5: Run the full backend suite**

Run:

```powershell
tools\php\php-local.cmd backend\artisan test
```

Expected: all tests pass with no failures or errors.

- [ ] **Step 6: Run formatting and repository checks**

Run:

```powershell
backend\vendor\bin\pint.bat --test
git diff --check
git status --short
```

Expected: Pint and `git diff --check` succeed; `git status` lists only intentional Phase 1 changes plus the pre-existing unrelated untracked files.

- [ ] **Step 7: Commit Task 8**

```powershell
git add docs/AUDIT_LOG_OPERATIONS.md docs/DEVELOPMENT_SETUP.md
git commit -m "docs: document audit production boundary"
```

- [ ] **Step 8: Phase 1 completion audit**

Verify each statement with direct evidence:

1. Existing audit rows survive upgrade migration and receive unique event UUIDs.
2. New logger rows contain server-generated event/request IDs and affected-school scope.
3. Nested secrets are absent from stored snapshots and metadata.
4. Actor username and sorted role snapshots are stored.
5. Model instance update, quiet save, and delete fail.
6. Only Super Admin receives audit permissions.
7. CEO calendar permissions are read-only.
8. SQLite focused and full backend suites pass.
9. MariaDB schema test passes without skip.
10. Production runtime grant and trusted-proxy actions remain clearly documented manual steps.

Do not mark Phase 1 complete if item 9 lacks real MariaDB evidence.
