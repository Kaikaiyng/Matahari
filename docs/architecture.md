# Architecture

**Status:** Current implementation reference

**Repository baseline:** Extensible Notification Channel foundation (2026-08-27)

## Tenant Boundary

The shared backend resolves an active tenant from an explicitly verified request hostname before authentication and business authorization. `TenantContext` contains tenant and surface; active membership then supplies tenant-specific roles and permitted schools. Client-supplied tenant IDs are not authoritative. Each school belongs to one tenant and existing business records continue to inherit tenant ownership through `school_id`.

Admin (`frontend/`) and App (`app/`) are separate builds on separate tenant domains. Each calls `/api/tenant-context`, rejects the wrong surface, and uses same-origin `/api` session/CSRF requests. See [SaaS Multi-Tenancy](saas-multitenancy.md).

Every tenant runs the same Admin and App source builds and the same Laravel backend. Tenant variation is limited to host-resolved `branding` and `features`; tenant-specific frontend copies, tenant branches, and tenant-specific authorization behavior are outside the architecture.

Laravel's `tenant.surface` middleware is the authoritative browser-surface boundary. Admin/platform/tenant-management and legacy finance APIs require `admin`; Community, Teacher, Assessment, Quiz and Portal APIs require `app`; tenant context and session bootstrap/authentication remain shared. A surface mismatch returns 404 and does not replace membership, permission, feature, school or resource authorization.

`UserPermissionResolver` is authoritative for middleware and `/api/me`. It combines active tenant-membership position defaults with same-school explicit grants/denials in `user_permission_overrides`; platform owners bypass school permission lookup. `EmployeeAccessService` locks the target, synchronizes legacy and membership position roles, materializes overrides, and writes required audit records in one transaction.

The App has three personas only: Teacher, Parent, and Student. `app.teacher_access` admits an elevated employee as Teacher, while school-wide tools retain their own permission gates and App-surface endpoints. Multi-persona users make an explicit first-use choice that is remembered on the device.

## High-Level Architecture

```mermaid
flowchart LR
    Browser["Admin browser: frontend/ React 19 + TypeScript"]
    Mobile["Independent app/ multi-role Community client"]
    Vite["Vite dev server or Preview"]
    API["Laravel 13 JSON API + host TenantContext"]
    DB["Shared SQLite demo/tests or authoritative MariaDB"]
    Files["File session store: local demo"]
    Memory["Array session store: tests"]
    Tunnel["Optional temporary demo tunnel"]

    Browser <-->|"local assets"| Vite
    Mobile -->|"/api/v1 self-service + teacher attendance"| API
    Browser -->|"same-origin /api + session/CSRF cookies"| Vite
    Browser <-->|"temporary public HTTPS"| Tunnel
    Tunnel <-->|"forwards to Preview"| Vite
    Vite -->|"default /api proxy"| API
    API -->|"Eloquent and transactions"| DB
    API -.->|"normal database sessions"| DB
    API -.->|"demo sessions"| Files
    API -.->|"test sessions"| Memory
```

The Admin frontend, multi-role Community App, and backend are separate applications. Laravel remains the shared security and persistence boundary; neither React client is authoritative for permissions or financial state. Both clients reuse the same API, database, identity/RBAC, and domain services rather than creating a second mobile backend.

## School Updates Boundary

School Updates always follow host-resolved tenant, active membership, effective ability, and school/audience scope. The client never submits a tenant or school ID as authority. Laravel resolves the whole-school or selected active-class audience and is authoritative for visibility, notification recipients, Likes, reports, logical withdrawal, and state transitions.

The feed returns the latest 50 visible Updates. A notification's stored `context_json.post_id` is resolved through a separate authenticated single-Update endpoint that repeats tenant/school scope and `findVisible` audience authorization before returning the record; this permits an older authorized notification target without broadening the feed or exposing another audience/school.

