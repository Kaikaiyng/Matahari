# RYLAY Platform Rename Design

**Status:** Approved for implementation on 2026-08-15

## Goal

Rename the repository, active engineering identifiers, deployment defaults, and current documentation from the historical Matahari platform name to **RYLAY**. Matahari International School (MIS) remains the first tenant and keeps its tenant identity, branding, seeded data, and tenant-facing pages.

## Product and Tenant Boundary

RYLAY owns the shared product code, Laravel backend, Admin client, Community App client, database schema, deployment artifacts, and infrastructure conventions. All tenants run the same code versions and backend.

Tenant differences are limited to the authoritative `branding` and `features` configuration resolved from an active verified hostname. A tenant must not receive a copied frontend workspace, a tenant-specific code branch, or custom business behavior outside those configuration boundaries.

The target topology is:

```text
tenant Admin/App hostname
        |
        v
shared RYLAY Admin or Community App build
        |
        v
shared Laravel API -> shared RYLAY database
                         |- Matahari tenant
                         `- future tenants
```

## Rename Scope

Current platform-owned identifiers become RYLAY identifiers:

- GitHub repository `Kaikaiyng/Matahari` becomes `Kaikaiyng/RYLAY`.
- The local repository directory becomes `C:\Users\chong\Documents\RYLAY`.
- Active package names become `rylay-admin` and `rylay-community-app`.
- Application defaults use the RYLAY product name where they describe the shared platform.
- Deployment paths, Docker project/network identifiers, database and account examples, temporary directories, test gates, release artifacts, and CI artifact names use `rylay`.
- Canonical and active operational documentation uses RYLAY terminology and the new GitHub URL.

The following remain Matahari/MIS because they represent tenant data or tenant presentation:

- tenant and school names, slugs, codes, branding, logos, colors, addresses, and demo email domains;
- Admin/App page content produced from the Matahari tenant branding;
- Seeder fixtures and tests whose assertions prove Matahari tenant behavior;
- financial identifiers and all historical business records.

Historical plans and decision records retain statements that describe the repository's past state. They receive a clear superseding-name notice where needed rather than having historical evidence silently rewritten.

## Compatibility and Data Safety

No migration renames, deletes, rebuilds, or copies an existing database. New environment examples use `rylay_*` names. An existing installation may continue pointing at a historically named database until an operator performs a separately backed-up and verified database move.

The Admin remembered-username storage key changes to a RYLAY-owned key. The client reads and migrates the previous key once so an existing local browser preference is not lost, then removes the old key. No other long-lived runtime compatibility alias is required because the system has not launched.

GitHub is renamed only after repository tests pass. The local `origin` is then updated to the new canonical URL. The local top-level directory is renamed last so running commands do not lose their working path midway through the change.

## Enforcement

Repository contract tests will distinguish platform-owned strings from explicit Matahari tenant fixtures. They will fail if active deployment/package identifiers regress to the historical platform name. Existing tenant branding tests continue proving that Matahari renders correctly when its tenant context is active.

Backend hostname resolution, membership permission checks, and school scope remain authoritative. This rename does not introduce a client-submitted tenant switch or alter any domain, financial, or authorization rule.

## Verification

The implementation will run:

- focused rename and compatibility tests first;
- full backend PHPUnit, Pint, and API route loading;
- Admin Vitest, Oxlint, and production build;
- Community App Vitest, Oxlint, and production build;
- deployment contract tests and tracked-secret scans;
- a final repository search classifying every remaining Matahari occurrence as tenant data or historical evidence;
- Git diff and status review before external GitHub and local directory renames.

MariaDB data migration is not applicable because no schema or stored data changes are part of this rename. Container rendering and a live MariaDB lifecycle remain **Not verified** if Docker/MariaDB are unavailable in the workstation environment.
