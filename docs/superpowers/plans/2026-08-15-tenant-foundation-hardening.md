# Tenant Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the current MIS data while making tenant ownership, membership-school relationships, primary domains, and Admin/App API surfaces fail closed at both application and database boundaries.

**Architecture:** Keep the shared Laravel backend and shared database. Tenant context remains hostname-authoritative; schools remain the tenant boundary for business records. Add one corrective migration with explicit preflights and cross-database constraint helpers, then add route middleware that enforces the resolved browser surface without replacing membership, permission, feature, or school authorization.

**Tech Stack:** PHP 8.4, Laravel 13, PHPUnit 12, SQLite 3, MariaDB, React 19, TypeScript 6, Vite 8, Vitest, Oxlint.

## Global Constraints

- Preserve all current MIS tenant, school, identity, student, academic, finance, receipt, and audit rows.
- Do not edit `2026_08_14_000001_create_tenant_foundation.php`; add a corrective migration.
- Never use `migrate:fresh` on `backend/database/database.sqlite`.
- Tenant selection remains hostname-authoritative; never trust a submitted tenant ID.
- Tenant differences remain limited to host-resolved branding and features; do not add tenant-specific code branches.
- Admin/App surface checks supplement backend permissions and school/resource scope; they do not replace them.
- MariaDB tests may destroy only the guarded disposable database named `rylay_audit_test`.
- Every production behavior change follows red-green TDD.

---

## File Map

- Create `backend/database/migrations/2026_08_15_000001_harden_tenant_foundation.php`: preflight and corrective relational constraints.
- Create `backend/tests/Feature/TenantFoundationHardeningMigrationTest.php`: SQLite migration, preservation, preflight, constraint, and rollback tests.
- Modify `backend/tests/Feature/TenantFoundationMariaDbSchemaTest.php`: exact MariaDB hardening assertions.
- Modify `backend/app/Models/TenantUserMembership.php`: expose pivot `tenant_id` to relationship callers.
- Modify `backend/app/Services/Tenancy/TenantAdministrationService.php`: write tenant-aware school pivots.
- Modify `backend/app/Services/Foundation/FoundationAccountService.php`: write tenant-aware school pivots.
- Modify `backend/database/seeders/DatabaseSeeder.php`: seed tenant-aware membership pivots.
- Modify affected tenant fixture tests: populate required pivot tenant IDs.
- Create `backend/app/Http/Middleware/EnsureTenantSurface.php`: authoritative backend surface check.
- Modify `backend/bootstrap/app.php`: register `tenant.surface` middleware alias.
- Modify `backend/routes/api.php`: group Admin-only and App-only APIs by surface.
- Modify `backend/tests/Feature/TenantIsolationApiTest.php`: shared-route and wrong-surface regression tests.
- Modify `docs/saas-multitenancy.md`, `docs/architecture.md`, `docs/database.md`, `docs/current-status.md`, and `docs/testing-and-release.md`: final invariants and evidence.

---

### Task 1: Corrective migration and SQLite relational invariants

**Files:**
- Create: `backend/database/migrations/2026_08_15_000001_harden_tenant_foundation.php`
- Create: `backend/tests/Feature/TenantFoundationHardeningMigrationTest.php`

**Interfaces:**
- Consumes: existing `tenants`, `schools`, `tenant_domains`, `tenant_user_memberships`, and `tenant_membership_schools` tables.
- Produces: required `schools.tenant_id`, tenant-local school code uniqueness, composite ownership keys, required pivot tenant ID, composite foreign keys, generated `primary_surface`, and `tenant_domains_one_primary_surface_unique`.

- [ ] **Step 1: Write the stale-index and preservation test**

Create a feature test that obtains the corrective migration object, calls `down()`, verifies the legacy `schools_code_unique` state, snapshots all existing row identifiers/counts, calls `up()`, and asserts:

```php
$this->assertTrue(Schema::hasColumn('tenant_membership_schools', 'tenant_id'));
$this->assertSame($before, $this->identitySnapshot());
$this->assertIndex('schools', 'schools_tenant_code_unique', ['tenant_id', 'code'], true);
```

