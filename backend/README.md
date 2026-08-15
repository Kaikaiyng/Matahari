# RYLAY Backend

The backend is the shared Laravel 13 JSON API for the MIS Admin Panel and Community App. It owns authentication, authorization, school scope, academic foundations, portal relationship scope, daily Attendance, audit integration, financial validation, Fee Record charges, payment allocation, and receipt integrity.

## Requirements

- PHP 8.3 or newer; the current local runtime is PHP 8.4
- Composer dependencies from `composer.lock`
- PHP extensions enabled by `../tools/php/php.ini`
- SQLite or MariaDB

Use the project launcher on Windows:

```powershell
..\tools\php\php-local.cmd artisan --version
```

## Environment

Create `backend/.env` from `.env.example`, generate an application key, and keep all credentials local:

```powershell
Copy-Item .env.example .env
..\tools\php\php-local.cmd artisan key:generate
```

The default example uses SQLite:

```dotenv
DB_CONNECTION=sqlite
```

For MariaDB, use local values and a restricted application account:

```dotenv
DB_CONNECTION=mariadb
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=rylay
DB_USERNAME=your_local_app_user
DB_PASSWORD=your_local_password
```

Never commit the populated `.env` file.

## Database Setup

For a new SQLite development database:

```powershell
..\tools\php\php-local.cmd artisan migrate:fresh --seed --force
```

For an existing local database:

```powershell
..\tools\php\php-local.cmd artisan config:clear
..\tools\php\php-local.cmd artisan migrate --force
```

The current disposable demo schema has 43 non-SQLite-internal tables, including Laravel infrastructure. The full domain grouping and MariaDB lifecycle requirements are documented in [Database](../docs/database.md).

## Start the API

```powershell
..\tools\php\php-local.cmd artisan serve --host=127.0.0.1 --port=8000
```

Or from the repository root:

```powershell
tools\php\serve-backend.cmd
```

The default API base is `http://127.0.0.1:8000/api`.

## Implemented Domain Areas

- Session login, logout, and current user
- Username-based staff authentication with generic invalid/inactive credential errors
- Roles, permissions, user-role assignments, and permission middleware
- Student list, create, update, detail, status changes, and class lookup
- School-scoped shared calendar events
- Fee item lookup
- Versioned Fee Agreements and superseding
- Fee Record charge preview, activation, manual charges, and outstanding charges
- Payment creation, allocation, verification, history, and void safeguards
- Receipt creation, detail, print view, history, voiding, and regeneration
- Fee Record Summary and Category Monthly ledger APIs
- Legacy dashboard and monthly invoice-generation endpoints retained from the initial scaffold
- Academic years, subjects, class enrolment history, teaching assignments, and foundation account/portal-link management
- Parent and Student self-service identity/finance/attendance reads
- User-scoped portal notifications
- Teacher assignment-scoped daily Attendance marking and correction audit

## API Inventory

The application currently exposes 74 non-vendor API routes. Generate the authoritative list with:

```powershell
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
```

Main route groups:

| Group | Examples |
| --- | --- |
| Auth | `POST /api/login`, `POST /api/logout`, `GET /api/me` |
| Calendar | visible-range list, create, update, and delete |
| Students and classes | class lookup plus student list, create, detail, update, and status |
| Fee Agreements | student agreement list/create, show, and supersede |
| Fee Record | preview, activate, manual charge, outstanding, summary, and category monthly |
| Payments | student history/create, verify, and void |
| Receipts | student history, create from payment, show, print, and void |
| Academic foundation | academic years, subjects, enrolments, teaching assignments, staff/foundation accounts, and portal links |
| Portal self-service | Parent/Student identity, finance/attendance reads, and notifications |
| Teacher scope | assigned classes/students and daily Attendance read/write |

See [System Architecture](../docs/SYSTEM_ARCHITECTURE.md) for the complete endpoint table and finance data flow. See [Maintenance Guide](../docs/MAINTENANCE_GUIDE.md) for where route, validation, controller, service, model, and frontend request responsibilities belong.

## Authentication and Authorization

- Authentication uses Laravel sessions and cookies.
- Authenticated sessions expire after 480 minutes (8 hours) of inactivity by default.
- API session routes apply cookie encryption and session middleware.
- Protected routes use `auth` plus permission middleware such as `permission:payments.verify`.
- The frontend hides actions based on the same permission slugs, but the backend remains authoritative.
- School-owned records are scoped through their school relationships and current user context.

## Financial Integrity

- Fee Agreements are versioned; superseding preserves historical versions.
- Activated Fee Record charges are the source of expected balances in the current UI.
- Payment allocation cannot exceed the payment amount or selected outstanding charges.
- Payment verification and voiding are separate actions.
- A payment with an issued receipt cannot be casually voided.
- Receipt numbers are generated through a sequence and voided numbers are not recycled.
- Receipt item rows preserve the issued payment description and amount snapshot.

## Tests

```powershell
..\tools\php\php-local.cmd vendor\bin\phpunit
```

`phpunit.xml` forces SQLite `:memory:` so the automated suite does not modify the active local development/demo database.

Last verified on merged `master` on 2026-08-13:

```text
255 tests discovered
247 passed
8 opt-in MariaDB tests skipped
1,314 assertions
```

## Deferred Backend Scope

- Statements and reminders
- General reports and exports
- PDF generation
- Community Feed persistence/media, Assessment publication, and Quiz APIs
- Production-ready Parent Finance and guardian activation workflow
- Remaining production dashboard/invoice reporting beyond the implemented Fee Record outstanding total
- Deployment and hosting automation
