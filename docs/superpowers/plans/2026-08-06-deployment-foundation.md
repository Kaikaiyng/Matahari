# Deployment Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the repository-owned deployment foundation for health reporting, pre-launch identity, immutable ZIP releases, Docker Compose staging/production separation, and CI qualification without connecting to a real VPS.

**Architecture:** Laravel remains the authoritative same-origin API and React remains the static frontend. A pinned PHP-FPM runtime image and Nginx application container run an environment-specific release directory; one MariaDB service owns two isolated databases, and environment-specific migration/runtime identities are kept separate. GitHub Actions performs quick checks, builds one checksum-addressed ZIP, and performs full qualification against disposable MariaDB; remote SSH deployment, production promotion, off-site backup, and Telegram operations are separate follow-up plans because their external targets do not exist yet.

**Tech Stack:** PHP 8.4 / Laravel 13, React 19 / TypeScript 6 / Vite 8, Node.js 24, Docker Compose, Nginx, MariaDB, GitHub Actions, Bash, Node built-in test runner

## Global Constraints

- Target one Ubuntu 24.04 LTS VPS; keep provider-specific values out of tracked files.
- Staging and production use separate Laravel environment files, Docker Compose project names, release roots, databases, and database identities.
- Staging contains fictional or synthetic data only and never receives a production database copy.
- Production may contain fictional demo data before launch only when it displays `PRE-LAUNCH DEMO` and outbound communication remains disabled.
- Build one ZIP per Git commit and promote that exact SHA-256-verified ZIP; never rebuild for production.
- Do not install Composer or npm dependencies on a deployed server.
- Do not commit credentials, `.env` files, Basic Auth files, database files, backup keys, Telegram secrets, or real student data.
- Never use `migrate:fresh`, destructive schema probes, or demo seeders against a database that may contain valuable data.
- Runtime database identities do not receive schema-change privileges; migration identities are short-lived deployment inputs.
- This plan does not claim Docker runtime verification because Docker is not installed on the current Windows machine.

## Program Split

This is the first independently testable delivery of the approved deployment design.

1. **This plan — repository deployment foundation:** health endpoint, pre-launch banner, release builder, runtime image, generic Compose definitions, non-secret environment contracts, and CI qualification.
2. **Remote release operations:** edge TLS/Basic Auth, SSH deployment user, versioned VPS release directories, automatic staging deployment, manual exact-artifact production promotion, pre-migration backup gate, atomic switch, and rollback drill.
3. **Recovery and monitoring:** daily full backup, MariaDB binary logs, remote backup driver, restore/reconciliation drill, scheduler/disk/TLS monitoring, and Telegram alerts.

The second plan starts only after the VPS address and domains exist. The third plan can prepare scripts earlier, but cannot be accepted until an off-site target and alert recipient exist.

---

### Task 1: Add a non-secret application readiness endpoint

**Files:**
- Create: `backend/app/Http/Controllers/HealthController.php`
- Create: `backend/tests/Feature/HealthEndpointTest.php`
- Modify: `backend/routes/web.php`

**Interfaces:**
- Consumes: Laravel's configured default database connection.
- Produces: unauthenticated `GET /health`, returning only `{"status":"ok"}` with HTTP 200 or `{"status":"unavailable"}` with HTTP 503.

- [ ] **Step 1: Write the failing feature tests**

```php
<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class HealthEndpointTest extends TestCase
{
    public function test_health_reports_ready_without_exposing_configuration(): void
    {
        $response = $this->getJson('/health');

        $response
            ->assertOk()
            ->assertExactJson(['status' => 'ok'])
            ->assertHeaderMissing('X-Powered-By');

        $this->assertStringNotContainsString('database', $response->getContent());
        $this->assertStringNotContainsString(base_path(), $response->getContent());
    }

    public function test_health_fails_closed_when_the_database_is_unavailable(): void
    {
        DB::shouldReceive('select')->once()->with('SELECT 1')->andThrow(new RuntimeException('private failure detail'));

        $response = $this->getJson('/health');

        $response
            ->assertStatus(503)
            ->assertExactJson(['status' => 'unavailable']);
        $this->assertStringNotContainsString('private failure detail', $response->getContent());
    }
}
```

