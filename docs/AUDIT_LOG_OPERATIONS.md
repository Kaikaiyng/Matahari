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

## Verification Before Launch

1. Confirm the runtime account can select and insert an audit row.
2. Confirm the runtime account cannot update or delete an audit row.
3. Confirm migration credentials can run forward migrations during a controlled release.
4. Confirm audit rows are included in encrypted off-site backups and MariaDB binary logs.
5. Restore a backup into a temporary database and confirm audit rows are readable.
