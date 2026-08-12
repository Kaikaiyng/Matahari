# Testing and Release

**Status:** Repository command and release reference

**Repository baseline:** MIS demo/portal review based on Phase A merge `a69d32b`

Run commands from a clean feature branch/worktree. Record the exact command, exit code, counts, skipped cases, and limitations. Never convert a skipped or unavailable check into a pass.

## Dependency Setup

Backend:

```powershell
cd backend
$env:PHPRC = (Resolve-Path ..\tools\php).Path
composer install
Remove-Item Env:PHPRC
```

This makes a Composer command that starts the system PHP load `tools/php/php.ini`. If Composer is supplied as a trusted local `composer.phar`, use `php -c ..\tools\php\php.ini <path-to-composer.phar> install`. Composer was not available as a command in the documentation-validation environment, so dependency installation was not rerun; the existing lockfile/vendor tree was used.

When network access and Composer are available, also run `composer audit --locked`. The 2026-08-03 validation environment did not provide a Composer command, so PHP dependency advisories remain **Not verified** by that environment.

Frontend (the lockfile is committed):

```powershell
cd frontend
npm.cmd ci
```

Audit both the production and complete dependency trees:

```powershell
npm.cmd audit --omit=dev --audit-level=moderate
npm.cmd audit --audit-level=moderate
```

Install only when dependencies are absent or lockfiles changed. Do not update lockfiles unintentionally.

## Backend Validation

Full PHPUnit suite:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit
```

The default suite uses SQLite `:memory:` and skips opt-in MariaDB destructive cases.

Route loading:

```powershell
cd backend
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
```

Configuration loading without exposing environment values:

```powershell
cd backend
..\tools\php\php-local.cmd artisan about --only=environment,drivers
```

Do not paste `php artisan env`, `.env`, connection URLs, secrets, or full production configuration into logs or documentation.

## Frontend Validation

```powershell
cd frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

- `test` runs Vitest once.
- `lint` runs Oxlint.
- `build` runs `tsc -b` and then Vite production build, so it is also the configured TypeScript check.
- No browser E2E command is configured.

The commands above validate only the Admin UI. Run the same install/test/lint/build lifecycle separately from `app/` for the Parent/Student application. A future native packaging workspace must add its own platform validation before a store release can be called complete.

## Future Mobile Validation Gates

Mobile work requires evidence beyond narrow viewport checks of the current Admin UI:

- Phase B: role-aware Parent/Student shell, loading/empty/error/offline behavior, session/CSRF preservation, direct API denial, accessibility, responsive browser QA, and staging topology.
- Phase C: Admin-versus-Parent finance parity, guardian relationship/capability enforcement, cross-school/IDOR denial, and reuse of authoritative receipt output.
- Phase D: authoritative balance recheck, recipient resolution, transactional audit/history, duplicate suppression, and durable notification behavior independent of push delivery.
- Phase E: teacher assignment scope, class and direct-student targeting, recipient deduplication, server-side scoring, attempt concurrency, and historical enrolment behavior.
- Phase F: native credential/token storage and revocation, device-token privacy, deep links, signed Android build, real-device push behavior, and platform-specific release checks.

Do not claim Firebase, Capacitor, APK/iOS delivery, or native authentication passed until those dependencies exist and the relevant real-device checks have run.

## Formatting and Static Analysis

Backend formatting check:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\pint --test
```

Apply backend formatting only to intended files when a code change requires it:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\pint path\to\file.php
```

No PHPStan, Psalm, Larastan, or equivalent PHP static-analysis command is configured. Do not claim PHP static analysis passed. Frontend lint and TypeScript checking are covered by the commands above.

## SQLite Migration Lifecycle

Use an explicit disposable file, never the demo database or a database with valuable data:

```powershell
$migrationDb = Join-Path $env:TEMP 'matahari-migration-check.sqlite'
if (Test-Path -LiteralPath $migrationDb) { Remove-Item -LiteralPath $migrationDb }
New-Item -ItemType File -Path $migrationDb | Out-Null

$env:APP_ENV = 'testing'
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = $migrationDb
$env:DB_URL = ''
$env:SESSION_DRIVER = 'array'
$env:CACHE_STORE = 'array'
$env:QUEUE_CONNECTION = 'sync'

cd backend
..\tools\php\php-local.cmd artisan config:clear
..\tools\php\php-local.cmd artisan migrate:fresh --force
..\tools\php\php-local.cmd artisan migrate:rollback --step=1 --force
..\tools\php\php-local.cmd artisan migrate --force
```

After checking every exit code, remove only the exact disposable path and clear the process environment or close the terminal. A one-step rollback proves only the latest batch/step. Migration-specific changes may require a targeted rollback or full disposable reset.