- [ ] **Step 2: Run the focused test and verify that it fails**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd artisan test tests/Feature/HealthEndpointTest.php
```

Expected: FAIL because `/health` does not exist.

- [ ] **Step 3: Add the controller**

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        try {
            DB::select('SELECT 1');

            return response()->json(['status' => 'ok']);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['status' => 'unavailable'], 503);
        }
    }
}
```

- [ ] **Step 4: Register the route without authentication or internal details**

Add to `backend/routes/web.php`:

```php
use App\Http\Controllers\HealthController;

Route::get('/health', HealthController::class)->name('health');
```

- [ ] **Step 5: Run focused checks**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd artisan test tests/Feature/HealthEndpointTest.php
..\tools\php\php-local.cmd vendor\bin\pint --test app/Http/Controllers/HealthController.php tests/Feature/HealthEndpointTest.php routes/web.php
..\tools\php\php-local.cmd artisan route:list --path=health --except-vendor
```

Expected: two tests pass, Pint exits 0, and one named `health` route is listed.

- [ ] **Step 6: Commit**

```powershell
git add -- backend/app/Http/Controllers/HealthController.php backend/tests/Feature/HealthEndpointTest.php backend/routes/web.php
git commit -m "feat: add deployment health endpoint"
```

---

### Task 2: Add a runtime-controlled pre-launch banner

**Files:**
- Create: `backend/app/Http/Controllers/DeploymentInfoController.php`
- Create: `backend/config/deployment.php`
- Create: `backend/tests/Feature/DeploymentInfoEndpointTest.php`
- Create: `frontend/src/components/DeploymentBanner.tsx`
- Create: `frontend/src/components/DeploymentBanner.test.tsx`
- Create: `frontend/src/components/DeploymentBanner.css`
- Modify: `backend/.env.example`
- Modify: `backend/routes/web.php`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: server-side `DEPLOYMENT_MODE`, restricted to `local`, `staging`, `prelaunch-production`, or `production`.
- Produces: unauthenticated `GET /deployment-info` with only `{"environment_label":""}`, `{"environment_label":"STAGING"}`, or `{"environment_label":"PRE-LAUNCH DEMO"}`; React renders the returned label on login and authenticated screens.

- [ ] **Step 1: Write the failing backend tests**

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;

class DeploymentInfoEndpointTest extends TestCase
{
    public function test_staging_exposes_only_the_safe_environment_label(): void
    {
        config(['deployment.mode' => 'staging']);

        $this->getJson('/deployment-info')
            ->assertOk()
            ->assertExactJson(['environment_label' => 'STAGING']);
    }

    public function test_prelaunch_production_exposes_the_demo_warning(): void
    {
        config(['deployment.mode' => 'prelaunch-production']);

        $this->getJson('/deployment-info')
            ->assertOk()
            ->assertExactJson(['environment_label' => 'PRE-LAUNCH DEMO']);
    }

    public function test_normal_production_exposes_no_label_or_configuration(): void
    {
        config(['deployment.mode' => 'production']);

        $response = $this->getJson('/deployment-info');

        $response->assertOk()->assertExactJson(['environment_label' => '']);
        $this->assertStringNotContainsString('APP_', $response->getContent());
        $this->assertStringNotContainsString('DB_', $response->getContent());
    }
}
```

- [ ] **Step 2: Write the failing frontend tests**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeploymentBanner } from './DeploymentBanner'

