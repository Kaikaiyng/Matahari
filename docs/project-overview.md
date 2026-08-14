# Project Overview

**Status:** Current implementation and confirmed product context

**Repository baseline:** SaaS feature branch based on merged `master` at `0ad0558`

**Reviewed:** 2026-08-14

## Business Purpose

The product is the owner's configurable school-software SaaS named **RYLAY**, using the registered primary domain `rylay.my`. It serves multiple customer tenants from one Laravel backend and authoritative MariaDB database; each tenant can contain multiple schools/campuses and has separate Admin/App domains, branding, features, memberships and role scopes. MIS is the first tenant/demo configuration. It is not yet a production-complete academic ERP.

## Intended Users

The seeded implementation contains these stored role slugs:

- `tenant-owner` — manages configuration and memberships for the active tenant only.

- `super-admin` — Super Admin.
- `school-admin` — School Admin.
- `finance` — Finance.
- `ceo` — CEO.

The intended CEO concept has been described as management or print-only access, but the current seed grants only Fee Record view and Calendar view permissions. It does not grant receipt printing. See [Permissions](permissions.md).

Phase A also adds the `teacher`, `parent`, and `student` role slugs without replacing existing assignments. A user may hold multiple roles. The independent `app/` web workspace presents Parent, Student, Teacher, and authorized Staff experiences, but this does not make preview modules or a native application complete.

Platform administration is not a tenant role. It uses the explicit `users.is_platform_owner` flag. Users are global identities, while tenant membership roles and permitted schools are resolved for the request hostname. See [SaaS Multi-Tenancy](saas-multitenancy.md).

## Intended Scale

Historical project material used approximately 200 students only for operating-cost estimation. No repository evidence defines that value as a supported maximum, and no formal load, concurrency, or capacity limit has been validated.

**Not verified:** Maximum student count, concurrent users, transaction throughput, database size, and response-time targets.

Do not describe the system as unlimited or use the historical cost estimate as performance evidence.

## Current MVP Scope

### Implemented

- Username login/logout/session restoration, CSRF-protected mutations, login throttling, active-session status checks, and seeded role-permission lookup.
- Student list, search, filters, creation, details, backend profile update, and lifecycle status changes.
- Read-only class directory and active-student rosters.
- Versioned Fee Agreement creation, history, detail, and superseding.
- Fee Agreement item billing configuration and discount snapshots.
- Fee Record preview, activation, manual charges, outstanding balances, summary, and category-month ledger.
- Student-centred payment recording, allocation, verification, void reversal, and history.
- Receipt issue, snapshot items, browser print view, void, regeneration, and history.
- School calendar list/create/update/delete.
- Permission-filtered responsive application shell and admin UI.
- Temporary local/public demo tooling.
- Audit schema, logger, sanitizer, request IDs, model-level append-only guards, critical authentication/student/finance event integration, a read-only API, and a Super Admin Audit Trail UI.
- Backend permission and authenticated-school enforcement for the legacy dashboard and monthly invoice endpoints.
- Database guards for one current Fee Agreement per school/student/year and one scheduled charge per agreement item/month.
- Phase A teacher/parent/student roles, reviewed nullable portal links, academic years, enrolment history, subjects, teaching assignments, scoped `/api/v1` management/teacher APIs, policies/access services, and transactional foundation audit events.
- MIS-branded demo identities for Admin, Teacher, Parent, and Student; an independent role-filtered `app/` web shell; self-profile/enrolment endpoints; and user-scoped in-app notification storage.
- Assignment-scoped daily Attendance sessions/records, Teacher roster marking, correction reasons and audit, and scoped Parent/Student history reads.
- Phone-first Community App presentation with a compact header, role-specific liquid-glass bottom navigation, and profile-based sign out.

### Partially Implemented