Effective same-school `community.publish` is sufficient to create an immediate official text Update with optional JPEG, PNG, or WebP images for the whole school or any active same-school class; no position or Teaching Assignment condition is layered on that ability. `community.view` permits an authorized audience member to read; `community.moderate` permits visibility and management of same-school Updates plus Post Report decisions, but does not by itself make a manager a class-notification recipient. Parent and Student personas never imply publishing and may read, Like, and report authorized published Updates. Whole-school delivery includes only active users with a valid Teacher, Parent, or active-Student App persona; class delivery additionally requires an active enrolment/link/assignment. The active client/API has no comments, direct-Student publishing, user blocking, restrictions, appeals, or routine approval. Historical Community storage remains readable only where compatibility requires it and is retained rather than deleted.

The App exposes public `/legal/*` routes backed by a no-session public API. Responses contain effective policy sections, tenant presentation and configured support contacts only—never report, reporter or evidence data.

## Notification Channel Boundary

Business services create immutable `NotificationMessage` values and send them through `NotificationDispatcher`. The dispatcher resolves registered `NotificationChannelContract` implementations; `InAppChannel` is currently the only concrete channel and retains `portal_notifications` as the user-facing read model. Existing notification APIs and App/Admin payloads are unchanged, and in-app insertion remains inside each producer's surrounding transaction.

`notification_destinations` is a channel-neutral external-address registry. Global records have no tenant or school, tenant records have only `tenant_id`, and school records carry both IDs with the existing composite tenant/school foreign key. A destination contains a channel key, neutral destination type/address, routing purpose, status, and non-secret configuration; it never represents or binds a RYLAY user.

No external adapter is registered, so unsupported channels are reported as skipped with sanitized diagnostics and cannot claim successful delivery. Telegram delivery, Bot tokens, Telegram user login/binding, destination CRUD/UI, queues, outbox, retries, and delivery history are **Planned, not implemented**. A future network adapter must not perform provider calls inside an originating business transaction; durable delivery requires a separately approved outbox/queue design.

## Backend Structure

- `routes/api.php`: JSON API routes with manually assembled cookie, session, and native CSRF middleware.
- `app/Http/Controllers/Api/`: HTTP orchestration and response payloads.
- `app/Http/Requests/`: input normalization, validation, and some school/route-model authorization.
- `app/Http/Middleware/EnsureUserHasPermission.php`: permission-slug enforcement.
- `app/Http/Middleware/EnsureUserIsActive.php`: rechecks user status for every authenticated API request.
- `app/Support/SchoolScopeResolver.php`: trusted school resolution for the dashboard and legacy invoice workflow.
- `app/Support/SchoolContext.php` and `ResolveSchoolContext`: consistent school resolution for new Phase A `/api/v1` modules.
- `app/Policies/`: Phase A academic and portal-link resource authorization.
- `app/Services/Foundation/`: academic foundation, teacher scope, portal-link, and minimum foundation-account transactions.
- `app/Services/Attendance/`: teaching-assignment-scoped class Attendance, append-only campus movements, guardian notifications, time-bound abilities, and transactional audit.
- `app/Services/FeeAgreements/`: agreement creation and superseding transactions.
- `app/Services/Billing/`: Fee Record generation/summary, payment, receipt, numbering, manual in-app payment reminders, and legacy invoice services.
- `app/Services/Audit/` and `app/Audit/`: audit events, trusted context, sanitization, and persistence.
- `app/Services/Operations/ApplicationLogReader.php`: bounded read-only parsing, filtering, normalization, pagination, and sanitization for Laravel application logs.
- `app/Services/Notifications/`: channel-neutral messages/targets, dispatch coordination, and the current in-app delivery channel.
- `app/Models/`: Eloquent entities and relationships.
- `database/migrations/`: schema history and corrective migrations.
- `database/seeders/`: demo school, users, roles, permissions, fees, and scenarios.

Legacy authorization remains primarily route middleware plus distributed scope checks. New Phase A modules use policies/access services and `SchoolContext`; this is the required pattern for future mobile/self-service modules.

## Frontend Structure

