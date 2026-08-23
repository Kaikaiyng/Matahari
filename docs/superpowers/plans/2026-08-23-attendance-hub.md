# Attendance Hub Implementation Plan

**Execution status:** Implemented 2026-08-23; verification and delivery evidence is recorded in `docs/current-status.md` and the final commit report.

> **For agentic workers:** Execute inline in this session. Do not use subagents, create intermediate commits, or push until the user reviews the complete day of work.

**Goal:** Deliver one Attendance Hub with immutable campus Entry/Exit events, Hikvision-ready ingestion, time-bound user abilities, Parent visibility/notifications, and no Student Attendance surface.

**Architecture:** Keep existing class `attendance_sessions`/`attendance_records` for Class Register. Add a separate campus-event aggregate with a provider adapter and derived daily summaries. Dedicated Attendance permissions combine role permissions and active school-scoped user grants; all resources remain tenant/school scoped.

**Tech Stack:** Laravel 13/PHP, React 19/TypeScript, SQLite-compatible and MariaDB-compatible migrations, PHPUnit, Vitest, Oxlint, Vite.

## Global Constraints

- Preserve immutable event, notification, and audit history.
- Never accept a client-submitted tenant ID; use resolved tenant and school context.
- Store no face templates and return no device secrets.
- Student receives no Attendance navigation, API, or notification.
- Parent access requires the existing reviewed active guardian-child academic capability.
- No intermediate commit or push; `.idea/` remains untouched.

---

### Task 1: Consolidate Existing Attendance UX

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/ClassesPage.tsx`
- Create: `frontend/src/features/attendance/AttendanceHubPage.tsx`
- Test: `frontend/src/App.test.tsx`
- Test: `frontend/src/components/ClassesPage.test.tsx`
- Modify: `app/src/components/StudentPortalView.tsx`
- Modify: `app/src/api/portalApi.ts`
- Test: `app/src/components/MobileShell.test.tsx`

**Interfaces:** `AttendanceHubPage` receives current permissions, optional `initialClassId`, and `onUnauthorized`. Classes emits `onOpenAttendance(classId)` and contains no register editor.

- [ ] Add failing Admin tests proving Classes has only roster plus `Open Class Register`, and Attendance opens the selected class register.
- [ ] Add failing App test proving Student does not request or render Attendance.
- [ ] Extract the current register/overview UI into `AttendanceHubPage`; wire the standalone Sidebar entry and contextual Classes deep link.
- [ ] Remove `getStudentAttendance()` from Student loading and remove its progress card/copy without changing Timetable or results.
- [ ] Run `npm.cmd test -- --run src/components/ClassesPage.test.tsx src/App.test.tsx -t Attendance` in `frontend/` and the focused Student/MobileShell test in `app/`.

### Task 2: Dedicated Permissions and Time-Bound Abilities

**Files:**
- Create: `backend/database/migrations/2026_08_23_000001_add_attendance_permissions_and_abilities.php`
- Create: `backend/app/Models/UserAttendanceAbility.php`
- Modify: `backend/app/Models/User.php`
- Create: `backend/app/Services/Attendance/AttendanceAbilityService.php`
- Create: `backend/app/Http/Controllers/Api/V1/AttendanceAbilityController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Audit/AuditAction.php`
- Test: `backend/tests/Feature/AttendanceAbilityTest.php`

**Interfaces:** `User::hasPermissionTo()` recognizes an active `user_attendance_abilities` row for the resolved school only. Grants contain `school_id`, `user_id`, `permission_slug`, `effective_from`, nullable `expires_at`, `granted_by`, nullable `revoked_by/revoked_at`, and reason.

- [ ] Write failing tests for current, future, expired, revoked, cross-school, and unauthorized grants.
- [ ] Add the six dedicated permissions and assign school/super admin management permissions and Teacher assigned-scope permissions.
- [ ] Implement school-scoped ability list/create/revoke endpoints with audited transactional mutations.
- [ ] Replace Admin Attendance route middleware and class-scope service checks with the dedicated permissions.
- [ ] Run `php artisan test --filter=AttendanceAbilityTest` and existing Attendance feature tests.

### Task 3: Campus Attendance Persistence

**Files:**
- Create: `backend/database/migrations/2026_08_23_000002_create_campus_attendance_tables.php`
- Create models: `CampusAttendanceDevice.php`, `CampusAttendanceReader.php`, `CampusAttendanceCredential.php`, `CampusAttendanceEvent.php`, `CampusAttendanceException.php`, `CampusAttendanceSetting.php`
- Test: `backend/tests/Feature/CampusAttendanceMigrationTest.php`

**Interfaces:** Device/reader belongs to one school. Credential maps one provider person/card fingerprint to one Student. Event uniqueness is `(school_id, device_id, provider_event_id)` and contains direction, authentication method, occurred/received timestamps, result, nullable Student/Credential, filtered source payload, and manual-correction metadata.

- [ ] Write a migration test for foreign keys, unique event idempotency, indexes, casts, and rollback order.
- [ ] Add tables in parent-before-child order and drop in reverse order.
- [ ] Add focused models with fillable fields, encrypted secret cast, JSON casts, and relationships.
- [ ] Run fresh migrate, migration test, rollback the two new migrations, and re-migrate on disposable SQLite.

### Task 4: Hikvision-Ready Event Ingestion

**Files:**
- Create: `backend/app/Services/Attendance/GateEventData.php`
- Create: `backend/app/Services/Attendance/GateEventAdapter.php`
- Create: `backend/app/Services/Attendance/HikvisionGateEventAdapter.php`
- Create: `backend/app/Services/Attendance/CampusAttendanceService.php`
- Create: `backend/app/Http/Controllers/Api/V1/CampusAttendanceIngestionController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Audit/AuditAction.php`
- Test: `backend/tests/Feature/CampusAttendanceIngestionTest.php`

**Interfaces:** Adapter normalizes vendor payload to provider event ID, external person/card reference, reader, direction, event time, authentication method, result, and filtered source snapshot. Service returns `{event, duplicate, exception}`.

- [ ] Write failing tests for signed ingestion, invalid signature, inactive device, Face/Card normalization, Entry/Exit, duplicate retry, unknown credential, out-of-order events, clock skew, and cross-school isolation.
- [ ] Implement per-device HMAC verification and a simulator request using the same normalized contract.
- [ ] Persist immutable events transactionally, flag anomalies, and recompute a student's date summary from ordered events.
- [ ] Create one Parent notification per unique successful event for each eligible reviewed linked guardian; never notify Student.
- [ ] Audit manual events/corrections in the same transaction and ensure provider events cannot be edited.
- [ ] Run the ingestion test and existing portal-notification tests.

### Task 5: Admin Campus, Device, Settings, and Ability APIs

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/CampusAttendanceController.php`
- Create: `backend/app/Http/Controllers/Api/V1/AttendanceDeviceController.php`
- Create: `backend/app/Http/Controllers/Api/V1/AttendanceSettingController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/AdminCampusAttendanceTest.php`

