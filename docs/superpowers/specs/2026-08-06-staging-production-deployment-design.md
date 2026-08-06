# Staging and Production Deployment Design

**Status:** Approved design; planned, not implemented

**Decision date:** 2026-08-06

**Target platform:** One Ubuntu 24.04 LTS VPS, designed so the deployment can later move to another VPS provider

## 1. Purpose

Matahari will use a repeatable local-to-staging-to-production release process. Development happens only in the local repository. Every push to `master` goes through quick checks, produces one immutable ZIP release, and deploys that ZIP to staging. Production receives the exact ZIP that was qualified in staging; production is never rebuilt and server files are never edited manually.

The initial operating target is one school, no more than approximately 500 students, and approximately 10 concurrent users. This is a planning target, not a verified capacity claim. The first VPS can therefore remain a simple single-node deployment; Kubernetes, multi-node application servers, and separate database hosts are outside the initial scope.

This design does not claim that Matahari is production-ready. It records the agreed direction for the infrastructure and the controls that implementation must verify.

## 2. Selected Architecture

The selected approach is one VPS running Docker Compose, with strict environment and database separation:

```text
Internet
   |
   v
Nginx edge proxy (TLS, routing, Basic Auth)
   |-------------------------------|
   v                               v
staging application stack          production application stack
staging.example.com                app.example.com
   |                               |
   | matahari_staging_app          | matahari_production_app
   |                               |
   +-------------+-----------------+
                 v
          one private MariaDB service
          - matahari_staging
          - matahari_production
```

The placeholder hostnames will be replaced after the real domains are chosen. MariaDB must not expose a public port. Docker networks, application environment files, release directories, logs, and container names must make the staging and production boundaries obvious.

Each application stack contains:

- an Nginx web service that serves `frontend/dist` and forwards same-origin `/api` requests;
- a PHP-FPM Laravel application service;
- a Laravel scheduler service using the same application release and environment;
- environment-specific health checks and logs.

The edge proxy is the only public entry point. Infrastructure images and Compose configuration are version-pinned separately from application ZIPs. A release manifest records the expected infrastructure version so promotion fails instead of running on an incompatible image or configuration.

## 3. Why This Architecture Was Selected

The alternative native Nginx/PHP-FPM/MariaDB installation would be initially simpler, but it would make runtime drift and VPS replacement harder to control. Fully immutable container images or separate VPSs would provide stronger isolation, but add cost and operational complexity beyond the current scale and would replace the preferred ZIP workflow.

The selected design keeps the useful operational idea observed in `AdminSystem_Update`: clear staging and production targets and a packaged release. It does not copy that system's monolithic PHP API, duplicated environment trees, request-time schema changes, or web-accessible maintenance scripts. Matahari keeps Laravel controllers, requests, services, migrations, authorization, tests, and audit boundaries as the maintainable source architecture.

## 4. Environment and Data Separation

### Staging

- Uses only fictional or synthetic data.
- Is never populated from a production database copy.
- Keeps Nginx Basic Auth in front of the Laravel login at all times.
- May send notifications only to explicit test sinks; real email, SMS, or parent communication is disabled.
- Receives every successful release automatically after quick checks.

### Production before official launch

- May temporarily contain fictional demo data only.
- Displays a clear `PRE-LAUNCH DEMO` banner.
- Keeps external email, SMS, reminders, and other outbound communication disabled.
- Must not mix real people or real financial records with demo data.
- Keeps Nginx Basic Auth until the official launch decision.

### Production go-live reset

Before any real data is entered, an explicit, logged go-live operation must:

1. confirm the exact production database identity and create a verified backup;
2. remove all fictional/demo data through a purpose-built, guarded reset procedure;
3. apply the production schema without reseeding demo users or records;
4. create a new secure Super Admin through a private operational procedure;
5. verify that demo identifiers and sample records have a count of zero;
6. remove the `PRE-LAUNCH DEMO` state only after the checks pass;
7. decide deliberately whether production Basic Auth and outbound communications remain disabled or are enabled.

No generic destructive command may be reused against a database that may contain valuable data. After go-live, production is always treated as valuable and never reset with `migrate:fresh` or demo seeders.

## 5. Database Identities

The minimum runtime databases and accounts are:

| Environment | Database | Runtime account | Boundary |
| --- | --- | --- | --- |
| Staging | `matahari_staging` | `matahari_staging_app` | Access only to the staging database |
| Production | `matahari_production` | `matahari_production_app` | Access only to the production database |

Runtime accounts must not receive global privileges or routine schema-alteration privileges. Deployment implementation should add environment-specific migration identities that are available only during a migration job, plus a restricted backup identity where MariaDB tooling requires it. These operational identities must remain separate from the long-running application containers.

The production runtime grant must preserve the documented audit boundary: normal application access to audit records is limited to the required insert/read behavior, while schema and recovery operations use separate controlled identities.

## 6. Secrets and Access

Real credentials must never be sent in chat, committed to Git, stored in a release ZIP, written to build logs, or placed in plaintext documentation.

