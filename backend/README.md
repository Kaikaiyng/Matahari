# Matahari Backend

The backend is a Laravel 13 JSON API for the Matahari Admin Finance MVP. It owns authentication, authorization, financial validation, Fee Record charges, payment allocation, and receipt integrity.

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
DB_DATABASE=matahari
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

The current schema has 36 tables. The full domain grouping and MariaDB fresh-install caveat are documented in [Database Design](../docs/DATABASE_DESIGN.md).

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

## API Inventory

The application currently exposes 35 non-vendor API routes. Generate the authoritative list with:

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

Last verified on 2026-07-22:

```text
116 tests
721 assertions
```

## Deferred Backend Scope

- Statements and reminders
- General reports and exports
- PDF generation
- Parent Portal
- Remaining production dashboard/invoice reporting beyond the implemented Fee Record outstanding total
- Deployment and hosting automation