describe('DeploymentBanner', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders the runtime environment label', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ environment_label: 'PRE-LAUNCH DEMO' }),
    }))

    render(<DeploymentBanner />)

    expect(await screen.findByRole('status')).toHaveTextContent('PRE-LAUNCH DEMO')
  })

  it('fails closed to no banner when runtime information is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { container } = render(<DeploymentBanner />)

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 3: Run focused tests and verify that they fail**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd artisan test tests/Feature/DeploymentInfoEndpointTest.php
cd ..\frontend
npm.cmd test -- src/components/DeploymentBanner.test.tsx
```

Expected: both commands FAIL because the endpoint and component do not exist.

- [ ] **Step 4: Implement the safe backend runtime contract**

Create `backend/config/deployment.php`:

```php
<?php

return [
    'mode' => env('DEPLOYMENT_MODE', 'local'),
];
```

Create `DeploymentInfoController` whose only response field is derived from an allowlist:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;

class DeploymentInfoController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $label = match (config('deployment.mode')) {
            'staging' => 'STAGING',
            'prelaunch-production' => 'PRE-LAUNCH DEMO',
            default => '',
        };

        return response()->json(['environment_label' => $label]);
    }
}
```

Register `GET /deployment-info` in `backend/routes/web.php` and add this non-secret setting to `backend/.env.example`:

```dotenv
DEPLOYMENT_MODE=local
```

- [ ] **Step 5: Implement the component and styles**

```tsx
import { useEffect, useState } from 'react'
import './DeploymentBanner.css'

export function DeploymentBanner() {
  const [label, setLabel] = useState('')

  useEffect(() => {
    let active = true

    void fetch('/deployment-info', { credentials: 'same-origin' })
      .then((response) => {
        if (!response.ok) throw new Error('Deployment information unavailable')
        return response.json() as Promise<{ environment_label?: unknown }>
      })
      .then((payload) => {
        if (active && typeof payload.environment_label === 'string') {
          setLabel(payload.environment_label)
        }
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  if (!label) return null

  return <div className="deployment-banner" role="status">{label}</div>
}
```

```css
.deployment-banner {
  position: relative;
  z-index: 100;
  width: 100%;
  padding: 0.45rem 1rem;
  border-bottom: 1px solid #92400e;
  background: #fef3c7;
  color: #78350f;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-align: center;
}

@media print {
  .deployment-banner { display: none; }
}
```

- [ ] **Step 6: Render it at both application entry states**

Import `DeploymentBanner` in `frontend/src/App.tsx`. Wrap both the unauthenticated `LoginScreen` and authenticated `AdminShell` returns in fragments whose first child is:

```tsx
<DeploymentBanner />
```

The component remains outside `AdminShell`, cannot be hidden by permissions, and reads runtime information after deployment. The frontend ZIP is therefore identical for staging and production.

- [ ] **Step 7: Run focused and full checks**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd artisan test tests/Feature/DeploymentInfoEndpointTest.php
..\tools\php\php-local.cmd vendor\bin\pint --test app/Http/Controllers/DeploymentInfoController.php config/deployment.php tests/Feature/DeploymentInfoEndpointTest.php routes/web.php
cd ..\frontend
npm.cmd test -- src/components/DeploymentBanner.test.tsx src/App.test.tsx
npm.cmd run lint
npm.cmd run build
```

Expected: backend and frontend tests pass, Pint/Oxlint exit 0, TypeScript passes, and Vite produces `frontend/dist`.

- [ ] **Step 8: Commit**

```powershell
git add -- backend/.env.example backend/app/Http/Controllers/DeploymentInfoController.php backend/config/deployment.php backend/routes/web.php backend/tests/Feature/DeploymentInfoEndpointTest.php frontend/src/App.tsx frontend/src/components/DeploymentBanner.tsx frontend/src/components/DeploymentBanner.test.tsx frontend/src/components/DeploymentBanner.css
git commit -m "feat: show runtime deployment banner"
```

---

### Task 3: Build a deterministic release manifest and ZIP staging tree

**Files:**
- Create: `deploy/scripts/create-release.mjs`
- Create: `deploy/tests/create-release.test.mjs`
- Create: `deploy/release-files.txt`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `--source`, `--output`, `--commit`, `--build-time`, and `--infrastructure-version` CLI arguments plus `deploy/release-files.txt`.
- Produces: an output directory containing the deployable tree and `release-manifest.json`; the caller creates and hashes the ZIP once.

- [ ] **Step 1: Write Node built-in tests for manifest content, exclusions, and reproducibility**

Create temporary backend/frontend fixtures, call the exported `createRelease(options)`, then assert:

```js
assert.equal(manifest.schema_version, 1)
assert.equal(manifest.git_commit, '0123456789abcdef0123456789abcdef01234567')
assert.equal(manifest.build_time_utc, '2026-08-06T00:00:00.000Z')
assert.equal(manifest.infrastructure_version, '1')
assert.deepEqual(manifest.migrations, ['2026_01_01_000001_example.php'])
assert.ok(manifest.files.some((file) => file.path === 'backend/app/example.php'))
assert.ok(manifest.files.some((file) => file.path === 'frontend/dist/index.html'))
assert.ok(manifest.files.every((file) => /^[a-f0-9]{64}$/.test(file.sha256)))
assert.equal(existsSync(join(output, 'backend', '.env')), false)
assert.equal(existsSync(join(output, 'backend', 'database', 'database.sqlite')), false)
```

Also assert that an invalid commit, non-empty output directory, missing `backend/vendor`, or missing `frontend/dist` rejects with a specific error.

- [ ] **Step 2: Run the test and verify that it fails**

Run:

```powershell
node --test deploy/tests/create-release.test.mjs
```

Expected: FAIL because `deploy/scripts/create-release.mjs` does not exist.

- [ ] **Step 3: Implement the release builder with Node standard-library APIs only**

Implement and export:

```js
export async function createRelease({ source, output, commit, buildTime, infrastructureVersion })
```

The implementation must:

1. validate `commit` with `/^[a-f0-9]{40}$/` and `buildTime` with `new Date(buildTime).toISOString() === buildTime`;
2. refuse a missing or non-empty output directory;
3. read newline-delimited allowlist entries from `deploy/release-files.txt`;
4. copy only allowlisted directories/files without following symbolic links;
5. reject any copied `.env`, SQLite file, `node_modules`, test-result directory, or path containing a secret-like filename;
6. sort migration names and file paths with bytewise `localeCompare`;
7. calculate SHA-256 for every copied regular file;
8. write stable two-space JSON ending in one newline.

The CLI parser calls `createRelease()` and exits non-zero with a redacted one-line error. It never prints environment values or file contents.

- [ ] **Step 4: Define the release allowlist**

Create `deploy/release-files.txt`:

```text
backend/app
backend/bootstrap
backend/config
backend/database/migrations
backend/public
backend/resources
backend/routes
backend/storage/app/.gitignore
backend/storage/framework/.gitignore
backend/storage/logs/.gitignore
backend/artisan
backend/composer.json
backend/composer.lock
backend/vendor
frontend/dist
```

- [ ] **Step 5: Ignore local release output without ignoring deployment source**

Append to `.gitignore`:

```gitignore
/deploy/.build/
/deploy/artifacts/
```

- [ ] **Step 6: Run tests and a local release rehearsal**

Run after existing dependencies and `frontend/dist` are present:

```powershell
node --test deploy/tests/create-release.test.mjs
node deploy/scripts/create-release.mjs --source . --output deploy/.build/release --commit 0123456789abcdef0123456789abcdef01234567 --build-time 2026-08-06T00:00:00.000Z --infrastructure-version 1
Get-FileHash -Algorithm SHA256 deploy/.build/release/release-manifest.json
```

Expected: all Node tests pass, the release staging tree is created once, and the manifest hash is a 64-character SHA-256 value. If `backend/vendor` is not installed, the rehearsal must fail with the documented missing-path error rather than silently omitting dependencies.

- [ ] **Step 7: Commit**

```powershell
git add -- .gitignore deploy/release-files.txt deploy/scripts/create-release.mjs deploy/tests/create-release.test.mjs
git commit -m "feat: add immutable release builder"
```

---

### Task 4: Add the pinned PHP-FPM runtime and application Nginx configuration

**Files:**
- Create: `deploy/docker/php/Dockerfile`
- Create: `deploy/docker/php/opcache.ini`
- Create: `deploy/docker/php/php.ini`
- Create: `deploy/docker/nginx/app.conf`
- Create: `deploy/tests/runtime-contract.test.mjs`

**Interfaces:**
- Consumes: an extracted release mounted read-only at `/var/www/matahari/current` and a writable Laravel storage volume at `/var/www/matahari/current/backend/storage/runtime`.
- Produces: `matahari-php:8.4.21-1` listening on FastCGI port 9000 and Nginx serving the React build plus `/api`, `/health`, and `/up` through Laravel.

- [ ] **Step 1: Write static contract tests**

Use Node's test runner to read the Dockerfile and Nginx configuration and assert:

```js
assert.match(dockerfile, /^FROM php:8\.4\.21-fpm-bookworm$/m)
assert.match(dockerfile, /docker-php-ext-install[\s\S]*bcmath[\s\S]*pdo_mysql/)
assert.doesNotMatch(dockerfile, /COPY\s+backend/i)
assert.match(nginx, /location \/api\//)
assert.match(nginx, /location = \/health/)
assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html/)
assert.match(nginx, /fastcgi_pass php:9000/)
assert.doesNotMatch(nginx, /server_tokens on/)
```

- [ ] **Step 2: Run the contract test and verify that it fails**

Run:

```powershell
node --test deploy/tests/runtime-contract.test.mjs
```

Expected: FAIL because the runtime files do not exist.

- [ ] **Step 3: Add the PHP runtime image**

Use `php:8.4.21-fpm-bookworm`, install only runtime libraries and the `bcmath`, `intl`, `opcache`, `pcntl`, `pdo_mysql`, and `zip` extensions, copy the two INI files, create an unprivileged `matahari` user, set the FPM pool to that user, and set `WORKDIR /var/www/matahari/current/backend`. The image must not copy source code, Composer, Node, npm, or any environment file.

The final Dockerfile health check must be process-level only:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD php-fpm -t || exit 1
```

- [ ] **Step 4: Add production PHP settings**

`deploy/docker/php/php.ini` must contain:

```ini
expose_php=Off
display_errors=Off
log_errors=On
memory_limit=256M
max_execution_time=60
post_max_size=16M
upload_max_filesize=16M
session.cookie_httponly=1
session.cookie_secure=1
session.cookie_samesite=Lax
```

`deploy/docker/php/opcache.ini` must contain:

```ini
opcache.enable=1
opcache.enable_cli=0
opcache.validate_timestamps=0
opcache.memory_consumption=128
opcache.max_accelerated_files=20000
opcache.jit=off
```

- [ ] **Step 5: Add the application Nginx server**

The server listens internally on port 8080, sets `server_tokens off`, serves `/var/www/matahari/current/frontend/dist`, uses SPA fallback for non-API routes, and sends `/api/*`, `/health`, and `/up` to `/var/www/matahari/current/backend/public/index.php` through `php:9000`. It denies dotfiles, `.env`, Composer manifests, storage internals, and PHP paths other than the front controller. It emits conservative security headers and leaves TLS/HSTS to the later edge-proxy plan.

- [ ] **Step 6: Run static tests**

Run:

```powershell
node --test deploy/tests/runtime-contract.test.mjs
```

Expected: all runtime contract tests pass.

- [ ] **Step 7: Record the external validation limitation**

Run:

```powershell
Get-Command docker -ErrorAction SilentlyContinue
```

Expected in the current environment: no Docker command. Record **Not verified on Docker: image build, Nginx syntax, PHP extensions, and container health** in the task handoff; do not mark those checks as passed.

- [ ] **Step 8: Commit**

```powershell
git add -- deploy/docker/php/Dockerfile deploy/docker/php/opcache.ini deploy/docker/php/php.ini deploy/docker/nginx/app.conf deploy/tests/runtime-contract.test.mjs
git commit -m "feat: add deployment runtime containers"
```

---

### Task 5: Add isolated database and application Compose contracts

**Files:**
- Create: `deploy/compose/database.yml`
- Create: `deploy/compose/application.yml`
- Create: `deploy/database/init-databases.sh`
- Create: `deploy/database/apply-runtime-grants.sh`
- Create: `deploy/env/database.env.example`
- Create: `deploy/env/staging.env.example`
- Create: `deploy/env/production.env.example`
- Create: `deploy/tests/compose-contract.test.mjs`

**Interfaces:**
- Consumes: private, untracked environment files and an existing release root.
- Produces: one non-public MariaDB service plus separately named staging and production application stacks whose runtime users cannot access each other's databases.

- [ ] **Step 1: Write static Compose and secret-boundary tests**

Tests must assert that:

```js
assert.match(databaseCompose, /mariadb:11\.4\.8/)
assert.doesNotMatch(databaseCompose, /ports:/)
assert.match(applicationCompose, /127\.0\.0\.1:\$\{APP_HTTP_PORT\}:8080/)
assert.match(applicationCompose, /read_only: true/)
assert.match(applicationCompose, /no-new-privileges:true/)
assert.match(applicationCompose, /\/health/)
assert.match(stagingEnv, /APP_ENV_NAME=staging/)
assert.match(stagingEnv, /DB_DATABASE=matahari_staging/)
assert.match(stagingEnv, /DB_USERNAME=matahari_staging_app/)
assert.match(productionEnv, /APP_ENV_NAME=production/)
assert.match(productionEnv, /DB_DATABASE=matahari_production/)
assert.match(productionEnv, /DB_USERNAME=matahari_production_app/)
for (const file of envExamples) assert.doesNotMatch(file, /=.{16,}/)
```

The tests also reject tracked files named `.env`, `htpasswd`, `*.sql`, `*.sqlite`, `*.pem`, or `*.key` under `deploy/`.

- [ ] **Step 2: Run the contract test and verify that it fails**

Run:

```powershell
node --test deploy/tests/compose-contract.test.mjs
```

Expected: FAIL because the Compose and environment files do not exist.

- [ ] **Step 3: Define the private database service**

`deploy/compose/database.yml` uses exact image tag `mariadb:11.4.8`, an internal Docker network named `matahari_database`, a named data volume, `utf8mb4`, UTC, binary logging, 15-minute binlog expiry safety floor of 31 days, and a health check using a dedicated health-check user. It has no host `ports` mapping.

Mount `deploy/database/init-databases.sh` read-only into `/docker-entrypoint-initdb.d/10-matahari.sh`. The initialization script validates database/user identifiers with `^[A-Za-z0-9_]+$` and generated secret values with `^[A-Za-z0-9_-]{32,}$`, creates:

- `matahari_staging`;
- `matahari_production`;
- `matahari_staging_app` and `matahari_production_app` without schema privileges;
- `matahari_staging_migrator` and `matahari_production_migrator`, each with schema privileges only on its own database.

No SQL or password is echoed.

- [ ] **Step 4: Define runtime grants after migrations**

`apply-runtime-grants.sh <database> <runtime-user>` must validate both arguments, revoke all existing privileges from the runtime user, enumerate current tables through `information_schema`, and grant:

- `SELECT`, `INSERT`, `UPDATE`, `DELETE` on normal application tables;
- `SELECT`, `INSERT` only on `audit_logs`;
- no schema-level `CREATE`, `ALTER`, `DROP`, `INDEX`, `TRIGGER`, `GRANT`, or global privileges.

It exits non-zero if `audit_logs` is absent or if the runtime user/database pair is not one of the two approved environment pairs.

- [ ] **Step 5: Define the generic application stack**

`deploy/compose/application.yml` defines `php`, `scheduler`, and `web` services. It uses:

- `COMPOSE_PROJECT_NAME=matahari_staging` or `matahari_production` from the invoking environment file;
- a read-only bind mount `${RELEASE_ROOT}/current:/var/www/matahari/current:ro`;
- a per-environment writable storage volume mounted only at Laravel runtime storage;
- a private application network plus the external `matahari_database` network for PHP/scheduler only;
- a web binding on `127.0.0.1:${APP_HTTP_PORT}:8080` so the application is not directly public;
- `read_only: true`, `tmpfs`, dropped Linux capabilities, and `no-new-privileges:true` wherever supported;
- a web health check against `http://127.0.0.1:8080/health`.

The scheduler command is:

```yaml
command: ["php", "artisan", "schedule:work", "--no-interaction"]
```

- [ ] **Step 6: Add non-secret examples**

The three example files contain exact database names, account names, internal service names, ports `18080` for staging and `18081` for production, placeholder domains from the approved design, `APP_DEBUG=false`, secure session settings, `MAIL_MAILER=log`, and empty secret values. Each file begins with:

```dotenv
# Copy to an untracked server-side file and fill secrets there. Never commit the copy.
```

Staging sets `DEPLOYMENT_MODE=staging`; pre-launch production sets `DEPLOYMENT_MODE=prelaunch-production`; official production sets `DEPLOYMENT_MODE=production`. The server returns the safe label at runtime, so all environments use the exact same frontend files and ZIP.

- [ ] **Step 7: Run static contract tests**

Run:

```powershell
node --test deploy/tests/compose-contract.test.mjs
```

Expected: all Compose and secret-boundary tests pass. Docker runtime checks remain **Not verified** on the current machine.

- [ ] **Step 8: Commit**

```powershell
git add -- deploy/compose deploy/database deploy/env deploy/tests/compose-contract.test.mjs
git commit -m "feat: define isolated deployment environments"
```

---

### Task 6: Add quick CI, one-time artifact build, and full MariaDB qualification

**Files:**
- Create: `.github/workflows/release-candidate.yml`
- Create: `.github/workflows/full-qualification.yml`
- Create: `deploy/scripts/package-release.sh`
- Create: `deploy/tests/workflow-contract.test.mjs`

**Interfaces:**
- Consumes: pushes to `master`, the committed lockfiles, and the release builder from Task 3.
- Produces: one GitHub artifact named `matahari-<40-character-commit>.zip`, a sibling `.sha256` file, quick-check status, and full-qualification status. It performs no SSH deployment in this plan.

- [ ] **Step 1: Write workflow contract tests**

Parse the workflow text and assert:

```js
assert.match(releaseWorkflow, /branches:\s*\[master\]/)
assert.match(releaseWorkflow, /npm ci/)
assert.match(releaseWorkflow, /composer install --no-dev --prefer-dist --no-interaction --no-progress --optimize-autoloader/)
assert.match(releaseWorkflow, /create-release\.mjs/)
assert.match(releaseWorkflow, /upload-artifact@v4/)
assert.match(qualificationWorkflow, /mariadb:11\.4\.8/)
assert.match(qualificationWorkflow, /php artisan test/)
assert.match(qualificationWorkflow, /npm run lint/)
assert.match(qualificationWorkflow, /npm run build/)
assert.match(qualificationWorkflow, /composer audit/)
assert.match(qualificationWorkflow, /npm audit/)
assert.doesNotMatch(`${releaseWorkflow}\n${qualificationWorkflow}`, /secrets\.[A-Z_]+/)
```

The final assertion is intentional: this foundation must not introduce deployment secrets before an SSH target exists.

- [ ] **Step 2: Run the workflow contract test and verify that it fails**

Run:

```powershell
node --test deploy/tests/workflow-contract.test.mjs
```

Expected: FAIL because the workflows do not exist.

- [ ] **Step 3: Implement quick checks and the single artifact build**

`release-candidate.yml` runs on push to `master` and manual dispatch. It uses Ubuntu, Node 24, PHP 8.4 with required extensions, Composer cache, and npm cache. Its jobs:

1. `quick-checks`: Composer lock validation, Pint, PHP route loading, a focused health/auth test group, npm clean install, focused Vitest, Oxlint, and tracked-file secret/name checks.
2. `build-release`: depends on quick checks; installs Composer production dependencies into `backend/vendor`, builds `frontend/dist` once with an empty runtime-independent banner, calls `create-release.mjs`, calls `package-release.sh`, verifies SHA-256, and uploads ZIP + checksum + manifest with 30-day retention.

The workflow grants only:

```yaml
permissions:
  contents: read
```

- [ ] **Step 4: Implement archive packaging**

`package-release.sh <release-directory> <artifact-directory> <commit>` validates the 40-character lowercase commit, refuses symlinks, runs:

```bash
TZ=UTC find . -exec touch -h -d '@0' {} +
zip -X -q -r "../matahari-${commit}.zip" .
sha256sum "matahari-${commit}.zip" > "matahari-${commit}.zip.sha256"
```

from the staged release directory, then validates that the ZIP contains exactly one `release-manifest.json` and no `.env`, `.sqlite`, `node_modules`, test results, PEM/key files, or absolute paths.

- [ ] **Step 5: Implement full qualification**

`full-qualification.yml` is callable by `workflow_call` and manually dispatchable with a required commit SHA. It starts disposable `mariadb:11.4.8`, installs dev dependencies, and runs:

- complete PHPUnit;
- Pint check and API/health route loading;
- migrate, rollback, and re-migrate against a disposable database whose name contains `test`;
- complete Vitest, Oxlint, TypeScript, and Vite build;
- `composer audit --locked`;
- `npm audit --omit=dev --audit-level=moderate` and `npm audit --audit-level=moderate`;
- the complete `node --test deploy/tests/*.test.mjs` contract suite.

`release-candidate.yml` calls the reusable full qualification workflow only after the release artifact has been produced. Until the remote staging plan exists, the job name and documentation must say `Full qualification (staging deployment pending)` rather than claiming it ran after staging.

- [ ] **Step 6: Run local static tests**

Run:

```powershell
node --test deploy/tests/workflow-contract.test.mjs deploy/tests/create-release.test.mjs deploy/tests/runtime-contract.test.mjs deploy/tests/compose-contract.test.mjs
```

Expected: all deployment contract tests pass. GitHub-hosted execution and disposable MariaDB remain **Not verified** until the workflows run remotely.

- [ ] **Step 7: Commit**

```powershell
git add -- .github/workflows/release-candidate.yml .github/workflows/full-qualification.yml deploy/scripts/package-release.sh deploy/tests/workflow-contract.test.mjs
git commit -m "ci: build and qualify deployment artifacts"
```

---

### Task 7: Document operation boundaries and verify the foundation

**Files:**
- Create: `docs/deployment-foundation.md`
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/current-status.md`
- Modify: `docs/testing-and-release.md`

**Interfaces:**
- Consumes: the implemented repository files and actual command evidence from Tasks 1–6.
- Produces: a current, non-secret operator/developer guide that never describes unverified Docker, GitHub, VPS, backup, or monitoring behavior as complete.

- [ ] **Step 1: Write the deployment foundation guide**

The guide must contain:

- architecture and file map;
- exact local Node/backend/frontend verification commands;
- how to copy example environment files without committing the copies;
- how staging and production database/runtime identities differ;
- release ZIP contents, manifest, checksum, retention, and exclusions;
- the current workflow order and the explicit fact that SSH staging deployment is not yet wired;
- current Docker absence and exact checks that are **Not verified**;
- next-plan prerequisites: VPS IP, domains, SSH deployment identity, GitHub repository variables, TLS, and remote backup/Telegram targets;
- a warning that production demo reset, backup, restore, and promotion scripts do not yet exist.

- [ ] **Step 2: Update canonical status without overstating completion**

Update the documentation links and replace only the deployment-status claims made obsolete by the implementation. Preserve these explicit statements until evidence exists:

```markdown
- Real staging deployment: **Not configured**
- Real production deployment: **Not configured**
- Docker runtime validation: **Not verified on this workstation**
- Off-site backup: **Not configured**
- Point-in-time restore drill: **Not verified**
- Telegram alerting: **Not configured**
```

- [ ] **Step 3: Run full local validation**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd artisan test
..\tools\php\php-local.cmd vendor\bin\pint --test
..\tools\php\php-local.cmd artisan route:list --path=api --except-vendor
..\tools\php\php-local.cmd artisan route:list --path=health --except-vendor
cd ..\frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
cd ..
node --test deploy/tests/*.test.mjs
git diff --check
```

Expected: PHPUnit, Pint, route loading, Vitest, Oxlint, TypeScript/Vite, Node deployment contracts, and whitespace checks pass. Record exact counts and versions in `docs/current-status.md` only if freshly observed.

- [ ] **Step 4: Inspect the intended diff and tracked-file safety**

Run:

```powershell
git status --short
git diff --stat origin/master...HEAD
git ls-files deploy .github | Select-String -Pattern '(\.env$|\.sqlite$|\.pem$|\.key$|htpasswd$|test-results)'
git grep -n -I -E '(BEGIN (RSA |OPENSSH )?PRIVATE KEY|DB_PASSWORD=.+|TELEGRAM_BOT_TOKEN=.+)'
```

Expected: only intended source/config/docs are tracked; the filename scan returns no secret artifacts; the content scan returns no populated credentials or private keys. Existing unrelated untracked files remain untouched.

- [ ] **Step 5: Commit documentation**

```powershell
git add -- README.md docs/README.md docs/current-status.md docs/deployment-foundation.md docs/testing-and-release.md
git commit -m "docs: document deployment foundation operations"
```

- [ ] **Step 6: Completion gate**

Do not call this phase complete unless every locally available check passed and every unavailable external check is labeled **Not verified**. Do not push, open a pull request, create GitHub Secrets, connect to a VPS, initialize MariaDB, or deploy an environment without a separate authorized step.

## Plan Self-Review

- **Spec coverage:** This phase covers repository health, environment identity, immutable artifacts, runtime/Compose separation, and CI qualification. Remote release operations and recovery/monitoring are explicitly split because they require external infrastructure and separate acceptance evidence.
- **Artifact consistency:** The banner was corrected from build-time Vite configuration to a runtime Laravel response so staging and production can use the exact same ZIP.
- **Secret boundary:** All examples contain empty secret values; static tests reject tracked secret-bearing filenames; CI has no deployment secrets in this phase.
- **Database safety:** Runtime and migration identities are separate, database ports are private, and destructive production database commands are absent.
- **Verification honesty:** Docker, GitHub-hosted runners, real MariaDB containers, VPS deployment, backups, restore, and Telegram are not represented as verified from this workstation.
