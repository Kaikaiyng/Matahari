# Username Authentication and User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace staff email authentication with username authentication and add audited, responsive, Super Admin-only fixed-role user management.

**Architecture:** Keep Laravel session authentication and the existing role/permission tables. Add a forward-only username migration, focused user-management requests/controllers, backend authorization and audit logging, then integrate a small React user-management component into Settings without refactoring the rest of `App.tsx`.

**Tech Stack:** Laravel 13, PHP 8.4, PHPUnit, MariaDB 12.3, SQLite test database, React 19, TypeScript 6, Vite 8, Vitest, Testing Library, CSS media queries.

## Global Constraints

- Staff authentication uses username and password only; staff email is removed from model, API, login, and user-management UI.
- Only Super Admin creates initial passwords and resets passwords.
- Passwords remain one-way hashes and never enter responses, logs, audit data, seed output, or retained frontend state.
- No self-service password changes, email recovery, forced first-login password changes, `must_change_password`, universal password, custom roles, per-user overrides, or permanent user deletion.
- Each staff user has exactly one fixed role: Super Admin, CEO, School Admin, or Finance.
- CEO may view and print existing permitted content but may not mutate business data; backend authorization is mandatory.
- Deactivation preserves user IDs, financial references, and audit history.
- Protect the current user and last active Super Admin from lockout.
- Preserve existing application architecture; do not rewrite routing or state management.

---

### Task 1: Username Schema, Model, Factory, and Seeder

**Files:**
- Create: `backend/database/migrations/2026_07_12_000001_replace_staff_email_with_username.php`
- Modify: `backend/app/Models/User.php`
- Modify: `backend/database/factories/UserFactory.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Test: `backend/tests/Feature/UsernameMigrationTest.php`

**Interfaces:**
- Produces: `users.username` as the unique authentication identifier; `User::$fillable` exposes `username` and not `email`.
- Preserves: IDs, passwords, school IDs, statuses, roles, timestamps, and financial foreign keys.

- [ ] **Step 1: Write the failing migration/model test**

Create `UsernameMigrationTest` assertions that the migrated schema has `username`, lacks `email` and `email_verified_at`, lacks `password_reset_tokens`, and seeded users are `superadmin`, `admin`, and `finance` with one role each.

```php
public function test_staff_schema_and_seed_use_username_without_email(): void
{
    $this->seed();

    $this->assertTrue(Schema::hasColumn('users', 'username'));
    $this->assertFalse(Schema::hasColumn('users', 'email'));
    $this->assertFalse(Schema::hasColumn('users', 'email_verified_at'));
    $this->assertFalse(Schema::hasTable('password_reset_tokens'));
    $this->assertSame(
        ['admin', 'finance', 'superadmin'],
        User::query()->orderBy('username')->pluck('username')->all(),
    );
    $this->assertTrue(User::query()->withCount('roles')->get()->every(
        fn (User $user) => $user->roles_count === 1,
    ));
}
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
php -c ..\tools\php\php.ini artisan test --filter=UsernameMigrationTest
```

Expected: FAIL because `users.username` does not exist and staff email columns still exist.

- [ ] **Step 3: Implement the forward migration and model updates**

The migration must add a nullable 50-character username, backfill normalized email local parts with deterministic numeric suffixes, add the unique constraint, make username non-null, drop staff email columns, and drop `password_reset_tokens`. Its `down()` recreates nullable email fields and the reset-token table without inventing recoverable email values.

Update `User`:

```php
protected $fillable = [
    'school_id',
    'name',
    'username',
    'password',
    'status',
    'last_login_at',
];
```

Update the factory to generate lowercase unique usernames and update the Seeder to use `superadmin`, `admin`, and `finance`. Synchronize exactly one role using `sync([$roleId])`. Add CEO read-only permissions including `receipts.print`, and add the five `users.*` permissions only to Super Admin.

- [ ] **Step 4: Run the focused test and full migration test suite**

Run:

```powershell
php -c ..\tools\php\php.ini artisan test --filter=UsernameMigrationTest
php -c ..\tools\php\php.ini artisan test
```

Expected: focused test PASS; legacy authentication tests may now fail because they still send email, which is addressed in Task 2.

- [ ] **Step 5: Commit Task 1**

```powershell
git add backend/database/migrations/2026_07_12_000001_replace_staff_email_with_username.php backend/app/Models/User.php backend/database/factories/UserFactory.php backend/database/seeders/DatabaseSeeder.php backend/tests/Feature/UsernameMigrationTest.php
git commit -m "feat: migrate staff accounts to usernames"
```

### Task 2: Username-Only Session Authentication

**Files:**
- Modify: `backend/app/Http/Requests/LoginRequest.php`
- Modify: `backend/app/Http/Controllers/Api/AuthController.php`
- Modify: `backend/tests/Feature/AuthApiTest.php`

**Interfaces:**
- Consumes: `users.username` from Task 1.
- Produces: `POST /api/login` with `{username,password}` and current-user payload containing `username` without email.

- [ ] **Step 1: Rewrite authentication tests for username behavior**

Add separate tests for normalized username login, missing/legacy email rejection, generic invalid credentials, inactive users, `/api/me`, logout, and existing RBAC behavior.

```php
$this->postJson('/api/login', [
    'username' => ' ADMIN ',
    'password' => 'password',
])->assertOk()
  ->assertJsonPath('user.username', 'admin')
  ->assertJsonMissingPath('user.email');

