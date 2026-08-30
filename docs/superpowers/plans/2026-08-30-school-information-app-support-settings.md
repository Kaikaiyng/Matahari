# School Information and App Support Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audited school information and App Support settings that are editable in Admin and consumed by the current school's App support page.

**Architecture:** Keep institutional fields on `schools` and store App-facing contacts in a one-to-one `school_support_settings` record. Resolve school context exclusively on the backend, expose school settings through authenticated Admin endpoints, and merge safe local support contacts into the existing public policy response.

**Tech Stack:** Laravel 13/PHP 8.3, Eloquent migrations and services, React 19/TypeScript, Vitest/Testing Library, existing RYLAY Admin and App CSS systems.

## Global Constraints

- Preserve the existing tenant → school hierarchy; settings are scoped to the resolved current school.
- Use the existing MAW-derived Admin pattern with RYLAY/MIS colours and a 16px sibling gap.
- School Information and App Support mutations must be audited in the same transaction.
- Do not add Telegram, notification delivery, support ticketing, secrets, packages, or automotive logic.
- New schema fields are nullable and existing school and financial history is preserved.

---

### Task 1: School settings schema, model, permission, and audit vocabulary

**Files:**
- Create: `backend/database/migrations/2026_08_30_000001_add_school_information_and_support_settings.php`
- Create: `backend/app/Models/SchoolSupportSetting.php`
- Modify: `backend/app/Models/School.php`
- Modify: `backend/app/Audit/AuditAction.php`
- Modify: `backend/app/Audit/AuditSubject.php`
- Modify: `backend/database/seeders/DatabaseSeeder.php`
- Test: `backend/tests/Feature/SchoolSettingsTest.php`

**Interfaces:**
- Produces `School::supportSettings(): HasOne`.
- Produces fillable `registration_number`, `group_member_line`, and `operating_hours` school fields.
- Produces `school.settings.manage`, `SchoolInformationUpdated`, `SchoolAppSupportUpdated`, and `SchoolSupportSetting` audit vocabulary.

- [ ] **Step 1: Write the failing schema and permission tests**

Add tests asserting the new school columns and support table exist, School Admin and Finance receive `school.settings.manage`, and Teacher does not receive it.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd backend; ..\tools\php\php-local.cmd vendor\bin\phpunit tests/Feature/SchoolSettingsTest.php`

Expected: failure because the migration, model, relation, and permission do not exist.

- [ ] **Step 3: Add the nullable migration and model contracts**

Create the three nullable `schools` strings, the unique school support row with nullable contact fields and `updated_by`, safe foreign-key rollback order, Eloquent relationships, fillables, and audit enum values. Insert/assign the permission in both migration-safe data setup and the demo seeder so upgraded and fresh databases agree.

- [ ] **Step 4: Run the focused test**

Run the command from Step 2.

Expected: schema and role assertions pass.

- [ ] **Step 5: Commit**

```powershell
git add backend/database/migrations/2026_08_30_000001_add_school_information_and_support_settings.php backend/app/Models/SchoolSupportSetting.php backend/app/Models/School.php backend/app/Audit/AuditAction.php backend/app/Audit/AuditSubject.php backend/database/seeders/DatabaseSeeder.php backend/tests/Feature/SchoolSettingsTest.php
git commit -m "feat: add school support settings schema"
```

### Task 2: Authenticated school settings API and transactional audit

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/SchoolSettingsController.php`
- Create: `backend/app/Services/SchoolSettings/SchoolSettingsService.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/SchoolSettingsTest.php`

**Interfaces:**
- Produces `GET|PUT /api/v1/admin/settings/school-information`.
- Produces `GET|PUT /api/v1/admin/settings/app-support`.
- PUT requests accept only the typed fields in the design and require `school.settings.manage`.

- [ ] **Step 1: Add failing API tests**

Cover current-school reads, School Admin update, Teacher denial, cross-school isolation, invalid email rejection, nullable values, and rollback when the injected audit logger fails.

- [ ] **Step 2: Run and confirm the API tests fail**

Run: `cd backend; ..\tools\php\php-local.cmd vendor\bin\phpunit tests/Feature/SchoolSettingsTest.php`

Expected: 404 or missing-controller failures for the new endpoints.

- [ ] **Step 3: Implement controller, service, and routes**

Use `SchoolContext::fromRequest($request)->schoolId`; never accept a school ID in the payload. Validate trimmed nullable strings and email fields. Lock the school/support row, update only allowed values, write `AuditEvent` through `AuditLoggerContract` inside the same transaction, and return normalized JSON.

- [ ] **Step 4: Run the focused backend test**

Run the command from Step 2.

