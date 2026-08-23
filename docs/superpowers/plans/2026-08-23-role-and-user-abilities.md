# Role and User Abilities Implementation Plan

**Execution status:** Implemented 2026-08-23; verification and delivery evidence is recorded in `docs/current-status.md` and the final commit report.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overlapping employee/App role model with global Super Admin, three school employee positions, three App personas, editable per-user permission overrides, and transactional audit history.

**Architecture:** Existing roles remain backend permission templates and identity markers, while a new school-scoped override table records explicit grants and denials. A centralized resolver supplies effective permissions to middleware and authentication payloads. Employees use one exclusive position role plus optional Parent identity; App personas are derived from Parent/Student relationships and Teacher/Teacher-App access, never Staff.

**Tech Stack:** Laravel 13, Eloquent, MariaDB/SQLite migrations, PHPUnit, React 19, TypeScript, Vitest.

## Global Constraints

- Super Admin is the protected `is_platform_owner` identity and has platform-wide access.
- Employee positions are exactly `finance`, `school-admin`, and `teacher`; Finance inherits School Admin defaults plus finance permissions.
- App personas are exactly Teacher, Parent, and Student.
- Ability changes require a reason and must audit in the same transaction.
- School actors cannot edit themselves, platform owners, cross-school users, or platform-only permissions.
- Preserve historical and financial records; no destructive database reset.
- Make one final commit and push only after the complete project verification, per user instruction.

---

### Task 1: Permission override schema and resolver

**Files:**
- Create: `backend/database/migrations/2026_08_23_000003_create_user_permission_overrides.php`
- Create: `backend/app/Models/UserPermissionOverride.php`
- Create: `backend/app/Services/Authorization/UserPermissionResolver.php`
- Modify: `backend/app/Models/User.php`
- Modify: `backend/app/Http/Controllers/Api/AuthController.php`
- Test: `backend/tests/Feature/UserAbilityAuthorizationTest.php`

**Interfaces:**
- `UserPermissionResolver::has(User $user, string $slug, ?int $schoolId = null): bool`
- `UserPermissionResolver::effectiveSlugs(User $user, ?int $schoolId = null): array`
- Unique override key: `(school_id, user_id, permission_id)` with boolean `allowed`.

- [ ] Write tests proving explicit deny removes a role permission, explicit grant adds a school permission, cross-school overrides do not apply, and platform owner always passes.
- [ ] Run `..\tools\php\php-local.cmd vendor\bin\phpunit --filter UserAbilityAuthorizationTest`; expect the new tests to fail before implementation.
- [ ] Add the override migration/model and resolver; make `User::hasPermissionTo()` delegate to it and make `/me` return effective permissions.
- [ ] Re-run the focused test; expect all cases to pass.

### Task 2: Employee position and ability mutation API

**Files:**
- Create: `backend/app/Services/Authorization/EmployeeAccessCatalog.php`
- Create: `backend/app/Services/Authorization/EmployeeAccessService.php`
- Create: `backend/app/Http/Controllers/Api/V1/EmployeeAccessController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Audit/AuditAction.php`
- Modify: `backend/app/Http/Controllers/Api/V1/StaffController.php`
- Test: `backend/tests/Feature/EmployeeAccessTest.php`

**Interfaces:**
- `GET /api/v1/admin/staff/{user}/access` returns position, grouped ability catalog, effective/granted/default state.
- `PUT /api/v1/admin/staff/{user}/access` consumes `{position: finance|school-admin|teacher, permissions: string[], teacher_app_access: bool, reason: string}`.
- Audit actions: `employee.position_changed`, `employee.abilities_updated`, `employee.app_access_changed`.

- [ ] Write tests for same-school read/update, mandatory reason, self-edit rejection, platform-owner rejection, cross-school rejection, Finance inheritance, dependency normalization, and audit rollback.
- [ ] Run the focused test and confirm failure.
- [ ] Implement a grouped grantable catalog, atomic role/override synchronization, explicit grant/deny materialization, and same-transaction audit snapshots.
- [ ] Replace Attendance-only ability routes in Employees with the new endpoint while retaining historical Attendance records as read-only compatibility data.
- [ ] Run the focused test and confirm all cases pass.

