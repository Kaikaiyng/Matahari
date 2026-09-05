# Development Setup

Status: Current local-development guide

Last verified for the current Admin and School App web stacks: 2026-09-05

The repository has separate Matahari `frontend/` (Admin) and `app/` (Parent/Student/Teacher School App) web workspaces. Local seed domains are `localhost` for Admin and `127.0.0.1` for App; both proxy `/api` to the shared backend. Dedicated mode resolves both to `mis`. There is no Staff App persona and still no native toolchain. See [Tenancy Foundation and Future RYLAY SaaS](saas-multitenancy.md) and [Mobile Product Architecture and Roadmap](mobile-product-roadmap.md).

## 1. Local Stack

- Admin and School App: separate React 19, TypeScript 6, Vite 8, Node.js, and `npm.cmd` workspaces
- Backend: Laravel 13 on PHP 8.4
- Local database: PostgreSQL 18; SQLite remains an explicit disposable demo option
- Test databases: SQLite `:memory:` by default plus a guarded disposable PostgreSQL release run

The repository provides PHP helpers under `tools/php/`:

| File | Purpose |
| --- | --- |
| `php.ini` | Enables project extensions including `pdo_pgsql`, `pdo_sqlite`, `intl`, and `mbstring` |
| `php-local.cmd` | Runs PHP with the project configuration |
| `php-local.ps1` | PowerShell equivalent of the project PHP launcher |
| `serve-backend.cmd` | Starts Laravel locally |
| `reset-demo-sqlite.cmd` | Safely rebuilds only the ignored local demo SQLite file and seeds realistic scenarios |
| `serve-demo-backend.cmd` | Starts the demo API with SQLite, file sessions, and debug output disabled |

Temporary HTTPS demo helpers and their tests live under `tools/public-demo/`. They are separate from normal local development; see [Temporary Public Demo](PUBLIC_DEMO.md).

Plain `php` on this machine does not automatically load `tools/php/php.ini`. Prefer the provided launcher.

## 2. Admin Setup

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Default URL:

```text
http://localhost:5173
```

The API defaults to `http://127.0.0.1:8000/api`. Override it in `frontend/.env.local`:

```dotenv
VITE_API_PROXY_TARGET=http://127.0.0.1:8000
```

Production verification:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## 3. School App Setup

In a second terminal:

```powershell
cd app
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5174`. Keep Admin on `http://localhost:5173`; the distinct local hosts isolate host-only browser session cookies while both Vite servers proxy `/api` to the same Laravel backend. Validate this workspace independently with `npm.cmd test`, `npm.cmd run lint`, and `npm.cmd run build`.

## 4. Demo Backend Setup

From the repository root:

```powershell
tools\php\reset-demo-sqlite.cmd
tools\php\serve-demo-backend.cmd
```

`reset-demo-sqlite.cmd` hard-pins Laravel to `backend/database/database.sqlite` before running `migrate:fresh --seed`. It never resets PostgreSQL or changes `backend/.env`. The seeded demo includes unpaid, fully paid with receipt, partially paid, and not-yet-configured student accounts.

## 5. General Backend Development

From `backend/`:

```powershell
Copy-Item .env.example .env
..\tools\php\php-local.cmd artisan key:generate
..\tools\php\php-local.cmd artisan migrate --force
```

Then start the API from the repository root with `tools\php\serve-backend.cmd`. This direct launcher keeps the project PHP configuration active in the long-running server process on Windows.

For an existing database, use `artisan migrate --force` instead of `migrate:fresh`.

Run tests:

```powershell
..\tools\php\php-local.cmd vendor\bin\phpunit
```

## 6. Database Options

### PostgreSQL

The repository example configuration uses PostgreSQL and dedicated Matahari tenancy. Use a private restricted account:

```dotenv
TENANCY_MODE=dedicated
TENANCY_DEDICATED_TENANT_SLUG=mis
TENANCY_LOCAL_TENANT_SLUG=mis
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=matahari
DB_USERNAME=your_local_app_user
DB_PASSWORD=your_local_password
DB_SSLMODE=prefer
```

After changing database settings:

```powershell
..\tools\php\php-local.cmd artisan config:clear
..\tools\php\php-local.cmd artisan migrate --force
```

Full setup, disposable-test safeguards, backup and restore guidance are in [PostgreSQL](postgresql.md). Never run `migrate:fresh` against the active development, staging or production database.

### Optional SQLite demo

The explicit demo launchers set `DB_CONNECTION=sqlite` themselves. SQLite is suitable for a disposable seeded demo and the default automated compatibility suite. The local database file is ignored and must not be committed.

