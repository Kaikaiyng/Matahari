# Extensible Notification Channels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route existing in-app notifications through a channel-neutral dispatcher and add scoped external destination configuration without implementing Telegram delivery.

**Architecture:** `NotificationDispatcher` sends immutable `NotificationMessage` objects through registered `NotificationChannelContract` implementations. `InAppChannel` remains the sole concrete channel and preserves `portal_notifications`; `NotificationDestination` stores global, tenant or school-scoped external addresses without provider-specific fields.

**Tech Stack:** PHP 8.3, Laravel 13, Eloquent, SQLite/MariaDB-compatible migrations, PHPUnit 12.

## Global Constraints

- Preserve existing notification API payloads, types, contexts, read state and transaction rollback behavior.
- Keep destination schema and contracts channel-neutral.
- Do not add Telegram adapters, tokens, user bindings, login, queues, outbox, delivery history or UI.
- Global scope is nullable `tenant_id` plus nullable `school_id`; school scope must match its tenant through the existing tenancy hierarchy.
- Do not commit `.idea/`.

---

### Task 1: Channel-neutral destination model

**Files:**
- Create: `backend/database/migrations/2026_08_27_000001_create_notification_destinations_table.php`
- Create: `backend/app/Models/NotificationDestination.php`
- Modify: `backend/app/Models/Tenant.php`
- Modify: `backend/app/Models/School.php`
- Test: `backend/tests/Feature/NotificationChannelArchitectureTest.php`

**Interfaces:**
- Produces: `NotificationDestination::forScope(?int $tenantId, ?int $schoolId)`, `active()`, tenant and school relationships.

- [ ] **Step 1: Add failing scope and schema tests**

```php
$global = NotificationDestination::query()->create($base + ['tenant_id' => null, 'school_id' => null]);
$tenant = NotificationDestination::query()->create($base + ['tenant_id' => $school->tenant_id, 'school_id' => null]);
$schoolTarget = NotificationDestination::query()->create($base + ['tenant_id' => $school->tenant_id, 'school_id' => $school->id]);
$this->assertSame([$global->id], NotificationDestination::query()->forScope(null, null)->pluck('id')->all());
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `cd backend; ..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\NotificationChannelArchitectureTest.php`

- [ ] **Step 3: Add the migration and model**

```php
$table->foreignId('tenant_id')->nullable()->constrained()->restrictOnDelete();
$table->unsignedBigInteger('school_id')->nullable();
$table->string('channel', 50);
$table->string('destination_type', 50);
$table->text('destination_address');
$table->string('purpose', 100);
$table->json('configuration')->nullable();
$table->string('status', 20)->default('active');
$table->foreign(['tenant_id', 'school_id'])->references(['tenant_id', 'id'])->on('schools')->restrictOnDelete();
```

Implement exact global/tenant/school query scopes and reject `school_id` without `tenant_id` or a mismatched tenant before persistence.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `cd backend; ..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\NotificationChannelArchitectureTest.php`

### Task 2: Dispatcher and in-app channel

**Files:**
- Create: `backend/app/Contracts/NotificationChannelContract.php`
- Create: `backend/app/Services/Notifications/NotificationMessage.php`
- Create: `backend/app/Services/Notifications/NotificationTarget.php`
- Create: `backend/app/Services/Notifications/NotificationDispatchResult.php`
- Create: `backend/app/Services/Notifications/InAppChannel.php`
- Create: `backend/app/Services/Notifications/NotificationDispatcher.php`
- Modify: `backend/app/Providers/AppServiceProvider.php`
- Test: `backend/tests/Feature/NotificationChannelArchitectureTest.php`

**Interfaces:**
- Produces: `NotificationDispatcher::sendInApp(NotificationMessage $message, iterable $recipientUserIds): NotificationDispatchResult`.
- Produces: `NotificationDispatcher::dispatch(NotificationMessage $message, string $channel, iterable $targets): NotificationDispatchResult`.

- [ ] **Step 1: Add failing dispatcher tests**

```php
$result = app(NotificationDispatcher::class)->sendInApp(
    new NotificationMessage($tenantId, $schoolId, 'general', 'Title', 'Body', ['key' => 'value']),
    [$user->id],
);
$this->assertSame(1, $result->delivered);
$this->assertDatabaseHas('portal_notifications', ['recipient_user_id' => $user->id, 'title' => 'Title']);
```

Also assert an unregistered channel returns a skipped result and writes no notification.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run the Task 1 focused PHPUnit command.

- [ ] **Step 3: Implement contracts, DTOs, dispatcher and `InAppChannel`**

```php
interface NotificationChannelContract
{
    public function key(): string;
    public function deliver(NotificationMessage $message, array $targets): NotificationDispatchResult;
}
```

Register only `InAppChannel`. It bulk-inserts the same `portal_notifications` fields currently written by producers. The dispatcher logs a sanitized warning and returns `delivered=0`, `skipped=count($targets)` for unknown external channels.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run the Task 1 focused PHPUnit command.

### Task 3: Migrate existing producers

**Files:**
- Modify: `backend/app/Services/Attendance/CampusAttendanceService.php`
- Modify: `backend/app/Services/Billing/PaymentReminderService.php`
- Modify: `backend/app/Services/Community/CommunityService.php`
- Modify: `backend/app/Services/Community/CommunityModerationService.php`
- Test: existing Attendance, Payment Reminder and Community feature tests.

**Interfaces:**
- Consumes: `NotificationDispatcher::sendInApp(...)` from Task 2.

- [ ] **Step 1: Replace every direct production `PortalNotification::create/insert` call**

```php
$this->notifications->sendInApp(
    new NotificationMessage($tenantId, $schoolId, $type, $title, $body, $context),
    $recipientIds,
);
```

Inject the dispatcher through constructors and preserve current recipient resolution, notification contents, audit counts and transaction boundaries.

- [ ] **Step 2: Confirm no direct production writes remain**

Run: `rg -n "PortalNotification::(query\(\)->)?(create|insert)" backend/app`
Expected: no matches.

- [ ] **Step 3: Run focused regression tests**

Run: `cd backend; ..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\NotificationChannelArchitectureTest.php tests\Feature\DemoPortalApiTest.php tests\Feature\CommunityApiTest.php tests\Feature\ParentFinanceApiTest.php tests\Feature\AttendanceApiTest.php`

### Task 4: Canonical documentation and validation

**Files:**
- Modify: `README.md`
- Modify: `docs/project-overview.md`
- Modify: `docs/current-status.md`
- Modify: `docs/business-rules.md`
- Modify: `docs/architecture.md`
- Modify: `docs/database.md`
- Modify: `docs/testing-and-release.md`

- [ ] **Step 1: Document the implemented boundary**

State that channel-neutral dispatch, in-app delivery and destination configuration exist, while Telegram delivery, credentials, bindings, UI and durable retries remain unimplemented.

- [ ] **Step 2: Run proportional validation**

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\pint --test app\Contracts\NotificationChannelContract.php app\Models\NotificationDestination.php app\Services\Notifications app\Services\Attendance\CampusAttendanceService.php app\Services\Billing\PaymentReminderService.php app\Services\Community\CommunityService.php app\Services\Community\CommunityModerationService.php
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
```

Run `git diff --check` and the focused tests from Task 3. Record MariaDB as **Not verified** if no disposable server is available.

- [ ] **Step 3: Review, commit and push intended files**

Stage only the plan, implementation, tests and current documentation. Exclude `.idea/`; commit without force-push, fetch, confirm branch divergence and push the feature branch.
