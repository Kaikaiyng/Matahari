# Implementation Status

Status: `INTEGRATED_FEATURE_BRANCH_NOT_PRODUCTION_READY`

Current documentation baseline: 2026-08-26 on `feat/admin-application-logs`; the integrated feature branch is pushed, but default `master` merge and production deployment are separate. Exact commit and final validation evidence are recorded in [Current Status](current-status.md).

The SaaS contains three independently operated runtimes: the Laravel API in `backend/`, the Admin Panel in `frontend/`, and the mobile-first School App in `app/`. Admin and App have separate tenant domains/builds, resolve tenant context from the hostname, and share authentication identities, tenant membership RBAC, school scope, MariaDB-compatible schema, audit and finance sources of truth. MIS is the first tenant configuration. The repository is not production-ready and has no native/store package.

## 1. Implemented Admin and Finance

- Username session login/logout/restoration, CSRF protection, login throttling, active-user rechecks, roles, and permission-gated actions.
- Student list/search/filter/create/detail, backend profile update, lifecycle status changes, and read-only class rosters.
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

- CI sources, immutable release ZIP generation, pinned PHP/Nginx images, separate Admin/App Nginx services, private MariaDB Compose configuration, environment examples, health/deployment-info endpoints, and deployment contract tests are present.
- Real container startup on this workstation, stable hosting, edge TLS, remote promotion, monitoring, backup scheduling, runtime grants, and restore drills are not verified.
- The Quick Tunnel tooling is temporary demo transport, not production infrastructure.

## 5. Current Verification Evidence

Latest integrated feature-branch checks recorded on 2026-08-25/26:

```text
School App: 56 Vitest tests passed; Oxlint passed; TypeScript/Vite build passed
Admin Panel: 187 Vitest tests passed; Oxlint exit 0 with 9 existing Calendar Fast Refresh warnings; build passed
Backend: 395 tests discovered; 383 passed; 12 MariaDB-gated tests skipped; 2,145 assertions
Pint: passed
API routes: 152 non-vendor routes loaded
Local reachability: tenant-aware backend, Admin root, and App root returned HTTP 200
```

The 2026-08-23 User Ability/Attendance delivery passed a disposable SQLite fresh migration, targeted rollback, and re-migration. School Updates added no migration. MariaDB audience-query/runtime behavior, browser/manual UAT, real Hikvision integration, real-device/native behavior, and production load remain **Not verified** in the final delivery evidence.

## 6. Known Limitations and Gates

- No production deployment, capacity target, load test, monitoring, backup/restore drill, or production MariaDB upgrade has been verified.
- Guardian/account activation and academic/enrolment live-data backfill require explicit source review, dry runs, approval, and recovery plans.
- Discount formulas and eligibility are unapproved; non-zero-discount charge generation fails closed.
- Refunds, credits, overpayments, write-offs, general correction/recovery, statements, automatic/external reminders, reports, exports, and server PDF remain incomplete. Manual in-app payment reminders are implemented.
- User lifecycle administration and password reset remain incomplete beyond minimum foundation account creation/role assignment.
- Native authentication, Sanctum, Firebase, Capacitor, Android/iOS packages, push delivery, and store publication are absent.

Use [Current Status](current-status.md) for detailed dated evidence, [Project Overview](project-overview.md) for scope, [Architecture](architecture.md) for runtime boundaries, [Permissions](permissions.md) for active identities/abilities, and [Mobile Product Architecture and Roadmap](mobile-product-roadmap.md) for the current App direction. The detailed System Architecture and MIS App Product Specification are historical snapshots.
