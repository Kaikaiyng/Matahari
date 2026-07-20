Set-StrictMode -Version Latest

$script:CloudflaredUrl = 'https://github.com/cloudflare/cloudflared/releases/download/2026.7.2/cloudflared-windows-amd64.exe'
$script:CloudflaredSha256 = 'cdb5d4432f6ae1595654a692a51308b69d2bf7af961f5578d9391837cf072df9'

function Get-PublicDemoPaths([string]$RepoRoot) {
    $root = [IO.Path]::GetFullPath($RepoRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
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
        if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
            throw "Required file not found: $required"
        }
    }

    foreach ($command in @('php.exe', 'node.exe', 'npm.cmd')) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Required command not found: $command"
        }
    }
}

function Assert-PublicDemoPortAvailable([int]$Port) {
    $probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
    try {
        $probe.Start()
    }
    catch {
        throw "Port $Port is already in use. Stop the conflicting local service and try again."
    }
    finally {
        try { $probe.Stop() } catch {}
    }
}

function Get-PublicDemoHttpStatus([string]$Uri) {
    try {
        return [int](Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5).StatusCode
    }
    catch {
        if ($_.Exception.Response) {
            return [int]$_.Exception.Response.StatusCode
        }

        return 0
    }
}

function Wait-PublicDemoHttp([string]$Uri, [int]$ExpectedStatus, [int]$TimeoutSeconds) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        if ((Get-PublicDemoHttpStatus -Uri $Uri) -eq $ExpectedStatus) {
            return
        }

        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)

    throw "Timed out waiting for HTTP $ExpectedStatus from $Uri"
}

function Assert-PublicDemoSha256([string]$Path, [string]$Expected) {
    $actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Expected.ToLowerInvariant()) {
        throw "cloudflared checksum mismatch. Expected $Expected but received $actual."
    }
}

function Get-PublicDemoCloudflared($Paths) {
    New-Item -ItemType Directory -Path $Paths.BinRoot -Force | Out-Null

    if (Test-Path -LiteralPath $Paths.CloudflaredPath -PathType Leaf) {
        Assert-PublicDemoSha256 -Path $Paths.CloudflaredPath -Expected $script:CloudflaredSha256
        return $Paths.CloudflaredPath
    }

    $download = $Paths.CloudflaredPath + '.download'
    try {
        Invoke-WebRequest -Uri $script:CloudflaredUrl -OutFile $download -UseBasicParsing -TimeoutSec 120
        Assert-PublicDemoSha256 -Path $download -Expected $script:CloudflaredSha256
        Move-Item -LiteralPath $download -Destination $Paths.CloudflaredPath -Force
        return $Paths.CloudflaredPath
    }
    finally {
        Remove-Item -LiteralPath $download -Force -ErrorAction SilentlyContinue
    }
}

function Save-PublicDemoState($Paths, $State) {
    New-Item -ItemType Directory -Path $Paths.RuntimeRoot -Force | Out-Null
    $State | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Paths.StatePath -Encoding UTF8
}

function Read-PublicDemoState($Paths) {
    if (-not (Test-Path -LiteralPath $Paths.StatePath -PathType Leaf)) {
        return $null
    }

    Get-Content -LiteralPath $Paths.StatePath -Raw | ConvertFrom-Json
}

function Test-PublicDemoProcessIdentity([int]$Id, [string]$ExecutablePath) {
    try {
        $process = Get-Process -Id $Id -ErrorAction Stop
        return ([IO.Path]::GetFullPath($process.Path) -ieq [IO.Path]::GetFullPath($ExecutablePath))
    }
    catch {
        return $false
    }
}

function Test-PublicDemoStateHealthy($State) {
    if (-not $State -or -not $State.url -or @($State.processes).Count -ne 3) {
        return $false
    }

    foreach ($process in @($State.processes)) {
        if (-not (Test-PublicDemoProcessIdentity -Id $process.id -ExecutablePath $process.executable_path)) {
            return $false
        }
    }

    return $true
}

function Stop-PublicDemoOwnedProcess($ProcessRecord) {
    if (-not (Test-PublicDemoProcessIdentity -Id $ProcessRecord.id -ExecutablePath $ProcessRecord.executable_path)) {
        Write-Warning "Skipped stale or mismatched PID $($ProcessRecord.id) ($($ProcessRecord.name))."
        return $false
    }

    Stop-Process -Id $ProcessRecord.id -Force
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    while ((Get-Process -Id $ProcessRecord.id -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 100
    }

    if (Get-Process -Id $ProcessRecord.id -ErrorAction SilentlyContinue) {
        throw "Timed out stopping demo PID $($ProcessRecord.id) ($($ProcessRecord.name))."
    }

    return $true
}

function Stop-PublicDemoStateProcesses($State) {
    $records = @($State.processes)
    [array]::Reverse($records)
    $allMatched = $true

    foreach ($record in $records) {
        if (-not (Stop-PublicDemoOwnedProcess -ProcessRecord $record)) {
            $allMatched = $false
        }
    }

    return $allMatched
}

function Wait-PublicDemoTunnelUrl([string[]]$LogPaths, [int]$TimeoutSeconds) {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        foreach ($path in $LogPaths) {
            if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
                continue
            }

            try {
                $content = Get-Content -LiteralPath $path -Raw
            }
            catch {
                continue
            }

            $match = [regex]::Match($content, 'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($match.Success) {
                return $match.Value
            }
        }

        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)

    throw 'Timed out waiting for Cloudflare to issue a temporary URL.'
}

Export-ModuleMember -Function @(
    'Get-PublicDemoPaths'
    'Assert-PublicDemoPrerequisites'
    'Assert-PublicDemoPortAvailable'
    'Wait-PublicDemoHttp'
    'Assert-PublicDemoSha256'
    'Get-PublicDemoCloudflared'
    'Save-PublicDemoState'
    'Read-PublicDemoState'
    'Test-PublicDemoProcessIdentity'
    'Test-PublicDemoStateHealthy'
    'Stop-PublicDemoOwnedProcess'
    'Stop-PublicDemoStateProcesses'
    'Wait-PublicDemoTunnelUrl'
)
