# Security, Financial Integrity, and Audit Hardening Design

**Date:** 2026-08-03
**Status:** Approved through the user's authorization to remediate all confirmed vulnerabilities
**Scope:** Existing authentication, authorization, school scoping, Fee Agreement and Fee Record workflows, critical audit coverage, and permission-aware frontend navigation

## 1. Objective

Close the confirmed security and financial-integrity gaps without inventing unapproved school policy. The implementation must fail closed when a safe outcome depends on an unknown discount, correction, or reconciliation rule. Existing records remain traceable; no historical financial record is physically deleted or silently rewritten.

This work does not claim that the application is production-ready. Deployment controls such as trusted proxies, TLS termination, runtime database grants, secrets management, backups, and restore drills remain operational requirements.

## 2. Confirmed Risks

### Authentication and request integrity

- Session-authenticated mutation routes do not currently enforce CSRF protection.
- Login attempts are not rate limited.
- A user made inactive after login can retain an existing session.
- The legacy school dashboard trusts a client-supplied school ID and lacks a permission boundary.
- The legacy monthly invoice endpoint trusts client-supplied school and actor IDs and lacks a financial permission boundary.

### Financial integrity

- Superseding a Fee Agreement leaves activated future charges attached to the old version and allows the new version to generate overlapping charges.
- Discount snapshots are stored and displayed by the frontend, but charge generation ignores them.
- Cross-school fee item IDs, duplicate fee items, and unknown selected discount codes are not rejected consistently.
- Fee Agreement academic-year validation accepts values that later billing code cannot interpret unambiguously.
- `requires_preview_confirmation` does not act as an activation gate.
- Monetary request validation does not consistently enforce the `DECIMAL(10,2)` range and scale.

### Auditability and frontend authorization

- The audit foundation exists, but critical authentication, student, Fee Agreement, payment, and receipt workflows do not yet use it.
- No read-only Audit Trail API or frontend exists.
- Navigation exposes modules without checking the current user's permissions.
- The frontend dashboard request hard-codes school `1`.

## 3. Chosen Approach

Use centralized security controls and explicit domain guards. Unknown financial behavior is rejected with a clear validation or conflict response; it is not approximated.

Rejected alternatives:

- Endpoint-only patches would leave CSRF, inactive-session, audit, and financial inconsistencies unresolved.
- Automatically applying discounts or cancelling old charges would require unconfirmed allocation, stacking, credit, and reconciliation policy.
- Deleting legacy routes would avoid some risks but would unnecessarily remove existing demo behavior that can be secured.

## 4. Security Design

### 4.1 CSRF

Use Laravel's native request-forgery middleware in the session API group. Provide a same-origin `GET /api/csrf-cookie` bootstrap response that creates the framework XSRF cookie. The frontend API client requests this cookie before the first state-changing request and sends the decoded value in `X-XSRF-TOKEN`.

Safe methods remain readable without a token. State-changing unauthenticated and authenticated requests without a matching token receive HTTP 419. The token is never logged or included in audit payloads.

### 4.2 Login throttling

Rate limit login by normalized username plus client IP. Failed credentials and inactive-account attempts consume the limit; a successful login clears the key. A throttled request returns HTTP 429 without revealing whether an account exists.

### 4.3 Active-session enforcement

Every authenticated API group uses an `EnsureUserIsActive` middleware after session authentication. An inactive user has the session invalidated, the CSRF token regenerated, and receives HTTP 401.

### 4.4 School scope and trusted actor

Controllers never accept an authoritative actor ID. `created_by`, `verified_by`, `voided_by`, and equivalent actor fields come from the authenticated user.

School-bound users always operate on their stored `school_id`. A Super Admin may supply an explicit school selector only where the endpoint supports global administration. Missing or invalid scope fails closed. Dashboard and invoice generation use the same resolver and backend permission middleware.

## 5. Financial Integrity Design

### 5.1 Fee Agreement supersede

Before superseding, lock the current agreement and inspect its activated charges. If any charge falls on or after the new effective month, reject the supersede with HTTP 409. This includes unpaid, partially paid, fully paid, allocated, or receipted charges. No charge is cancelled, deleted, or re-parented automatically.

The database receives forward-only corrective uniqueness constraints where they are portable and safe:

- at most one scheduled charge for a Fee Agreement item and billing month;
- at most one current Fee Agreement for a school, student, and academic year using a nullable current-slot key.

The migration performs a duplicate preflight and aborts rather than discarding existing data.

### 5.2 Discounts

