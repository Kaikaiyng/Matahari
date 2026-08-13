# Development Setup

Status: Current local-development guide

Last verified for the current Admin and Community App web stacks: 2026-08-13

The repository has separate `frontend/` (Admin) and `app/` (Parent/Student/Teacher/Staff Community App) web workspaces. There is still no native toolchain: do not install Capacitor, Firebase, Sanctum, Android, or iOS dependencies from this guide. See [Mobile Product Architecture and Roadmap](mobile-product-roadmap.md).

## 1. Local Stack

- Admin and Community App: separate React 19, TypeScript 6, Vite 8, Node.js, and `npm.cmd` workspaces
- Backend: Laravel 13 on PHP 8.4
- Local database: SQLite for the repeatable demo; MariaDB remains available for development environments
- Test database: SQLite `:memory:` through `backend/phpunit.xml`

The repository provides PHP helpers under `tools/php/`:

| File | Purpose |
| --- | --- |
| `php.ini` | Enables project extensions including `pdo_mysql`, `pdo_sqlite`, `mysqli`, `intl`, and `mbstring` |
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

## 3. Community App Setup

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

`reset-demo-sqlite.cmd` hard-pins Laravel to `backend/database/database.sqlite` before running `migrate:fresh --seed`. It never resets MariaDB or changes `backend/.env`. The seeded demo includes unpaid, fully paid with receipt, partially paid, and not-yet-configured student accounts.

## 5. General Backend Development

From `backend/`:

```powershell
Copy-Item .env.example .env
..\tools\php\php-local.cmd artisan key:generate
..\tools\php\php-local.cmd artisan migrate:fresh --seed --force
```

Then start the API from the repository root with `tools\php\serve-backend.cmd`. This direct launcher keeps the project PHP configuration active in the long-running server process on Windows.

For an existing database, use `artisan migrate --force` instead of `migrate:fresh`.

Run tests:

```powershell
..\tools\php\php-local.cmd vendor\bin\phpunit
```

## 6. Database Options

### SQLite

The repository example configuration uses SQLite:

```dotenv
DB_CONNECTION=sqlite
```

SQLite is suitable for a new contributor, automated tests, and rollback. The local database file is ignored and must not be committed.

### MariaDB

Use a restricted local account and private `.env` values:

```dotenv
DB_CONNECTION=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=matahari
DB_USERNAME=your_local_app_user
DB_PASSWORD=your_local_password
```

After changing database settings:

```powershell
..\tools\php\php-local.cmd artisan config:clear
..\tools\php\php-local.cmd artisan migrate --force
```

Do not publish database or phpMyAdmin credentials. phpMyAdmin is an optional local operator tool, not an application dependency.

Fresh MariaDB schema creation has one known migration-order caveat. Read [Database Design](DATABASE_DESIGN.md) before running a clean MariaDB migration.

## 7. Seeded Local Accounts

The seeder creates local `.test` users for Super Admin, School Admin, and Finance roles. Their development password is defined in `backend/database/seeders/DatabaseSeeder.php`.

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

The backend CORS configuration must allow that exact frontend origin. Keep MariaDB port `3306` and phpMyAdmin bound to `127.0.0.1`; the iPad only needs the frontend and API ports.

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

As of merged `master` on 2026-08-13:

- Admin tests: 169 passed across 15 files; build passed; lint exited 0 with 9 known Fast Refresh organization warnings
- Community App tests: 16 passed across 3 files; lint and build passed
- Backend after the data-foundation slice: 260 tests discovered, 250 passed, 10 MariaDB-only inspections skipped under SQLite, and 1,339 assertions
- API inventory: 74 non-vendor routes
- Disposable schema after the Community App data-foundation migrations: 61 non-SQLite-internal tables
- Disposable MariaDB 11.4 lifecycle and dedicated Community/Assessment/Quiz FK/index inspection: passed in GitHub qualification run `31661265923` (59 MariaDB assertions)
- Deployment contract tests: 18 passed

## Audit MariaDB Integration Test

The default PHPUnit suite uses in-memory SQLite and cannot prove MariaDB JSON, index, row-lock, or concurrency behavior. Run audit database integration tests against a disposable MariaDB database:

```powershell
$env:DB_CONNECTION='mariadb'
$env:DB_URL=''
$env:DB_HOST='127.0.0.1'
$env:DB_PORT='3306'
$env:DB_DATABASE='matahari_audit_test'
$env:DB_USERNAME='matahari_test'
$env:DB_PASSWORD='matahari_test'
$env:AUDIT_MARIADB_DESTRUCTIVE_TEST='1'
Push-Location backend
try {
    ..\tools\php\php-local.cmd artisan test --group=mariadb
}
finally {
    Pop-Location
    Remove-Item Env:\AUDIT_MARIADB_DESTRUCTIVE_TEST -ErrorAction SilentlyContinue
    Remove-Item Env:\DB_CONNECTION, Env:\DB_URL, Env:\DB_HOST, Env:\DB_PORT, Env:\DB_DATABASE, Env:\DB_USERNAME, Env:\DB_PASSWORD -ErrorAction SilentlyContinue
}
```

The guarded test owns `migrate:fresh`; do not run a separate unguarded refresh. Before dropping any tables, it requires the explicit opt-in, rejects a non-empty `DB_URL`, requires Laravel's `mariadb` driver, and verifies through read-only queries that the connected server identifies itself as MariaDB and the actual database is exactly `matahari_audit_test`.

The database must contain no valuable data because the test drops its tables. The cleanup block clears the opt-in and all temporary database variables even when the test fails. A skipped MariaDB-group test under SQLite is not acceptance evidence.