- The VPS stores separate staging and production `.env` files with restrictive filesystem permissions.
- GitHub Secrets stores only deployment connection details and SSH material needed by the workflow.
- Application secrets, database passwords, backup keys, Telegram credentials, and service tokens are never embedded in frontend assets.
- Notion may record the secret name, owner, purpose, environment, creation date, rotation date, and recovery instructions, but not the plaintext secret.
- The deployment SSH user uses a key, has no general-purpose shared password, and receives only the permissions needed for release operations.
- Staging and production use different `APP_KEY`, session names, database credentials, Basic Auth credentials, and external-service credentials.
- `APP_DEBUG=false`, secure cookies, HTTPS, exact trusted-proxy addresses, CSRF behavior, and login throttling are verified in both deployed environments.

The VPS firewall exposes only the required SSH and HTTPS/HTTP ports. SSH policy, administrator access, key rotation, OS updates, and emergency access must be documented during implementation.

## 7. Immutable ZIP Release

GitHub Actions builds one ZIP per release. The ZIP contains only deployable application material:

- Laravel production files;
- `backend/vendor` installed from the committed Composer lockfile;
- `frontend/dist` built from the committed npm lockfile;
- the migration inventory;
- `release-manifest.json`.

The release must not run Composer or npm installation on staging or production. The manifest includes at least:

- release identifier and Git commit SHA;
- UTC build timestamp;
- PHP, Node.js, Laravel, Composer-lock, and npm-lock information;
- migration inventory;
- expected infrastructure version;
- SHA-256 checksum of the release payload.

Secrets, `.env` files, SQLite databases, test results, source maps not approved for deployment, development dependencies, local recovery folders, and local tooling state are excluded.

The same ZIP checksum is recorded when staging is deployed and checked again before production promotion. Production must reject an artifact whose release identifier, commit, checksum, qualification result, or expected infrastructure version does not match the staging record.

## 8. GitHub and Deployment Flow

The agreed workflow permits direct pushes to `master`; pull requests are recommended for risky work but are not mandatory for every change.

```text
local edit
   -> push master
   -> quick checks
   -> build one ZIP and checksum
   -> automatic staging deployment
   -> automatic full qualification
   -> manual staging browser review
   -> manual production promotion of the same ZIP
```

Quick checks should fail fast on basic backend/frontend syntax, formatting, focused tests, lockfile consistency, and accidental-secret detection. They exist to avoid deploying an obviously broken staging build.

After staging deployment, full qualification starts automatically and includes:

- complete PHPUnit validation;
- disposable MariaDB migration and rollback lifecycle checks;
- complete Vitest, Oxlint, TypeScript, and Vite production build checks;
- Composer and npm dependency advisory checks;
- repository and artifact secret scans;
- staging `/health` and container health checks.

After automation passes, the operator manually checks login, Dashboard, Students, Student Detail, Fee Agreement/Fee Record, payment and receipt flows, Calendar, Audit Trail, responsive layout, and the staging demo/access banners as applicable.

Production is a separate manual `workflow_dispatch` operation with a required release identifier. This design must not depend on a paid GitHub feature: the workflow itself validates that the selected release completed staging deployment and full qualification. If the repository plan supports protected GitHub Environments and required reviewers, those controls should be added as a second approval layer.

Force pushes to `master` are prohibited. A failed quick or full check prevents production promotion but does not trigger an automatic production change.

## 9. Atomic Release Procedure

Each environment uses versioned directories such as:

```text
/srv/matahari/staging/releases/<release-id>
/srv/matahari/staging/current
/srv/matahari/production/releases/<release-id>
/srv/matahari/production/current
```

Deployment performs these steps against the target environment only:

1. upload the selected ZIP to a temporary incoming location;
2. verify its SHA-256 checksum and manifest before extraction;
3. extract into a new, immutable release directory;
4. attach only the target environment's server-side configuration and writable storage;
5. verify configuration and warm caches using the new release;
6. run the target database migration policy;
7. atomically switch `current` to the new release;
8. reload PHP OPcache or the affected application services;
9. run health and smoke checks;
10. retain recent releases for controlled application rollback.

Staging migrations run automatically. Production promotion first creates and verifies a backup, records the binary-log position, then runs reviewed migrations. Migrations should follow expand/contract compatibility so the previously running application remains safe until the release switch. An incompatible migration requires a declared maintenance window and a reviewed runbook.

If the post-switch health check fails, the application symlink returns to the previous verified release. Database migrations are never automatically rolled back in production. Schema or data problems use a reviewed forward corrective migration or a deliberate restore decision because `down()` may destroy or invalidate financial history.

## 10. Backup and Recovery

The production recovery targets are:

- **RPO:** approximately 15 minutes;
- **RTO:** service restored to a verified environment within four hours.

The target backup policy is:

- one full MariaDB backup every day;
- continuous MariaDB binary logs sufficient for point-in-time recovery;
- a verified pre-migration backup before every production schema/data release;
- 30-day backup retention;
- encrypted backup files and separately protected encryption keys;
- checksums, completion status, age monitoring, and periodic restore drills.

