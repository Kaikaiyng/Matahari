# SaaS Multi-Tenancy

**Status:** Implemented and locally hardened; production rollout pending

**Reviewed:** 2026-08-15

## Product Model

The platform product name is **RYLAY** and its registered primary domain is **`rylay.my`**. Matahari International School (MIS) is the first configured tenant, not the platform identity hard-coded into business data.

DNS authority for `rylay.my` has been delegated to Cloudflare from the Hostinger registration. **Hostinger KVM 2 is the preferred initial VPS option but has not been purchased.** Production origin IPs, DNS records, TLS/origin configuration and deployment state therefore remain unconfigured. Current plan specifications, region, pricing, backup retention and upgrade limits must be checked again immediately before purchase.

The hierarchy is:

```text
platform
  tenant (customer organization)
    branding, domains, feature flags, memberships
    one or more schools/campuses
      academic, community, attendance, finance and audit records
```

The Laravel application and authoritative MariaDB database are shared. Existing business tables remain scoped by `school_id`; a school's required `tenant_id` supplies the tenant boundary. This avoids adding a redundant tenant key to every historical finance table while preserving its current school ownership.

## Request Resolution

Every API request passes through tenant resolution before authentication or business authorization:

1. Normalize the request hostname.
2. Match an active, explicitly verified `tenant_domains` record.
3. Require the owning tenant to be active.
4. Bind the tenant and surface (`admin`, `app`, or `api`) to the request.
5. For authenticated requests, require an active `tenant_user_memberships` record.
6. Resolve permissions and permitted schools from that active membership.
7. Apply the existing resource, school, teacher, guardian, student, and finance controls.

The host is authoritative. A client-supplied tenant ID cannot switch context. Unknown production hosts, pending domains, unverified domains, and suspended tenants fail closed. The local/test fallback exists only for repository compatibility and must not be enabled as a production tenant-selection mechanism.

## Browser Surfaces

- `frontend/` is the Admin browser build. It accepts only a domain whose surface is `admin`.
- `app/` is the mobile-first role app build. It accepts only a domain whose surface is `app`.
- Both load `GET /api/tenant-context` before rendering, apply tenant branding and feature flags, and use same-origin session/CSRF requests.
- Both can be deployed under separate subdomains while reverse-proxying `/api` to the same Laravel application.
- All tenants use the same Admin/App code and backend release. Supported differences are limited to the active tenant's `branding` and `features`; tenant-specific code copies or branches are not supported.
- Laravel enforces the resolved surface: Admin business APIs return 404 on App hosts, and App business APIs return 404 on Admin hosts. Tenant context and session bootstrap/authentication routes remain shared.

The current app remains web technology. Capacitor, Firebase, Sanctum, native authentication and store packaging are not installed.

## Approved RYLAY Domain Convention

- `rylay.my` and `www.rylay.my`: future RYLAY public website.
- `console.rylay.my`: future RYLAY platform-control interface.
- `{tenant}.rylay.my`: tenant Admin surface, beginning with `mis.rylay.my`.
- `{tenant}-app.rylay.my`: tenant App surface, beginning with `mis-app.rylay.my`.

This single-label convention is compatible with one `*.rylay.my` wildcard boundary. Each browser surface should reverse-proxy same-origin `/api` to Laravel; an independent cross-origin `api.rylay.my` is not required for the initial deployment. Exact DNS records must wait for a selected VPS and must be activated in `tenant_domains` only after DNS/TLS verification.

## Identity, Membership and Roles

`users` is a global identity table. Access is tenant-specific through `tenant_user_memberships`, which stores status, default school, all-school access, allowed schools and membership roles. The same identity may therefore have different roles and campuses in different tenants.

Global `user_roles` are retained for compatibility and migration history. During an authenticated tenant request, authorization uses the active membership roles. `super-admin` cannot be assigned as a tenant membership role through the tenant API.

