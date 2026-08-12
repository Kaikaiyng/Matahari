# Deployment Foundation

**Status:** Repository foundation implemented; real staging, production, backup, and monitoring are not configured

**Updated:** 2026-08-06

This document describes the deployment material currently stored in the repository. The approved target architecture remains in [Staging and Production Deployment Design](superpowers/specs/2026-08-06-staging-production-deployment-design.md).

## Implemented Repository Components

| Path | Responsibility |
| --- | --- |
| `backend/app/Http/Controllers/HealthController.php` | Database-aware, non-secret `GET /health` readiness response |
| `backend/app/Http/Controllers/DeploymentInfoController.php` | Allowlisted runtime label from `DEPLOYMENT_MODE` through `GET /api/deployment-info` |
| `frontend/src/components/DeploymentBanner.tsx` | Displays `STAGING` or `PRE-LAUNCH DEMO` without rebuilding the frontend |
| `deploy/scripts/create-release.mjs` | Creates an allowlisted release tree and per-file SHA-256 manifest |
| `deploy/scripts/package-release.sh` | Creates and verifies the single ZIP and its SHA-256 file on Linux CI |
| `deploy/docker/` | Pinned PHP-FPM runtime and internal application Nginx configuration |
| `deploy/compose/database.yml` | Private MariaDB service with binary logging and secret-file inputs |
| `deploy/compose/application.yml` | Generic isolated PHP, scheduler, and web stack for either environment |
| `deploy/database/` | First-start database/account creation and post-migration least-privilege grants |
| `deploy/env/*.example` | Non-secret database, staging, and production Compose contracts |
| `.github/workflows/release-candidate.yml` | Quick checks and one-time immutable artifact build on `master` |
| `.github/workflows/full-qualification.yml` | Complete application, advisory, deployment-contract, and disposable MariaDB checks |

## Environment Boundary

The database service has no host port. It creates these fixed boundaries from private secret files:

| Environment | Database | Runtime identity | Migration identity |
| --- | --- | --- | --- |
| Staging | `matahari_staging` | `matahari_staging_app` | `matahari_staging_migrator` |
| Production | `matahari_production` | `matahari_production_app` | `matahari_production_migrator` |

Migration identities receive schema privileges only for their own database. Runtime identities receive no privileges during first initialization. After migrations, `apply-runtime-grants.sh` enumerates the actual tables and grants normal CRUD per table, except `audit_logs`, which receives only `SELECT` and `INSERT`.

Staging and production run with different Compose project names, release roots, Laravel `.env` files, storage/cache volumes, ports, database credentials, `APP_KEY`, session settings, and `DEPLOYMENT_MODE`. Each environment exposes separate loopback-only Admin and Parent/Student App ports. The edge proxy must route two HTTPS hostnames to those ports; both internal Nginx services proxy `/api` to the same Laravel service and database.

## Runtime Deployment Label

`DEPLOYMENT_MODE` is private server configuration with four accepted operational values:

| Value | Browser label |
| --- | --- |
| `local` | none |
| `staging` | `STAGING` |
| `prelaunch-production` | `PRE-LAUNCH DEMO` |
| `production` | none |

Laravel maps the mode to an allowlisted label and never returns environment values directly. React loads the label at runtime from `/api/deployment-info`. Therefore staging and production use identical frontend files and the same ZIP.

## Release Artifact

`deploy/release-files.txt` is the only source allowlist. The release contains Laravel runtime code, migration files, production `backend/vendor`, built Admin `frontend/dist`, and built Parent/Student `app/dist`. It excludes environment files, SQLite data, source dependency directories, test results, credentials, key files, and local tooling state.

`release-manifest.json` records:

- Git commit and UTC build time;
- infrastructure contract version;
- PHP, Node.js, and Laravel versions;
- Composer/npm lockfile SHA-256 values;
- sorted migration inventory;
- SHA-256 for every included file.

