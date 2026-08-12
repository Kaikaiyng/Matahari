# Phase A Academic Foundation Delivery

**Validation date:** 2026-08-12

**Delivery branch:** `phase-a-academic-foundation`

**Implementation head before this documentation-only update:** `ecaa0a1f177292ae99c9338e255a1f93312971f5`

**Status:** Implemented and locally validated; not merged to `master`

## Delivered Scope

Phase A adds the academic and portal-identity foundation without activating later product phases:

- a consistent `SchoolContext` and access pattern for new `/api/v1` modules;
- additive teacher, parent, and student roles and base permissions;
- nullable, explicitly reviewed portal-user links for parents and students;
- guardian portal review, access, and history fields;
- academic years, class enrolments, subjects, and teaching assignments;
- minimum administrative APIs and services for those records and foundation accounts;
- policies and access services for school and teacher scope;
- transactional audit integration for sensitive mutations;
- MariaDB-compatible foreign keys, indexes, and current-record uniqueness guards;
- focused authorization, migration, upgrade, and audit tests.

`students.class_id` remains unchanged for compatibility. Phase A does not infer or rewrite current student placement from that field.

## Database Changes

The delivery adds three corrective migrations. No historical migration is modified.

1. `2026_08_12_000001_create_academic_foundation_tables.php` creates `academic_years`, `subjects`, `class_enrolments`, and `teaching_assignments`.
2. `2026_08_12_000002_add_portal_foundation_links.php` adds nullable unique portal-user links and guardian review/access/history fields.
3. `2026_08_12_000003_add_phase_a_roles_and_permissions.php` adds foundation roles and permissions without replacing existing assignments.

The current enrolment guard uses a nullable `current_slot`: one current enrolment is allowed for each school, academic year, and student, while ended rows retain history. Teaching assignments use the same nullable-current-slot pattern for their school/year/class/subject/teacher scope.

Portal links require a same-school user with the matching role. Existing records are not matched by email, phone, or name. Existing guardian links remain `unreviewed`, and historical access flags remain `NULL` until an approved activation workflow acts on them.

## Models, Services, and Policies

New models are `AcademicYear`, `ClassEnrolment`, `StudentParentLink`, `Subject`, and `TeachingAssignment`. Existing `School`, `SchoolClass`, `Student`, `Guardian`, and `User` models expose the required relationships.

Foundation services cover academic years, subjects, enrolments, teaching assignments, teacher scope, portal links, and minimum foundation-account management. `SchoolContext`, `ResolveSchoolContext`, resource policies, and teacher-scope checks provide the authorization boundary for new modules.

## API Surface

Twenty `/api/v1` routes were added:

- academic-year list, create, update, and activate;
- subject list, create, and update;
- class-enrolment list, create, and end;
- teaching-assignment list, create, and end;
- minimum foundation-user creation and foundation-role update;
- parent and student portal-user linking;
- guardian portal-access review/update;
- teacher assignment listing and assigned-class roster access.

These routes use authenticated active sessions, permission middleware, resolved school context, policies or access services, school-scoped queries, and transactional domain services. They do not add native/mobile authentication or token authentication.

## Authorization Decisions

- Super Admin receives all Phase A permissions.
- School Admin can manage academic years, subjects, enrolments, teaching assignments, portal links, and foundation accounts/roles within the resolved school.
- Teacher can read academic-year and subject references and can access only teaching assignments and rosters within an active matching assignment.
- Parent receives `parent.self_service`; no Parent Finance access is included.
- Student receives `student.self_service`; no student finance access is included.
- Finance and CEO defaults are unchanged.
- Foundation-role mutation changes only teacher, parent, and student roles. Existing administrative and finance roles remain intact, including for multi-role users.
- Parent/student portal users and linked records must belong to the same school. Cross-school academic, teacher, and identity-link access is rejected.

## Audit and Transaction Behavior

Sensitive foundation mutations add audit action, module, and subject types. The domain mutation and its audit insert execute in the same database transaction. A forced audit-persistence failure is tested and rolls back the business mutation.

## Validation Evidence

The following checks were run locally on 2026-08-12:

| Check | Result |
| --- | --- |
| Full backend PHPUnit suite | Passed: 242 tests total, 234 passed, 8 MariaDB-only skipped, 1,254 assertions |
| Phase A on disposable MariaDB 10.4.32 | Passed: 17 tests, 103 assertions |
| Existing MariaDB test group | Passed: 8 tests, 33 assertions |
| SQLite fresh migration, rollback of the three Phase A migrations, re-migration | Passed |
| Existing-data upgrade migration test | Passed: 1 test, 12 assertions |
| MariaDB fresh migration, rollback of the three Phase A migrations, re-migration | Passed |
| MariaDB foreign-key/index inspection | Passed; nullable current-slot and portal-user unique indexes plus `RESTRICT`/`SET NULL` behavior inspected |
| Pint | Passed |
| API route loading | Passed: 59 routes loaded |
| Frontend lint | Exit 0 with 9 pre-existing `react(only-export-components)` warnings in `CalendarViews.tsx` |
| Frontend production build | Passed: TypeScript/Vite build, 83 modules transformed |
| Frontend Vitest | **Not passed:** 160 passed and 8 failed across 15 files |

The frontend test failures concern existing branding-contract expectations, stale navigation/finance assertions, and a duplicate `Add participants` query. There is no frontend diff from the branch base for this delivery, so they are recorded as baseline regression-suite failures rather than Phase A changes. They must still be resolved before claiming a fully green repository suite.

The MariaDB lifecycle used a disposable local database. It validates migration, foreign-key, index, and application behavior, but not production credentials, grants, backups, restoration, or production data.

## Live-Data Backfill Gates

The following remain separate controlled operations and were not performed:

- assigning production academic-year dates;
- reconstructing historical class enrolment dates or records;
- associating real parent/guardian or student portal accounts;
- reviewing or activating historical guardian access;
- resolving any ambiguous identity or academic-history candidates;
- validating production backups and a recovery plan before migration.

Each gate requires reviewed source data, explicit approval, a dry-run/reporting step, and a recovery plan. No production database was used during Phase A validation.

## Explicitly Deferred

Mobile Web, Parent Finance, notifications, payment reminders, Quiz, AI, Firebase, Capacitor, Sanctum, and native/mobile authentication are not implemented.

Future Quiz V1 must retain class targets, direct student targets, and materialized `quiz_assignment_recipients`. Its product types are `multiple_choice` and `true_false`; both may share the same option storage and scoring mechanism. This is a recorded future constraint, not Phase A schema or behavior.

## Delivery History

- `08591ad` — academic foundation schema
- `a9f90d7` — scoped foundation APIs
- `833a427` — migration lifecycle hardening
- `267edcd` — minimum foundation-account management
- `ecaa0a1` — Phase A foundation boundary documentation

The branch must not be merged to `master` without explicit approval.
