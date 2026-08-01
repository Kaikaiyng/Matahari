# Secure Audit, Correction, Authorization, and Recovery Design

**Date:** 2026-07-31
**Status:** Approved in principle; written design pending final user review
**Scope:** Program architecture plus detailed design for Phase 1, the audit foundation

## 1. Purpose

Matahari needs reliable evidence for security-sensitive and financial changes before production use. The system must answer who acted, which roles they held, what changed, when and where the change came from, and why a correction occurred. Corrections must preserve the original record and must not turn the audit system into a universal undo feature.

The source requirements are directionally sound but cannot be implemented as one change. They span independent subsystems: audit storage, request context, authorization, existing business-flow integration, a read-only Audit Log Centre, generic field restoration, domain-specific financial corrections, user administration, operational logging, and disaster recovery. This design decomposes that work so every phase produces independently testable software.

## 2. Repository Facts That Govern the Design

- The backend declares Laravel `^13.8`, PHP `^8.3`, and PHPUnit `^12.5.12`.
- The frontend uses React 19, TypeScript 6, Vite 8, and Vitest.
- `audit_logs` and `App\Models\AuditLog` already exist. The audit schema must be upgraded with forward-only additive migrations; it must not be created a second time.
- The current audit columns are `school_id`, `user_id`, `action`, `entity_type`, `entity_id`, `old_values`, `new_values`, `ip_address`, `user_agent`, and normal timestamps.
- Users have a many-to-many role relationship. Audit actor roles must therefore be stored as a role-slug array unless a later migration enforces single-role membership.
- The permission middleware and permission slugs are the repository's backend authorization pattern.
- Payment, receipt, and Fee Agreement services already use database transactions and row locks. Audit writes for those flows must be added inside the existing transactions.
- Student profile and status updates currently occur directly in controllers. They must move behind transactional application services before critical audit writes are added.
- PHPUnit currently runs against in-memory SQLite. SQLite remains the fast test database, but MariaDB integration tests are required for JSON, migration, index, row-lock, and concurrency claims.
- Super Admin account administration, role changes, and staff password reset remain design-only. Their audit events cannot be claimed as implemented until that subsystem exists.
- The current CEO seed grants calendar write permissions even though the product requirement describes CEO as report-only. That existing conflict must be resolved explicitly in the authorization phase.

## 3. Security Claim and Threat Model

The application will provide an **append-only audit log under the application-runtime threat model**:

1. No HTTP update or delete route exists for audit records.
2. The `AuditLog` model rejects normal instance update and delete operations.
3. All application writes go through one logger interface.
4. Production runtime database credentials are documented to have only `SELECT` and `INSERT` privileges on `audit_logs`; deployment credentials remain separate.
5. Audit backups and database binary logs provide recovery evidence outside the live application database.

Laravel model events alone are not an immutability boundary because bulk queries, quiet model methods, raw SQL, and database administrators can bypass them. The product must not describe the table as cryptographically immutable. A database administrator with sufficiently broad credentials remains capable of alteration. Cryptographic tamper evidence or an external WORM log sink is not part of Phase 1; it may be added later only if regulatory or contractual requirements demand it.

## 4. Program Phases

### Phase 1: Audit Foundation

Deliver an additive schema migration, request and execution context, recursive secret filtering, a typed audit event interface, append-only model behavior, Super Admin audit permissions, and SQLite plus MariaDB-focused tests. No Audit Log UI or correction endpoint is introduced.

### Phase 2: Existing Business-Flow Coverage

Integrate explicit audit events into already implemented flows:

- login success, login failure, and logout;
- student create and profile update;
- current student status update;
- Fee Agreement create and supersede;
- payment record, verify, and void;
- receipt issue and void.

Payment, receipt, and Fee Agreement audit writes occur inside their existing transactions. Student writes first move into focused transactional services. Authentication logging is best-effort and falls back to the dedicated security log channel so an audit insert failure cannot prevent login failure handling or logout.

### Phase 3: Read-Only Audit Log Centre

Add Super Admin-only list, detail, subject-history, related-event, and batch-event APIs. The APIs use permission middleware, explicit resources, stable subject aliases, strict filter validation, maximum page size, and `(created_at, id)` cursor pagination. Add the React route, navigation entry, filters, diff display, related links, and authorization/error states. No correction action is exposed in this phase.

### Phase 4: Low-Risk Generic Correction

Add a server-side eligibility matrix for explicitly approved non-financial fields. Each field has a type adapter that normalizes database and audit values before conflict checks. A correction requires a reason, locks the subject row, rejects stale values with HTTP 409, applies all requested fields atomically, and appends a linked correction event inside the same transaction. There is no force option and no arbitrary field name accepted from the client.

Initial eligible fields are limited to fields that exist in the current model:

- Student: `notes`

