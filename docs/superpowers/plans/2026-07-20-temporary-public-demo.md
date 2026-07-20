# Temporary Public Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, double-clickable Windows workflow that exposes the persistent Matahari SQLite demo through a free temporary Cloudflare HTTPS URL.

**Architecture:** Laravel runs on loopback port `8002`, Vite Preview runs on loopback port `4175` and proxies `/api` to Laravel, and a Cloudflare Quick Tunnel exposes only Vite Preview. A PowerShell module owns validation, a pinned `cloudflared` download, process identity, state, health checks, and cleanup; thin start/stop scripts and `.cmd` wrappers provide the operator workflow.

**Tech Stack:** Windows PowerShell 5.1, Cloudflare `cloudflared`, Laravel 13/PHP 8.4, React 19/TypeScript 6/Vite 8, SQLite, PHPUnit, and Vitest.

## Global Constraints

- Preserve `backend/database/database.sqlite`; public-demo start and stop code must not run migrations, seeders, reset commands, replacement, or deletion against it.
- Bind Laravel to `127.0.0.1:8002` and Vite Preview to `127.0.0.1:4175`; expose only Vite Preview through the tunnel.
- Build with `VITE_API_BASE_URL=/api` and proxy `/api` to `http://127.0.0.1:8002`.
- Run Laravel with process-scoped `APP_DEBUG=false`, SQLite, file session/cache, and sync queue overrides without editing `backend/.env`.
- Pin `cloudflared` to official release `2026.7.2`, URL `https://github.com/cloudflare/cloudflared/releases/download/2026.7.2/cloudflared-windows-amd64.exe`, and SHA-256 `cdb5d4432f6ae1595654a692a51308b69d2bf7af961f5578d9391837cf072df9`.
- Store task-owned binaries, logs, state, PIDs, and the public URL under ignored `/.demo-public/`; never install machine-wide.
- Stop processes only after PID and executable-path identity checks; never kill a process solely because it owns port `8002` or `4175`.
- Protect `GET /api/dashboard/school` and `POST /api/invoices/generate-monthly` with existing session authentication.
- Remain compatible with Windows PowerShell 5.1; do not use PowerShell 7-only syntax or parameters.
- Preserve all pre-existing dirty and untracked workspace content. Do not stage the current user changes in `README.md`, `docs/DEVELOPMENT_SETUP.md`, `frontend/src/api.ts`, seeders, test results, or other unrelated paths.

## File map

- Modify `backend/routes/api.php`: move the two legacy routes into the session-authenticated route group.
- Modify `backend/tests/Feature/AuthApiTest.php`: prove both legacy routes reject unauthenticated requests.
- Modify `backend/tests/Feature/ApiWorkflowTest.php`: authenticate the existing successful workflow.
- Modify `frontend/vite.config.ts`: share a configurable API proxy and add strict preview settings.
- Create `frontend/vite.config.test.ts`: unit-test preview host, port, allowed host, and proxy target.
- Create `.gitignore`: ignore only the root task-owned runtime directory.
- Create `tools/public-demo/PublicDemo.psm1`: reusable paths, checks, download verification, state, URL parsing, and safe process cleanup.
- Create `tools/public-demo/tests/PublicDemo.Tests.ps1`: dependency-free PowerShell module tests.
- Create `tools/public-demo/tests/LauncherContract.Tests.ps1`: static safety contract for the launchers.
- Create `tools/public-demo/start-public-demo.ps1`: build and start backend, preview, and tunnel with rollback.
- Create `tools/public-demo/stop-public-demo.ps1`: stop only recorded matching processes and preserve data/logs.
- Create `tools/public-demo/start-public-demo.cmd` and `tools/public-demo/stop-public-demo.cmd`: double-click entry points.
- Create `docs/PUBLIC_DEMO.md`: operator instructions, security model, persistence, and troubleshooting.

---

### Task 1: Put legacy APIs behind the existing login session

**Files:**
- Modify: `backend/tests/Feature/AuthApiTest.php`
- Modify: `backend/tests/Feature/ApiWorkflowTest.php`
- Modify: `backend/routes/api.php`

**Interfaces:**
- Consumes: existing Laravel `$sessionMiddleware` array and the `auth` middleware alias.
- Produces: both legacy endpoints return HTTP `401` without a session and retain their existing responses for an authenticated seeded admin.

- [ ] **Step 1: Write the failing authentication regression test**

Add this method to `AuthApiTest`:

```php
public function test_legacy_dashboard_and_invoice_generation_require_authentication(): void
{
    $this->seed();

    $school = School::query()->where('code', 'MIS')->firstOrFail();

    $this->getJson('/api/dashboard/school?school_id='.$school->id.'&invoice_month=2026-07')
        ->assertUnauthorized();

    $this->postJson('/api/invoices/generate-monthly', [
        'school_id' => $school->id,
        'invoice_month' => '2026-07',
        'issue_date' => '2026-07-01',
        'due_date' => '2026-07-10',
    ])->assertUnauthorized();
}
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit --filter=test_legacy_dashboard_and_invoice_generation_require_authentication
```