- `src/App.tsx`: authentication state, permission-filtered navigation, Dashboard, Student Detail, finance workspaces, summary pages, and most API orchestration.
- `src/api.ts`: same-origin credentialed JSON `fetch`, CSRF bootstrap/header/retry behavior, normalized API errors, and validation-error parsing.
- `src/components/AdminShell.tsx` and `AdminUi.tsx`: shell and shared administrative UI primitives.
- `src/components/CalendarPage.tsx`: calendar workflow and permission visibility.
- `src/components/ClassesPage.tsx`: read-only class directory and rosters.
- `src/features/fee-agreements/`: Fee Agreement editor and form model.
- `src/features/payments/`: payment allocation editor and allocation model.
- `src/features/audit/`: read-only Audit Trail list, filters, cursor pagination, and detail view.
- `src/features/logs/`: Super Admin-only sanitized Application Logs summary, filters, pagination, and expandable context.
- `src/features/settings/`: responsive Admin Settings workspace. It composes existing tenant Branding and Attendance Settings APIs, keeps school/account context read-only where no mutation API exists, and links access management to Employees.

The application does not use React Router, Redux, React Query, or another global data layer. Page selection is component state, so there are no deep links or browser-history routes. Data fetching uses local state/effects and the shared API wrapper.

The Admin Sidebar uses MAW-style navigation behavior with MIS branding: standalone primary destinations, icon-led accordion module groups, indented text subitems, a full desktop slide-away control, and the existing mobile drawer. Group and desktop-collapse preferences are local presentation state only; they never replace backend authorization.

The Settings workspace follows the same MAW-inspired information architecture while retaining MIS/RYLAY colours and controls. Branding changes update the in-memory tenant context after a successful backend save so the current Admin title and CSS variables refresh without a reload. Attendance times and guardian campus-notification switches intentionally share the authoritative Attendance Settings payload; Notifications does not introduce a second settings store or expose planned external destinations.

The Admin shell owns shared `--admin-card-*` presentation tokens for radius, border, surface depth, hover depth, and inset surfaces. Dashboard is the canonical card reference: shared statistic cards keep text on the left and their soft semantic icon tile on the right. `StatCard`, `DataPanel`, toolbars, Dashboard panels, and established domain-card selectors consume the same tokens so Students, Classes, Finance, Attendance, Calendar, Audit/Application Logs, Settings, and moderation do not develop separate card languages. Admin typography uses Plus Jakarta Sans throughout the shell, pages, forms, tables, and dialogs, with JetBrains Mono reserved for technical log content. The final Admin-only typography layer follows the verified MAW source scale: 24px page, 18px section/dialog, 15px card, 14px body copy, 13px form/table/navigation, 12px supporting, 11px eyebrow/table heading, and 24px metric text. Shell density also follows MAW with a 56px utility bar, 80px brand area, centred 1600px content maximum, and 32px by 24px desktop content padding. These tokens and fonts are scoped to Admin and do not affect `app/`.

`frontend/` and `app/` are independent React workspaces. Admin and the Community App are built and deployed separately on different domains, while each domain reverse-proxies its own `/api` path to the same Laravel backend. This same-origin browser topology preserves the existing session-cookie and CSRF model. A native workspace and store packaging do not exist yet.

The App exposes Updates without turning `app/` into an administrative back door. Employee publication is whole-school or school/class-audience scoped and permission-gated; attendance and academic mutations remain teaching-assignment scoped; Parent/Student reads remain relationship or self scoped. Post Reports management remains in `frontend/`.

## Authentication Flow

1. The frontend obtains `/api/csrf-cookie` before a mutation when no `XSRF-TOKEN` cookie is present and sends the decoded value in `X-XSRF-TOKEN`.
2. `POST /api/login` receives username/password through native request-forgery protection.
3. `LoginRequest` trims and lowercases the username and validates its format.
4. Login attempts are limited to five per 60 seconds by normalized username plus client IP. Successful login clears the limiter key.
5. Laravel's `web` session guard checks the password. A successful login regenerates the session ID; a non-`active` user receives the same generic failure as bad credentials.
6. `/api/me` restores the user and returns role slugs plus the union of role permissions.
7. `EnsureUserIsActive` reloads status on authenticated requests; deactivation invalidates an existing session and returns 401.
8. Logout invalidates the session and regenerates its token.

Configuration defaults include an eight-hour session lifetime, database sessions outside tests, `HttpOnly` cookies, SameSite `lax`, environment-controlled secure cookies, and no session payload encryption.

