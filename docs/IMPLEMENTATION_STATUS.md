# Implementation Status

Status: `MATAHARI_DEVELOPMENT_NOT_PRODUCTION_READY`

Current documentation baseline: 2026-09-06. Exact commits and dated validation evidence are recorded in [Current Status](current-status.md).

Matahari contains three independently operated runtimes: the Laravel API in `backend/`, the Admin Panel in `frontend/`, and the mobile-first School App in `app/`. Admin and App have separate MIS domains/builds and share authentication identities, membership RBAC, school scope, a PostgreSQL-compatible schema, audit and finance sources of truth. Dedicated mode rejects every non-MIS tenant and disables SaaS platform routes. The repository is not production-ready and has no native/store package.

## 1. Implemented Admin and Finance

- Username session login/logout/restoration, CSRF protection, login throttling, active-user rechecks, roles, and permission-gated actions.
- Student list/search/filter/create/detail, permission-gated profile editing through the audited API, lifecycle status changes, and read-only class rosters. Profile class edits do not change academic-year enrolment history.
- Live read-only Parent directory with school-scoped contact search/pagination and optional student/profile-class search and relationship history under `students.view`. Parent contact/relationship editing and account onboarding remain incomplete.
- Versioned Fee Agreements, billing configuration, preview, activation, manual charges, outstanding balances, summary, and category/month ledger.
- Payment allocation, verification, void safeguards, history, receipt issue/view/print/void/regeneration, and preserved receipt snapshots/numbers.
- Shared school Calendar CRUD and responsive Admin shell.
- MAW-style grouped navigation with animated expansion, complete desktop slide-away collapse, and a responsive drawer.
- Attendance Hub combining campus overview/records, class registers, device mapping, settings, and student movement timelines.
- Employee Position and User Abilities editing with immediate checkbox dependencies, protected-owner/same-school guards, required reason, and transactional audit.
- Read-only Super Admin Audit Trail and sanitized Application Logs, plus transactional audit for implemented sensitive student, foundation, Attendance, employee-access, School Updates, and finance mutations.

## 2. Implemented Academic and Identity Foundation

- Super Admin is the protected platform-owner identity. Active employee positions are School Admin, Finance, and Teacher; historical CEO/Tenant Owner rows are not seeded or assignable. Parent and Student remain relationship/App identities, and multi-persona users are supported.
- Academic years, subjects, class enrolment history, teaching assignments, minimum foundation account management, explicit Parent/Student portal links, and guardian access/history fields.
- New modules use authenticated active sessions, permission middleware, `SchoolContext`, access services/policies, school-scoped queries, and transactional domain services.
- `students.class_id` remains for compatibility. Production dates, historical enrolments, account associations, and guardian access are never guessed or automatically activated.

## 3. Implemented School App Slice

- Separate `app/` React/Vite workspace and deployment boundary.
- Exactly Parent, Student, and Teacher personas with a compact header, role-specific floating liquid-glass navigation, swipe-back secondary pages, notifications, profile/settings, and sign out from More/Profile.
- Parent/Student self identity and enrolment access.
- Read-only Parent finance from authoritative Fee Record/payment/receipt data; no payment interface.
- Daily class Attendance plus campus entry/exit records; Teacher assignment/school abilities, correction reasons and audit; Parent linked-child reads; explicit Student exclusion.
- Live published Assessment results, class Schedule, and formal Teacher-assigned Quiz workflows.
- Live School Updates with employee publishing ability, immediate whole-school or multi-class text/image posts, optional in-app notifications, authorized reads/Likes/Post Reports, and no active comments or new direct-Student targeting.

Practice/AI Quiz, push/native delivery, automatic or external payment reminders, and production hardening remain planned. Historical Community comments, direct-Student audiences, restrictions, blocks, appeals, and pending/rejected rows remain preserved compatibility storage rather than active social workflows.

## 4. Deployment Foundation

- CI sources, immutable release ZIP generation, pinned PHP/Nginx images, separate Admin/App Nginx services, private PostgreSQL Compose configuration, environment examples, health/deployment-info endpoints, and deployment contract tests are present.
- Real container startup on this workstation, stable hosting, edge TLS, remote promotion, monitoring, backup scheduling, runtime grants, and restore drills are not verified.
- The Quick Tunnel tooling is temporary demo transport, not production infrastructure.

## 5. Current Verification Evidence

Latest database transition checks recorded on 2026-09-04, followed by the 2026-09-05 focused dedicated/store checks:

```text
PostgreSQL backend: 413 discovered; 392 passed; 21 legacy engine-specific skips; 2,225 assertions
Combined dedicated/store SQLite backend: 420 discovered; 407 passed; 13 skips; 2,274 assertions
Dedicated mode: 5 focused tests; 23 assertions
Store safeguards: 9 focused App tests; 8 focused backend tests; 35 backend assertions
Complete School App: 59 tests; lint and production build passed
Pint, 159-route loading, deployment contracts, and relative documentation links: passed
```

The PostgreSQL transition passed full migration/rollback/re-migration, runtime grant restrictions, local data reconciliation and an isolated backup restore. Browser/manual UAT, real Hikvision integration, real-device/native behavior, hosted deployment and production load remain **Not verified**.

## 6. Known Limitations and Gates

- No hosted production deployment, capacity target, load test, monitoring, automated off-site backup, or hosted restore drill has been verified.
- Guardian/account activation and academic/enrolment live-data backfill require explicit source review, dry runs, approval, and recovery plans.
- Discount formulas and eligibility are unapproved; non-zero-discount charge generation fails closed.
- Refunds, credits, overpayments, write-offs, general correction/recovery, statements, automatic/external reminders, reports, exports, and server PDF remain incomplete. Manual in-app payment reminders are implemented.
- User lifecycle administration and password reset remain incomplete beyond minimum foundation account creation/role assignment.
- Native authentication, Sanctum, Firebase, Capacitor, Android/iOS packages, push delivery, and store publication are absent.

Use [Current Status](current-status.md) for detailed dated evidence, [Project Overview](project-overview.md) for scope, [Architecture](architecture.md) for runtime boundaries, [Permissions](permissions.md) for active identities/abilities, and [Mobile Product Architecture and Roadmap](mobile-product-roadmap.md) for the current App direction. The detailed System Architecture and MIS App Product Specification are historical snapshots.