### Task 3: Final role templates and demo migration

**Files:**
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Modify: `backend/app/Services/Foundation/FoundationAccountService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/FoundationAccountController.php`
- Modify: `backend/app/Http/Controllers/Api/V1/PlatformTenantController.php`
- Modify: `backend/app/Http/Controllers/Api/V1/TenantSettingsController.php`
- Modify: `backend/tests/Feature/DemoPortalApiTest.php`
- Modify: `backend/tests/Feature/PhaseAFoundationApiTest.php`

**Interfaces:**
- Employee creation accepts one `position` from the three approved values.
- Parent/Student identities remain optional relationship roles and are not employee positions.

- [ ] Update tests to reject CEO/Tenant Owner assignment and verify Finance contains every School Admin default plus finance-only mutations.
- [ ] Run the affected focused tests and confirm expected failures.
- [ ] Stop seeding active CEO/Tenant Owner templates, make Finance inherit School Admin permission IDs plus finance permissions, and keep Super Admin platform-owner-only.
- [ ] Update account creation/role assignment allowlists without permitting school users to grant Super Admin.
- [ ] Re-run focused tests and confirm passing results.

### Task 4: Admin Employees editor

**Files:**
- Modify: `frontend/src/components/StaffPage.tsx`
- Modify: `frontend/src/App.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Uses the Employee Access API from Task 2.
- Draft checkbox changes are immediate locally; one Done action submits position, permissions, Teacher App Access, and required reason.

- [ ] Add failing UI tests for three positions, grouped permissions, reason validation, dependency behavior, and disabled self/platform targets.
- [ ] Run the focused Vitest file and confirm failure.
- [ ] Replace Attendance-only checkboxes with Position, grouped User Abilities, Teacher App Access, and Reason; update directory filters/copy to exclude Parent/Student.
- [ ] Run focused tests, Admin build, and lint.

### Task 5: App personas and Teacher elevated scope

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/components/MobileShell.tsx`
- Modify: `app/src/components/TeacherPortalView.tsx`
- Modify: `app/src/components/CommunityFeed.tsx`
- Modify: `app/src/features/community-safety/CommunityPolicyGate.tsx`
- Modify: `app/src/api/portalApi.ts`
- Test: `app/src/App.test.tsx`
- Test: `app/src/components/MobileShell.test.tsx`

**Interfaces:**
- `AppRole = 'parent' | 'student' | 'teacher'`.
- Teacher persona is allowed by the teacher role or effective `app.teacher_access` permission.
- First multi-persona entry prompts for a persona; later visits use persisted last choice.

- [ ] Add failing tests for no Staff persona, explicit first-use selection, persisted selection, and School Admin Teacher App Access.
- [ ] Run focused App tests and confirm failure.
- [ ] Remove Staff branches/copy, reuse Teacher screens with backend effective permissions for elevated scope, and add first-use persona selection storage.
- [ ] Run App tests, build, and lint.

### Task 6: Documentation, regression, and delivery

**Files:**
- Modify: `README.md`
- Modify: `docs/project-overview.md`
- Modify: `docs/current-status.md`
- Modify: `docs/business-rules.md`
- Modify: `docs/architecture.md`
- Modify: `docs/database.md`
- Modify: `docs/permissions.md`
- Modify: `docs/testing-and-release.md` only if commands/contracts changed.

- [ ] Update every role, permission, App-persona, audit, API, and schema description; remove stale CEO/Tenant Owner/Staff claims.
- [ ] Run backend PHPUnit, route loading, Pint check, SQLite migration/rollback checks, Admin Vitest/lint/build, App Vitest/lint/build, and `git diff --check`.
- [ ] Run MariaDB checks if a disposable MariaDB is available; otherwise record **Not verified**.
- [ ] Review the complete diff and secret/generated-file status; exclude `.idea/`, databases, runtime state, and unrelated artifacts.
- [ ] Create one final commit, push the feature branch, and report the branch/commit plus exact verification results.
