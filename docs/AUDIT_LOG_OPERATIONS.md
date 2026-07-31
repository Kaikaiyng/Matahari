# Audit Log Operations

## Security Boundary

Matahari treats `audit_logs` as append-only for the application runtime. Laravel model guards prevent ordinary instance updates and deletes, but they do not stop bulk queries, raw SQL, migration credentials, or database administrators.

Before Production launch, use separate deployment and runtime database identities. Replace `matahari` and `matahari_app` below with the deployed database and runtime account:

```sql
REVOKE UPDATE, DELETE ON `matahari`.`audit_logs` FROM 'matahari_app'@'%';
GRANT SELECT, INSERT ON `matahari`.`audit_logs` TO 'matahari_app'@'%';
SHOW GRANTS FOR 'matahari_app'@'%';
```

> **DO NOT RUN** these example statements until the actual hosting account, host pattern, migration process, and recovery access are confirmed. Keep migration credentials outside the web runtime.

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

1. Confirm the runtime account can select and insert an audit row.
2. Confirm the runtime account cannot update or delete an audit row.
3. Confirm migration credentials can run forward migrations during a controlled release.
4. Confirm audit rows are included in encrypted off-site backups and MariaDB binary logs.
5. Restore a backup into a temporary database and confirm audit rows are readable.
