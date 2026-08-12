# Project Overview

**Status:** Current implementation and confirmed product context

**Repository baseline:** `8b65469e96a81551d9c7cac4cf10c44ab6342761`

**Reviewed:** 2026-08-03

## Business Purpose

Matahari supports administrative and finance workflows for Matahari International School. The present product is an internal school administration and finance MVP intended for workflow demonstration and continued development. It is not a complete academic ERP.

## Intended Users

The seeded implementation contains these stored role slugs:

- `super-admin` — Super Admin.
- `school-admin` — School Admin.
- `finance` — Finance.
- `ceo` — CEO.

The intended CEO concept has been described as management or print-only access, but the current seed grants only Fee Record view and Calendar view permissions. It does not grant receipt printing. See [Permissions](permissions.md).

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

### Partially Implemented

- Dashboard: API-backed metrics are available to `fee_record.view`. School-bound users are forced to their own school. The seeded Super Admin is currently bound to the single seeded school; a multi-school selector is planned but not implemented.
- Students: backend profile update exists, but the frontend does not expose a complete student-profile edit workflow; guardian data is read-only in Student Detail.
- Parents: schema, relationships, and seed data exist; the top-level frontend is static and there are no parent CRUD APIs.
- Fee catalogue: read API and schema exist; the top-level page is static and no management API/UI exists.
- Fee Agreements: versions and snapshots work. Discount formulas are not approved, so agreements with non-zero discounts cannot preview or activate charges. Superseding is rejected if old charge history exists on or after the new effective month; no automated credit/recalculation workflow exists.
- Payments and receipts: real workflows are implemented within Student Detail; there are no separate top-level modules.
- Invoices: legacy schema and a permission/school-scoped monthly-generation API remain, but the active Fee Record workflow does not use invoices as its source of truth and no invoice UI exists.
- Audit: critical authentication, student, agreement, Fee Record activation/manual charge, payment, and receipt actions are covered. Calendar changes, exports, user management, generic correction, and recovery audit flows are not integrated because those features are lower-risk operational changes or absent from the current product.

### Planned, Not Implemented

Phase A foundation now defines teacher/parent/student roles, scoped academic records, and explicitly reviewed nullable portal identity links; it does not activate a portal or add native/mobile authentication.

- Full user/role administration, account status management, and password reset. Phase A provides only minimum account creation and teacher/parent/student role assignment.
- General reports, exports, statements, reminders, and server-generated PDF documents.
- Parent portal and communications.
- Generic audit corrections, audit export, and recovery workflows beyond read-only event review.
- Refunds, credits, overpayments, write-offs, and approved financial correction workflows.
- Stable production hosting, remote CD/promotion, monitoring, scheduled backups, and a verified restore process. Repository-owned CI and deployment configuration now exist but require current runner/container evidence.
- Cross-school management reporting and complete multi-school tenant controls.

## Explicitly Out of Current Scope

Unless a future approved specification adds them, do not infer these from navigation labels or historical plans:

- Attendance, grading, examinations, timetabling, learning management, admissions automation, HR/payroll, library, transport operations, and other complete academic ERP modules.
- Provider-specific VPS provisioning, public domains, edge TLS/Basic Auth, Cloudflare, and live infrastructure state.
- Mobile applications.

## System Boundaries

- React presents administration workflows and client-side usability checks.
- Laravel is authoritative for authentication, authorization, validation, school scoping, state transitions, numbering, and persisted finance effects.
- MariaDB/MySQL-compatible behavior is the production direction. SQLite supports the local demo and default automated tests only.
- The application models school ownership with `school_id`. A shared resolver protects the dashboard and legacy invoice paths, while other scope checks remain distributed across controllers, requests, and services; there is no global tenant middleware.
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