- Dashboard: API-backed metrics are available to `fee_record.view`. School-bound users are forced to their own school. The seeded Super Admin is currently bound to the single seeded school; a multi-school selector is planned but not implemented.
- Students: backend profile update exists, but the frontend does not expose a complete student-profile edit workflow; guardian data is read-only in Student Detail.
- Parents: schema, relationships, and seed data exist; the top-level frontend is static and there are no parent CRUD APIs.
- Fee catalogue: read API and schema exist; the top-level page is static and no management API/UI exists.
- Fee Agreements: versions and snapshots work. Discount formulas are not approved, so agreements with non-zero discounts cannot preview or activate charges. Superseding is rejected if old charge history exists on or after the new effective month; no automated credit/recalculation workflow exists.
- Payments and receipts: real workflows are implemented within Student Detail; there are no separate top-level modules.
- Invoices: legacy schema and a permission/school-scoped monthly-generation API remain, but the active Fee Record workflow does not use invoices as its source of truth and no invoice UI exists.
- Audit: critical authentication, student, agreement, Fee Record activation/manual charge, payment, and receipt actions are covered. Calendar changes, exports, user management, generic correction, and recovery audit flows are not integrated because those features are lower-risk operational changes or absent from the current product.
- Community App: login, role shell, notification drawer, self-service identity, read-only parent finance, and daily Attendance are functional slices. Additive Community, Assessment, and Quiz tables now reserve the approved persistence model, while publishing/media delivery, result publication, formal/Practice Quiz services, and Schedule remain explicitly labelled previews.

### Approved Product Direction, Not Implemented

- Full user/role administration, account status management, and password reset. Phase A provides only minimum account creation and teacher/parent/student role assignment.
- General reports, exports, statements, reminders, and server-generated PDF documents.
- Completion and product hardening of the mobile-first multi-role Community App.
- Production Parent Finance, manual payment reminders, teacher Quiz, push delivery, and later native Android/iOS packaging in separately approved phases.
- Generic audit corrections, audit export, and recovery workflows beyond read-only event review.
- Refunds, credits, overpayments, write-offs, and approved financial correction workflows.
- Stable production hosting, remote CD/promotion, monitoring, scheduled backups, and a verified restore process. Repository-owned CI and deployment configuration now exist but require current runner/container evidence.
- Cross-school management reporting and complete multi-school tenant controls.

## Explicitly Out of Current Implementation Scope

Unless a future approved specification adds them, do not infer these from navigation labels or historical plans:

- Grading, examinations, timetabling, learning management, admissions automation, HR/payroll, library, transport operations, and other complete academic ERP modules. Daily Attendance is the only implemented attendance slice; lesson/event UI and broader attendance operations remain out of scope.
- Provider-specific VPS provisioning, public domains, edge TLS/Basic Auth, Cloudflare, and live infrastructure state.
- Native mobile client code, native packaging, token authentication, Firebase, and app-store delivery. These remain future product phases.

## System Boundaries

- `frontend/` presents Admin workflows and rejects portal-only accounts. `app/` presents Parent, Student, Teacher, and authorized Staff role surfaces. The App is not native, and preview cards are not backend business-rule evidence.
- Laravel is authoritative for authentication, authorization, validation, school scoping, state transitions, numbering, and persisted finance effects.
- Admin Web and the Community App share one Laravel backend, one MariaDB database, one RBAC/identity system, and the existing finance source of truth.
- MariaDB/MySQL-compatible behavior is the production direction. SQLite supports the local demo and default automated tests only.
- The application models school ownership with `school_id`. New Phase A modules use `SchoolContext`, middleware, policies/access services, and school-scoped queries; legacy checks remain distributed and can migrate incrementally.
- No third-party business system integration is present. The public demo tunnel is temporary transport, not a domain service.

## Operational Assumptions

- Local development is Windows-oriented because project PHP and demo launchers are PowerShell/Command Prompt scripts.
- The local demo database is disposable SQLite seeded with fictional scenarios.
- A deployed environment must provide private configuration, MariaDB, secure session/cookie settings, least-privilege database identities, backups, restore testing, monitoring, and HTTPS.
- **Not verified:** A production environment, release process, runtime database grants, proxy trust configuration, or backup/restore drill.

## Related Documentation

- [Business Rules](business-rules.md)
- [Architecture](architecture.md)
- [Database](database.md)
- [Permissions](permissions.md)
- [Current Status](current-status.md)
- [Testing and Release](testing-and-release.md)
- [Mobile Product Architecture and Roadmap](mobile-product-roadmap.md)
