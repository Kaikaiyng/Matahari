# Multi-Tenant School Administration Platform

This repository is a configurable school-administration SaaS under incremental development. Matahari International School (MIS) is the first tenant and demo configuration. The product contains an Admin/Finance browser surface and an independent mobile-first Community App for Parent, Student, Teacher, and authorized Staff roles. Both clients use the same Laravel API and authoritative database, resolve a tenant from their subdomain, and remain separate builds/deployments. It is not yet production-ready or a native store release.

Tenant branding is runtime configuration. Branding changes never authorize rewriting tenant identity, student numbers, invoice numbers, receipt numbers, or other historical records. See [SaaS Multi-Tenancy](docs/saas-multitenancy.md).

## Current Scope

Implemented workflows include:

- Username/password login with Laravel session cookies and seeded role permissions.
- Host-authoritative tenant resolution, tenant-specific memberships/roles/school scopes, configurable branding/domains/features, and audited platform/tenant management APIs.
- Student search, creation, detail, status changes, and read-only class rosters.
- Versioned Fee Agreements and billing configuration.
- Fee Record preview, activation, manual charges, outstanding balances, summary, and category/month views.
- Payment allocation, verification, void safeguards, receipt generation, browser printing, and receipt void/regeneration.
- Shared school calendar CRUD.
- Phase A academic foundation APIs for academic years, class enrolments, subjects, teaching assignments, and reviewed portal identity links.
- Independent `app/` Community App views for Parent, Student, Teacher, and authorized Staff roles, with role-aware liquid-glass navigation, self-service identity endpoints, personal in-app notifications, read-only parent finance, and MIS demo personas.
- Daily class Attendance: assignment-scoped Teacher roster marking, Parent/Student history reads, correction reasons, and transactional audit logging.
- Scoped Community publishing and feeds with private authorized media, appreciations, controlled comments, moderation history, and transactional audit logging.
- Teaching Assignment-scoped Assessments with draft result entry, explicit complete-roster publication, and authorized Parent/Student published-result views.
- Permission-filtered navigation and a Super Admin-only, read-only Audit Trail with filters and event detail.
- Responsive desktop, tablet, and mobile administration UI.
- CSRF-protected session mutations, login throttling, active-session rechecks, request IDs, and transactional audit events for implemented critical workflows.

Important boundaries:

- `frontend/` is Admin-only. `app/` is the separate multi-role Community App surface. Attendance, Community, Assessment results, class Schedule, and formal Teacher-assigned Quiz use live scoped APIs. Practice/AI Quiz remains disabled.
- Parent finance is read-only and has no payment interface. Payment reminders, native authentication, Firebase, Capacitor, and app-store packaging remain unimplemented. See [Mobile Product Architecture and Roadmap](docs/mobile-product-roadmap.md).

- Payments and receipts are implemented inside Student Detail; unimplemented top-level placeholder navigation has been removed.
- The parent directory and fee catalogue top-level pages remain display-only; parent mutations, fee catalogue management, reports, exports, settings, user management, password reset, and production deployment are incomplete or not implemented.
- Discounts can be stored as agreement snapshots, but charge preview/activation deliberately fails closed until approved formulas exist.
- Generic audit correction/recovery and audit export are planned, not implemented.

## Technology Stack

| Area | Repository version or implementation |
| --- | --- |
| Backend | PHP `^8.3`, Laravel Framework `13.17.0` from `composer.lock` |
| Admin and App frontends | Separate React `19.2.7`, TypeScript `6.0.x`, Vite `8.1.0` workspaces |
| Authentication | Laravel `web` guard with session cookies |
| Production database direction | MariaDB/MySQL-compatible |
| Local demo and default tests | SQLite; PHPUnit uses SQLite `:memory:` |
| Backend tests | PHPUnit `12.5.30` |
| Frontend tests/lint | Vitest, Testing Library, Oxlint |

The repository does not use Laravel 10. Admin is under `frontend/`, the multi-role Community App is under `app/`, and the npm manifest under `backend/` is Laravel scaffold tooling.

## Repository Structure

```text
backend/             Laravel API, domain services, schema, seeders, tests
frontend/            Admin-only React application, components, feature models, tests
app/                 Independent multi-role mobile-first React Community App
docs/                Current documentation and historical delivery records
tools/php/           Windows PHP launchers and local SQLite demo helpers
tools/public-demo/   Temporary Cloudflare Quick Tunnel demo tooling
```

No native workspace exists yet. `app/` is a separate web workspace designed to become the source for later approved store packaging; Capacitor/native authentication/Firebase are not installed.

Future coding agents must also read [AGENTS.md](AGENTS.md).

## Prerequisites

- PHP 8.3 or newer with the extensions enabled by `tools/php/php.ini`.
- Composer.
- Node.js and npm. The repository does not currently pin a Node version.
- SQLite for the quickest local demo, or a separately provisioned MariaDB database for compatibility work.

## Local Demo Setup

Install dependencies once:

```powershell
cd backend
$env:PHPRC = (Resolve-Path ..\tools\php).Path
composer install
Remove-Item Env:PHPRC
cd ..\frontend
npm.cmd ci
cd ..\app
npm.cmd ci
cd ..
```

`PHPRC` makes a Composer installation that launches the system `php.exe` load this repository's `tools/php/php.ini`. If Composer is not installed as a command, run its trusted local `composer.phar` explicitly with `php -c ..\tools\php\php.ini` instead.

Create or intentionally reset only the ignored local demo SQLite database:

```powershell
tools\php\reset-demo-sqlite.cmd
```

