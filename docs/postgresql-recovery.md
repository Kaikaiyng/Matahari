# PostgreSQL Backup and Restore Rehearsal

Run these operator tools in a POSIX shell with PostgreSQL 18 clients, `sha256sum`, and standard shell utilities. Use a protected `PGPASSFILE` or another libpq credential provider; passwords on the command line and `PGPASSWORD` are rejected. Backups contain private school data and belong outside Git, release ZIPs and public storage.

## Create a backup

Create a private backup directory, then run:

```sh
PGPASSFILE=/private/backup.pgpass sh deploy/scripts/backup-postgres.sh \
  --database matahari_production --host 127.0.0.1 --port 5432 \
  --username authorized_backup_operator --output-directory /private/backups
```

The script uses `pg_dump --format=custom`, private file permissions and a SHA-256 sidecar. It refuses to overwrite an existing archive/checksum. The source database is read only; it does not reset, seed or migrate it. The database operator needs read access to all required tables and sequences. Use a PostgreSQL client compatible with the server major version.

## Restore into a new disposable database

Only use an archive from a trusted database/operator: restoring a PostgreSQL dump can execute SQL from that database. The restore operator needs permission to create a database.

```sh
MATAHARI_POSTGRES_RESTORE_VERIFY=1 PGPASSFILE=/private/restore.pgpass \
  sh deploy/scripts/verify-postgres-restore.sh \
  --archive /private/backups/matahari_production-<UTC-timestamp>.dump \
  --database matahari_restore_verify_rehearsal \
  --host 127.0.0.1 --port 5432 --username authorized_restore_operator
```

The tool requires the `matahari_restore_verify_<name>` pattern, explicit opt-in and an absent target database. It verifies the checksum and custom archive format, creates a new database, restores with fail-fast/no-owner/no-privileges flags, reports student/finance/audit counts and checks that owned sequences are not behind their table IDs. Existing databases are never overwritten. It retains the new database on success or failure and prints a cleanup command for the operator to review.

These checks establish restore operability and sequence readiness. Counts must still be reconciled with the source at the backup snapshot; the script does not prove business totals, restore runtime grants, back up media files, provide encryption/off-site storage, schedule retention, or implement WAL/PITR. A full recovery requires the matching application artifact, private configuration, files, runtime grants and source reconciliation. See [Deployment Foundation](deployment-foundation.md) and [PostgreSQL](postgresql.md).
