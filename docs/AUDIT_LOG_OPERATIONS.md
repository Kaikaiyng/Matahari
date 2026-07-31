# Audit Log Operations

## Security Boundary

Matahari treats `audit_logs` as append-only for the application runtime. Laravel model guards prevent ordinary instance updates and deletes, but they do not stop bulk queries, raw SQL, migration credentials, or database administrators.

Before Production launch, use separate deployment, recovery, and web-runtime
database identities. The web-runtime identity must start from a
no-privilege baseline: it must have no global grants, no database/schema or
wildcard grants, no inherited role that supplies them, and no `GRANT OPTION`.
Grant it only the table privileges the application needs. For `audit_logs`,
that allowlist is exactly `SELECT, INSERT`:

```sql
CREATE USER 'matahari_app'@'%' IDENTIFIED BY '<runtime-secret>';
GRANT SELECT, INSERT ON `matahari`.`audit_logs` TO 'matahari_app'@'%';
SHOW GRANTS FOR 'matahari_app'@'%';
```

Replace `matahari`, `matahari_app`, the host pattern, and the secret with the
deployed values. `CREATE USER` is shown to emphasize a new, clean runtime
identity; follow the hosting provider's approved identity-creation process.
For an existing broadly privileged account, either rebuild it as a clean
runtime identity or remove every higher-scope grant (including grants supplied
by roles) before applying this table allowlist. A table-level `REVOKE` does
not deny a privilege that remains granted globally or at database/schema scope;
adding table grants alone therefore does not make a broad account
least-privilege.

`SHOW GRANTS` is useful inspection evidence, but it is not sufficient proof of
the effective boundary. Review direct grants and active/inherited roles, then
run the disposable negative verification below. Keep migration and recovery
credentials outside the web runtime and do not place their secrets in the web
application configuration.

> **DO NOT RUN** these example statements until the actual hosting account,
> host pattern, migration process, and recovery access are confirmed. Do not
> run privilege changes or destructive verification probes against Production.

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

Run the following checks only against an explicitly disposable staging or
restore database, for example `matahari_audit_grant_probe`. It must contain no
valuable data and must not be Production. Before the runtime account connects,
an operator using a separate administrative identity creates three disposable
probe tables in that database:

```sql
CREATE TABLE `audit_privilege_probe_alter` (`id` INT NOT NULL PRIMARY KEY);
CREATE TABLE `audit_privilege_probe_drop` (`id` INT NOT NULL PRIMARY KEY);
CREATE TABLE `audit_privilege_probe_truncate` (`id` INT NOT NULL PRIMARY KEY);
```

The disposable database must reproduce the runtime identity's effective,
per-table allowlist for its restored `audit_logs` table. For example, if the
probe database is `matahari_audit_grant_probe`, the operator grants the same
runtime identity only the equivalent audit-table access there:

```sql
GRANT SELECT, INSERT ON `matahari_audit_grant_probe`.`audit_logs` TO 'matahari_app'@'%';
```

Do not add a database/schema or global grant merely to make this probe run;
that would invalidate its evidence. If roles are part of the intended runtime
configuration, reproduce only the same effective per-table allowlist in the
disposable database and review it before testing.

Connect as the runtime identity to that disposable database. The following
positive probes must succeed; use a fresh UUID value for the insert:

```sql
INSERT INTO `audit_logs` (
    `event_uuid`, `action`, `module`, `context_type`, `schema_version`, `created_at`, `updated_at`
) VALUES (
    '019fb61a-3c8e-7573-ad4f-6395ae978630', 'grant_probe', 'security', 'system', 1,
    UTC_TIMESTAMP(), UTC_TIMESTAMP()
);

SELECT `id`, `event_uuid`
FROM `audit_logs`
WHERE `event_uuid` = '019fb61a-3c8e-7573-ad4f-6395ae978630';
```

Each following statement must fail with a permissions error. Run them only in
the disposable staging/restore database and only against the disposable probe
tables named here; never run these destructive probes against Production or a
database with valuable data:

```sql
UPDATE `audit_logs`
SET `action` = 'grant_probe_should_fail'
WHERE `event_uuid` = '019fb61a-3c8e-7573-ad4f-6395ae978630';

DELETE FROM `audit_logs`
WHERE `event_uuid` = '019fb61a-3c8e-7573-ad4f-6395ae978630';

ALTER TABLE `audit_privilege_probe_alter`
ADD COLUMN `should_not_exist` TINYINT;

DROP TABLE `audit_privilege_probe_drop`;

TRUNCATE TABLE `audit_privilege_probe_truncate`;
```

Stop and investigate if any negative probe succeeds. The separate disposable
probe tables ensure that a wrongly permitted `ALTER`, `DROP`, or `TRUNCATE`
does not invalidate the other checks. Record the runtime account, effective
grant/role review, target database name, statements, expected failures, and
results as release evidence.

After the boundary checks:

1. Confirm migration credentials can run forward migrations during a controlled release.
2. Confirm audit rows are included in encrypted off-site backups and MariaDB binary logs.
3. Restore a backup into a temporary database and confirm audit rows are readable.
