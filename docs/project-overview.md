# Project Overview

**Status:** Current implementation and confirmed product context

**Repository baseline:** Integrated delivery on `feat/admin-application-logs`; default `master` merge remains separate

**Reviewed:** 2026-08-27

## Business Purpose

The product is the owner's configurable school-software SaaS named **RYLAY**, using the registered primary domain `rylay.my`. It serves multiple customer tenants from one Laravel backend and authoritative MariaDB database; each tenant can contain multiple schools/campuses and has separate Admin/App domains, branding, features, memberships and role scopes. MIS is the first tenant/demo configuration. It is not yet a production-complete academic ERP.

All tenants share the same Admin/App code and backend release. Tenant variation is configuration-only through host-resolved `branding` and `features`; per-tenant code forks are not an approved customization mechanism.

The Admin workspace uses the owner's MAW-derived personal UI pattern as its default presentation contract. RYLAY retains its own school workflows, API data, permission enforcement, tenant branding, and burgundy selection/action colour; the reference supplies only layout, typography, surface, control, and motion behavior. The multi-role School App remains a separate visual and runtime surface.

## Intended Users

Platform administration uses the protected `users.is_platform_owner` Super Admin identity. School employees have exactly one position: `school-admin`, `finance`, or `teacher`. Finance inherits all School Admin defaults plus supported finance mutations. Teacher starts with assigned scope and may receive explicit same-school User Ability grants or denials. Parent and Student remain relationship/App identities; an employee may additionally be Parent.

The independent `app/` workspace exposes exactly Teacher, Parent, and Student personas. School Admin or Finance may use Teacher only when granted `app.teacher_access`; elevated tools remain controlled by effective backend permissions. Multi-persona users choose on first entry and the last local choice is remembered. Historical `ceo` and `tenant-owner` rows may remain after upgrade, but are no longer seeded or assignable. See [Permissions](permissions.md).

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
- Channel-neutral notification dispatch, an `in_app` channel that preserves existing portal behavior, and external destination configuration at exact global, tenant, or tenant-plus-school scope.
- Assignment-scoped daily Attendance sessions/records, Teacher roster marking, correction reasons and audit, linked-child Parent history reads, and explicit Student exclusion.
- Phone-first School App presentation with a compact header, role-specific liquid-glass bottom navigation, and profile-based sign out.
- Official School Updates: employees with `community.publish` create immediate whole-school or multi-class text/image updates, optionally notify the resolved audience, and audit publication. Teachers, Parents, and Students read authorized Updates and can Like or report them; comments and new direct-Student targeting are unavailable.

### Partially Implemented

- Dashboard: API-backed metrics are available to `fee_record.view`. School-bound users are forced to their own school. The seeded Super Admin is currently bound to the single seeded school; a multi-school selector is planned but not implemented.
- Students: backend profile update exists, but the frontend does not expose a complete student-profile edit workflow; guardian data is read-only in Student Detail.
- Parents: schema, relationships, and seed data exist; the top-level frontend is static and there are no parent CRUD APIs.
- Fee catalogue: read API and schema exist; the top-level page is static and no management API/UI exists.
- Fee Agreements: versions and snapshots work. Discount formulas are not approved, so agreements with non-zero discounts cannot preview or activate charges. Superseding is rejected if old charge history exists on or after the new effective month; no automated credit/recalculation workflow exists.
- Payments and receipts: real workflows are implemented within Student Detail; there are no separate top-level modules.
- Invoices: legacy schema and a permission/school-scoped monthly-generation API remain, but the active Fee Record workflow does not use invoices as its source of truth and no invoice UI exists.
- Audit: critical authentication, student, agreement, Fee Record activation/manual charge, payment, and receipt actions are covered. Calendar changes, exports, user management, generic correction, and recovery audit flows are not integrated because those features are lower-risk operational changes or absent from the current product.
- School App: login, role shell, notification drawer, self-service identity, read-only parent finance, daily Attendance, School Updates, published Assessment results, Schedule, and formal Quiz are functional slices. Historical Community comments, direct-Student posts, reports, and pending-review rows remain preserved storage, not active social workflows. Native/store delivery remains unimplemented.

### Approved Product Direction, Not Implemented

- Full user lifecycle administration, account status management, and password reset. The current Employees editor covers same-school Position, explicit User Abilities, and Teacher App Access changes, but it is not a complete account-administration module.
- General reports, exports, statements, automatic/external reminders, and server-generated PDF documents.
- Completion and product hardening of the mobile-first multi-role School App.
- Production hardening for Parent Finance, push delivery, and later native Android/iOS packaging in separately approved phases. Manual in-app payment reminders and formal Teacher-assigned Quiz are implemented web slices.
- External notification adapters such as Telegram, provider credentials, destination management UI, queues/outbox, retry/delivery history, and any Telegram user binding or login.
- Generic audit corrections, audit export, and recovery workflows beyond read-only event review.
- Refunds, credits, overpayments, write-offs, and approved financial correction workflows.
- Stable production hosting, remote CD/promotion, monitoring, scheduled backups, and a verified restore process. Repository-owned CI and deployment configuration now exist but require current runner/container evidence.
- Cross-school management reporting and complete multi-school tenant controls.

## Explicitly Out of Current Implementation Scope

Unless a future approved specification adds them, do not infer these from navigation labels or historical plans:

- Complete grading, examinations, learning management, admissions automation, HR/payroll, library, transport operations, and other full academic ERP modules. Daily class Attendance and campus entry/exit records are implemented slices; full timetable, lesson-event, and enterprise attendance operations remain out of scope.
- Provider-specific VPS provisioning, public domains, edge TLS/Basic Auth, Cloudflare, and live infrastructure state.
- Native mobile client code, native packaging, token authentication, Firebase, and app-store delivery. These remain future product phases.

## System Boundaries

- `frontend/` presents permission-scoped Admin workflows and rejects portal-only accounts. `app/` presents exactly Parent, Student, and Teacher personas; elevated employees remain in the Teacher persona through explicit User Abilities. The App is not native, and visible cards are not backend business-rule evidence.
- Laravel is authoritative for authentication, authorization, validation, school scoping, state transitions, numbering, and persisted finance effects.
- Admin Web and the School App share one Laravel backend, one MariaDB database, one RBAC/identity system, and the existing finance source of truth.
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