## 7. Seeded Local Accounts

The seeder creates fictional local `.test` identities covering Super Admin, School Admin, Finance, Teacher, Parent, and Student use. Active employee positions are School Admin, Finance, and Teacher; Super Admin is the protected platform owner. Their development password is defined in `backend/database/seeders/DatabaseSeeder.php`.

Seeded credentials are local-only. Do not reuse them in any deployed environment.

## 8. iPad and LAN Demo

Connect the computer and iPad to the same trusted network. Find the computer's IPv4 address, then start the backend and frontend with host access.

The provided demo server binds to localhost for safety. For intentional LAN testing, run the built-in server with the same explicit demo environment from a temporary PowerShell session:

```powershell
$env:APP_ENV='local'
$env:APP_DEBUG='false'
$env:DB_CONNECTION='sqlite'
$env:DB_DATABASE=(Resolve-Path 'backend\database\database.sqlite').Path
$env:SESSION_DRIVER='file'
cd backend\public
php -c ..\..\tools\php\php.ini -S 0.0.0.0:8000 -t . ..\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php
```

Frontend PowerShell session:

```powershell
$env:VITE_API_BASE_URL='http://YOUR_LAN_IP:8000/api'
cd frontend
npm.cmd run dev -- --host 0.0.0.0
```

Open on the iPad:

```text
http://YOUR_LAN_IP:5173
```

The backend CORS configuration must allow that exact frontend origin. Keep PostgreSQL bound to `127.0.0.1` or a private container network; the iPad only needs the frontend and API ports.

## 9. Responsive QA Sizes

- Desktop: 1440x900
- iPad landscape: 1180x820
- iPad portrait: 820x1180
- Mobile portrait: 390x844

Follow [Demo Review Script](DEMO_REVIEW_SCRIPT.md) for the test sequence.

For repository ownership, API layering, files that must change together, and the publish checklist, use the [Maintenance Guide](MAINTENANCE_GUIDE.md).

## 10. Troubleshooting

### PHP reports missing extensions

Run through `tools/php/php-local.cmd` or pass the config explicitly:

```powershell
php -c ..\tools\php\php.ini artisan about
```

### Frontend cannot log in

Check:

- `VITE_API_BASE_URL` includes `/api`
- backend is reachable from the browser device
- backend CORS includes the frontend origin
- browser accepts the session cookie
- Laravel configuration cache was cleared after `.env` changes

### PowerShell blocks npm

Use `npm.cmd` rather than `npm`.

## 11. Verified Baseline

The 2026-09-04 PostgreSQL transition passed the complete backend suite on PostgreSQL and SQLite, a full migration/rollback/re-migration lifecycle, deployment grant restrictions, local data reconciliation and an isolated backup restore. The 2026-09-05 dedicated/store changes add focused backend/App tests plus successful App lint/build, Pint, route loading and deployment contracts. Exact counts and the current GitHub result are recorded in [Current Status](current-status.md).

## Disposable PostgreSQL Qualification

The default PHPUnit suite uses in-memory SQLite and cannot prove PostgreSQL locking, generated-column, foreign-key, or concurrency behavior. Run the full suite only against a newly created disposable database named exactly `matahari_test`:

```powershell
$env:DB_CONNECTION='pgsql'
$env:DB_URL=''
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='5432'
$env:DB_DATABASE='matahari_test'
$env:DB_USERNAME='your_private_test_user'
$env:DB_PASSWORD='your_private_test_password'
$env:MATAHARI_PGSQL_TEST_ALLOW_RESET='1'
Push-Location backend
try {
    ..\tools\php\php-local.cmd vendor\bin\phpunit
}
finally {
    Pop-Location
    Remove-Item Env:\MATAHARI_PGSQL_TEST_ALLOW_RESET -ErrorAction SilentlyContinue
    Remove-Item Env:\DB_CONNECTION, Env:\DB_URL, Env:\DB_HOST, Env:\DB_PORT, Env:\DB_DATABASE, Env:\DB_USERNAME, Env:\DB_PASSWORD -ErrorAction SilentlyContinue
}
```

The guarded test owns schema reset. Before dropping tables, `Tests\TestCase` requires the explicit opt-in, rejects a non-empty `DB_URL`, requires Laravel's `pgsql` driver, and verifies that both the configured and actual database names are exactly `matahari_test`. The database must contain no valuable data. A SQLite pass is compatibility evidence, not PostgreSQL release evidence.