$this->postJson('/api/login', [
    'email' => 'admin@mis.test',
    'password' => 'password',
])->assertUnprocessable()->assertJsonValidationErrors(['username']);
```

- [ ] **Step 2: Run AuthApiTest and verify RED**

Run:

```powershell
php -c ..\tools\php\php.ini artisan test --filter=AuthApiTest
```

Expected: FAIL because the request still validates email and the payload still returns email.

- [ ] **Step 3: Implement username normalization and authentication**

`LoginRequest::prepareForValidation()` trims and lowercases username. Rules require the username regex and password string. `AuthController` calls `Auth::guard('web')->attempt(['username' => ..., 'password' => ...])`, returns the same generic username/password message for incorrect and inactive accounts, regenerates sessions, and returns:

```php
return [
    'id' => $user->id,
    'name' => $user->name,
    'username' => $user->username,
    'school_id' => $user->school_id,
    'status' => $user->status,
    'last_login_at' => $user->last_login_at?->toISOString(),
    'roles' => $user->roles->pluck('slug')->values()->all(),
    'permissions' => $effectivePermissions,
];
```

- [ ] **Step 4: Run focused and full backend tests**

Run:

```powershell
php -c ..\tools\php\php.ini artisan test --filter=AuthApiTest
php -c ..\tools\php\php.ini artisan test
```

Expected: PASS after replacing all seeded login payloads in affected tests with usernames.

- [ ] **Step 5: Commit Task 2**

```powershell
git add backend/app/Http/Requests/LoginRequest.php backend/app/Http/Controllers/Api/AuthController.php backend/tests
git commit -m "feat: authenticate staff with usernames"
```

### Task 3: CEO Read-Only Backend Enforcement

**Files:**
- Create: `backend/tests/Feature/CeoReadOnlyAccessTest.php`
- Modify only if a discovered endpoint lacks middleware: `backend/routes/api.php`

**Interfaces:**
- Consumes: CEO permissions seeded in Task 1.
- Produces: backend proof that CEO can view and print existing receipts but cannot mutate any available business resource.

- [ ] **Step 1: Write the failing CEO authorization matrix test**

Seed and login as CEO, then assert successful GET access to students, Fee Agreements, Fee Records, payments, receipts, and receipt print. Assert `403` for every available mutation route, including student create/update/status, Fee Agreement create/supersede, Fee Record activate/manual charge, payment create/verify/void, and receipt create/void.

```php
#[DataProvider('ceoForbiddenMutationProvider')]
public function test_ceo_cannot_mutate_business_data(string $method, string $uri, array $payload): void
{
    $this->seedAndLoginAsCeo();
    $this->json($method, $this->resolveSeededUri($uri), $payload)->assertForbidden();
}