`tools\php\reset-demo-sqlite.cmd` destroys only the ignored, disposable `backend/database/database.sqlite` demo database and then runs `migrate:fresh --seed`. It reseeds the MIS demo tenant and `MIS` identifiers. It does not run automatically; do not adapt it to a database containing valuable data. Existing receipt identifiers are financial history and are never rewritten automatically. Seeded users are demo-only; inspect the seeder locally if credentials are needed, and never reuse them in a deployed environment.

The Admin and App load public display configuration from `/api/tenant-context`; receipt/legal snapshot rules remain independent of presentation branding. A fresh disposable seed configures MIS for local development. Runtime branding must never rewrite historical receipt identifiers.

Start the API in one terminal:

```powershell
tools\php\serve-demo-backend.cmd
```

Start the React frontend in another terminal:

```powershell
cd frontend
npm.cmd run dev
```

Start the Community App in a third terminal:

```powershell
cd app
npm.cmd ci
npm.cmd run dev
```

Local URLs are Admin `http://localhost:5173`, App `http://127.0.0.1:5174`, and shared API `http://127.0.0.1:8000`. Using `localhost` and `127.0.0.1` as distinct local hosts keeps their host-only session cookies separate. Production uses two real domains, each reverse-proxying `/api` to the same Laravel backend.

The frontend defaults to the same-origin `/api` path. Vite development and preview proxy that path to `http://127.0.0.1:8000` by default. To use another local backend target without changing the browser API origin, create an untracked `frontend/.env.local`:

```dotenv
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
```

`VITE_API_BASE_URL` is supported for an explicitly reviewed alternative topology, but cross-origin session/cookie behavior is deployment-sensitive and is not the default.

## General Backend Environment

For non-demo development:

```powershell
cd backend
Copy-Item .env.example .env
..\tools\php\php-local.cmd artisan key:generate
if (-not (Test-Path -LiteralPath database\database.sqlite)) {
    New-Item -ItemType File -Path database\database.sqlite | Out-Null
}
..\tools\php\php-local.cmd artisan migrate --force
```

The file-creation step is required because the example environment defaults to SQLite and the database file is intentionally not committed. For MariaDB, omit that step, set private local values for `DB_CONNECTION=mariadb`, host, port, database, username, and password, then clear cached configuration. Do not commit `.env` or include credentials in documentation.

Use `migrate --force` for an existing database. Never use `migrate:fresh` when data must be preserved.

## Verification Commands

Backend:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit
..\tools\php\php-local.cmd vendor\bin\pint --test
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
```

Frontend:

```powershell
cd frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

The Community App uses the same three commands from `app/`.

`npm.cmd run build` runs `tsc -b` before the Vite production build. No PHP static-analysis command is currently configured. GitHub Actions now defines quick checks, one immutable ZIP build, full application validation, dependency audits, and a disposable MariaDB migration lifecycle; its current execution result must still be checked in GitHub. See [Testing and Release](docs/testing-and-release.md) and [Deployment Foundation](docs/deployment-foundation.md).

## Development Workflow

1. Fetch the latest remote default branch and create a dedicated feature branch/worktree.
2. Read the relevant canonical documentation and existing tests.
3. Make the smallest complete change; avoid unrelated refactoring.
4. Enforce permissions and school scope on the backend, not only in the UI.
5. Run focused checks and the complete relevant validation set.
6. Update documentation in the same pull request when behavior, schema, permissions, or commands change.
7. Review the final diff and secret scan before pushing.

## Security Notes

- Do not use demo data or seeded passwords in production.
- Frontend-hidden actions are not an authorization boundary.
- CSRF middleware, a same-origin CSRF-cookie bootstrap, username-plus-IP login throttling, and active-user request checks are implemented. HTTPS cookie flags, proxy trust, rate-limit storage, CORS, and session topology still require deployment-specific verification.
- Audit rows are append-only at the Eloquent model layer, not against raw SQL or privileged database users. Runtime least-privilege requirements are documented in [Audit Log Operations](docs/AUDIT_LOG_OPERATIONS.md).
- Do not commit `.env`, database files, test artifacts, real student data, tokens, or tunnel runtime state.

## Documentation

- [Project Overview](docs/project-overview.md)
- [Business Rules](docs/business-rules.md)
- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [Permissions](docs/permissions.md)
- [Current Status](docs/current-status.md)
- [Testing and Release](docs/testing-and-release.md)
- [Phase A Academic Foundation Delivery](docs/phase-a-academic-foundation.md)
- [Mobile Product Architecture and Roadmap](docs/mobile-product-roadmap.md)
- [MIS App Product Specification](docs/mobile-app-product-spec.md)
- [MIS App Design System](DESIGN.md)
- [Deployment Foundation](docs/deployment-foundation.md)
- [Staging and Production Deployment Design](docs/superpowers/specs/2026-08-06-staging-production-deployment-design.md) — approved direction; repository foundation partially implemented
- [Documentation Index](docs/README.md)

## Current Limitations

- No formal load or concurrency limit has been validated. Historical planning used approximately 200 students for cost estimation only; this is not a tested capacity claim.
- The default automated backend suite uses SQLite and cannot prove MariaDB JSON, index, locking, foreign-key, or rollback behavior.
- No stable hosting or production environment exists. CI and portable Docker/Compose source are included, but real container startup, remote deployment, monitoring, and backup/restore remain unverified.
- User administration and password reset are not implemented.
- General reports, exports, statements, payment reminders, production-ready Parent Finance, Practice/AI Quiz, PDF generation, and complete academic ERP modules are not implemented. Community, Attendance, Assessment, Schedule, formal Quiz, notifications, and read-only Parent Finance now use live scoped APIs; native/store delivery remains a separate controlled gate.
- Operational readiness remains incomplete: production hosting, remote release operations, monitoring, runtime grant execution, backups, restore drills, and approved discount/correction policies are not verified. See [Current Status](docs/current-status.md).