Expected: FAIL because the current endpoints return successful responses without authentication.

- [ ] **Step 3: Move the routes into the authenticated group**

Delete the two top-level route declarations and place them at the top of the existing `Route::middleware([...$sessionMiddleware, 'auth'])` group:

```php
Route::middleware([...$sessionMiddleware, 'auth'])->group(function (): void {
    Route::get('/dashboard/school', [DashboardController::class, 'school']);
    Route::post('/invoices/generate-monthly', [InvoiceGenerationController::class, 'store']);

    Route::get('/calendar-events', [CalendarEventController::class, 'index'])
        ->middleware('permission:calendar.view');
});
```

Do not alter the other routes inside this group.

- [ ] **Step 4: Update the successful workflow to authenticate**

Add `use App\Models\User;` to `ApiWorkflowTest`. After `$this->seed()`, resolve the seeded admin and apply it to both protected calls:

```php
$admin = User::query()->where('email', 'admin@mis.test')->firstOrFail();

$this->actingAs($admin)->postJson('/api/invoices/generate-monthly', [
    'school_id' => $school->id,
    'invoice_month' => '2026-07',
    'issue_date' => '2026-07-01',
    'due_date' => '2026-07-10',
])
    ->assertCreated()
    ->assertJsonPath('created_count', 3)
    ->assertJsonPath('skipped_count', 0);

$this->actingAs($admin)
    ->getJson('/api/dashboard/school?school_id='.$school->id.'&invoice_month=2026-07')
    ->assertOk();
```

Apply the same `$admin` authentication to the invoice-generation call in `test_legacy_invoice_first_payment_endpoint_is_not_available`; leave the deliberately missing `/api/payments` request unchanged.

- [ ] **Step 5: Run focused and full backend tests**

Run:

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit tests\Feature\AuthApiTest.php tests\Feature\ApiWorkflowTest.php
..\tools\php\php-local.cmd vendor\bin\phpunit
```

Expected: both focused files PASS, then the complete backend suite PASS.

- [ ] **Step 6: Commit only the authentication changes**

```powershell
git add backend/routes/api.php backend/tests/Feature/AuthApiTest.php backend/tests/Feature/ApiWorkflowTest.php
git commit -m "fix: require login for legacy APIs"
```

### Task 2: Configure and test the single-origin Vite Preview

**Files:**
- Create: `frontend/vite.config.test.ts`
- Modify: `frontend/vite.config.ts`

**Interfaces:**
- Consumes: `VITE_API_PROXY_TARGET` from the launcher process environment.
- Produces: `createViteConfig(env)` and a preview on `127.0.0.1:4175` with strict port selection, `.trycloudflare.com` allowed, and `/api` proxied to the supplied target.

- [ ] **Step 1: Write the failing config test**

Create `frontend/vite.config.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createViteConfig } from './vite.config'