Deployment limitations remain: secure-cookie flags, trusted proxy behavior, CORS, shared rate-limit/session storage, HTTPS termination, and multi-instance topology are environment-specific and **Not verified**.

Mobile Web must initially preserve the reviewed browser session/CSRF model. Native authentication is a later security decision; Sanctum is only a candidate for separate evaluation and is not currently installed. Custom JWT authentication is not an approved direction.

## Authorization Flow

Standard protected request flow:

```text
cookie/session middleware
  -> CSRF verification for mutations
  -> auth
  -> active-user check
  -> permission:<slug>
  -> request/controller/service school-scope checks
  -> domain transaction
```

`User::hasPermissionTo()` resolves permissions through the user's roles. Frontend navigation and actions use the returned permission slugs for usability, while backend middleware remains authoritative. Dashboard and monthly invoice routes now require `fee_record.view` and `fee_record.generate` respectively and resolve school/actor from trusted context.

New Phase A modules use a consistent chain under `/api/v1`: authenticated active user, permission middleware, `ResolveSchoolContext`, resource policy/access service, school-scoped query, and transactional domain service. Self-service callers do not provide their own school scope. Legacy endpoints retain their current distributed checks and can migrate incrementally.

Teacher roster access requires an active/current teaching assignment matching the authenticated teacher, school, academic year, class, and subject. Portal identity linking requires exact same-school users with the required role; it never uses guessed personal-data matching.

Class Attendance uses current teaching scope. A Teacher can create or update one `daily` session for an assigned class/date; time-bound abilities can separately broaden school visibility or management. Campus Attendance is an independent append-only entry/exit stream and does not silently create lesson/class decisions. Admin endpoints remain behind the Admin surface, resolved school context, tenant feature, and dedicated permission middleware. Parent campus/class reads require an active guardian-child link with `can_view_academics = true`; Student Attendance is not exposed. React role visibility is not the authorization boundary.

Gate entry is currently an authenticated Admin API integration, not a public hardware endpoint. It serializes daily-session creation by class, leaves the session `in_progress`, and treats repeated student/session scans as idempotent. Device-signature authentication, replay protection, and exit-event processing are **Planned, not implemented**.

## Request and Validation Flow

- Form Requests validate most mutation payloads and normalize selected values.
- Route permission middleware rejects missing permissions with HTTP 403.
- Controllers load school-scoped records or delegate to services.
- Financial services use transactions and row locks where sequencing or concurrent balances matter.
- Tenant-owned fee items, allocations, classes, and selected discount items are validated against the resolved school before persistence.
- Laravel renders exceptions as JSON for `api/*` requests and adds the request UUID header when available.

Form Request `authorize()` commonly returns `true`; the route permission and later scope checks remain essential. Validation rules and persisted strings are not always backed by database enums/checks.

## Domain Logic Placement

- Fee Agreement versioning belongs in `FeeAgreementVersioningService`.
- Fee Record generation/manual charge/summary/category logic belongs under `Services/Billing`.
- Payment allocation, verification, and void reversal belong in `PaymentRecordingService`.
- Receipt eligibility, snapshots, voiding, and number sequencing belong in `ReceiptGenerationService` and `ReceiptNumberService`.
- Legacy monthly invoice generation remains separate and is not the active Fee Record source of truth.
- Fee Record activation and manual charges own their transactions and required audit inserts.

Controllers should not duplicate these invariants. New material financial mutations must write an allowlisted audit event inside the same transaction.

## API Conventions

- API base path: `/api`.
- JSON requests/responses with Laravel validation errors (HTTP 422).
- Authentication failures use 401; permission/school-scope failures use 403; conflicting charge history uses 409; CSRF mismatch uses 419; login throttling uses 429.
- Resource payloads frequently use a named top-level key; lists may use `data` plus metadata.
- Route models and explicit integer IDs are both present; conventions are not completely uniform.
- Existing legacy routes use `/api`; new foundation and future self-service modules use `/api/v1`.

## Error Handling

The frontend API client preserves backend messages/validation details for non-5xx responses and replaces server failures with a generic service-unavailable message. Page components handle loading, empty, permission, and error states with varying completeness. Session restoration failures currently return the user to the login screen even when the failure is not 401.

