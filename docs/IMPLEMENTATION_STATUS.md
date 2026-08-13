# Implementation Status

Status: `DEVELOPMENT_DEMO_WITH_LIVE_FOUNDATION_SLICES`

Last verified on merged `master`: 2026-08-13 at `816ea1d`

Matahari now contains three independently operated runtimes: the Laravel API in `backend/`, the Admin Panel in `frontend/`, and the mobile-first Community App in `app/`. Admin and App have separate builds and intended domains but share the same authentication, RBAC, school scope, MariaDB-compatible schema, audit system, and finance source of truth. The repository is not production-ready and has no native/store package.

## 1. Implemented Admin and Finance

- Username session login/logout/restoration, CSRF protection, login throttling, active-user rechecks, roles, and permission-gated actions.
- Student list/search/filter/create/detail, backend profile update, lifecycle status changes, and read-only class rosters.
- Versioned Fee Agreements, billing configuration, preview, activation, manual charges, outstanding balances, summary, and category/month ledger.
- Payment allocation, verification, void safeguards, history, receipt issue/view/print/void/regeneration, and preserved receipt snapshots/numbers.
- Shared school Calendar CRUD and responsive Admin shell.
- Read-only Super Admin Audit Trail and transactional audit for implemented sensitive student, foundation, Attendance, and finance mutations.

## 2. Implemented Academic and Identity Foundation

- Teacher, Parent, and Student roles coexist with existing Super Admin, School Admin, Finance, and CEO roles; multi-role users are supported.
- Academic years, subjects, class enrolment history, teaching assignments, minimum foundation account management, explicit Parent/Student portal links, and guardian access/history fields.
- New modules use authenticated active sessions, permission middleware, `SchoolContext`, access services/policies, school-scoped queries, and transactional domain services.
- `students.class_id` remains for compatibility. Production dates, historical enrolments, account associations, and guardian access are never guessed or automatically activated.

## 3. Implemented Community App Slice

- Separate `app/` React/Vite workspace and deployment boundary.
- Parent, Student, Teacher, and authorized Staff role surfaces with a compact header and role-specific floating liquid-glass navigation.
- Community-style Home presentation, notifications, profile/settings, and sign out from More/Profile.
- Parent/Student self identity and enrolment access.
- Read-only Parent finance from authoritative Fee Record/payment/receipt data; no payment interface.
- Daily Attendance sessions and records, Teacher assignment-scoped roster marking, correction reasons, transactional audit, and scoped Parent/Student reads.

Community publishing/media, reactions/comments persistence, Assessments/results, Schedule, formal Quiz, Practice Quiz generation, payment reminders, and broader Parent Finance remain previews or planned modules. Preview UI is not evidence of backend completion.

## 4. Deployment Foundation

- CI sources, immutable release ZIP generation, pinned PHP/Nginx images, separate Admin/App Nginx services, private MariaDB Compose configuration, environment examples, health/deployment-info endpoints, and deployment contract tests are present.
- Real container startup on this workstation, stable hosting, edge TLS, remote promotion, monitoring, backup scheduling, runtime grants, and restore drills are not verified.
- The Quick Tunnel tooling is temporary demo transport, not production infrastructure.

## 5. Current Verification Evidence

Merged-result checks on 2026-08-13:

```text
Community App: 3 Vitest files, 16 tests passed; Oxlint passed; TypeScript/Vite build passed (76 modules)
Admin Panel: 15 Vitest files, 169 tests passed; Oxlint exit 0 with 9 known warnings; build passed (83 modules)
Backend: 255 tests discovered; 247 passed; 8 opt-in MariaDB tests skipped; 1,314 assertions
Pint: passed
API routes: 74 loaded
Deployment contracts: 18 passed
Responsive App QA: 39 role/page/viewport combinations; no horizontal overflow or undersized visible targets
```

The visual-refinement branch did not change backend schema, so it did not rerun MariaDB lifecycle checks. Phase A previously passed disposable MariaDB fresh migration, rollback/re-migration, existing-data upgrade, and foreign-key/index inspection. That evidence is not a claim about any production database.

## 6. Known Limitations and Gates

- No production deployment, capacity target, load test, monitoring, backup/restore drill, or production MariaDB upgrade has been verified.
- Guardian/account activation and academic/enrolment live-data backfill require explicit source review, dry runs, approval, and recovery plans.
- Discount formulas and eligibility are unapproved; non-zero-discount charge generation fails closed.
- Refunds, credits, overpayments, write-offs, general correction/recovery, statements, reminders, reports, exports, and server PDF remain incomplete.
- User lifecycle administration and password reset remain incomplete beyond minimum foundation account creation/role assignment.
- Native authentication, Sanctum, Firebase, Capacitor, Android/iOS packages, push delivery, and store publication are absent.

Use [Current Status](current-status.md) for detailed dated evidence, [Project Overview](project-overview.md) for scope, [System Architecture](SYSTEM_ARCHITECTURE.md) for runtime boundaries, and [MIS App Product Specification](mobile-app-product-spec.md) for the approved App direction.