describe('public demo preview config', () => {
  it('binds loopback and proxies the API to the supplied backend', () => {
    const config = createViteConfig({
      VITE_API_PROXY_TARGET: 'http://127.0.0.1:8002',
    })

    expect(config.preview).toEqual({
      host: '127.0.0.1',
      port: 4175,
      strictPort: true,
      allowedHosts: ['.trycloudflare.com'],
      proxy: { '/api': 'http://127.0.0.1:8002' },
    })
    expect(config.server?.proxy).toEqual({
      '/api': 'http://127.0.0.1:8002',
    })
  })

  it('keeps the normal local API target when no override is supplied', () => {
    const config = createViteConfig({})

    expect(config.server?.proxy).toEqual({
      '/api': 'http://127.0.0.1:8000',
    })
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
cd frontend
npm.cmd test -- vite.config.test.ts
```

Expected: FAIL because `createViteConfig` is not exported.

- [ ] **Step 3: Implement the configurable dev and preview proxy**

Replace `frontend/vite.config.ts` with:

```ts
import { defineConfig, type UserConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export function createViteConfig(env: NodeJS.ProcessEnv = process.env): UserConfig {
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:8000'

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
    server: {
      proxy: {
        '/api': apiProxyTarget,
      },
    },
    preview: {
      host: '127.0.0.1',
      port: 4175,
      strictPort: true,
      allowedHosts: ['.trycloudflare.com'],
      proxy: {
        '/api': apiProxyTarget,
      },
    },
  }
}

export default defineConfig(createViteConfig())
```

- [ ] **Step 4: Run the config test and public-demo build check**

Run:

```powershell
cd frontend
npm.cmd test -- vite.config.test.ts
$env:VITE_API_BASE_URL='/api'
$env:VITE_API_PROXY_TARGET='http://127.0.0.1:8002'
npm.cmd run build
if (rg -n "http://127\.0\.0\.1:8000/api" dist) { throw 'Public build contains the loopback API base.' }
Remove-Item Env:VITE_API_BASE_URL
Remove-Item Env:VITE_API_PROXY_TARGET
```

Expected: two config tests PASS, build PASS, and `rg` finds no loopback API base in `dist`.

- [ ] **Step 5: Run the full frontend verification**

```powershell
cd frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Expected: tests, lint, TypeScript compilation, and production build PASS.

- [ ] **Step 6: Commit the preview configuration**

```powershell
git add frontend/vite.config.ts frontend/vite.config.test.ts
git commit -m "feat: configure public demo preview"
```

### Task 3: Build tested PowerShell safety and lifecycle primitives

**Files:**
- Create: `.gitignore`
- Create: `tools/public-demo/PublicDemo.psm1`
- Create: `tools/public-demo/tests/PublicDemo.Tests.ps1`

**Interfaces:**
- Produces: `Get-PublicDemoPaths`, `Assert-PublicDemoPrerequisites`, `Assert-PublicDemoPortAvailable`, `Wait-PublicDemoHttp`, `Assert-PublicDemoSha256`, `Get-PublicDemoCloudflared`, `Save-PublicDemoState`, `Read-PublicDemoState`, `Test-PublicDemoProcessIdentity`, `Test-PublicDemoStateHealthy`, `Stop-PublicDemoOwnedProcess`, `Stop-PublicDemoStateProcesses`, and `Wait-PublicDemoTunnelUrl`.
- State schema: `{ url: string, processes: [{ name: string, id: int, executable_path: string }] }` serialized as JSON.

- [ ] **Step 1: Write the failing dependency-free PowerShell tests**

Create `tools/public-demo/tests/PublicDemo.Tests.ps1` with a small assertion harness and these exact cases:

```powershell
$ErrorActionPreference = 'Stop'
$module = Join-Path $PSScriptRoot '..\PublicDemo.psm1'
Import-Module $module -Force

function Assert-True([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

function Assert-Throws([scriptblock]$Action, [string]$Pattern) {
    $caught = $null
    try { & $Action } catch { $caught = $_ }
    if (-not $caught) { throw "Expected failure matching: $Pattern" }
    if ($caught.Exception.Message -notmatch $Pattern) { throw $caught }
}

$tempRoot = Join-Path ([IO.Path]::GetTempPath()) ('matahari-public-demo-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
    $paths = Get-PublicDemoPaths -RepoRoot $tempRoot
    Assert-True ($paths.RuntimeRoot -eq (Join-Path $tempRoot '.demo-public')) 'Runtime root escaped the repository.'

    Assert-Throws { Assert-PublicDemoPrerequisites -Paths $paths } 'Demo database not found'

    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $occupiedPort = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
    Assert-Throws { Assert-PublicDemoPortAvailable -Port $occupiedPort } 'already in use'
    $listener.Stop()

    $hashFile = Join-Path $tempRoot 'hash.txt'
    Set-Content -LiteralPath $hashFile -Value 'abc' -NoNewline -Encoding Ascii
    Assert-PublicDemoSha256 -Path $hashFile -Expected 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    Assert-Throws { Assert-PublicDemoSha256 -Path $hashFile -Expected ('0' * 64) } 'checksum'

    $state = [pscustomobject]@{
        url = 'https://example.trycloudflare.com'
        processes = @([pscustomobject]@{ name = 'test'; id = $PID; executable_path = (Get-Process -Id $PID).Path })
    }
    Save-PublicDemoState -Paths $paths -State $state
    $loaded = Read-PublicDemoState -Paths $paths
    Assert-True ($loaded.url -eq $state.url) 'State URL did not round-trip.'
    Assert-True (Test-PublicDemoStateHealthy -State $loaded) 'Matching state was not healthy.'
    Assert-True (Test-PublicDemoProcessIdentity -Id $PID -ExecutablePath (Get-Process -Id $PID).Path) 'Matching process was rejected.'
    Assert-True (-not (Test-PublicDemoProcessIdentity -Id $PID -ExecutablePath (Join-Path $tempRoot 'wrong.exe'))) 'Mismatched process was accepted.'

    $log = Join-Path $tempRoot 'cloudflared.log'
    Set-Content -LiteralPath $log -Value 'INF https://sunny-demo.trycloudflare.com ready'
    $url = Wait-PublicDemoTunnelUrl -LogPaths @($log) -TimeoutSeconds 1
    Assert-True ($url -eq 'https://sunny-demo.trycloudflare.com') 'Tunnel URL was not parsed.'

    Write-Host 'PublicDemo.Tests.ps1: PASS'
}
finally {
    if ($listener) { try { $listener.Stop() } catch {} }
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\public-demo\tests\PublicDemo.Tests.ps1
```

Expected: FAIL because `PublicDemo.psm1` does not exist.

- [ ] **Step 3: Ignore the runtime directory**

Create the root `.gitignore` with exactly:

```gitignore
/.demo-public/
```

- [ ] **Step 4: Implement the PowerShell module**

Create `tools/public-demo/PublicDemo.psm1`. Use `Set-StrictMode -Version Latest`, the pinned constants from Global Constraints, and implement the exported functions with these contracts:

```powershell
Set-StrictMode -Version Latest

$script:CloudflaredVersion = '2026.7.2'
$script:CloudflaredUrl = 'https://github.com/cloudflare/cloudflared/releases/download/2026.7.2/cloudflared-windows-amd64.exe'
$script:CloudflaredSha256 = 'cdb5d4432f6ae1595654a692a51308b69d2bf7af961f5578d9391837cf072df9'

function Get-PublicDemoPaths([string]$RepoRoot) {
    $root = [IO.Path]::GetFullPath($RepoRoot).TrimEnd('\')
    $runtime = Join-Path $root '.demo-public'
    [pscustomobject]@{
        RepoRoot = $root
        RuntimeRoot = $runtime
        BinRoot = Join-Path $runtime 'bin'
        LogRoot = Join-Path $runtime 'logs'
        StatePath = Join-Path $runtime 'state.json'
        UrlPath = Join-Path $runtime 'public-url.txt'
        CloudflaredPath = Join-Path $runtime 'bin\cloudflared.exe'
        CloudflaredConfigPath = Join-Path $runtime 'cloudflared.yml'
        DatabasePath = Join-Path $root 'backend\database\database.sqlite'
        PhpIniPath = Join-Path $root 'tools\php\php.ini'
        BackendPublicPath = Join-Path $root 'backend\public'
        LaravelRouterPath = Join-Path $root 'backend\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
        FrontendPath = Join-Path $root 'frontend'
        ViteCliPath = Join-Path $root 'frontend\node_modules\vite\bin\vite.js'
    }
}

function Assert-PublicDemoPrerequisites($Paths) {
    if (-not (Test-Path -LiteralPath $Paths.DatabasePath -PathType Leaf)) {
        throw 'Demo database not found. Run tools\php\reset-demo-sqlite.cmd once, then start the public demo again.'
    }
    foreach ($required in @($Paths.PhpIniPath, $Paths.LaravelRouterPath, $Paths.ViteCliPath)) {
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required file not found: $required" }
    }
    foreach ($command in @('php.exe', 'node.exe', 'npm.cmd')) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Required command not found: $command" }
    }
}

function Assert-PublicDemoPortAvailable([int]$Port) {
    $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
    try { $probe.Start() }
    catch { throw "Port $Port is already in use. Stop the conflicting local service and try again." }
    finally { try { $probe.Stop() } catch {} }
}

function Get-PublicDemoHttpStatus([string]$Uri) {
    try { return [int](Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5).StatusCode }
    catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode }
        return 0
    }
}

function Wait-PublicDemoHttp([string]$Uri, [int]$ExpectedStatus, [int]$TimeoutSeconds) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        if ((Get-PublicDemoHttpStatus -Uri $Uri) -eq $ExpectedStatus) { return }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "Timed out waiting for HTTP $ExpectedStatus from $Uri"
}

function Assert-PublicDemoSha256([string]$Path, [string]$Expected) {
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Expected.ToLowerInvariant()) { throw "cloudflared checksum mismatch. Expected $Expected but received $actual." }
}

function Get-PublicDemoCloudflared($Paths) {
    New-Item -ItemType Directory -Path $Paths.BinRoot -Force | Out-Null
    if (Test-Path -LiteralPath $Paths.CloudflaredPath) {
        Assert-PublicDemoSha256 -Path $Paths.CloudflaredPath -Expected $script:CloudflaredSha256
        return $Paths.CloudflaredPath
    }
    $download = $Paths.CloudflaredPath + '.download'
    try {
        Invoke-WebRequest -Uri $script:CloudflaredUrl -OutFile $download -UseBasicParsing
        Assert-PublicDemoSha256 -Path $download -Expected $script:CloudflaredSha256
        Move-Item -LiteralPath $download -Destination $Paths.CloudflaredPath -Force
        return $Paths.CloudflaredPath
    }
    finally { Remove-Item -LiteralPath $download -Force -ErrorAction SilentlyContinue }
}

function Save-PublicDemoState($Paths, $State) {
    New-Item -ItemType Directory -Path $Paths.RuntimeRoot -Force | Out-Null
    $State | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Paths.StatePath -Encoding UTF8
}

function Read-PublicDemoState($Paths) {
    if (-not (Test-Path -LiteralPath $Paths.StatePath -PathType Leaf)) { return $null }
    Get-Content -LiteralPath $Paths.StatePath -Raw | ConvertFrom-Json
}

function Test-PublicDemoProcessIdentity([int]$Id, [string]$ExecutablePath) {
    try {
        $process = Get-Process -Id $Id -ErrorAction Stop
        return ([IO.Path]::GetFullPath($process.Path) -ieq [IO.Path]::GetFullPath($ExecutablePath))
    }
    catch { return $false }
}

function Test-PublicDemoStateHealthy($State) {
    if (-not $State -or -not $State.url -or @($State.processes).Count -ne 3) { return $false }
    foreach ($process in @($State.processes)) {
        if (-not (Test-PublicDemoProcessIdentity -Id $process.id -ExecutablePath $process.executable_path)) { return $false }
    }
    return $true
}

function Stop-PublicDemoOwnedProcess($ProcessRecord) {
    if (-not (Test-PublicDemoProcessIdentity -Id $ProcessRecord.id -ExecutablePath $ProcessRecord.executable_path)) {
        Write-Warning "Skipped stale or mismatched PID $($ProcessRecord.id) ($($ProcessRecord.name))."
        return $false
    }
    Stop-Process -Id $ProcessRecord.id -Force
    try { Wait-Process -Id $ProcessRecord.id -Timeout 10 -ErrorAction SilentlyContinue } catch {}
    return $true
}

function Stop-PublicDemoStateProcesses($State) {
    $records = @($State.processes)
    [array]::Reverse($records)
    $allMatched = $true
    foreach ($record in $records) {
        if (-not (Stop-PublicDemoOwnedProcess -ProcessRecord $record)) { $allMatched = $false }
    }
    return $allMatched
}

function Wait-PublicDemoTunnelUrl([string[]]$LogPaths, [int]$TimeoutSeconds) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        foreach ($path in $LogPaths) {
            if (-not (Test-Path -LiteralPath $path)) { continue }
            $match = [regex]::Match((Get-Content -LiteralPath $path -Raw), 'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($match.Success) { return $match.Value }
        }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'Timed out waiting for Cloudflare to issue a temporary URL.'
}

Export-ModuleMember -Function Get-PublicDemoPaths, Assert-PublicDemoPrerequisites, Assert-PublicDemoPortAvailable, Wait-PublicDemoHttp, Assert-PublicDemoSha256, Get-PublicDemoCloudflared, Save-PublicDemoState, Read-PublicDemoState, Test-PublicDemoProcessIdentity, Test-PublicDemoStateHealthy, Stop-PublicDemoOwnedProcess, Stop-PublicDemoStateProcesses, Wait-PublicDemoTunnelUrl
```

- [ ] **Step 5: Run the module tests**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\public-demo\tests\PublicDemo.Tests.ps1
```

Expected: `PublicDemo.Tests.ps1: PASS`.

- [ ] **Step 6: Commit the runtime foundation**

```powershell
git add .gitignore tools/public-demo/PublicDemo.psm1 tools/public-demo/tests/PublicDemo.Tests.ps1
git commit -m "feat: add public demo runtime safety"
```

### Task 4: Add double-click start and stop launchers

**Files:**
- Create: `tools/public-demo/tests/LauncherContract.Tests.ps1`
- Create: `tools/public-demo/start-public-demo.ps1`
- Create: `tools/public-demo/stop-public-demo.ps1`
- Create: `tools/public-demo/start-public-demo.cmd`
- Create: `tools/public-demo/stop-public-demo.cmd`

**Interfaces:**
- Consumes: all `PublicDemo.psm1` functions and `VITE_API_PROXY_TARGET` from Task 2.
- Produces: a successful start writes `.demo-public/state.json` and `.demo-public/public-url.txt`; stop removes only those active-state files and preserves `.demo-public/bin`, `.demo-public/logs`, and SQLite.

- [ ] **Step 1: Write the failing launcher safety contract**

Create `tools/public-demo/tests/LauncherContract.Tests.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
$publicDemoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repoRoot = [IO.Path]::GetFullPath((Join-Path $publicDemoRoot '..\..'))

function Require([bool]$Condition, [string]$Message) { if (-not $Condition) { throw $Message } }

$required = @('start-public-demo.ps1', 'stop-public-demo.ps1', 'start-public-demo.cmd', 'stop-public-demo.cmd')
foreach ($name in $required) { Require (Test-Path -LiteralPath (Join-Path $publicDemoRoot $name)) "Missing launcher: $name" }

$start = Get-Content -LiteralPath (Join-Path $publicDemoRoot 'start-public-demo.ps1') -Raw
$stop = Get-Content -LiteralPath (Join-Path $publicDemoRoot 'stop-public-demo.ps1') -Raw
$ignore = Get-Content -LiteralPath (Join-Path $repoRoot '.gitignore') -Raw

Require ($start -match "VITE_API_BASE_URL\s*=\s*'/api'") 'Start script does not build with /api.'
Require ($start -match '127\.0\.0\.1:8002') 'Laravel loopback port is missing.'
Require ($start -match '127\.0\.0\.1:4175') 'Preview loopback port is missing.'
Require ($start -notmatch 'migrate:fresh|db:wipe|reset-demo-sqlite') 'Start script contains a database reset command.'
Require ($stop -notmatch 'database\.sqlite|migrate:fresh|db:wipe') 'Stop script may alter the database.'
Require ($ignore -match '(?m)^/\.demo-public/$') 'Runtime directory is not ignored.'

Write-Host 'LauncherContract.Tests.ps1: PASS'
```

- [ ] **Step 2: Run the contract and verify it fails**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\public-demo\tests\LauncherContract.Tests.ps1
```

Expected: FAIL with `Missing launcher: start-public-demo.ps1`.

- [ ] **Step 3: Implement the start orchestrator**

Create `start-public-demo.ps1` with this control flow:

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'PublicDemo.psm1') -Force

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$paths = Get-PublicDemoPaths -RepoRoot $repoRoot
$started = New-Object System.Collections.ArrayList
$savedEnvironment = @{}
$environment = @{
    APP_ENV = 'local'; APP_DEBUG = 'false'; DB_CONNECTION = 'sqlite'; DB_DATABASE = $paths.DatabasePath
    SESSION_DRIVER = 'file'; CACHE_STORE = 'file'; QUEUE_CONNECTION = 'sync'
    VITE_API_BASE_URL = '/api'; VITE_API_PROXY_TARGET = 'http://127.0.0.1:8002'
}

function Quote-Argument([string]$Value) { return '"' + $Value.Replace('"', '\"') + '"' }
function Add-StartedProcess([string]$Name, $Process) {
    $executablePath = (Get-Process -Id $Process.Id -ErrorAction Stop).Path
    [void]$started.Add([pscustomobject]@{ name = $Name; id = $Process.Id; executable_path = $executablePath })
}
function Show-PublicUrl([string]$Url) {
    Write-Host "`nPublic demo is ready:`n$Url`n"
    try { Set-Clipboard -Value $Url; Write-Host 'The URL has been copied to the clipboard.' } catch {}
}

try {
    $existing = Read-PublicDemoState -Paths $paths
    if (Test-PublicDemoStateHealthy -State $existing) { Show-PublicUrl -Url $existing.url; exit 0 }
    if ($existing) { [void](Stop-PublicDemoStateProcesses -State $existing) }
    Remove-Item -LiteralPath $paths.StatePath, $paths.UrlPath -Force -ErrorAction SilentlyContinue

    Assert-PublicDemoPrerequisites -Paths $paths
    Assert-PublicDemoPortAvailable -Port 8002
    Assert-PublicDemoPortAvailable -Port 4175
    $cloudflared = Get-PublicDemoCloudflared -Paths $paths

    New-Item -ItemType Directory -Path $paths.LogRoot -Force | Out-Null
    foreach ($name in $environment.Keys) {
        $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $environment[$name], 'Process')
    }

    Push-Location $paths.FrontendPath
    try { & npm.cmd run build; if ($LASTEXITCODE -ne 0) { throw 'Frontend public-demo build failed.' } }
    finally { Pop-Location }

    $php = (Get-Command php.exe -ErrorAction Stop).Source
    $backendOut = Join-Path $paths.LogRoot 'backend.out.log'
    $backendErr = Join-Path $paths.LogRoot 'backend.err.log'
    Remove-Item -LiteralPath $backendOut, $backendErr -Force -ErrorAction SilentlyContinue
    $backendArgs = "-c $(Quote-Argument $paths.PhpIniPath) -S 127.0.0.1:8002 -t $(Quote-Argument $paths.BackendPublicPath) $(Quote-Argument $paths.LaravelRouterPath)"
    $backend = Start-Process -FilePath $php -ArgumentList $backendArgs -WorkingDirectory $paths.BackendPublicPath -WindowStyle Hidden -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr -PassThru
    Add-StartedProcess -Name 'backend' -Process $backend
    Wait-PublicDemoHttp -Uri 'http://127.0.0.1:8002/api/me' -ExpectedStatus 401 -TimeoutSeconds 30

    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $previewOut = Join-Path $paths.LogRoot 'preview.out.log'
    $previewErr = Join-Path $paths.LogRoot 'preview.err.log'
    Remove-Item -LiteralPath $previewOut, $previewErr -Force -ErrorAction SilentlyContinue
    $previewArgs = "$(Quote-Argument $paths.ViteCliPath) preview"
    $preview = Start-Process -FilePath $node -ArgumentList $previewArgs -WorkingDirectory $paths.FrontendPath -WindowStyle Hidden -RedirectStandardOutput $previewOut -RedirectStandardError $previewErr -PassThru
    Add-StartedProcess -Name 'preview' -Process $preview
    Wait-PublicDemoHttp -Uri 'http://127.0.0.1:4175/' -ExpectedStatus 200 -TimeoutSeconds 30
    Wait-PublicDemoHttp -Uri 'http://127.0.0.1:4175/api/me' -ExpectedStatus 401 -TimeoutSeconds 30

    Set-Content -LiteralPath $paths.CloudflaredConfigPath -Value 'no-autoupdate: true' -Encoding Ascii
    $tunnelLog = Join-Path $paths.LogRoot 'cloudflared.log'
    $tunnelOut = Join-Path $paths.LogRoot 'cloudflared.out.log'
    $tunnelErr = Join-Path $paths.LogRoot 'cloudflared.err.log'
    Remove-Item -LiteralPath $tunnelLog, $tunnelOut, $tunnelErr -Force -ErrorAction SilentlyContinue
    $tunnelArgs = "tunnel --config $(Quote-Argument $paths.CloudflaredConfigPath) --url http://127.0.0.1:4175 --no-autoupdate --loglevel info --logfile $(Quote-Argument $tunnelLog)"
    $tunnel = Start-Process -FilePath $cloudflared -ArgumentList $tunnelArgs -WorkingDirectory $paths.RuntimeRoot -WindowStyle Hidden -RedirectStandardOutput $tunnelOut -RedirectStandardError $tunnelErr -PassThru
    Add-StartedProcess -Name 'tunnel' -Process $tunnel
    $url = Wait-PublicDemoTunnelUrl -LogPaths @($tunnelLog, $tunnelOut, $tunnelErr) -TimeoutSeconds 60
    Wait-PublicDemoHttp -Uri ($url + '/') -ExpectedStatus 200 -TimeoutSeconds 60

    $state = [pscustomobject]@{ url = $url; processes = @($started) }
    Save-PublicDemoState -Paths $paths -State $state
    Set-Content -LiteralPath $paths.UrlPath -Value $url -Encoding Ascii
    Show-PublicUrl -Url $url
    Write-Host 'Share it only with intended testers. Run stop-public-demo.cmd when the demo ends.'
}
catch {
    Write-Error $_.Exception.Message
    if ($started.Count -gt 0) { [void](Stop-PublicDemoStateProcesses -State ([pscustomobject]@{ processes = @($started) })) }
    Remove-Item -LiteralPath $paths.StatePath, $paths.UrlPath -Force -ErrorAction SilentlyContinue
    exit 1
}
finally {
    foreach ($name in $environment.Keys) { [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process') }
}
```

- [ ] **Step 4: Implement stop and command wrappers**

Create `stop-public-demo.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot 'PublicDemo.psm1') -Force

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$paths = Get-PublicDemoPaths -RepoRoot $repoRoot
$state = Read-PublicDemoState -Paths $paths

if (-not $state) {
    Write-Host 'No recorded public demo is running.'
    Remove-Item -LiteralPath $paths.UrlPath -Force -ErrorAction SilentlyContinue
    exit 0
}

$allMatched = Stop-PublicDemoStateProcesses -State $state
Remove-Item -LiteralPath $paths.StatePath, $paths.UrlPath -Force -ErrorAction SilentlyContinue
if (-not $allMatched) { Write-Warning 'One or more stale PIDs were ignored because they no longer belonged to the demo.' }
Write-Host 'Public demo stopped. SQLite data and diagnostic logs were preserved.'
```

Create `start-public-demo.cmd`:

```bat
@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-public-demo.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
```

Create `stop-public-demo.cmd` with the same wrapper, changing only the PowerShell filename to `stop-public-demo.ps1`.

- [ ] **Step 5: Run module and launcher tests**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\public-demo\tests\PublicDemo.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\public-demo\tests\LauncherContract.Tests.ps1
```

Expected: both scripts print `PASS`.

- [ ] **Step 6: Exercise bounded failure paths without touching SQLite**

Temporarily occupy port `4175` with a test-owned listener, run the PowerShell start script, and release the listener in `finally`:

```powershell
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 4175)
try {
    $listener.Start()
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\public-demo\start-public-demo.ps1
    if ($LASTEXITCODE -eq 0) { throw 'Expected occupied-port startup failure.' }
}
finally { $listener.Stop() }
```

Expected: a clear `Port 4175 is already in use` failure, no task-owned service remains on port `8002`, and `backend/database/database.sqlite` has the same SHA-256 before and after this failure test.

- [ ] **Step 7: Commit the launchers**

```powershell
git add tools/public-demo/start-public-demo.ps1 tools/public-demo/stop-public-demo.ps1 tools/public-demo/start-public-demo.cmd tools/public-demo/stop-public-demo.cmd tools/public-demo/tests/LauncherContract.Tests.ps1
git commit -m "feat: add temporary public demo launchers"
```

### Task 5: Document and verify the real public workflow

**Files:**
- Create: `docs/PUBLIC_DEMO.md`

**Interfaces:**
- Consumes: `start-public-demo.cmd`, `stop-public-demo.cmd`, `.demo-public/public-url.txt`, and seeded login `admin@mis.test` / `password`.
- Produces: an operator guide and evidence that local, proxied, and real Quick Tunnel flows work while SQLite persists.

- [ ] **Step 1: Write the operator guide**

Create `docs/PUBLIC_DEMO.md` with these sections and exact operational facts:

```markdown
# Temporary Public Demo

## What it does

The public-demo launcher creates a free temporary `https://...trycloudflare.com` address. The host PC must remain powered on and connected to the internet. The address normally changes after stopping and restarting.

This is demo-only infrastructure. Share the URL and seeded demo login only with intended testers. Never place production or real student data in the demo SQLite database.

## First use

From the repository root, create demo data once if `backend/database/database.sqlite` is missing:

```powershell
tools\php\reset-demo-sqlite.cmd
```

Double-click `tools\public-demo\start-public-demo.cmd`. First use downloads and verifies the pinned official Cloudflare executable. When startup succeeds, the HTTPS URL appears and is copied to the clipboard.

## Normal use

1. Double-click `start-public-demo.cmd`.
2. Send the displayed URL to the small demo audience.
3. Sign in with a seeded demo account.
4. Double-click `stop-public-demo.cmd` when the demonstration ends.

Starting and stopping does not reset `backend/database/database.sqlite`; calendar entries and other demo changes remain for the next session.

## Safety model

Only Vite Preview is tunneled. Laravel listens on `127.0.0.1:8002`, Vite Preview listens on `127.0.0.1:4175`, debug output is disabled, and MariaDB/phpMyAdmin/database files are never exposed. The application login is the only access gate; anyone with the URL can reach the sign-in page.

## Troubleshooting

- Missing database: run `tools\php\reset-demo-sqlite.cmd` once. This intentionally rebuilds demo SQLite, so do not use it when you need to preserve current demo changes.
- Occupied port: stop the local service using `8002` or `4175`, then retry.
- Download/checksum/tunnel failure: read `.demo-public/logs/`; do not bypass checksum validation.
- Old URL: start again and share the newly displayed address.
- End of demo: run `stop-public-demo.cmd`; closing a browser tab does not stop the tunnel.
```

- [ ] **Step 2: Run complete automated verification**

```powershell
cd backend
..\tools\php\php-local.cmd vendor\bin\phpunit
cd ..\frontend
npm.cmd test
npm.cmd run lint
npm.cmd run build
cd ..
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\public-demo\tests\PublicDemo.Tests.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\public-demo\tests\LauncherContract.Tests.ps1
```

Expected: backend suite, frontend suite, lint, build, and both PowerShell test scripts PASS.

- [ ] **Step 3: Start a real tunnel and verify the public same-origin API**

Record the SQLite hash, run `tools\public-demo\start-public-demo.ps1`, read `.demo-public/public-url.txt`, and verify the public root plus authenticated API using a PowerShell web session:

```powershell
$before = (Get-FileHash backend\database\database.sqlite -Algorithm SHA256).Hash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\public-demo\start-public-demo.ps1
if ($LASTEXITCODE -ne 0) { throw 'Public demo failed to start.' }
$url = (Get-Content .demo-public\public-url.txt -Raw).Trim()
(Invoke-WebRequest -Uri $url -UseBasicParsing).StatusCode
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$body = @{ email = 'admin@mis.test'; password = 'password' } | ConvertTo-Json
Invoke-RestMethod -Uri "$url/api/login" -Method Post -WebSession $session -ContentType 'application/json' -Body $body
Invoke-RestMethod -Uri "$url/api/calendar-events?start=2026-07-01&end=2026-07-31" -WebSession $session
```

Expected: public root returns `200`, login returns the seeded admin, and Calendar returns JSON without CORS or mixed-content failure.

- [ ] **Step 4: Verify Calendar persistence and cleanup the test event**

Create a uniquely named appointment through the public API, save its ID, stop and restart the demo, confirm it remains, then delete it through the public API. Use payload:

```powershell
$eventBody = @{
    title = 'PUBLIC-DEMO-PERSISTENCE-CHECK'
    event_type = 'appointment'
    is_all_day = $false
    starts_at = '2026-07-21T09:00:00+08:00'
    ends_at = '2026-07-21T10:00:00+08:00'
    location = 'Demo Room'
} | ConvertTo-Json
$created = Invoke-RestMethod -Uri "$url/api/calendar-events" -Method Post -WebSession $session -ContentType 'application/json' -Body $eventBody
$eventId = $created.calendar_event.id
```

After restart, create a new authenticated web session for the new URL, list July 2026 events, assert the saved ID exists, and delete it with `DELETE /api/calendar-events/$eventId`. Expected: the event survives process restart because SQLite was not reset, then deletion returns HTTP `204`.

- [ ] **Step 5: Stop and verify cleanup boundaries**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\public-demo\stop-public-demo.ps1
$after = (Get-FileHash backend\database\database.sqlite -Algorithm SHA256).Hash
if (Test-NetConnection 127.0.0.1 -Port 8002 -InformationLevel Quiet) { throw 'Backend port is still open.' }
if (Test-NetConnection 127.0.0.1 -Port 4175 -InformationLevel Quiet) { throw 'Preview port is still open.' }
if (Test-Path .demo-public\state.json) { throw 'Active state was not removed.' }
if (-not (Test-Path .demo-public\logs)) { throw 'Diagnostic logs were not preserved.' }
```

Expected: task-owned ports are closed, active state is gone, logs remain, and SQLite still exists. The final database hash may differ only because the temporary Calendar row was created and deleted through normal application behavior; startup and shutdown themselves never replace the database.

- [ ] **Step 6: Browser smoke test the user-facing workflow**

Start once more and use the real public URL in a browser. Verify sign-in, Dashboard, Calendar navigation, add/edit, delete confirmation, deletion, and no console CORS/mixed-content errors. Stop the demo afterward.

Expected: the complete remote-user demonstration works from the single HTTPS origin and the URL ceases to be an active demo after stop.

- [ ] **Step 7: Commit the operator documentation**

```powershell
git add docs/PUBLIC_DEMO.md
git commit -m "docs: add temporary public demo guide"
```

- [ ] **Step 8: Review the final task-only diff**

```powershell
git status --short
git log --oneline -5
git diff HEAD~4..HEAD -- .gitignore backend/routes/api.php backend/tests/Feature/AuthApiTest.php backend/tests/Feature/ApiWorkflowTest.php frontend/vite.config.ts frontend/vite.config.test.ts tools/public-demo docs/PUBLIC_DEMO.md
```

Expected: four focused implementation commits contain only the task paths. Pre-existing user-owned dirty/untracked files remain present and uncommitted.