The automation exposes a portable `BACKUP_REMOTE_DRIVER` boundary so an S3-compatible service, Cloudflare R2, Backblaze B2, or SFTP target can be selected later without redesigning the release process.

Until a remote destination is configured and a restore drill passes, the status must say **Off-site backup: Not configured**. An encrypted copy kept only on the same VPS is useful for operational mistakes but is not disaster recovery. The system must not claim the RPO/RTO targets are achieved before backup monitoring, off-site transfer, point-in-time recovery, and reconciliation are proven.

Staging contains synthetic data and has no production recovery objective. It still receives a guarded snapshot before risky migration testing where useful.

## 11. Monitoring and Alerts

The implementation provides a non-secret `/health` endpoint and monitors:

- edge proxy and application reachability;
- Docker container health and unexpected restarts;
- PHP/Laravel error logs with rotation and redaction;
- disk space and inode usage;
- MariaDB availability, storage, backup age, backup failures, and binary-log continuity;
- scheduler heartbeat;
- TLS certificate expiry;
- staging and production release identifiers.

Alerts go to Telegram. The bot token and chat identifier are VPS secrets and must never appear in Git, chat, documentation, frontend code, or logs. Health output must not reveal versions, credentials, database names, internal paths, stack traces, or configuration values.

## 12. Sizing and Portability

The starting planning range is 2–4 vCPU, 4–8 GB RAM, and at least 80 GB SSD storage. This is not a purchased specification or performance guarantee. Before launch, disk growth, backup size, MariaDB memory, PHP worker count, frontend/API response time, and peak finance workflows must be measured with representative synthetic data.

All provider-specific values remain in private configuration. The repository should contain portable Compose files, scripts, examples, and runbooks rather than a hard dependency on one VPS provider.

## 13. Failure Handling

- A quick-check failure stops before staging deployment.
- An upload, checksum, extraction, configuration, or migration failure leaves the existing `current` release unchanged.
- A staging failure blocks qualification and production promotion.
- A full-qualification failure blocks production promotion.
- A production backup verification failure blocks migration and release switching.
- A post-switch application failure returns the application symlink to the previous release and raises a Telegram alert.
- A database compatibility or data-integrity failure stops automation and requires an explicit recovery decision; it does not run a destructive automatic rollback.
- A missing Telegram notification is itself observable through a periodic alert-channel test.

All scripts must be idempotent where practical, validate the exact target environment, and fail closed when the environment, release identifier, database name, checksum, or prerequisite evidence is ambiguous.

## 14. Documentation and Testing Deliverables

Implementation must add or update:

- Docker Compose and pinned runtime image definitions;
- Nginx TLS/routing/Basic Auth templates;
- GitHub Actions quick-check, staging, qualification, and production-promotion workflows;
- release build, manifest, checksum, deploy, rollback, backup, restore, and health-check scripts;
- non-secret environment examples for both environments;
- deployment, operations, incident, backup/restore, go-live reset, and release runbooks;
- automated script/configuration tests and disposable MariaDB validation;
- a recorded staging deployment, exact-artifact production rehearsal, backup restore drill, and reconciliation result.

No production readiness claim is allowed until the repository checks, deployment rehearsal, MariaDB checks, access controls, monitoring, off-site backup, restore drill, and manual application smoke tests have current passing evidence.

## 15. Decisions Deferred Until Implementation

The following choices are intentionally deferred and do not change the architecture:

- VPS provider, public IP, and final server size;
- production and staging domain names;
- MariaDB minor version within a supported pinned release;
- TLS registration details;
- off-site backup provider and credentials;
- Telegram bot and recipient identifiers;
- whether the current GitHub plan supports protected environment reviewers;
- production launch date and the exact moment Basic Auth/outbound communications are enabled.

These values must be resolved before the affected deployment step, stored only in the approved secret location, and recorded in an operational inventory without plaintext credentials.

## 16. Scope Exclusions

This design does not include implementing new school business features, editing staging server files, copying production data into staging, Kubernetes, high availability, multiple application VPSs, database replication, automatic destructive database rollback, or a public database administration interface.

## 17. Acceptance Criteria

The deployment work is complete only when all of the following are demonstrated:

1. staging and production run as visibly separate Docker Compose environments on Ubuntu 24.04 LTS;
2. each runtime database account is technically unable to access the other database;
3. a push to `master` produces one checksum-addressed ZIP and automatically deploys it to staging after quick checks;
4. full qualification runs after staging deployment and failed qualification blocks production;
5. production promotion requires an explicit manual release selection and deploys the exact staging-qualified checksum without rebuilding;
6. versioned releases switch atomically and an application rollback drill succeeds;
7. production migration is blocked unless the pre-migration backup is verified;
8. a point-in-time restore and financial/audit reconciliation drill meets or clearly reports against the RPO/RTO targets;
9. staging contains synthetic data only and production completes the guarded demo-data reset before real use;
10. secrets are absent from Git history, ZIP contents, browser assets, documentation, and workflow logs;
11. Basic Auth, TLS, secure sessions, trusted proxies, least-privilege access, health checks, log rotation, and Telegram alerts are verified;
12. current documentation accurately distinguishes implemented controls from planned or unverified controls.
