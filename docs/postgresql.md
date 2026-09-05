# PostgreSQL

PostgreSQL 18.6 is the Matahari development and deployment database from 2026-09-04. Admin and School App share one Laravel API and database. Tenant, school, permissions, financial-history and audit boundaries remain enforced. Dedicated mode separately locks runtime resolution to the `mis` tenant and disables platform tenant-management routes.

## Local development

The example environment now selects `pgsql`. Install PostgreSQL 18 and enable PHP `pdo_pgsql`, create an empty development database owned by your development account, and configure the private `backend/.env` before running migrations:

```dotenv
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=matahari
DB_USERNAME=matahari
DB_PASSWORD=
DB_SSLMODE=prefer
```

Supply the password privately; the blank example is not a configured credential. Clear any old `DB_URL` or process-level `DB_*` override. Managed remote databases should use the provider's certificate and `DB_SSLMODE=verify-full`. The private Docker network uses `DB_HOST=postgres`, port `5432`, and `DB_SSLMODE=disable`; do not expose that service port publicly.

```powershell
cd backend
..\tools\php\php-local.cmd artisan config:clear
..\tools\php\php-local.cmd artisan migrate --force
cd ..
tools\php\serve-backend.cmd
```

On the current Windows workstation a separate portable installation lives at `%LOCALAPPDATA%\Matahari\PostgreSQL`, listens only on `127.0.0.1:55433`, and uses database `matahari`. Its credentials are private local files and `backend/.env`; none belong in Git. `serve-backend.cmd` starts this installed cluster when needed, then uses Laravel's configured database. It never seeds, clears or recreates a database. Other projects' database services are separate.

The one-time SQLite copy retained the original `backend/database/database.sqlite` and a consistent snapshot at `%LOCALAPPDATA%\Matahari\PostgreSQL\sqlite-before-postgres-20260904.sqlite`. All 84 tables / 502 rows were reconciled by normalized row hashes, including financial and audit history; foreign keys were validated and sequences advanced beyond imported IDs. Normalization accounts for native dates, booleans and decimal representations, without changing their application values. The import used a new destination; it is not a reusable production migration command.

`serve-demo-backend.cmd`, `reset-demo-sqlite.cmd` and the temporary public-demo launcher remain explicit legacy SQLite tools. Do not use them to start or reset the PostgreSQL application. PHPUnit's default SQLite in-memory database is a separate compatibility test environment.

## Tests and migrations

Full qualification runs the entire backend suite on PostgreSQL, a complete migration/rollback/re-migration lifecycle, schema constraints, deployment grants and a separate SQLite regression suite. Set these process variables only for a newly created disposable `matahari_test` database, with its private test credentials:

```powershell
$env:DB_CONNECTION = 'pgsql'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '5432'
$env:DB_DATABASE = 'matahari_test'
$env:DB_URL = ''
$env:MATAHARI_PGSQL_TEST_ALLOW_RESET = '1'
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit
```

Set `DB_USERNAME` / `DB_PASSWORD` privately before running. PostgreSQL tests refuse to initialize unless the opt-in, configured database, actual database and empty URL agree. Tests rebuild tables. Never point them at the development, staging, production or restored-data database. A SQLite-only pass is not PostgreSQL release evidence.

The historical tenant-hardening migration gained an additive PostgreSQL generated-column branch because a later corrective migration cannot run past its previous unsupported-driver exception. Existing SQLite/MySQL branches are retained. Other migration files are unchanged. Historical upgrade tests now respect foreign-key dependency order. Fee-agreement creation locks the student row before checking current agreements and calculating the next version, including when no agreement exists yet. Text searches explicitly retain case-insensitive behavior.

## Deployment and recovery

Repository-owned backup and disposable restore tools are documented in [PostgreSQL Backup and Restore Rehearsal](postgresql-recovery.md). They require explicit database/archive inputs and never overwrite an existing restore target.

Docker uses `postgres:18.6-bookworm` and a new `matahari_postgres_data` volume at `/var/lib/postgresql`, matching the [official PostgreSQL 18 image layout](https://github.com/docker-library/postgres/blob/master/18/bookworm/Dockerfile). It never reuses a MariaDB volume. Existing operational network/release names remain compatible with the application Compose stack.

Initialization creates `matahari_staging` and `matahari_production`, each with a separate migrator owner and runtime account. Run migrations as that database's migrator, then run `apply-runtime-grants.sh` as the administrator inside the database container. Repeat grants after adding tables. Runtime users have ordinary table CRUD, sequence usage, read-only migration history, and only `SELECT, INSERT` on `audit_logs`. They cannot create schema objects or connect to the other environment. Credentials with ownership, elevated flags or role memberships are rejected by the grant script.

Back up with PostgreSQL's [custom-format pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html), then restore into a newly created, separate database using `pg_restore --exit-on-error --no-owner --no-privileges`. Use private `PGPASSFILE` or protected process credentials. Recreate owners and apply runtime grants separately when restoring to another server. Reconcile all tables, receipts, payment totals, audit rows and sequence state before switching application connections. Back up uploaded files separately.

The local copy has a custom-format backup and a disposable restore rehearsal. Automated scheduling, encrypted off-site storage, WAL archival / point-in-time recovery, Docker startup, hosted deployment and production recovery are **Not configured / Not verified**. A local backup file alone does not provide those capabilities.

Keep old SQLite data and the previous private environment until the new connection is accepted. Switching back after PostgreSQL has received new writes requires reconciling those writes; simply selecting the old SQLite file would omit them.