Guardian phone, email, address, and emergency contact may be added only after the existing parent/guardian update flow is implemented and audited. Status, class/level, roles, money, Fee Agreements, payments, receipts, discounts, and dates affecting billing are never generic-restoration fields.

### Phase 5: Domain Corrections and User Administration

Implement separate workflows, each with its own design and test matrix:

- Student status correction based on an approved state-transition and dependency decision table.
- Fee Agreement correction by creating a new version from a chosen historical version.
- Payment correction through receipt void, payment void or reversal, balance recalculation, and re-entry.
- Receipt replacement using a new receipt number and an explicit replacement link.
- User role correction and staff password reset after Super Admin account administration exists.

These workflows reuse the audit foundation but do not share a universal rollback endpoint.

### Phase 6: Operations, Recovery, and Pre-Launch Evidence

Complete production logging guidance, runtime database grants, backup and restore documentation, release rollback documentation, a MariaDB restore drill, and the pre-launch security checklist. The initial recovery targets are:

- RPO: no more than 15 minutes of committed production data loss during operating hours, using daily backups plus MariaDB binary logs.
- RTO: service restored to a verified temporary or production environment within four hours.

Backups include the database, uploaded business documents, and separately protected application encryption keys. A backup is not accepted as valid until a restore drill verifies authentication, students, Fee Agreements, payments, receipts, roles, audit records, and financial totals.

## 5. Phase 1 Detailed Architecture

### 5.1 Additive Schema

The existing identifiers remain to minimize migration risk:

- `user_id` remains the nullable actor foreign key.
- `entity_type` and `entity_id` remain the nullable audited-subject identity.

The migration adds:

- `event_uuid`: server-generated UUID, unique and required for all post-migration events;
- `request_id`: server-generated UUID shared by events from one HTTP request;
- `batch_id`: nullable UUID for imports, commands, and batch work;
- `actor_username`: nullable username snapshot;
- `actor_roles`: nullable JSON array of sorted role slugs;
- `module`: stable module slug;
- `metadata`: nullable JSON after allowlisting and redaction;
- `reason`: nullable text;
- `related_audit_id`: nullable self-reference to the originating audit event;
- `route_name`: nullable route snapshot;
- `http_method`: nullable HTTP verb;
- `context_type`: one of `http`, `console`, `queue`, or `system`;
- `schema_version`: positive integer describing the audit payload format.

Existing `old_values` and `new_values` remain JSON. New events store changed fields only. `updated_at` remains on legacy schema for compatibility but is never changed after insert.

The migration runs in stages: add nullable columns, backfill a unique `event_uuid` and legacy context values in bounded chunks, create indexes, and then enforce the post-migration invariants that are portable across SQLite and MariaDB. Migration tests cover both a fresh database and an upgrade from the current schema with existing audit rows.

Stable `entity_type` values are application aliases such as `student`, `fee_agreement`, `payment`, `receipt`, and `user`; PHP class names are not stored as the public subject contract.

### 5.2 Components

`AuditEvent` is an immutable data object containing action, module, affected school ID, subject alias and ID, changed values, reason, related event ID, batch ID, and safe metadata. The affected school comes from the business record, not merely from the actor.

`AuditContext` is an immutable data object containing request ID, context type, actor ID, username snapshot, role snapshots, actor school ID, IP address, user agent, route, and HTTP method.

`AuditContextFactory` creates HTTP context from the authenticated request and creates explicit system context for console, queue, and maintenance work.

`RequestIdMiddleware` generates a UUID for every HTTP request, stores it in the request attributes/container context, and returns it in the `X-Request-ID` response header. A client-supplied value is never authoritative.

`AuditPayloadSanitizer` recursively handles arrays and objects, treats sensitive keys case-insensitively, and rejects passwords, password hashes, confirmation values, tokens, OTP values, session identifiers or payloads, CSRF values, authorization headers, cookies, API keys, credentials, full headers, file contents, and raw request bodies. Domain integrations pass action-specific allowlisted fields before the sanitizer applies the denylist.

`AuditAction` and `AuditModule` are string-backed enums. They define the stable values used by writers, filters, API resources, and tests. Controllers and services do not invent free-form action or module names.

`AuditLoggerContract::record(AuditEvent $event, AuditContext $context): AuditLog` is the only application interface that inserts rows. A contract is used so transaction-failure tests can replace the logger with an implementation that throws.

`AuditLogger::record` validates stable action/module/subject aliases, sanitizes values and metadata, generates `event_uuid`, and inserts exactly one record. It stores `AuditEvent.schoolId` as the affected school and falls back to the actor school only when the event has no explicit affected school. It never accepts actor, role, IP, route, method, timestamp, or request ID from frontend payloads.

### 5.3 Data Flow

