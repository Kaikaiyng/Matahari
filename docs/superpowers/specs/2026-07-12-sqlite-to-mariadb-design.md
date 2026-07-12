# SQLite to MariaDB Local Migration Design

## Goal

Migrate the Matahari Laravel application's current local SQLite data to a local MariaDB database and provide phpMyAdmin for browser-based administration, without losing the original SQLite database or changing application business logic.

## Scope

- Install a local MariaDB server and the PHP MySQL extensions required by Laravel and phpMyAdmin.
- Create a dedicated `matahari` database and a local application user.
- Build the MariaDB schema from the existing Laravel migrations.
- Copy all application data from `backend/database/database.sqlite`, preserving primary keys and relationships.
- Verify table-by-table row counts and representative application flows before switching Laravel's local `.env` connection.
- Install phpMyAdmin outside the repository, configure cookie authentication, bind it to localhost, and open it in the desktop browser.
- Preserve the original SQLite database and create a timestamped backup before migration.

## Architecture and Data Flow

Laravel will use its existing `mariadb` connection configuration. The new schema will be created in an empty MariaDB database by the existing migrations. A one-time local transfer process will read SQLite rows and insert them into matching MariaDB tables while foreign-key checks are temporarily suspended for the import. The transfer will preserve identifiers; MariaDB auto-increment counters will then be verified against imported maximum IDs.

The active application connection will remain SQLite until schema creation, transfer, and validation succeed. Only then will `backend/.env` be updated to use MariaDB and Laravel's configuration cache be cleared.

phpMyAdmin will run through the existing local PHP runtime and connect to MariaDB on `127.0.0.1:3306`. Its web server will bind to `127.0.0.1`, so database administration is available only from this computer. This does not alter the existing iPad-facing frontend/backend LAN services.

## Safety and Rollback

- The SQLite source is never modified by the transfer.
- A timestamped SQLite backup is created before any database setup.
- MariaDB is initialized in a newly created, empty database; destructive migration commands are not run against the SQLite source.
- Laravel is switched only after schema and data validation.
- Rollback consists of restoring the prior SQLite variables in `backend/.env` and clearing Laravel's configuration cache.
- Credentials remain in ignored local configuration and are not committed.

## Error Handling

Installation, schema creation, import, and validation are separate gates. A failure stops the process before the next gate. Import errors leave the application using SQLite. If validation fails, the MariaDB database is treated as incomplete and is not activated.

## Verification

- Confirm MariaDB service health and PHP `pdo_mysql`/`mysqli` availability.
- Run Laravel migrations against the new empty database.
- Compare every migrated table's SQLite and MariaDB row counts.
- Verify imported primary-key maxima and foreign-key integrity.
- Clear configuration and confirm Laravel reports the MariaDB connection.
- Run backend automated tests without destroying migrated local data.
- Exercise login and representative read APIs against the MariaDB-backed local server.
- Open phpMyAdmin and confirm the `matahari` schema and tables are visible.

## Out of Scope

- Production deployment, hosting, remote database exposure, Cloudflare tunnels, and architecture or business-logic changes.
- Removing the SQLite source or backup.
- Exposing phpMyAdmin to the LAN or internet.
