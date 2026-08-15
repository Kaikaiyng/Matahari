# Tenant Foundation Hardening Design

**Status:** Implemented and verified locally

**Date:** 2026-08-15

## Purpose

Harden RYLAY's shared-database multi-tenant foundation before a second tenant is created or production deployment begins. Preserve the current MIS SQLite demo data, keep one shared Laravel backend and authoritative database, and permit tenant variation only through host-resolved branding and feature configuration.

## Scope

This change will:

- correct the existing local SQLite school-code index without resetting data;
- make every school belong to exactly one tenant;
- enforce same-tenant membership/default-school/allowed-school relationships at the database boundary;
- enforce at most one primary domain per tenant and browser surface under concurrent writes;
- enforce Admin versus App surface boundaries in the Laravel API;
- add two-tenant isolation and migration lifecycle evidence on SQLite and disposable MariaDB;
- update canonical tenancy, database, architecture, status, and testing documentation.

It will not create tenant-specific code copies, split tenants into separate databases, automate DNS/TLS ownership verification, introduce a production deployment, or change student and financial history.

## Architecture

The ownership hierarchy remains:

```text
RYLAY platform
  tenant
    branding, domains, features, memberships
    school/campus
      academic, community, attendance, finance and audit data
```

`tenant_domains.hostname` remains the authoritative request selector. `ResolveTenantContext` runs before authentication and binds the active, verified tenant and its `admin`, `app`, or `api` surface. Authentication then requires an active membership in that tenant. Business authorization continues through tenant membership roles, permissions, and a school selected from the active membership.

Business tables continue to carry `school_id` rather than a redundant `tenant_id`. The required `schools.tenant_id` relationship makes the school the durable tenant boundary for existing academic and financial history.

## Corrective Migration

A new migration will be added. The existing `2026_08_14_000001_create_tenant_foundation` migration will not be edited because it has already run in the local database and may have run elsewhere.

### Preflight

Before changing constraints, the migration will fail without modifying data if any of these conditions exist:

- a school has no tenant;
- two schools in one tenant share a code;
- a membership's default school belongs to another tenant;
- an allowed membership school belongs to another tenant;
- a tenant has more than one primary domain for the same surface;
- a tenant domain uses an unsupported surface.

The exception will identify the failed invariant and the affected record identifiers. The migration will not guess ownership, merge schools, rename codes, or select a winning domain.

### School ownership

The migration will remove the stale global `schools.code` unique index when present and ensure the exact unique index on `(tenant_id, code)` exists. It will then make `schools.tenant_id` non-null while preserving its restrictive foreign key to `tenants`.

A unique key on `(tenant_id, id)` will provide a referenced key for composite same-tenant foreign keys. This key is redundant for lookup purposes but necessary for relational integrity.

### Membership ownership

`tenant_user_memberships` will retain the unique `(tenant_id, user_id)` identity. Its nullable `default_school_id` will be protected by a composite foreign key `(tenant_id, default_school_id) -> schools(tenant_id, id)`.

`tenant_membership_schools` will gain a required `tenant_id`, backfilled from its membership. It will have both composite relationships:

- `(tenant_id, tenant_user_membership_id) -> tenant_user_memberships(tenant_id, id)`;
- `(tenant_id, school_id) -> schools(tenant_id, id)`.

All production membership writes and seed data will populate the pivot tenant ID. Existing single-column relationships may remain where Laravel relationship behavior relies on them, provided their delete rules do not conflict with the composite constraints.

### Primary domains

The database will expose a generated nullable primary-surface key derived from `is_primary` and `surface`. A unique index on `(tenant_id, primary_surface)` will allow any number of non-primary domains because their generated key is null, while allowing only one primary domain for each non-null surface.

The generated expression will be implemented explicitly for SQLite and MariaDB/MySQL-compatible grammar. Migration tests will inspect the exact resulting index. Application transactions and row locks remain for friendly state transitions; the unique database constraint is the final concurrency guard.

### Rollback