```text
HTTP request
  |
  +--> RequestIdMiddleware ----> server request UUID ----> response header
  |
  +--> auth + permission middleware
  |
  +--> controller
         |
         +--> transactional domain service
                |
                +--> lock/read current domain state
                +--> perform business mutation
                +--> build AuditEvent from explicit changed fields
                +--> AuditContextFactory from trusted server context
                +--> AuditLoggerContract::record()
                |
                +--> commit both, or roll back both on any exception

Authentication event
  |
  +--> attempt/login/logout
  +--> best-effort audit insert
  +--> on audit failure: security log + operational counter
  +--> authentication response still completes safely
```

### 5.4 Authorization

Phase 1 adds these permission slugs:

- `audit.view`
- `audit.correct_generic`

Only Super Admin receives them. No Audit Log route is created in Phase 1, but the permissions and authorization tests establish the boundary for subsequent phases. Later domain corrections require both the domain permission and the relevant audit correction permission; possessing `audit.view` never grants mutation rights.

Audit API routes place Laravel authentication middleware before permission middleware. Unauthenticated requests therefore return HTTP 401; authenticated users without the required permission return HTTP 403. Frontend route guards and hidden navigation are usability behavior only.

The CEO permission discrepancy is corrected in a dedicated authorization change with regression tests: CEO retains approved read/print permissions and loses calendar create/update/delete permissions unless the product requirements are explicitly changed.

### 5.5 IP and Proxy Trust

The logger uses Laravel's resolved client IP only after deployment config declares trusted proxy addresses. The repository documentation will state that trusting all forwarded headers without an infrastructure boundary makes audit IP data spoofable. Local development records the direct peer address. User-agent values are length-limited and treated as untrusted text.

### 5.6 Error Handling

- For a financial or material business mutation, an audit exception propagates and the enclosing database transaction rolls back.
- For login failure, login success, and logout, audit insertion is best-effort. Failure writes a structured, redacted `audit.write_failed` event to a dedicated `security` log channel with the request ID. Phase 1 does not introduce a metrics backend; operations can count and alert on this stable event name.
- Logout captures the actor context before session invalidation and performs invalidation in a `finally` path.
- No audit logger error or stack trace is returned to the user.
- Duplicate business requests are handled by domain invariants in Phase 2. Correction endpoints add an explicit idempotency key in Phase 4.

## 6. Testing Strategy

### Phase 1 Fast Suite: SQLite

- Additive migration succeeds on fresh schema.
- Upgrade migration preserves and backfills existing audit rows.
- Logger captures actor and role snapshots.
- Recursive sanitizer removes nested and differently cased secret keys.
- Request ID is generated server-side and returned in the response.
- Normal model update and delete attempts fail.
- Logger contract can be replaced with a throwing implementation.
- Permission seeds grant audit permissions only to Super Admin.

### Phase 1 MariaDB Integration Suite

- Fresh and upgrade migrations execute on the supported MariaDB version.
- JSON values and indexes are created as expected.
- Unique `event_uuid` is enforced.
- Concurrent row-lock and rollback tests use real MariaDB semantics.
- Query plans use the intended indexes once Phase 3 list endpoints exist.

SQLite results must never be used as proof of MariaDB locking or concurrency behavior.

### Later-Phase Coverage

```text
Audit foundation
  +--> unit: sanitizer, event validation, context generation
  +--> feature: permission and endpoint matrices
  +--> integration: mutation + audit atomic rollback
  +--> MariaDB: locks, conflicts, indexes, migration upgrade
  +--> frontend: route guards, list/detail, secret non-rendering
  +--> E2E: Super Admin views history and performs an eligible correction
  +--> recovery: backup restored and financial totals reconciled
```

Every new endpoint is tested as unauthenticated, Super Admin, School Admin, Finance, and CEO. Every new business integration first receives a failing regression test proving that the expected audit row is absent or that a logger failure currently leaves the wrong behavior; implementation follows only after the failure is observed.

## 7. Performance and Retention

Phase 1 stores changed fields only and never records ordinary page views. Phase 3 uses cursor pagination and an explicit maximum page size. Indexes are selected from real query shapes rather than adding every possible single-column index.

Failed login writes are protected by endpoint rate limiting and operational monitoring to prevent unauthenticated log-flood amplification. Audit Log detail access and correction attempts are security-sensitive reads/actions and are themselves recorded without recursively logging ordinary list refreshes.

Critical financial and correction audit records have no automatic deletion policy in the application. Before production, the operator documents retention and archive rules for personal data, backup expiry, and legal/business obligations.

## 8. Explicit Non-Goals