public function test_ceo_can_view_and_print_existing_receipt(): void
{
    [$receipt] = $this->seedIssuedReceipt();
    $this->seedAndLoginAsCeo();
    $this->getJson("/api/receipts/{$receipt->id}")->assertOk();
    $this->getJson("/api/receipts/{$receipt->id}/print")->assertOk();
}
```

- [ ] **Step 2: Run the CEO test and verify RED**

Run:

```powershell
php -c ..\tools\php\php.ini artisan test --filter=CeoReadOnlyAccessTest
```

Expected: FAIL until the CEO seed permissions are active and any missing backend permission boundary is corrected.

- [ ] **Step 3: Correct backend route permissions only where tests prove a gap**

Keep `receipts.print` for CEO. Do not grant create/update/generate/verify/void permissions. Every mutation route must retain a permission middleware that CEO lacks.

- [ ] **Step 4: Run CEO and full backend tests**

```powershell
php -c ..\tools\php\php.ini artisan test --filter=CeoReadOnlyAccessTest
php -c ..\tools\php\php.ini artisan test
```

Expected: all PASS with backend `403` results independent of frontend controls.

- [ ] **Step 5: Commit Task 3**

```powershell
git add backend/tests/Feature/CeoReadOnlyAccessTest.php backend/routes/api.php backend/database/seeders/DatabaseSeeder.php
git commit -m "test: enforce CEO read-only access"
```

### Task 4: Audited Super Admin User-Management API

**Files:**
- Create: `backend/app/Http/Controllers/Api/UserController.php`
- Create: `backend/app/Http/Controllers/Api/RoleController.php`
- Create: `backend/app/Http/Requests/StoreUserRequest.php`
- Create: `backend/app/Http/Requests/UpdateUserRequest.php`
- Create: `backend/app/Http/Requests/UpdateUserStatusRequest.php`
- Create: `backend/app/Http/Requests/ResetUserPasswordRequest.php`
- Create: `backend/app/Services/UserAccountService.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/UserManagementApiTest.php`

**Interfaces:**
- Produces: the six routes defined in the design, fixed-role payloads, lockout protection, and password-free audit logs.

- [ ] **Step 1: Write failing feature tests for each management behavior**

Cover list, create, edit, role sync, activate/deactivate, reset password, normalized duplicate usernames, invalid roles, non-Super Admin `403`, self-deactivation, self-demotion, last-active-Super-Admin protection, and audit secrecy.

```php
$response = $this->actingAs($superAdmin)->postJson('/api/users', [
    'name' => 'Accounts Clerk',
    'username' => 'accounts.clerk',
    'role_id' => $financeRole->id,
    'status' => 'active',
    'password' => 'initial-123',
    'password_confirmation' => 'initial-123',
])->assertCreated()->assertJsonMissing(['password']);