Expected: all School Settings feature tests pass.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/Http/Controllers/Api/V1/SchoolSettingsController.php backend/app/Services/SchoolSettings/SchoolSettingsService.php backend/routes/api.php backend/tests/Feature/SchoolSettingsTest.php
git commit -m "feat: add audited school settings api"
```

### Task 3: Admin School Information and App Support workspace

**Files:**
- Modify: `frontend/src/features/settings/SettingsPage.tsx`
- Modify: `frontend/src/features/settings/SettingsPage.css`
- Modify: `frontend/src/features/settings/SettingsPage.test.tsx`

**Interfaces:**
- Consumes the four endpoints from Task 2.
- Produces `School Information` and `App Support` rail sections and an App contact preview.

- [ ] **Step 1: Add failing Settings workspace tests**

Mock both GET responses and assert the fields render. Test School Admin editing/saving, read-only behavior without `school.settings.manage`, API errors, and live preview updates for call, WhatsApp, email, and support hours.

- [ ] **Step 2: Run the focused Admin test and verify failure**

Run: `cd frontend; npm.cmd test -- src/features/settings/SettingsPage.test.tsx`

Expected: failure because the new sections and requests do not exist.

- [ ] **Step 3: Implement both settings sections**

Replace the read-only School Profile section with editable School Information. Add App Support immediately after it, load each section lazily, preserve unsaved local state, normalize blank values to `null`, show saving/success/error feedback, and disable save controls without the permission. Use existing Admin inputs/actions and the MAW-style two-column Settings layout.

- [ ] **Step 4: Run the focused Admin test**

Run the command from Step 2.

Expected: all Settings page tests pass.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/features/settings/SettingsPage.tsx frontend/src/features/settings/SettingsPage.css frontend/src/features/settings/SettingsPage.test.tsx
git commit -m "feat: add school and app support settings ui"
```

### Task 4: School-scoped public support and App contact actions

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/PublicCommunityPolicyController.php`
- Modify: `backend/tests/Feature/PublicCommunityPolicyApiTest.php`
- Modify: `app/src/features/community-safety/PublicPolicyPage.tsx`
- Modify: `app/src/features/community-safety/CommunitySafety.css`
- Modify: `app/src/features/community-safety/PublicPolicyPage.test.tsx`

**Interfaces:**
- Extends public policy `support.school` with nullable `call_phone`, `whatsapp_phone`, `support_email`, and `operating_hours` only for a host-resolved tenant with exactly one active school.
- Keeps `child_safety_email` sourced from global safety configuration.

- [ ] **Step 1: Add failing backend and App tests**

Assert the public support response uses only the resolved school's support row and does not leak another school's values. In App tests, assert configured links use `tel:`, digits-only `wa.me`, and `mailto:`, hours render, and absent channels are omitted.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests/Feature/PublicCommunityPolicyApiTest.php
cd ..\app
npm.cmd test -- src/features/community-safety/PublicPolicyPage.test.tsx
```

Expected: response and contact-action assertions fail.

- [ ] **Step 3: Implement safe public output and App actions**

Resolve a public school only when the host-selected tenant has exactly one active school; return `support.school: null` for a multi-school tenant rather than guessing. Return local support fields nested alongside unchanged global platform/child-safety contacts. Render only configured actions, sanitize the WhatsApp URL to digits, and retain the existing emergency disclaimer and App visual system.

- [ ] **Step 4: Run focused backend and App tests**

Run the commands from Step 2.

Expected: both focused suites pass.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/Http/Controllers/Api/V1/PublicCommunityPolicyController.php backend/tests/Feature/PublicCommunityPolicyApiTest.php app/src/features/community-safety/PublicPolicyPage.tsx app/src/features/community-safety/CommunitySafety.css app/src/features/community-safety/PublicPolicyPage.test.tsx
git commit -m "feat: expose school app support contacts"
```

### Task 5: Canonical documentation and proportionate verification

**Files:**
- Modify: `README.md`
- Modify: `docs/project-overview.md`
- Modify: `docs/current-status.md`
- Modify: `docs/business-rules.md`
- Modify: `docs/permissions.md`
- Modify: `docs/architecture.md`
- Modify: `docs/database.md`
- Modify: `docs/testing-and-release.md`

**Interfaces:**
- Documents the implemented school settings, support fallback, permission, schema, audit, and validation evidence.

- [ ] **Step 1: Update canonical documentation**

Record the exact fields, school scope, `school.settings.manage`, public support exposure, global child-safety separation, audit behavior, and any unavailable MariaDB evidence. Remove statements that school-profile editing is unimplemented.

- [ ] **Step 2: Run proportionate verification**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests/Feature/SchoolSettingsTest.php tests/Feature/PublicCommunityPolicyApiTest.php
..\tools\php\php-local.cmd vendor\bin\pint --test
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
cd ..\frontend
npm.cmd test -- src/features/settings/SettingsPage.test.tsx
npm.cmd run build
cd ..\app
npm.cmd test -- src/features/community-safety/PublicPolicyPage.test.tsx
npm.cmd run build
```

Expected: focused tests, formatting, route loading, and both builds pass. Record MariaDB as **Not verified** unless a disposable MariaDB target is available.

- [ ] **Step 3: Review intended diff and secret scan**

Run:

```powershell
git diff --check
git status --short
git diff --stat
git diff -- . ':!.idea'
rg -n "BOT_TOKEN|TELEGRAM_TOKEN|BEGIN (RSA|OPENSSH|PRIVATE) KEY" backend frontend app docs
```

Expected: only intended project files are changed; `.idea/` remains unstaged; no credentials are introduced.

- [ ] **Step 4: Commit documentation**

```powershell
git add README.md docs/project-overview.md docs/current-status.md docs/business-rules.md docs/permissions.md docs/architecture.md docs/database.md docs/testing-and-release.md
git commit -m "docs: document school support settings"
```

- [ ] **Step 5: Preserve branch for visual confirmation**

Do not push. Report the local commit list and validation evidence so the owner can inspect the running Admin and App before requesting the final push.
