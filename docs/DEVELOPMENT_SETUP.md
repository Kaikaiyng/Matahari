# Development Setup

Status: Current local-development guide

Last verified: 2026-07-21

## 1. Local Stack

- Frontend: React 19, TypeScript 6, Vite 8, Node.js, and `npm.cmd`
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

Plain `php` on this machine does not automatically load `tools/php/php.ini`. Prefer the provided launcher.

## 2. Frontend Setup

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Default URL:

```text
http://127.0.0.1:5173
```

The API defaults to `http://127.0.0.1:8000/api`. Override it in `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

Production verification:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

## 3. Demo Backend Setup

From the repository root:

```powershell
tools\php\reset-demo-sqlite.cmd
tools\php\serve-demo-backend.cmd
```

`reset-demo-sqlite.cmd` hard-pins Laravel to `backend/database/database.sqlite` before running `migrate:fresh --seed`. It never resets MariaDB or changes `backend/.env`. The seeded demo includes unpaid, fully paid with receipt, partially paid, and not-yet-configured student accounts.

## 4. General Backend Development

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

## 5. Database Options

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

## 6. Seeded Local Accounts

The seeder creates local `.test` users for Super Admin, School Admin, and Finance roles. Their development password is defined in `backend/database/seeders/DatabaseSeeder.php`.

Seeded credentials are local-only. Do not reuse them in any deployed environment.

## 7. iPad and LAN Demo

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

## 8. Responsive QA Sizes

- Desktop: 1440x900
- iPad landscape: 1180x820
- iPad portrait: 820x1180
- Mobile portrait: 390x844

Follow [Demo Review Script](DEMO_REVIEW_SCRIPT.md) for the test sequence.

## 9. Troubleshooting

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

## 10. Verified Baseline

As of 2026-07-21:

- Frontend tests: 59 passed
- Frontend lint: zero errors and zero warnings
- Frontend build: passed
- Backend: 112 tests and 696 assertions
- API inventory: 30 routes
- Active demo schema: 36 tables