$this->assertDatabaseHas('audit_logs', [
    'user_id' => $superAdmin->id,
    'action' => 'user.created',
    'entity_id' => $response->json('data.id'),
]);
$this->assertStringNotContainsString('initial-123', AuditLog::query()->latest('id')->firstOrFail()->toJson());
```

- [ ] **Step 2: Run UserManagementApiTest and verify RED**

```powershell
php -c ..\tools\php\php.ini artisan test --filter=UserManagementApiTest
```

Expected: FAIL with missing routes/controllers.

- [ ] **Step 3: Implement validation requests and UserAccountService**

Requests normalize username and validate exact fields. `UserAccountService` wraps create/update/status operations in transactions, synchronizes one role, checks active Super Admin counts under lock, hashes passwords through the User cast, and writes `AuditLog` entries containing only name, username, role, and status changes.

```php
public function resetPassword(Request $request, User $target, string $password): void
{
    DB::transaction(function () use ($request, $target, $password): void {
        $target->forceFill(['password' => $password])->save();
        $this->audit($request, 'user.password_reset', $target, null, null);
    });
}
```

- [ ] **Step 4: Implement controllers and permission-protected routes**

Controllers return stable `{data: ...}` payloads and never serialize model password fields. Routes use the exact `users.*` permission middleware from the design. Do not add a DELETE route.

- [ ] **Step 5: Run focused and full backend tests**

```powershell
php -c ..\tools\php\php.ini artisan test --filter=UserManagementApiTest
php -c ..\tools\php\php.ini artisan test
```

Expected: all PASS and no audit assertion contains password material.

- [ ] **Step 6: Commit Task 4**

```powershell
git add backend/app/Http/Controllers/Api/UserController.php backend/app/Http/Controllers/Api/RoleController.php backend/app/Http/Requests backend/app/Services/UserAccountService.php backend/routes/api.php backend/tests/Feature/UserManagementApiTest.php
git commit -m "feat: add audited staff user management"
```

### Task 5: Username Login UI and Frontend Test Harness

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/LoginScreen.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: username login API from Task 2.
- Produces: username-only form and a Vitest/jsdom test command.

- [ ] **Step 1: Install focused test dependencies and add the test script**

```powershell
npm.cmd install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Add `"test": "vitest run"` and configure jsdom/setup in Vite config or a dedicated Vitest config.

- [ ] **Step 2: Extract or export LoginScreen and write the failing test**

The test asserts Username/Password fields, absence of Email, empty initial values, and `{username,password}` submission.

```tsx
expect(screen.getByLabelText('Username')).toHaveValue('')
expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
await user.type(screen.getByLabelText('Username'), 'admin')
await user.type(screen.getByLabelText('Password'), 'password')
await user.click(screen.getByRole('button', { name: 'Login' }))
expect(request).toHaveBeenCalledWith('/login', {
  method: 'POST',
  body: { username: 'admin', password: 'password' },
})
```

- [ ] **Step 3: Run frontend test and verify RED**

```powershell
npm.cmd test -- LoginScreen.test.tsx
```

Expected: FAIL because the current form uses Email and prefilled credentials.

- [ ] **Step 4: Implement username login UI and CurrentUser type**

Replace `email` with `username` throughout authentication/current-user UI. Keep password only in component state while the login form is mounted, clear error fields correctly, and retain accessible labels and touch sizing.

- [ ] **Step 5: Run tests, lint, and build**

```powershell
npm.cmd test -- LoginScreen.test.tsx
npm.cmd run lint
npm.cmd run build
```

Expected: PASS; the existing unrelated exhaustive-deps warning may remain but no new warning is introduced.

- [ ] **Step 6: Commit Task 5**

```powershell
git add frontend/package.json frontend/package-lock.json frontend/src/test frontend/src/LoginScreen.test.tsx frontend/src/App.tsx frontend/vite.config.ts
git commit -m "feat: switch login UI to username"
```

### Task 6: Responsive Super Admin User-Management UI

**Files:**
- Create: `frontend/src/UserManagementPage.tsx`
- Create: `frontend/src/UserManagementPage.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.css`

**Interfaces:**
- Consumes: `apiRequest`, `CurrentUser`, and Task 4 endpoints.
- Produces: Super Admin user table/cards and responsive create, edit, status, and password-reset dialogs.

- [ ] **Step 1: Write failing role/rendering and interaction tests**

Test loading/error/empty states, list rendering, Super Admin controls, non-Super Admin omission, create/edit role payloads, activate/deactivate confirmation, reset-password confirmation, and clearing password state when dialogs close.

```tsx
render(<UserManagementPage currentUser={superAdmin} request={request} />)
expect(await screen.findByText('accounts.clerk')).toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Reset password for accounts.clerk' }))
await user.type(screen.getByLabelText('New password'), 'replacement-123')
await user.type(screen.getByLabelText('Confirm password'), 'replacement-123')
await user.click(screen.getByRole('button', { name: 'Reset password' }))
expect(request).toHaveBeenCalledWith('/users/4/reset-password', expect.objectContaining({ method: 'POST' }))
```

- [ ] **Step 2: Run the component test and verify RED**

