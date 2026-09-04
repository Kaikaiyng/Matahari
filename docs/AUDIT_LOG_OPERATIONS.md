# Audit Log Operations

**Reviewed:** 2026-08-26

The same append-only and least-privilege rules apply to Admin, Phase A foundation, finance, class/campus Attendance, employee Position/User Ability changes, and School Updates/Post Report audit events. Material Attendance, employee-access, School Update, student, and finance mutations write their audit row in the same transaction; a failed audit insert must roll back the mutation. Application Logs are a separate sanitized read-only operational view and never replace Audit Trail records.

## Security Boundary

RYLAY treats `audit_logs` as append-only for the application runtime. Laravel model guards prevent ordinary instance updates and deletes, but they do not stop bulk queries, raw SQL, migration credentials, or database administrators.

Before Production launch, use separate migration, recovery and runtime database identities. PostgreSQL is the active database. The runtime account must not own database/schema/table objects, have privileged role attributes or inherit another role. It receives CONNECT, schema USAGE, and direct table/sequence permissions only.

After migrations, run `deploy/database/apply-runtime-grants.sh` for the approved environment pair. The script grants `audit_logs` only SELECT/INSERT, migration history only SELECT, other application tables ordinary CRUD, and sequences USAGE/SELECT. It never grants TRUNCATE, schema CREATE or object ownership. PostgreSQL privileges are additive: inherited privileges or ownership would bypass a narrow table grant, so the script rejects those identities.

Keep migration/recovery credentials outside the web runtime. Local development uses a development owner for migrations; that is not a production privilege boundary. See [PostgreSQL](postgresql.md) and [Deployment Foundation](deployment-foundation.md).

## Trusted Proxy Requirement

Audit IP addresses are reliable only when Laravel trusts the exact reverse proxies controlled by the deployment. Never trust forwarded headers from every address on a publicly reachable origin. Local development records the direct peer address.

## Runtime Failure Behavior

Material business mutations must write their audit event inside the same database transaction and roll back if the write fails. Authentication audit writes are best-effort and use the dedicated redacted security log fallback introduced with authentication integration.

These are integration requirements for later phases, not a claim that every business mutation or authentication flow already has audit integration.

## Failed Migration Recovery

Before the column-addition stage starts, drain in-flight requests and queued jobs, then stop every old application process that can write `audit_logs`. Keep those writers quiesced until all three stages are recorded and the post-migration checks pass. Do not run old and upgraded writers continuously against the schema during this migration.

The secure audit schema upgrade is split into separately recorded column-addition, backfill, and constraint/index stages. If an unrecorded stage fails after MariaDB has committed some DDL, preserve the database and diagnose the original error before rerunning `php artisan migrate --force`. The stages inspect the live schema, keep existing backfilled UUIDs, fill only null Phase 1 values, and skip exact indexes or constraints that already exist.

The constraint stage repeats the null-only backfill immediately before enforcing invariants. This is a recovery defense for a row committed between recorded stages; it is not permission to leave mixed-version writers running during the upgrade.

Do not manually mark a failed stage as migrated, regenerate UUIDs, drop a same-named index, or delete legacy audit rows. The constraint stage deliberately stops if a required column is absent, a required backfill value is null, or a same-named index has a different definition. Treat any of those conditions as a recovery investigation requiring a backup and an explicit data repair plan.

A controlled rollback must run all three Phase 1 stages in reverse order. It removes only the secure audit indexes and columns; the pre-existing audit columns and rows remain.

## Verification Before Launch

Run `deploy/tests/verify-postgres-grants.sh` only on a new disposable test cluster with the explicit test opt-in and private test credentials. The script exercises the real initializer, migrator logins, grants, runtime logins and denial of connections to the other deployment database. `deploy/tests/postgres-grants.sql` verifies audit insertion/reading and normal cache CRUD, while audit UPDATE/DELETE/TRUNCATE, schema CREATE and migration-history DELETE must fail. Probe writes are rolled back.

CI runs this check with synthetic data. A production account still needs a separately reviewed restore rehearsal; do not run these test initialization or mutation probes against a valuable database. A table-level grant alone is insufficient if object ownership or another role still grants broader authority.

After the boundary checks:

1. Confirm migration credentials can run forward migrations during a controlled release.
2. Confirm audit rows are included in encrypted off-site PostgreSQL backups and configured WAL archives.
3. Restore a backup into a temporary database and confirm audit rows are readable.