## Audit Architecture

Implemented:

- UUIDv7 request IDs and `X-Request-ID` response header.
- Typed audit action/module/context objects.
- Secret-key payload sanitization.
- Central `AuditLoggerContract`/`AuditLogger` binding.
- Secure audit columns, indexes, event UUID uniqueness, legacy backfill, and Eloquent instance immutability.
- Required transactional events for student create/update/status, agreement create/supersede, Fee Record activation/manual charges, payment record/verify/void, receipt issue/void, and manual payment-reminder send.
- Required transactional events for daily attendance submission and correction.
- Best-effort login success/failure/logout events with a dedicated redacted security-log fallback if audit storage fails.
- `GET /api/audit-logs` and `GET /api/audit-logs/{auditLog}` with validated strict filters, broad identifier search, global read-only summary metadata, stable cursor pagination, output re-sanitization, and `audit.view` backend enforcement.
- A permission-visible, read-only Audit Trail UI for Super Admin using the MAW operational-page structure: compact summaries and filters, dense rows, and an inline sanitized before/after/metadata inspector.
- `audit.view` and `audit.correct_generic` permissions seeded only to Super Admin; correction is not implemented.

Planned, not implemented:

- Generic correction workflow, audit export, and business-specific recovery operations.
- Events for future user management, reports/exports, refunds, credits, write-offs, and other workflows that do not currently exist.
- Verified production runtime database grants and restored-backup reconciliation.

Model guards do not prevent query-builder/raw SQL/DBA mutation. Production least-privilege requirements are in [Audit Log Operations](AUDIT_LOG_OPERATIONS.md).

## Application Log Viewer

`GET /api/application-logs` is a read-only Admin-surface endpoint protected by `logs.view`, which is assigned only to Super Admin by the migration and demo seeder. `ApplicationLogReader` reads only `laravel*.log` files from the configured log directory, parses single-line Laravel events, normalizes levels to `INFO`, `WARN`, `ERROR`, or `FATAL`, caps the in-memory result set, and applies validated filters and pagination.

The response runs structured context through the existing audit payload sanitizer and redacts credential-like assignments from message text. Multiline stack-trace continuation lines, security-channel files, raw request bodies, headers, cookies, credentials, and tokens are not returned. The MAW-style viewer presents only truthful response metadata, level counts, source/environment values and an inline dark context inspector. Unsupported archive, download, export, auto-refresh and server-health operations are not shown. The viewer is operational diagnostics; business actor/change history remains authoritative only in Audit Trail.

## External Services

No external business API, payment gateway, email provider, object storage service, analytics service, or identity provider is integrated. Laravel mail defaults to logging in the example environment.

Firebase/FCM, APNs, Telegram, and device registration are later delivery concepts only. A neutral external destination registry exists, but no provider adapter, credential, device-token/user-binding storage, queue/outbox, or external delivery runtime is implemented.

`tools/public-demo/` can download a pinned/checksummed `cloudflared` executable and expose Vite Preview through a temporary Quick Tunnel. This is demo-only and not a production dependency.

## Deployment Assumptions

The repository now contains GitHub Actions qualification source, a pinned PHP-FPM image, an internal Nginx application configuration, generic Docker Compose definitions for a private MariaDB service and isolated staging/production application stacks, non-secret environment contracts, and immutable release tooling. The implemented topology is described in [Deployment Foundation](deployment-foundation.md).

No real VPS, Docker runtime, edge TLS/Basic Auth, remote release directories, production database, backup destination, restore drill, or monitoring service is verified. A real deployment must still provide HTTPS and exact proxy trust, private secret files, migrations with separate identities, automatic staging delivery, manual exact-artifact production promotion, backup/recovery, logging, and alerts.

**Not verified:** Any deployed environment or production readiness.

## Related Documentation

- [Project Overview](project-overview.md)
- [Business Rules](business-rules.md)
- [Database](database.md)
- [Permissions](permissions.md)
- [Current Status](current-status.md)
- [Deployment Foundation](deployment-foundation.md)
- [Mobile Product Architecture and Roadmap](mobile-product-roadmap.md)