The GitHub release-candidate workflow creates one `matahari-<commit>.zip`, one checksum file, and the manifest. Production promotion must later download this exact artifact and checksum; it must not run the build steps again.

## Local Verification

Deployment contract tests require only Node.js:

```powershell
node --test deploy/tests/*.test.mjs
```

Backend deployment endpoints:

```powershell
cd backend
..\tools\php\php-local.cmd artisan test tests/Feature/HealthEndpointTest.php tests/Feature/DeploymentInfoEndpointTest.php
..\tools\php\php-local.cmd artisan route:list --path=health --except-vendor
..\tools\php\php-local.cmd artisan route:list --path=deployment-info --except-vendor
```

Frontend runtime banner:

```powershell
cd frontend
npm.cmd test -- src/components/DeploymentBanner.test.tsx src/App.test.tsx
npm.cmd run lint
npm.cmd run build
```

Parent/Student App:

```powershell
cd app
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

The release staging tree can be rehearsed on Windows after `backend/vendor`, `frontend/dist`, and `app/dist` exist:

```powershell
$releaseCommit = git rev-parse HEAD
node deploy/scripts/create-release.mjs --source . --output deploy/.build/release --commit $releaseCommit --build-time 2026-08-06T00:00:00.000Z --infrastructure-version 1 --php-version 8.4.21 --node-version 24.12.0
Get-FileHash -Algorithm SHA256 deploy/.build/release/release-manifest.json
```

Use a real current UTC build time outside a deterministic rehearsal. `deploy/.build/` and `deploy/artifacts/` are ignored.

## Docker Preparation

Copy the example values to private files outside the repository and create separate secret files. Do not put secret values in the example files or shell history. On an Ubuntu host with Docker, validate before starting services:

```bash
docker build -f deploy/docker/php/Dockerfile -t matahari-php:8.4.21-1 .
docker compose --env-file /srv/matahari/private/database.env -f deploy/compose/database.yml config
docker compose --env-file /srv/matahari/private/staging.env -f deploy/compose/application.yml config
docker compose --env-file /srv/matahari/private/production.env -f deploy/compose/application.yml config
```

The Laravel `APP_ENV_FILE` referenced by each application Compose environment must contain the private environment-specific Laravel variables. At minimum, configure a unique `APP_KEY`, correct URL, MariaDB runtime identity, secure session cookies, database-backed session/cache/queue settings, `APP_DEBUG=false`, `MAIL_MAILER=log`, and the matching `DEPLOYMENT_MODE`.

Database initialization and grants must first be rehearsed with disposable synthetic data. Do not run the database Compose project against an existing valuable MariaDB data directory.

## GitHub Workflow Order

On a push to `master`:

1. quick backend, frontend, deployment-contract, formatting, and secret-filename checks run;
2. production dependencies and frontend assets are built once;
3. the allowlisted release tree, manifest, ZIP, and checksum are created and retained for 30 days;
4. full PHPUnit, Pint, routes, dependency advisories, frontend validation, deployment contracts, and disposable MariaDB migration/rollback checks run.

The final job is intentionally named `Full qualification (staging deployment pending)`. Automatic SSH staging deployment is not present yet, so the workflow must not claim staging was deployed or browser-reviewed.

## Current Limitations

- Real staging deployment: **Not configured**
- Real production deployment: **Not configured**
- Docker image build, Nginx syntax, Compose startup, and container health: **Not verified on this workstation**
- GitHub-hosted workflow execution: verify against the current `master` Actions run
- TLS edge proxy and Nginx Basic Auth: **Not configured**
- Versioned remote release directories, atomic switch, and rollback drill: **Not implemented**
- Daily full backup and MariaDB point-in-time recovery: **Not configured**
- Off-site backup: **Not configured**
- Restore and financial/audit reconciliation drill: **Not verified**
- Telegram alerting and scheduler/disk/TLS monitoring: **Not configured**

These limitations are the scope of the remote release operations and recovery/monitoring plans. The application must not be described as production-ready until they are implemented and verified.
