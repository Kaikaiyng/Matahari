# SQLite to MariaDB Local Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the current local Matahari data from SQLite to MariaDB and open a working localhost phpMyAdmin instance without deleting the SQLite source.

**Architecture:** Install MariaDB as a local Windows service, build an empty `matahari` schema from Laravel migrations, and use a one-time PHP transfer script with independent SQLite and MariaDB PDO connections. Validate all table counts and application connectivity before changing Laravel's ignored local `.env`; install phpMyAdmin under the user's local application data directory and expose it only on localhost.

**Tech Stack:** Windows PowerShell, MariaDB 12.x, PHP 8.4 with `pdo_mysql`, Laravel 13 migrations, SQLite, phpMyAdmin.

## Global Constraints

- Preserve `backend/database/database.sqlite` unchanged and create a timestamped backup.
- Do not change backend business logic, deploy, host, or expose phpMyAdmin to the LAN or internet.
- Do not commit credentials or the phpMyAdmin distribution.
- Do not switch Laravel away from SQLite until schema, transfer, and row-count validation pass.

---

### Task 1: Establish the rollback baseline

**Files:**
- Read: `backend/.env`
- Read: `backend/database/database.sqlite`
- Create locally: `backend/database/backups/database-before-mariadb-<timestamp>.sqlite`

**Interfaces:**
- Consumes: the active SQLite file and ignored Laravel environment configuration.
- Produces: a byte-for-byte SQLite backup and a table/count baseline for later comparison.

- [ ] Record the SQLite SHA-256 hash, table names, row counts, and current Laravel connection.
- [ ] Copy the SQLite file into the timestamped backup path.
- [ ] Verify the backup SHA-256 equals the source hash.

### Task 2: Install and initialize MariaDB

**Files:**
- Modify locally: MariaDB service configuration and data directory managed by the installer.
- Modify locally: `backend/.env` only after Task 4 passes.

**Interfaces:**
- Consumes: MariaDB package `MariaDB.Server` and local-only credentials.
- Produces: a healthy local MariaDB service, an empty `matahari` database, and a restricted `matahari_app@localhost` account.

- [ ] Install MariaDB using WinGet and confirm the Windows service is running.
- [ ] Generate local credentials without committing them.
- [ ] Create the UTF-8 `matahari` database and grant only that schema to the application account.
- [ ] Verify PHP can connect with PDO MySQL.

### Task 3: Create the MariaDB schema and transfer data

**Files:**
- Create temporarily: `tools/migrate-sqlite-to-mariadb.php`
- Read: `backend/database/migrations/*.php`

**Interfaces:**
- Consumes: the SQLite source, empty MariaDB database, application credentials, and existing Laravel migrations.
- Produces: a MariaDB schema containing the same application rows and identifiers as SQLite.

- [ ] Run the existing Laravel migrations against the empty MariaDB database using process-scoped environment overrides.
- [ ] Create a one-time transfer script that reads both schemas, intersects matching columns, disables MariaDB foreign-key checks only for the import transaction, uses prepared inserts, and preserves primary keys.
- [ ] Run the transfer once against the new database and fail immediately on any insert error.
- [ ] Restore foreign-key checks and remove the temporary transfer script after successful validation.

### Task 4: Validate and activate MariaDB

**Files:**
- Modify locally: `backend/.env`

**Interfaces:**
- Consumes: SQLite count baseline and migrated MariaDB data.
- Produces: Laravel configured for the verified MariaDB database with a documented SQLite rollback path.

- [ ] Compare every common application table's row count between SQLite and MariaDB.
- [ ] Check MariaDB foreign-key consistency and verify primary-key maximum values for populated tables.
- [ ] Update the ignored local `.env` to `DB_CONNECTION=mariadb` with localhost connection fields.
- [ ] Clear Laravel configuration cache and verify the runtime driver and database name.
- [ ] Run backend tests in their isolated test environment and exercise login plus representative read endpoints against the local MariaDB-backed server.

### Task 5: Install and open phpMyAdmin

**Files:**
- Create locally outside repository: `%LOCALAPPDATA%\Matahari\phpMyAdmin\`
- Create locally outside repository: `%LOCALAPPDATA%\Matahari\phpMyAdmin\config.inc.php`

**Interfaces:**
- Consumes: official phpMyAdmin release, PHP 8.4 extensions, and localhost MariaDB.
- Produces: a localhost-only phpMyAdmin browser session showing the `matahari` database.

- [ ] Download the current official phpMyAdmin all-languages ZIP and verify extraction.
- [ ] Configure cookie authentication, a random blowfish secret, and MariaDB host `127.0.0.1`.
- [ ] Start PHP's local web server on an available localhost port and confirm its HTTP response.
- [ ] Open phpMyAdmin in the default browser and verify the login page and `matahari` database access.
- [ ] Report the localhost URL, application database username, backup location, validation evidence, and rollback command.