## MariaDB Validation

MariaDB is required for database-sensitive release evidence. Provision a disposable local/test server and a database named exactly:

```text
matahari_audit_test
```

The guarded destructive tests refuse to run unless all of these are true:

- `AUDIT_MARIADB_DESTRUCTIVE_TEST=1` is explicitly set.
- Laravel driver is exactly `mariadb`.
- `DB_URL` is empty.
- Configured and actual database names are exactly `matahari_audit_test`.
- Server version identifies MariaDB.

Set private values in the current process only; the placeholders below are not credentials:

```powershell
$env:AUDIT_MARIADB_DESTRUCTIVE_TEST = '1'
$env:DB_CONNECTION = 'mariadb'
$env:DB_URL = ''
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = '3306'
$env:DB_DATABASE = 'matahari_audit_test'

cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit --group mariadb
```

Set `DB_USERNAME` and `DB_PASSWORD` privately in the process before running the command. Do not paste their values into documentation, shell history, or test reports.

The test database is destroyed/rebuilt. It must contain no valuable data and must not be production or a restored production database.

For a schema-changing release, also run explicit MariaDB lifecycle checks against the disposable database:

```powershell
..\tools\php\php-local.cmd artisan config:clear
..\tools\php\php-local.cmd artisan migrate:fresh --force
..\tools\php\php-local.cmd artisan migrate:rollback --step=1 --force
..\tools\php\php-local.cmd artisan migrate --force
```

Validate any migration-specific rollback, foreign keys, exact indexes, JSON behavior, row locking, and concurrent financial paths relevant to the change. Stop on any unexpected schema definition or data loss.

For Phase A, the MariaDB lifecycle must additionally inspect the exact nullable current-slot unique indexes, portal-user unique indexes, and all academic/portal foreign-key delete rules. The existing-data upgrade test must prove that no academic dates, enrolment history, identity association, or guardian access is inferred.

## Documentation Validation

For documentation changes:

- Check every relative Markdown link resolves from its source file.
- Check fenced code blocks are balanced and language tags are appropriate.
- Check Mermaid source against GitHub-supported syntax where practical.
- Check headings and terminology are consistent.
- Search for unsupported claims and stale counts.
- Scan staged content for passwords, private keys, tokens, connection strings, real personal data, `.env` values, and generated artifacts.

Repository diff checks:

```powershell
git status --short
git diff --check
git diff --stat
git diff --name-only
```

After staging exact intended files:

```powershell
git diff --cached --check
git diff --cached --stat
git diff --cached
```

## Deployment Foundation Validation

Run all deployment source contracts from the repository root:

```powershell
node --test deploy/tests/*.test.mjs
```

These tests verify the release allowlist and manifest, unsafe-path exclusions, pinned runtime contracts, Nginx routing boundaries, private MariaDB topology, staging/production naming, runtime/migration identity separation, environment examples, GitHub workflow ordering, and absence of tracked-style secret artifacts under `deploy/`.

Rehearse the release tree only after production backend dependencies and the frontend build exist:

```powershell
$releaseCommit = git rev-parse HEAD
node deploy/scripts/create-release.mjs --source . --output deploy/.build/release --commit $releaseCommit --build-time 2026-08-06T00:00:00.000Z --infrastructure-version 1 --php-version 8.4.21 --node-version 24.12.0
Get-FileHash -Algorithm SHA256 deploy/.build/release/release-manifest.json
```

The fixed timestamp above is for a deterministic local rehearsal, not a real release. GitHub supplies the current UTC build time and creates the ZIP/checksum once. A production promotion must consume that artifact without rebuilding it.

When Docker is available, validation also requires:

```bash
docker build -f deploy/docker/php/Dockerfile -t matahari-php:8.4.21-1 .
docker compose --env-file /path/to/private/database.env -f deploy/compose/database.yml config
docker compose --env-file /path/to/private/staging.env -f deploy/compose/application.yml config
docker compose --env-file /path/to/private/production.env -f deploy/compose/application.yml config
```

Then start only disposable infrastructure, confirm container health, run migrations with the environment-specific migrator, apply runtime grants, and prove each runtime identity cannot access the other database or alter `audit_logs`. Never substitute production or restored production data for this check.

The workflows are:

- `.github/workflows/release-candidate.yml` — `master` quick checks, one ZIP/checksum/manifest build, then full qualification;
- `.github/workflows/full-qualification.yml` — full backend/frontend/advisory checks plus disposable MariaDB migrate/rollback/re-migrate.

Until an Actions run on the exact current `master` commit passes, mark GitHub-hosted execution **Not verified**. Until Docker starts successfully, mark image, Nginx, Compose, and container health **Not verified**. Workflow source is not runtime evidence.

## Temporary Public Demo Tooling