- No universal rollback endpoint.
- No Audit Log update or delete API.
- No school-scoped Audit Log Centre in the first release.
- No audit export in the first release.
- No generic restoration of financial values, statuses, roles, dates affecting billing, Fee Agreements, payments, receipts, or discounts.
- No automatic Production database grant changes, cron installation, deployment, or remote push.
- No third-party audit package. Native Laravel and repository patterns are used unless a later design proves a package is necessary and receives explicit approval.
- No claim of cryptographic immutability.
- No broad framework or UI refactor unrelated to the audited workflows.

## 9. Completion Definition

The full program is complete only when every phase has implementation evidence, its required SQLite and MariaDB tests pass, frontend type checking and production build pass, the permission matrix is verified through direct API access, correction conflicts and transaction rollback are proven, and a real backup has been restored into a temporary environment with financial reconciliation.

Phase 1 is complete when its additive migration, logger/context/sanitizer components, append-only application behavior, audit permissions, documentation, and both database-specific test evidence exist. Later phases cannot claim Phase 1 completion on their behalf.

## 10. Requirements Traceability

| Source requirement | Delivery phase | Evidence required before completion |
|---|---:|---|
| Role and permission matrix | 1, 3, 4, 5 | Permission seed assertions and direct API tests for unauthenticated, Super Admin, School Admin, Finance, and CEO users |
| Audit Log database design | 1 | Fresh and populated-schema migration tests; MariaDB table/index inspection; preserved legacy rows |
| Audit Log append-only behavior | 1, 6 | No mutation routes; model mutation tests; Production runtime grant checklist proving `audit_logs` allows only `SELECT` and `INSERT` |
| Central Audit Logger architecture | 1 | Contract, data objects, enums, middleware, sanitizer, and focused unit/feature tests |
| Data minimization and secret redaction | 1, 2, 3 | Recursive mixed-case/nested secret tests, changed-field-only event assertions, and API resource non-exposure tests |
| Authentication and security events | 2, 5 | Login success/failure/logout tests; later user create/status/role/reset tests after account administration exists |
| Student events | 2, 5 | Create/profile/status event tests; later status-correction dependency and conflict tests |
| Fee Agreement events | 2, 5 | Create/supersede tests; later historical clone/correction tests proving old versions remain unchanged |
| Payment and receipt events | 2, 5 | Record/verify/void/issue/cancel tests; later replacement and correction-chain tests with unique receipt numbers |
| Report export/print access | 3, 5 | Tests for each implemented sensitive report export/print flow, without storing generated report contents |
| Batch and maintenance operations | 2, 5 | Shared `batch_id`, system actor context, per-record or batch-summary policy tests, and rollback assertions |
| Transaction safety | 2, 4, 5 | Throwing audit logger tests proving business mutation, balances, receipts, and versions roll back atomically |
| Safe generic correction | 4 | Whitelist, normalized typed comparison, row-lock, required trimmed 10–1000 character reason, HTTP 409, idempotency, and linked-event tests |
| Student status correction | 5 | Approved state-transition/dependency decision table plus tests for fees, agreements, discounts, withdrawal data, and reports that exist |
| Fee Agreement correction | 5 | New-version-only implementation and tests for source/correction links and preserved historical versions |
| Payment/receipt correction | 5 | Receipt cancellation before payment void, balance reversal, re-entry, replacement link, and non-reused sequence tests |
| User role correction | 5 | User-management prerequisite, old/new role-set snapshots, escalation reason, session invalidation, and last-Super-Admin safety tests |
| Audit Log APIs | 3, 4, 5 | Route-list assertion proving no audit PUT/PATCH/DELETE; strict filters; cursor pagination; resource allowlist; 401/403 matrix |
| Audit Log frontend | 3, 4, 5 | Vitest route/navigation/detail/diff/secret tests and E2E correction/conflict behavior |
| Backend test requirements | All | `composer test`/Artisan test output plus MariaDB integration output for database-specific behavior |
| Frontend test requirements | 3, 4, 5 | `npm test`, `npm run lint`, and `npm run build` output |
| Performance and storage | 3, 6 | 50,000–100,000-row development dataset, MariaDB `EXPLAIN` evidence, cursor pagination, bounded resources, and storage monitoring notes |
| Laravel operational logging | 2, 6 | Dedicated redacted security channel; Production guidance for `APP_DEBUG=false`, daily rotation, error level, and disk alerts |
| Backup and disaster recovery | 6 | `docs/backup-and-recovery.md`, encrypted off-site backup evidence, binary-log/PITR procedure, and a successful temporary-database restore drill |
| Release and rollback | 6 | `docs/release-and-rollback.md`, pre-migration backup gate, migration inventory, health checks, and data-recovery decision tree |
| Pre-launch security scenarios | 6 | Automated/manual checklist containing all 25 scenarios with dated results and named evidence |
| Final acceptance criteria and handoff | 6 | Requirement-by-requirement completion report listing exact files, routes, permissions, events, whitelist, test results, risks, and manual operator actions |
