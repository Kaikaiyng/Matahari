# Matahari School Management System

Matahari is an administration and finance workflow MVP for Matahari International School. It supports a stakeholder demo and continued development of student, fee, payment, receipt, and calendar workflows. It is not yet a complete academic ERP or a production deployment package.

## Current Scope

Implemented workflows include:

- Username/password login with Laravel session cookies and seeded role permissions.
- Student search, creation, detail, status changes, and read-only class rosters.
- Versioned Fee Agreements and billing configuration.
- Fee Record preview, activation, manual charges, outstanding balances, summary, and category/month views.
- Payment allocation, verification, void safeguards, receipt generation, browser printing, and receipt void/regeneration.
- Shared school calendar CRUD.
- Responsive desktop, tablet, and mobile administration UI.
- Secure audit schema/logger foundation and request IDs.

Important boundaries:

- Payments and receipts are implemented inside Student Detail; their top-level navigation pages remain placeholders.
- Parents, fee catalogue management, invoices, reports, exports, settings, user management, password reset, and production deployment are incomplete or not implemented.
- Audit logging is not yet connected to normal business mutations, and there is no Audit Trail API or frontend.
- The legacy dashboard and monthly invoice endpoints have unresolved authorization and school-scope gaps. See [Current Status](docs/current-status.md).

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

Create or reset only the ignored local demo SQLite database:

```powershell
tools\php\reset-demo-sqlite.cmd
```

This command runs `migrate:fresh --seed` against `backend/database/database.sqlite`. Do not adapt it to a database containing valuable data. Seeded users are demo-only; inspect the seeder locally if credentials are needed, and never reuse them in a deployed environment.

Start the API in one terminal:

```powershell
tools\php\serve-demo-backend.cmd
```

Start the React frontend in another terminal:

```powershell
cd frontend
npm.cmd run dev
```

The frontend defaults to `http://127.0.0.1:8000/api`. To change it, create an untracked `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

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

`npm.cmd run build` runs `tsc -b` before the Vite production build. No PHP static-analysis command or automated CI workflow is currently configured. MariaDB and rollback validation require the disposable-database workflow in [Testing and Release](docs/testing-and-release.md); the default SQLite test suite is not sufficient proof.

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
- Production session cookie, proxy trust, CSRF, login throttling, database grants, backup/restore, and deployment hardening require review before launch.
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
- [Documentation Index](docs/README.md)

## Current Limitations

- No formal load or concurrency limit has been validated. Historical planning used approximately 200 students for cost estimation only; this is not a tested capacity claim.
- The default automated backend suite uses SQLite and cannot prove MariaDB JSON, index, locking, foreign-key, or rollback behavior.
- No stable hosting, production environment, CI pipeline, monitoring, or verified backup/restore process is included.
- User administration and password reset are not implemented.
- General reports, exports, statements, reminders, parent portal, PDF generation, and academic ERP modules are not implemented.
- Important security and financial-integrity risks remain open; the system must not be described as production-ready. See [Current Status](docs/current-status.md).