Use separate test methods for a successful preservation path and each failure path; do not combine a deliberately invalid row with the successful path.

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\TenantFoundationHardeningMigrationTest.php
```

Expected: failure because `2026_08_15_000001_harden_tenant_foundation.php` and its constraints do not exist.

- [ ] **Step 3: Add migration preflight helpers**

Implement private methods that query and throw `RuntimeException` before schema mutation:

```php
private function assertNoNullSchoolTenants(): void
private function assertNoDuplicateSchoolCodes(): void
private function assertMembershipSchoolsStayInTenant(): void
private function assertPrimaryDomainsAreUnique(): void
private function assertSupportedDomainSurfaces(): void
```

Messages must name the invariant and include affected IDs, for example:

```php
throw new RuntimeException("Tenant hardening blocked: school {$schoolId} has no tenant_id.");
```

- [ ] **Step 4: Implement the school and membership constraints**

In `up()`:

```php
$this->runPreflight();
$this->replaceSchoolCodeIndex();
$this->requireSchoolTenant();
$this->addCompositeOwnershipKeys();
$this->backfillMembershipSchoolTenant();
$this->addCompositeOwnershipForeignKeys();
```

The pivot backfill must derive `tenant_id` only from `tenant_user_memberships.tenant_id`. The migration must verify zero null/mismatched pivots after backfill before making the column required.

- [ ] **Step 5: Implement primary-domain concurrency protection**

Add a generated nullable `primary_surface` whose value is `surface` only when `is_primary` is true, otherwise null. Use explicit driver branches:

```php
if (DB::getDriverName() === 'sqlite') {
    DB::statement("ALTER TABLE tenant_domains ADD COLUMN primary_surface TEXT GENERATED ALWAYS AS (CASE WHEN is_primary = 1 THEN surface ELSE NULL END) VIRTUAL");
} else {
    DB::statement("ALTER TABLE tenant_domains ADD COLUMN primary_surface VARCHAR(20) GENERATED ALWAYS AS (CASE WHEN is_primary = 1 THEN surface ELSE NULL END) STORED");
}
Schema::table('tenant_domains', fn (Blueprint $table) =>
    $table->unique(['tenant_id', 'primary_surface'], 'tenant_domains_one_primary_surface_unique')
);
```

Limit the non-SQLite branch to `mariadb` and `mysql`; throw for unsupported production drivers.

- [ ] **Step 6: Implement guarded rollback**

`down()` must preflight global duplicate school codes before restoring `schools_code_unique`, then drop only the generated column, new indexes, pivot tenant column, and composite foreign keys added by this migration. It must leave all rows and original single-column foreign keys intact.

- [ ] **Step 7: Expand RED tests for every invariant and constraint**

Add individual tests proving:

```php
public function test_upgrade_rejects_school_without_tenant_without_partial_schema_changes(): void
public function test_upgrade_rejects_cross_tenant_default_school(): void
public function test_upgrade_rejects_cross_tenant_allowed_school(): void
public function test_database_rejects_cross_tenant_membership_school_after_upgrade(): void
public function test_database_allows_school_code_reuse_across_tenants_only(): void
public function test_database_rejects_duplicate_primary_surface(): void
public function test_rollback_rejects_global_school_code_collision_without_data_loss(): void
```

Run after writing each test and verify it fails for the missing invariant before adding its minimal migration behavior.

- [ ] **Step 8: Run the migration test and verify GREEN**

Run the focused PHPUnit file until every migration assertion passes on SQLite with no unexpected warning or partial schema mutation.

- [ ] **Step 9: Commit Task 1**

```powershell
git add backend/database/migrations/2026_08_15_000001_harden_tenant_foundation.php backend/tests/Feature/TenantFoundationHardeningMigrationTest.php
git commit -m "feat: harden tenant database boundaries"
```

---

### Task 2: Tenant-aware membership pivot writes

**Files:**
- Modify: `backend/app/Models/TenantUserMembership.php`
- Modify: `backend/app/Services/Tenancy/TenantAdministrationService.php`
- Modify: `backend/app/Services/Foundation/FoundationAccountService.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Modify: `backend/tests/Feature/TenantIsolationApiTest.php`
- Modify: `backend/tests/Feature/DemoPortalApiTest.php`
- Modify: `backend/tests/Feature/FormalQuizApiTest.php`

**Interfaces:**
- Consumes: Task 1's required `tenant_membership_schools.tenant_id`.
- Produces: every application and fixture pivot insert carries the owning membership tenant ID.

- [ ] **Step 1: Write failing service tests**

Extend tenant creation, membership update, foundation account creation, and demo seed tests to assert:

```php
$this->assertDatabaseHas('tenant_membership_schools', [
    'tenant_id' => $tenant->id,
    'tenant_user_membership_id' => $membership->id,
    'school_id' => $school->id,
]);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run `TenantIsolationApiTest`, `PhaseAFoundationApiTest`, `DemoScenarioSeederTest`, and `DemoPortalApiTest`. Expected: inserts fail or assertions fail because pivot tenant IDs are not supplied.

- [ ] **Step 3: Update the relationship and production writes**

Expose the pivot field:

```php
return $this->belongsToMany(School::class, 'tenant_membership_schools')
    ->withPivot('tenant_id')
    ->withTimestamps();