```powershell
npm.cmd test -- UserManagementPage.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the focused component and integrate Settings**

Use a typed request callback so the component does not duplicate the API client. Fetch roles and users only when the current user has `users.view`. Forms retain password values only while the active create/reset dialog is mounted. All buttons are permission-gated for usability while backend permissions remain authoritative.

- [ ] **Step 4: Add responsive and accessible CSS**

Desktop/iPad landscape uses a table. At `max-width: 767px`, hide the table header and render row cells as labeled card fields. Dialogs use viewport max-height, internal scroll, visible close control, sticky footer, 44px minimum targets, safe word wrapping, and no background overflow.

- [ ] **Step 5: Run frontend tests, lint, and build**

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Expected: all tests/build PASS and no new lint warnings.

- [ ] **Step 6: Commit Task 6**

```powershell
git add frontend/src/UserManagementPage.tsx frontend/src/UserManagementPage.test.tsx frontend/src/App.tsx frontend/src/App.css
git commit -m "feat: add responsive staff user management"
```

### Task 7: Documentation, MariaDB Migration, and End-to-End Verification

**Files:**
- Modify: `README.md`
- Modify: `backend/README.md`
- Modify: `frontend/README.md`
- Modify: `docs/DEVELOPMENT_SETUP.md`
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `docs/SYSTEM_ARCHITECTURE.md`
- Modify: `docs/DATABASE_DESIGN.md`

**Interfaces:**
- Applies the tested forward migration to the active `matahari` MariaDB database.
- Documents username login, role behavior, and password-reset ownership without publishing plaintext credentials.

- [ ] **Step 1: Update documentation and credential examples**

Replace staff email-login examples with usernames. Document CEO read-only print behavior, Super Admin-only password reset, deactivation semantics, and the absence of universal/password-view features. Do not include actual passwords.

- [ ] **Step 2: Run pre-migration MariaDB checks and migrate**

Capture current user IDs/roles and migration status, then run:

```powershell
php -c ..\tools\php\php.ini artisan migrate --force
php -c ..\tools\php\php.ini artisan config:clear
```

Verify usernames, one role per user, password-hash continuity, permissions, and no staff email columns.

- [ ] **Step 3: Run the full automated verification suite**

```powershell
php -c ..\tools\php\php.ini .\vendor\bin\phpunit
cd ..\frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
cd ..
git diff --check -- backend frontend README.md docs
```

Expected: backend suite, frontend tests, build, and diff check PASS; lint has no errors and no new warnings.

- [ ] **Step 4: Run browser QA**

At 1440×900, 1180×820, 820×1180, and 390×844 verify:

- username login and generic failure;
- Super Admin list/create/edit/reset/deactivate/reactivate;
- current/last Super Admin protection;
- CEO can view and print an existing receipt;
- CEO mutation attempts return backend `403`;
- School Admin and Finance do not see user-management controls;
- dialogs, cards, table, focus, validation, and touch targets remain usable.

- [ ] **Step 5: Run sensitive-data and final Git checks**

Search tracked changes for plaintext passwords, hashes, email-based staff payloads, `must_change_password`, and universal-password logic. Confirm unrelated untracked files remain untouched.

- [ ] **Step 6: Commit Task 7**

```powershell
git add README.md backend/README.md frontend/README.md docs/DEVELOPMENT_SETUP.md docs/IMPLEMENTATION_STATUS.md docs/SYSTEM_ARCHITECTURE.md docs/DATABASE_DESIGN.md
git commit -m "docs: document username-based staff administration"
```

## Plan Self-Review

- Spec coverage: all approved authentication, password, CEO, backend enforcement, audit, responsive UI, migration, and QA requirements map to Tasks 1–7.
- Scope: no self-service password change, forced change, custom roles, per-user overrides, permanent deletion, universal password, report module, or architecture rewrite.
- Type consistency: backend and frontend use `username`; user routes and permission slugs match the design; each account synchronizes one role.
- Security: password material appears only as test fixture input or active form input and is never returned, audited, or logged.
- No implementation placeholders remain.