**Interfaces:** Overview and records accept date plus optional class/status filters. Detail returns summary plus ordered immutable timeline. Device writes accept readers and direction; settings accept one school timezone, arrival cutoff, dismissal time, and Parent default notification booleans.

- [ ] Write failing tests for overview counts, filters, timeline, unknown exceptions, permission boundaries, device secret redaction, settings validation, and cross-school denial.
- [ ] Implement read endpoints under `attendance.view_school` and mutations under the matching manage permission.
- [ ] Implement device/reader and school setting transactional audit events.
- [ ] Run `php artisan test --filter=AdminCampusAttendanceTest`.

### Task 6: Admin Attendance Hub UI

**Files:**
- Create: `frontend/src/features/attendance/attendanceApi.ts`
- Create: `frontend/src/features/attendance/AttendanceHubPage.tsx`
- Create: `frontend/src/features/attendance/AttendanceHubPage.css`
- Test: `frontend/src/features/attendance/AttendanceHubPage.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:** Hub sections are Overview, Class Register, Devices, and Settings; Overview contains the complete Campus Records table. Section visibility follows returned permissions. Campus rows open a detail dialog with the full event timeline. User Abilities is exposed as checkboxes in Employees > Edit.

- [ ] Write failing tests for summary, filters, View Detail timeline, anomaly state, device/reader direction, school times, ability dates, and hidden unauthorized sections.
- [ ] Implement API types and the hub using existing Admin UI components and MIS tokens.
- [ ] Preserve 16px sibling-panel gaps and responsive tables/dialogs.
- [ ] Run the focused Attendance Hub tests, Admin lint, and build.

### Task 7: Parent and Teacher App Boundaries

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/ParentPortalController.php`
- Modify: `backend/routes/api.php`
- Modify: `app/src/api/portalApi.ts`
- Modify: `app/src/components/ParentPortalView.tsx`
- Modify: `app/src/components/TeacherPortalView.tsx`
- Modify: `app/src/components/NotificationCentre.tsx`
- Test: `backend/tests/Feature/AttendanceApiTest.php`
- Test: `app/src/components/MobileShell.test.tsx`

**Interfaces:** Parent campus endpoint returns only a reviewed linked child's daily summaries/timeline. Teacher Campus view requires active whole-school ability; existing assigned Class Register remains assignment scoped.

- [ ] Write failing tests proving Parent self scope, Student route absence, Teacher assigned default, active whole-school view grant, expiry, and notification category display.
- [ ] Add Parent Campus Attendance UI inside the child/academics area with current status and View Detail timeline.
- [ ] Add Teacher class selector for existing Class Register and an ability-gated whole-school Campus view.
- [ ] Remove Student Attendance API route and all Student Attendance requests/content.
- [ ] Run backend focused tests plus App tests, lint, and build.

### Task 8: Documentation and Verification

**Files:**
- Modify: `docs/architecture.md`
- Modify: `docs/business-rules.md`
- Modify: `docs/permissions.md`
- Modify: `docs/database.md`
- Modify: `docs/current-status.md`
- Modify: `docs/testing-and-release.md` only if commands change

- [ ] Document Campus versus Class/Lesson boundaries, permissions, device security, Parent default notifications, Student exclusion, idempotency, and hardware limitations.
- [ ] Run backend focused/full tests, route loading, Pint, migration/rollback checks; run Admin/App tests, lint, and builds separately.
- [ ] Record MariaDB as **Not verified** if no disposable MariaDB run is available.
- [ ] Review `git diff --check`, tracked files, generated artifacts, and secret-bearing content; keep `.idea/` untracked.
- [ ] Present the complete local result for user review before one consolidated commit/push.
