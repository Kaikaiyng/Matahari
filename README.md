# Matahari International School Administration System

This repository is the Matahari International School (MIS) administration and finance system under incremental development. It currently delivers an Admin/Finance web MVP, the Phase A academic/identity foundation, and an experimental mobile-shaped Parent/Student portal preview inside the existing React application. It is not yet a complete academic ERP, a native mobile application, or a production deployment package.

MIS branding is now the approved runtime and disposable-demo identity. Branding changes do not authorize rewriting an existing tenant, student number, invoice number, receipt number, or other historical record.

## Current Scope

Implemented workflows include:

- Username/password login with Laravel session cookies and seeded role permissions.
- Student search, creation, detail, status changes, and read-only class rosters.
- Versioned Fee Agreements and billing configuration.
- Fee Record preview, activation, manual charges, outstanding balances, summary, and category/month views.
- Payment allocation, verification, void safeguards, receipt generation, browser printing, and receipt void/regeneration.
- Shared school calendar CRUD.
- Phase A academic foundation APIs for academic years, class enrolments, subjects, teaching assignments, and reviewed portal identity links.
- Experimental `/portal` Parent/Student web views, self-service identity endpoints, personal in-app notifications, and MIS demo personas. These are test previews, not completed product phases.
- Permission-filtered navigation and a Super Admin-only, read-only Audit Trail with filters and event detail.
- Responsive desktop, tablet, and mobile administration UI.
- CSRF-protected session mutations, login throttling, active-session rechecks, request IDs, and transactional audit events for implemented critical workflows.

Important boundaries:

- The current `/portal` route is an experimental responsive preview within `frontend/`, not a released mobile product. Some academic cards and timetable/attendance content are explicitly labelled demo data.
- Parent finance is read-only in this preview and its payment notice interaction deliberately persists nothing. Payment reminders, Quiz, native authentication, Firebase, Capacitor, and app-store packaging remain unimplemented. See [Mobile Product Architecture and Roadmap](docs/mobile-product-roadmap.md).

- Payments and receipts are implemented inside Student Detail; unimplemented top-level placeholder navigation has been removed.
- The parent directory and fee catalogue top-level pages remain display-only; parent mutations, fee catalogue management, reports, exports, settings, user management, password reset, and production deployment are incomplete or not implemented.
- Discounts can be stored as agreement snapshots, but charge preview/activation deliberately fails closed until approved formulas exist.
- Generic audit correction/recovery and audit export are planned, not implemented.

## Technology Stack

| Area | Repository version or implementation |
| --- | --- |
| Backend | PHP `^8.3`, Laravel Framework `13.17.0` from `composer.lock` |
| Frontend | React `19.2.7`, TypeScript `6.0.x`, Vite `8.1.0` |
| Authentication | Laravel `web` guard with session cookies |
| Production database direction | MariaDB/MySQL-compatible |
| Local demo and default tests | SQLite; PHPUnit uses SQLite `:memory:` |
| Backend tests | PHPUnit `12.5.30` |
| Frontend tests/lint | Vitest, Testing Library, Oxlint |

The repository does not use Laravel 10. The separate React application is under `frontend/`; the npm manifest under `backend/` is Laravel scaffold tooling, not the main frontend.

## Repository Structure

```text
backend/             Laravel API, domain services, schema, seeders, tests
frontend/            React application, components, feature models, tests
docs/                Current documentation and historical delivery records
tools/php/           Windows PHP launchers and local SQLite demo helpers
tools/public-demo/   Temporary Cloudflare Quick Tunnel demo tooling
```

No native or separate `mobile/` workspace exists. The experimental `/portal` surface currently shares the React build; whether it remains isolated there or moves to a separate workspace is still an architectural gate.

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
cd ..
```

`PHPRC` makes a Composer installation that launches the system `php.exe` load this repository's `tools/php/php.ini`. If Composer is not installed as a command, run its trusted local `composer.phar` explicitly with `php -c ..\tools\php\php.ini` instead.

Create or intentionally reset only the ignored local demo SQLite database:

```powershell
tools\php\reset-demo-sqlite.cmd
```

`tools\php\reset-demo-sqlite.cmd` destroys only the ignored, disposable `backend/database/database.sqlite` demo database and then runs `migrate:fresh --seed`. It reseeds the MIS demo tenant and `MIS` identifiers. It does not run automatically; do not adapt it to a database containing valuable data. Existing receipt identifiers are financial history and are never rewritten automatically. Seeded users are demo-only; inspect the seeder locally if credentials are needed, and never reuse them in a deployed environment.

The runtime product label and receipt disclaimer are centralized in `frontend/src/branding.ts`. Later school-specific branding requires explicit approval and a deliberate update to the presentation configuration and, where appropriate, a fresh disposable demo seed. It must not be used to rename an existing tenant or rewrite historical receipt identifiers.

Start the API in one terminal:

```powershell
tools\php\serve-demo-backend.cmd
```

Start the React frontend in another terminal:

```powershell
cd frontend
npm.cmd run dev
```

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
- [Deployment Foundation](docs/deployment-foundation.md)
- [Staging and Production Deployment Design](docs/superpowers/specs/2026-08-06-staging-production-deployment-design.md) — approved direction; repository foundation partially implemented
- [Documentation Index](docs/README.md)

## Current Limitations

- No formal load or concurrency limit has been validated. Historical planning used approximately 200 students for cost estimation only; this is not a tested capacity claim.
- The default automated backend suite uses SQLite and cannot prove MariaDB JSON, index, locking, foreign-key, or rollback behavior.
- No stable hosting or production environment exists. CI and portable Docker/Compose source are included, but real container startup, remote deployment, monitoring, and backup/restore remain unverified.
- User administration and password reset are not implemented.
- General reports, exports, statements, reminders, production-ready Parent Finance/mobile self-service, PDF generation, and complete academic ERP modules are not implemented. The current portal is an experimental preview only.
- Operational readiness remains incomplete: production hosting, remote release operations, monitoring, runtime grant execution, backups, restore drills, and approved discount/correction policies are not verified. See [Current Status](docs/current-status.md).
