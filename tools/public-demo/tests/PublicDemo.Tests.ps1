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
$httpJob = $null
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

    $portProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $portProbe.Start()
    $httpPort = ([Net.IPEndPoint]$portProbe.LocalEndpoint).Port
    $portProbe.Stop()
    $readyPath = Join-Path $tempRoot 'http-ready.txt'
    $httpJob = Start-Job -ArgumentList $httpPort, $readyPath -ScriptBlock {
        param($Port, $ReadyPath)
        $server = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
        try {
            $server.Start()
            Set-Content -LiteralPath $ReadyPath -Value 'ready'
            $client = $server.AcceptTcpClient()
            $stream = $client.GetStream()
            $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $acceptsJson = $false
            while (($line = $reader.ReadLine()) -ne '') {
                if ($line -match '^Accept:\s*application/json') { $acceptsJson = $true }
            }
            $status = if ($acceptsJson) { '401 Unauthorized' } else { '500 Internal Server Error' }
            $body = [Text.Encoding]::UTF8.GetBytes('{}')
            $head = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: application/json`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n")
            $stream.Write($head, 0, $head.Length)
            $stream.Write($body, 0, $body.Length)
            $stream.Flush()
            $client.Close()
        }
        finally {
            $server.Stop()
        }
    }
    $readyDeadline = [DateTime]::UtcNow.AddSeconds(5)
    while (-not (Test-Path -LiteralPath $readyPath) -and [DateTime]::UtcNow -lt $readyDeadline) {
        Start-Sleep -Milliseconds 50
    }
    Assert-True (Test-Path -LiteralPath $readyPath) 'Local HTTP probe did not start.'
    Wait-PublicDemoHttp -Uri "http://127.0.0.1:$httpPort/" -ExpectedStatus 401 -TimeoutSeconds 2 -AcceptJson
    Wait-Job -Job $httpJob -Timeout 5 | Out-Null
    Receive-Job -Job $httpJob -ErrorAction Stop | Out-Null
    Remove-Job -Job $httpJob -Force
    $httpJob = $null

    $resolveArgument = New-PublicDemoCurlResolveArgument -HostName 'demo.trycloudflare.com' -Port 443 -IpAddress '104.16.231.132'
    Assert-True ($resolveArgument -eq 'demo.trycloudflare.com:443:104.16.231.132') 'Curl resolve argument was malformed.'

    $portProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $portProbe.Start()
    $htmlPort = ([Net.IPEndPoint]$portProbe.LocalEndpoint).Port
    $portProbe.Stop()
    $htmlReadyPath = Join-Path $tempRoot 'html-ready.txt'
    $httpJob = Start-Job -ArgumentList $htmlPort, $htmlReadyPath -ScriptBlock {
        param($Port, $ReadyPath)
        $server = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
        try {
            $server.Start()
            Set-Content -LiteralPath $ReadyPath -Value 'ready'
            $client = $server.AcceptTcpClient()
            $stream = $client.GetStream()
            $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            $acceptsJson = $false
            while (($line = $reader.ReadLine()) -ne '') {
                if ($line -match '^Accept:\s*application/json') { $acceptsJson = $true }
            }
            $status = if ($acceptsJson) { '406 Not Acceptable' } else { '200 OK' }
            $body = [Text.Encoding]::UTF8.GetBytes('ok')
            $head = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 $status`r`nContent-Type: text/plain`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n")
            $stream.Write($head, 0, $head.Length)
            $stream.Write($body, 0, $body.Length)
            $stream.Flush()
            $client.Close()
        }
        finally {
            $server.Stop()
        }
    }
    $readyDeadline = [DateTime]::UtcNow.AddSeconds(5)
    while (-not (Test-Path -LiteralPath $htmlReadyPath) -and [DateTime]::UtcNow -lt $readyDeadline) {
        Start-Sleep -Milliseconds 50
    }
    Assert-True (Test-Path -LiteralPath $htmlReadyPath) 'Local HTML probe did not start.'
    Wait-PublicDemoHttp -Uri "http://127.0.0.1:$htmlPort/" -ExpectedStatus 200 -TimeoutSeconds 2
    Wait-Job -Job $httpJob -Timeout 5 | Out-Null
    Receive-Job -Job $httpJob -ErrorAction Stop | Out-Null
    Remove-Job -Job $httpJob -Force
    $httpJob = $null

    $portProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $portProbe.Start()
    $publicProbePort = ([Net.IPEndPoint]$portProbe.LocalEndpoint).Port
    $portProbe.Stop()
    $publicReadyPath = Join-Path $tempRoot 'public-probe-ready.txt'
    $httpJob = Start-Job -ArgumentList $publicProbePort, $publicReadyPath -ScriptBlock {
        param($Port, $ReadyPath)
        $server = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
        try {
            $server.Start()
            Set-Content -LiteralPath $ReadyPath -Value 'ready'
            $client = $server.AcceptTcpClient()
            $stream = $client.GetStream()
            $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 1024, $true)
            while (($line = $reader.ReadLine()) -ne '') {}
            $body = [Text.Encoding]::UTF8.GetBytes('public-ok')
            $head = [Text.Encoding]::ASCII.GetBytes("HTTP/1.1 200 OK`r`nContent-Type: text/plain`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n")
            $stream.Write($head, 0, $head.Length)
            $stream.Write($body, 0, $body.Length)
            $stream.Flush()
            $client.Close()
        }
        finally {
            $server.Stop()
        }
    }
    $readyDeadline = [DateTime]::UtcNow.AddSeconds(5)
    while (-not (Test-Path -LiteralPath $publicReadyPath) -and [DateTime]::UtcNow -lt $readyDeadline) {
        Start-Sleep -Milliseconds 50
    }
    Assert-True (Test-Path -LiteralPath $publicReadyPath) 'Local public probe did not start.'
    Wait-PublicDemoPublicHttp -Uri "http://127.0.0.1:$publicProbePort/" -ExpectedStatus 200 -TimeoutSeconds 5
    Wait-Job -Job $httpJob -Timeout 5 | Out-Null
    Receive-Job -Job $httpJob -ErrorAction Stop | Out-Null
    Remove-Job -Job $httpJob -Force
    $httpJob = $null

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

    $emptyLog = Join-Path $tempRoot 'empty-cloudflared.log'
    New-Item -ItemType File -Path $emptyLog | Out-Null
    Assert-Throws { Wait-PublicDemoTunnelUrl -LogPaths @($emptyLog) -TimeoutSeconds 1 } 'Timed out waiting for Cloudflare'

    Write-Host 'PublicDemo.Tests.ps1: PASS'
}
finally {
    if ($listener) { try { $listener.Stop() } catch {} }
    if ($httpJob) {
        Stop-Job -Job $httpJob -ErrorAction SilentlyContinue
        Remove-Job -Job $httpJob -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