Because formulas, stacking order, eligibility reassessment, and fixed-discount allocation are not confirmed, a Fee Agreement containing any non-zero discount cannot be previewed or activated into Fee Record charges. Creation may retain an explicitly requested snapshot for historical/product-review purposes, but the API response and frontend state must clearly say billing is blocked.

The frontend must not present its local discount calculation as the payable amount. It may show an illustrative estimate labelled as unapproved, while activation remains disabled.

### 5.3 Strict input validation

- Agreement academic year is exactly four digits, matching the current Fee Record model.
- Fee item IDs are distinct and belong to the agreement's school.
- Selected discount fee codes are distinct and must resolve to items in the submitted agreement.
- Percentage inputs are within `0..100` when accepted for storage.
- All money inputs fit `0.00..99,999,999.99` (or the relevant positive lower bound) and have at most two decimal places.
- Services repeat critical tenant and lookup checks defensively and return controlled domain errors instead of null dereferences.

### 5.4 Preview confirmation

An agreement or item marked `requires_preview_confirmation` cannot activate from a bare boolean supplied by the client. Until a server-bound preview confirmation mechanism exists, activation fails closed with a clear response. Agreements without the flag continue through the existing preview/activation workflow.

### 5.5 Decimal handling

Mutation-critical equality and allocation checks use integer cents derived from normalized decimal strings. Models expose monetary database fields using `decimal:2` casts. Broad display and reporting refactors are limited to paths touched by this hardening and must keep response compatibility.

## 6. Audit Design

The existing `AuditLoggerContract`, `AuditEvent`, `AuditContextFactory`, stable actions, modules, and subject aliases remain the single write path.

- Student create, update, and status mutation move into focused transactional services. The mutation and audit insert commit or roll back together.
- Fee Agreement create/supersede, payment record/verify/void, and receipt issue/void add an action-specific allowlisted event inside the existing transaction.
- Authentication success, failure, and logout use best-effort audit writes. A logger failure produces a redacted structured security log entry and does not expose internal errors. Logout captures context before invalidation and invalidates in a `finally` path.
- Audit actor, role, school, IP, route, request ID, and time are derived from trusted server context, never request payloads.
- Audit payloads contain changed domain fields and stable identifiers only; no credentials, CSRF tokens, sessions, cookies, raw bodies, or uploaded proof content.

## 7. Audit Trail API and Frontend

Add Super Admin-only read endpoints:

- `GET /api/audit-logs`
- `GET /api/audit-logs/{auditLog}`

Both require `audit.view`. List filters are allowlisted and cursor-paginated with a hard maximum page size. Resources return only safe audit fields. There is no update, delete, correction, or export action.

Add an Audit Trail page with list, filters, detail view, loading/empty/403/error states, and safe before/after rendering. Navigation includes it only when the user has `audit.view`.

All navigation entries define their required permission. If a user's current page becomes unavailable, the app returns to the first allowed page. Frontend checks improve usability only; backend middleware remains authoritative.

## 8. Error Semantics

- 401: unauthenticated or inactive session.
- 403: authenticated but missing permission or forbidden school scope.
- 409: a valid request conflicts with existing financial history, including superseding across activated future charges.
- 419: missing or mismatched CSRF token.
- 422: invalid tenant-owned IDs, duplicate inputs, unsupported discount billing, preview-confirmation gate, academic year, or money format.
- 429: login throttle.

Responses must not reveal credentials, SQL, stack traces, or internal audit failures.

## 9. Verification

Every behavior starts with a failing regression test. Required evidence includes:

- authentication, CSRF, throttle, inactive-session, permission, and cross-school feature tests;
- Fee Agreement, charge generation, payment, receipt, and audit atomicity tests;
- direct API permission matrices for all seeded roles;
- frontend API-client, navigation, dashboard, discount-state, and Audit Trail tests;
- full PHPUnit, Pint, frontend tests, Oxlint, TypeScript, and production build;
- MariaDB focused suite plus fresh migration, rollback, and re-migration;
- a real HTTP CSRF smoke test because Laravel disables CSRF middleware in ordinary feature tests;
- secret scan, documentation link check, route/config loading, complete diff review, and PR status review.

## 10. Explicitly Deferred

The following are not vulnerability fixes and remain separate approved-design work:

- automatic discount formulas and stacking;
- automatic cancellation, credit, reversal, refund, or retroactive repricing;
- generic financial correction or universal rollback;
- full user-management functionality;
- production infrastructure grants, backup automation, and restore execution.

These items remain documented as `Needs confirmation`, `Planned, not implemented`, or operational requirements as appropriate.