`users.is_platform_owner` is an explicit platform-control capability. It is not inferred from `super-admin`, email, username or tenant ownership. Platform owners may administer tenants, but ordinary business APIs still require an explicit tenant/school context.

Tenant and platform configuration is controlled by the explicit Super Admin platform owner. Historical `tenant-owner` rows may remain for upgrade history, but the role is no longer seeded or assignable.

## Tenant Configuration

Tenant data includes:

- slug, display name, status, timezone and locale;
- organization/admin/app labels, logo URL and primary/accent colors;
- separate Admin/App/API domains with at most one primary domain per surface;
- tenant feature flags;
- schools/campuses;
- tenant user memberships, school scopes and membership roles.

New domains start as `pending` and unverified. Activation is an explicit platform action after external DNS/TLS ownership checks. The application does not currently automate DNS challenges or certificate issuance.

Feature configuration remains private. The public tenant-context endpoint exposes branding and boolean enabled states only.

## Management APIs

Public:

- `GET /api/tenant-context`

Platform owner under `/api/v1/platform`:

- list/create tenants;
- activate/suspend a tenant;
- update branding;
- add and explicitly activate domains;
- update feature flags;
- add schools;
- create/update user membership scope and roles.

Compatibility tenant-configuration routes under `/api/v1/tenant` also require the protected platform-owner capability. They can:

- update branding;
- add pending domains;
- update feature flags;
- add schools;
- create/update memberships.

The platform owner alone uses these platform/tenant configuration APIs; a school employee position never receives tenant-control authority. Domain activation and tenant status changes remain available only under `/api/v1/platform`.

## Audit and Transaction Rules

Tenant creation and all sensitive tenant mutations write audit records in the same database transaction. An audit failure rolls back the mutation. Audited actions cover tenant creation/status, branding, domain creation/activation, feature flags, schools and memberships. Audit metadata records the tenant ID without exposing credentials or private feature configuration.

## Additive Migration and Existing Data

The corrective migration is additive. It does not rewrite finance history, fee agreements, payments, receipts, receipt numbers, students or role assignments. `schools.tenant_id` is required. `tenant_membership_schools.tenant_id` is backfilled from its membership and is also required; composite foreign keys require the membership, default school and allowed schools to belong to the same tenant.

School codes are unique within a tenant rather than globally, so separate customers may use the same campus code. The stale global school-code index is removed when present. A generated nullable primary-surface key plus a unique index permits at most one primary domain for each tenant/surface while allowing multiple non-primary domains.

The corrective migration preflights missing tenant ownership, duplicate tenant-local school codes, cross-tenant membership-school relationships, unsupported domain surfaces and duplicate primary domains. It fails with an operator-visible error instead of deleting, merging, renaming or guessing data. Its rollback removes only the new hardening constraints/column and deliberately does not restore the obsolete global school-code rule.

For an existing installation, each existing school is conservatively placed in its own new tenant. Existing explicit `users.school_id` links become memberships and existing assigned roles are copied to those memberships. This is a mechanical preservation step, not a guess that separately stored schools belong to one customer.

The migration does not guess or create production domains, merge campuses, activate guardian portal access, link guardians/students by personal data, or infer academic-year/enrolment dates. Those remain controlled live-data gates.

## Production Gates

Before a production rollout:

- design and implement the RYLAY public website and platform-control interface;
- confirm, purchase and provision the preferred Hostinger KVM 2 VPS;
- register and verify each Admin/App/API domain and provision DNS/TLS externally;
- explicitly review which schools belong to each customer tenant;
- explicitly review tenant memberships, platform owners and tenant owners;
- repeat the migration lifecycle and FK/index checks on the exact release artifact and deployment MariaDB version;
- configure proxy trusted-host/session/cookie behavior for the chosen domains;
- run cross-tenant, cross-school, role, feature and suspended-tenant smoke tests;
- retain the existing controlled gates for guardian links, portal access and historical academic data.

MIS local seed domains are development fixtures only: `localhost` for Admin and `127.0.0.1` for App.