```

Every attach uses:

```php
$membership->schools()->attach($schoolId, ['tenant_id' => $membership->tenant_id]);
```

Every sync uses:

```php
$membership->schools()->syncWithPivotValues($schoolIds, ['tenant_id' => $membership->tenant_id]);
```

Update seeding and test fixtures to use the same explicit payload.

- [ ] **Step 4: Verify GREEN**

Run the focused tests from Step 2 plus `TenantFoundationHardeningMigrationTest`.

- [ ] **Step 5: Commit Task 2**

```powershell
git add backend/app/Models/TenantUserMembership.php backend/app/Services/Tenancy/TenantAdministrationService.php backend/app/Services/Foundation/FoundationAccountService.php backend/database/seeders/DatabaseSeeder.php backend/tests/Feature
git commit -m "fix: persist tenant ownership on membership schools"
```

---

### Task 3: Backend Admin/App surface boundary

**Files:**
- Create: `backend/app/Http/Middleware/EnsureTenantSurface.php`
- Modify: `backend/bootstrap/app.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/tests/Feature/TenantIsolationApiTest.php`

**Interfaces:**
- Consumes: `TenantContext::optional(Request)` and the domain's resolved surface.
- Produces: route middleware alias `tenant.surface` accepting one or more allowed surfaces.

- [ ] **Step 1: Write failing surface tests**

Add tests using one Admin domain and one App domain for the same tenant:

```php
$this->actingAs($admin)->getJson("http://{$appHost}/api/students")->assertNotFound();
$this->actingAs($appUser)->getJson("http://{$adminHost}/api/v1/portal/student/me")->assertNotFound();
$this->getJson("http://{$adminHost}/api/tenant-context")->assertOk();
$this->getJson("http://{$appHost}/api/tenant-context")->assertOk();
```

Also assert CSRF, login, `/me`, and logout routes remain reachable on both surface types when their normal authentication/CSRF requirements are satisfied.

- [ ] **Step 2: Run the new tests and verify RED**

Run `TenantIsolationApiTest`; expected wrong-surface business calls are not 404 because no backend surface middleware exists.

- [ ] **Step 3: Implement middleware**

Create:

```php
final class EnsureTenantSurface
{
    public function handle(Request $request, Closure $next, string ...$allowed): Response
    {
        $context = TenantContext::optional($request);
        abort_unless($context && in_array($context->surface(), $allowed, true), 404);

        return $next($request);
    }
}
```

Register `'tenant.surface' => EnsureTenantSurface::class` in `backend/bootstrap/app.php`.

- [ ] **Step 4: Classify routes without weakening existing middleware**

Apply `tenant.surface:admin` to platform, tenant settings, legacy Admin/Finance, and `/v1/admin` routes. Apply `tenant.surface:app` to Community, Teacher, Assessment, Quiz, Portal, and notifications. Keep tenant context and session bootstrap/authentication routes shared.

Do not remove `auth`, `active`, `tenant.member`, `school.context`, `tenant.feature`, or `permission` middleware from any route.

- [ ] **Step 5: Verify GREEN and route contracts**

Run:

```powershell
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\TenantIsolationApiTest.php
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor --json
```

Programmatically assert representative Admin and App routes contain the correct `tenant.surface:*` entry and every protected route still contains `tenant.member`.

- [ ] **Step 6: Commit Task 3**

```powershell
git add backend/app/Http/Middleware/EnsureTenantSurface.php backend/bootstrap/app.php backend/routes/api.php backend/tests/Feature/TenantIsolationApiTest.php
git commit -m "feat: enforce tenant API surfaces"
```

---

### Task 4: MariaDB schema qualification

**Files:**
- Modify: `backend/tests/Feature/TenantFoundationMariaDbSchemaTest.php`
- Modify: `backend/tests/Unit/Audit/MariaDbDestructiveTestGateTest.php` only if the existing guard cannot launch the tenant group safely.

**Interfaces:**
- Consumes: Task 1's exact constraint and index names.
- Produces: MariaDB evidence for nullability, composite foreign keys, and generated primary-domain uniqueness.

- [ ] **Step 1: Write failing MariaDB schema assertions**

Add assertions for:

```php
$this->assertColumnNullable('schools', 'tenant_id', false);
$this->assertColumnNullable('tenant_membership_schools', 'tenant_id', false);
$this->assertForeignKeyColumns('tenant_user_memberships', ['tenant_id', 'default_school_id'], 'schools', ['tenant_id', 'id'], 'RESTRICT');
$this->assertForeignKeyColumns('tenant_membership_schools', ['tenant_id', 'school_id'], 'schools', ['tenant_id', 'id'], 'CASCADE');
$this->assertIndex('tenant_domains', 'tenant_domains_one_primary_surface_unique', ['tenant_id', 'primary_surface'], true);
```

Implement helpers using `information_schema.COLUMNS`, `KEY_COLUMN_USAGE`, `REFERENTIAL_CONSTRAINTS`, and `STATISTICS`, ordered by ordinal position.

- [ ] **Step 2: Run without MariaDB and confirm guarded skip**

Run the MariaDB group against the default SQLite test connection. Expected: explicit skip explaining that a disposable MariaDB database is required, not a false pass.

- [ ] **Step 3: Provision a disposable MariaDB service**

Use an installed MariaDB/XAMPP service or a locally available container/portable distribution. Create only `rylay_audit_test`; keep credentials private in process environment variables. Confirm server version contains `MariaDB` before enabling `AUDIT_MARIADB_DESTRUCTIVE_TEST=1`.

- [ ] **Step 4: Run MariaDB migrate/rollback/re-migrate and grouped tests**

Run the commands in `docs/testing-and-release.md` against `rylay_audit_test`, including a targeted rollback of the corrective migration and re-migration. Expected: all tenant schema assertions pass and row/constraint behavior matches SQLite.

- [ ] **Step 5: Commit Task 4**

```powershell
git add backend/tests/Feature/TenantFoundationMariaDbSchemaTest.php backend/tests/Unit/Audit/MariaDbDestructiveTestGateTest.php
git commit -m "test: qualify tenant hardening on MariaDB"
```

---

### Task 5: Preserve and migrate the current MIS SQLite database

**Files:**
- Runtime only: ignored `backend/database/database.sqlite`
- Runtime backup: ignored `backend/database/backups/tenant-hardening-20260815/`

**Interfaces:**
- Consumes: verified corrective migration from Tasks 1-4.
- Produces: migrated current MIS database with identical business row identities and new hardening constraints.

- [ ] **Step 1: Stop write-capable local backend processes**

Record and stop only the process listening on local backend port 8000. Leave Admin/App processes running only if they cannot mutate data while the backend is stopped.

- [ ] **Step 2: Snapshot database and identities**

Copy the exact SQLite file to the ignored backup directory, compute SHA-256, and export read-only counts/IDs for tenants, schools, users, students, payments, receipts, and audit logs. Do not copy `.env`.

- [ ] **Step 3: Run non-destructive migration**

Run `artisan migrate --force` with the existing SQLite configuration. Never run `migrate:fresh`.

- [ ] **Step 4: Compare preservation evidence**

Re-run the count/identity snapshot and require an exact match for pre-existing rows. Verify no null school tenant, no cross-tenant membership relationship, the composite school code index, generated primary-domain index, and foreign key checks.

- [ ] **Step 5: Restart backend and smoke both hosts**

Start the hidden backend process. Verify Admin tenant context returns `surface=admin`, App tenant context returns `surface=app`, and representative wrong-surface requests return 404.

No Git commit is created for ignored database or backup files.

---

### Task 6: Documentation and full release evidence

**Files:**
- Modify: `docs/saas-multitenancy.md`
- Modify: `docs/architecture.md`
- Modify: `docs/database.md`
- Modify: `docs/current-status.md`
- Modify: `docs/testing-and-release.md`

**Interfaces:**
- Consumes: final implementation and exact executed verification evidence.
- Produces: canonical documentation that distinguishes implemented constraints from deployment-only gates.

- [ ] **Step 1: Update canonical documentation**

Record the required school tenant, composite membership ownership, primary-domain uniqueness, Admin/App middleware, current SQLite preservation result, and MariaDB execution result. If MariaDB could not run, label it **Not verified** and production-blocking.

- [ ] **Step 2: Run complete backend verification**

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit
..\tools\php\php-local.cmd vendor\bin\pint --test
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
```

- [ ] **Step 3: Run Admin and App verification separately**

In both `frontend/` and `app/`, run `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`. Record existing warnings separately from errors.

- [ ] **Step 4: Run migration lifecycle and repository checks**

Run disposable SQLite migrate/targeted rollback/re-migrate, disposable MariaDB lifecycle, `git diff --check`, documentation link checks, generated-artifact checks, and secret-pattern checks.

- [ ] **Step 5: Commit documentation**

```powershell
git add docs/saas-multitenancy.md docs/architecture.md docs/database.md docs/current-status.md docs/testing-and-release.md
git commit -m "docs: record tenant foundation hardening"
```

- [ ] **Step 6: Final review**

Review every commit and the full diff from `origin/master`. Confirm only intended source, tests, plan/spec, and canonical documentation are tracked. Report exact test counts, skips, MariaDB evidence, current database preservation evidence, unresolved deployment gates, and the branch commit IDs.
