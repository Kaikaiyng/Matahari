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
$listener = $null
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
    $listener = $null

    $hashFile = Join-Path $tempRoot 'hash.txt'
    Set-Content -LiteralPath $hashFile -Value 'abc' -NoNewline -Encoding Ascii
    Assert-PublicDemoSha256 -Path $hashFile -Expected 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    Assert-Throws { Assert-PublicDemoSha256 -Path $hashFile -Expected ('0' * 64) } 'checksum'

    $currentExecutable = (Get-Process -Id $PID).Path
    $state = [pscustomobject]@{
        url = 'https://example.trycloudflare.com'
        processes = @(
            [pscustomobject]@{ name = 'backend'; id = $PID; executable_path = $currentExecutable }
            [pscustomobject]@{ name = 'preview'; id = $PID; executable_path = $currentExecutable }
            [pscustomobject]@{ name = 'tunnel'; id = $PID; executable_path = $currentExecutable }
        )
    }
    Save-PublicDemoState -Paths $paths -State $state
    $loaded = Read-PublicDemoState -Paths $paths
    Assert-True ($loaded.url -eq $state.url) 'State URL did not round-trip.'
    Assert-True (Test-PublicDemoStateHealthy -State $loaded) 'Matching state was not healthy.'
    Assert-True (Test-PublicDemoProcessIdentity -Id $PID -ExecutablePath $currentExecutable) 'Matching process was rejected.'
    Assert-True (-not (Test-PublicDemoProcessIdentity -Id $PID -ExecutablePath (Join-Path $tempRoot 'wrong.exe'))) 'Mismatched process was accepted.'

    $staleRecord = [pscustomobject]@{ name = 'stale'; id = $PID; executable_path = (Join-Path $tempRoot 'wrong.exe') }
    $previousWarningPreference = $WarningPreference
    try {
        $WarningPreference = 'SilentlyContinue'
        $staleResult = Stop-PublicDemoOwnedProcess -ProcessRecord $staleRecord
    }
    finally {
        $WarningPreference = $previousWarningPreference
    }
    Assert-True (-not $staleResult) 'Stale PID should have been skipped.'
    Assert-True ($null -ne (Get-Process -Id $PID -ErrorAction SilentlyContinue)) 'Mismatched cleanup stopped the current test process.'

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
