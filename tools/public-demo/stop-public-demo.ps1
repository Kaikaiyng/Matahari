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

if (-not $allMatched) {
    Write-Warning 'One or more stale PIDs were ignored because they no longer belonged to the demo.'
}

Write-Host 'Public demo stopped. SQLite data and diagnostic logs were preserved.'