`down()` removes only constraints and columns introduced by the corrective migration. It retains tenant-local school-code uniqueness and deliberately does not restore the obsolete global school-code rule. Rollback never deletes, merges, or renames tenant, school, membership, student, or financial records.

## API Surface Enforcement

A dedicated `tenant.surface:<surface>` middleware will compare the route's allowed surface with the host-resolved `TenantContext`. A mismatch will return 404 so an endpoint is not advertised on the wrong browser surface.

Routes will be classified as follows:

- shared on Admin and App: tenant context, CSRF bootstrap, login, current-user session, logout, and deployment metadata;
- Admin only: platform tenant administration, current-tenant settings, legacy Admin/Finance endpoints, and `/api/v1/admin/*`;
- App only: Community, Teacher, Assessment, Quiz, Parent/Student portal, schedule self-service, and portal notifications;
- `api` surface: reserved for a later reviewed integration API; no current business routes will be moved to it.

Surface enforcement supplements rather than replaces authentication, active-user checks, tenant membership, feature flags, permissions, school context, teacher assignment scope, guardian relationships, student-self scope, or financial safeguards.

The Admin and App React checks remain as early user-facing validation. The Laravel middleware becomes the authoritative surface boundary.

## Data and Error Handling

No request may select a tenant by submitting `tenant_id`. Unknown, pending, unverified, or suspended host mappings continue to fail closed. Local fallback remains restricted to configured loopback hosts and may not be enabled as a production tenant-selection mechanism.

Migration preflight failures are operator-visible and transactional. API surface mismatch returns 404. Invalid membership-school combinations return validation or authorization errors before persistence, while database constraints prevent inconsistent writes caused by concurrency or future code regressions.

## Testing

Tests will be written before each implementation change and observed failing for the expected reason.

### SQLite

- migration preflight rejects each invalid invariant without partial schema or data changes;
- an existing database with the stale global school-code index migrates without losing MIS data;
- `schools.tenant_id` becomes required;
- two tenants may reuse a school code, while one tenant may not duplicate it;
- cross-tenant default-school and allowed-school records are rejected by database constraints;
- duplicate primary domains per tenant/surface are rejected;
- migrate, targeted rollback, and re-migrate preserve row counts and identities;
- wrong-host, wrong-surface, suspended-tenant, wrong-membership, cross-school, and cross-tenant API access fail closed;
- representative Admin routes fail on App hosts and representative App routes fail on Admin hosts;
- shared authentication/session routes remain available on both surfaces.

### MariaDB

A disposable database named `rylay_audit_test` will run the guarded MariaDB suite. It will verify exact foreign keys, delete rules, generated-column/index behavior, nullability, migration, rollback, and re-migration. No production, restored-production, or valuable database may be used.

If MariaDB cannot be installed or started in the environment, the work cannot be described as production-verified; the missing evidence will be reported as a release blocker.

### Full regression

The final verification will run:

- full backend PHPUnit, route loading, Pint, and SQLite migration lifecycle;
- Admin Vitest, Oxlint, TypeScript/build;
- App Vitest, Oxlint, TypeScript/build;
- disposable MariaDB tenant schema and lifecycle checks;
- diff, generated-artifact, and secret checks.

## Documentation and Operational Gates

Canonical architecture, database, SaaS tenancy, current-status, and testing documents will describe the final constraints and evidence. Production remains blocked until real Admin/App DNS and TLS mappings are verified, trusted-proxy/session/cookie settings are validated on the deployment topology, and the exact release commit passes CI and deployment smoke tests.

## Acceptance Criteria

The hardening is complete only when:

1. the current MIS SQLite database migrates without row loss;
2. all schools have a non-null tenant;
3. database constraints prevent cross-tenant membership-school relationships;
4. tenant-local school code and primary-domain uniqueness are enforced;
5. Admin and App APIs reject the wrong host surface at the backend;
6. two-tenant isolation tests pass for identity, permission, school, resource, feature, and surface boundaries;
7. SQLite and disposable MariaDB migration/rollback/re-migration pass;
8. all relevant backend, Admin, and App regression checks pass;
9. documentation records the final behavior and remaining deployment-only gates.