The repository includes self-contained contract/runtime tests for the demo launcher. Windows may block direct `.ps1` execution under the machine policy, so run the scripts in a child process with a process-scoped execution policy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\public-demo\tests\LauncherContract.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\public-demo\tests\PublicDemo.Tests.ps1
```

These tests validate the launcher tooling only. They do not prove Cloudflare availability, public DNS propagation, production security, or stable deployment.

## Security Review

Before release, confirm:

- Every protected backend route has authentication, the correct permission, and school-scope enforcement.
- Unauthorized, cross-school, inactive-user, and invalid-state tests exist for changed operations.
- Frontend visibility never substitutes for backend authorization.
- Session cookie, HTTPS, CORS, CSRF, proxy trust, and login throttling match the deployed topology.
- Demo credentials/data are absent from deployment.
- Financial mutations preserve original records, actor/time/reason, transactions, and audit requirements.
- Runtime database grants are least-privilege; audit-table write access is limited as documented.
- No secrets or real student information are staged.

## Manual Smoke Tests

Use fictional data in a local or approved test environment:

1. Request `/api/csrf-cookie`; confirm login without a valid CSRF header returns 419, then login with the cookie/header pair. Exercise session restore, logout, invalid credentials, throttling, and an already-authenticated user deactivated in the database.
2. Exercise each seeded role and direct API denial, not only button visibility.
3. Search/create/view/status-change a student in the UI as authorized; smoke-test profile update through the protected API because a complete profile-edit UI is not implemented. Verify denial for Finance/CEO.
4. Create and supersede a Fee Agreement; inspect version history. Confirm a replacement across existing charge history returns 409 without changing either version.
5. Preview/activate charges and add a manual charge; confirm totals and Audit Trail events. Confirm non-zero discounts and `requires_preview_confirmation` prevent activation.
6. Record cash and non-cash payments; verify pending payment; test partial allocation and over-allocation rejection.
7. Issue, print, void, and regenerate a receipt; confirm numbers are not reused and issued receipt blocks payment void.
8. Test calendar view/create/update/delete by role and school.
9. Confirm navigation exposes only permission-backed entries and Audit Trail appears only to Super Admin. A global account without a selected school must not silently use school `1`.
10. Check desktop, tablet, mobile, keyboard focus, and native browser print preview.

For a real HTTP CSRF smoke test, use a disposable local database and an exact temporary port, start `artisan serve` in a hidden child process, preserve cookies in one client session, and stop only that recorded process ID afterward. Laravel feature tests disable CSRF middleware during normal test execution, so route/middleware feature tests do not replace this HTTP check.

Real iPad Safari and native print preview are manual evidence; automated component tests do not replace them.

## Release Checklist

- [ ] Branch is based on the latest remote default branch and has no conflicts.
- [ ] Working tree contains only intended changes.
- [ ] Focused and full backend tests pass; skips are explained.
- [ ] Frontend tests, lint, TypeScript, and production build pass.
- [ ] Route and configuration loading pass.
- [ ] Temporary public-demo tests pass when launcher files changed.
- [ ] SQLite migration lifecycle passes where relevant.
- [ ] MariaDB validation passes for database-sensitive work, or the release is blocked.
- [ ] Migration rollback/data-recovery behavior is reviewed and tested.
- [ ] Backend formatting and available analysis checks pass.
- [ ] Security, permissions, school scope, financial integrity, and audit impact are reviewed.
- [ ] Manual smoke/UAT evidence is recorded for user-visible workflows.
- [ ] Documentation, links, code fences, Mermaid, and secret scans pass.
- [ ] No Critical or Important issue remains unresolved.
- [ ] Pull request includes summary, exact validation results, limitations, and scope.
- [ ] Required reviews/status checks and branch protection are satisfied without override.

## Rollback Preparation

- Take and verify a backup before any production schema/data release.
- Record the previous application commit/artifact and compatible schema version.
- Prefer a forward corrective migration over destructive reversal when historical migrations or new writes make `down()` unsafe.
- Test restore into a temporary environment and reconcile students, charges, allocations, payments, receipts, sequences, and audit rows.
- Define the stop/writer-quiesce procedure for multi-stage audit migrations.
- Never call a migration rollback safe merely because `down()` exists.

## Git Cleanliness and Merge Rules

- Fetch before final validation and confirm the branch is not behind.
- Do not commit user files from another task, ignored runtime tools, database files, `dist`, `test-results`, or tunnel state.
- Do not force-push, use `--no-verify`, disable checks, or override branch protection.
- Do not merge with failing tests, conflicts, missing required review, insufficient credentials, or unresolved Critical/Important issues.
- If blocked, keep the work on the pushed feature branch, create a pull request when possible, and report the exact blocker.
