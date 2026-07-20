$ErrorActionPreference = 'Stop'
$publicDemoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$repoRoot = [IO.Path]::GetFullPath((Join-Path $publicDemoRoot '..\..'))

function Require([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

$required = @('start-public-demo.ps1', 'stop-public-demo.ps1', 'start-public-demo.cmd', 'stop-public-demo.cmd')
foreach ($name in $required) {
    Require (Test-Path -LiteralPath (Join-Path $publicDemoRoot $name)) "Missing launcher: $name"
}

$start = Get-Content -LiteralPath (Join-Path $publicDemoRoot 'start-public-demo.ps1') -Raw
$stop = Get-Content -LiteralPath (Join-Path $publicDemoRoot 'stop-public-demo.ps1') -Raw
$module = Get-Content -LiteralPath (Join-Path $publicDemoRoot 'PublicDemo.psm1') -Raw
$ignore = Get-Content -LiteralPath (Join-Path $repoRoot '.gitignore') -Raw

[void][scriptblock]::Create($start)
[void][scriptblock]::Create($stop)

Require ($start -match "VITE_API_BASE_URL\s*=\s*'/api'") 'Start script does not build with /api.'
Require ($start -match '127\.0\.0\.1:8002') 'Laravel loopback port is missing.'
Require ($start -match '127\.0\.0\.1:4175') 'Preview loopback port is missing.'
Require ($start -match '--protocol http2') 'Tunnel must use HTTP/2 for restrictive networks.'
Require ($start -notmatch 'migrate:fresh|db:wipe|reset-demo-sqlite') 'Start script contains a database reset command.'
Require ($stop -notmatch 'database\.sqlite|migrate:fresh|db:wipe') 'Stop script may alter the database.'
Require ($module -match '-OutFile \$download -UseBasicParsing -TimeoutSec 120') 'Cloudflare download is not time-bounded.'
Require ($ignore -match '(?m)^/\.demo-public/\r?$') 'Runtime directory is not ignored.'

$lastCleanup = $start.LastIndexOf('Stop-PublicDemoStateProcesses')
$lastError = $start.LastIndexOf('Write-Error')
Require ($lastCleanup -ge 0 -and $lastError -gt $lastCleanup) 'Failure cleanup must run before error output.'
Require ($start -match 'Write-Error \$failureMessage -ErrorAction Continue') 'Failure output must not interrupt cleanup.'

Write-Host 'LauncherContract.Tests.ps1: PASS'
