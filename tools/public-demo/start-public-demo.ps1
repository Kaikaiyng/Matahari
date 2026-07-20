$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Import-Module (Join-Path $PSScriptRoot 'PublicDemo.psm1') -Force

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$paths = Get-PublicDemoPaths -RepoRoot $repoRoot
$started = New-Object System.Collections.ArrayList
$savedEnvironment = @{}
$environment = @{
    APP_ENV = 'local'
    APP_DEBUG = 'false'
    DB_CONNECTION = 'sqlite'
    DB_DATABASE = $paths.DatabasePath
    SESSION_DRIVER = 'file'
    CACHE_STORE = 'file'
    QUEUE_CONNECTION = 'sync'
    VITE_API_BASE_URL = '/api'
    VITE_API_PROXY_TARGET = 'http://127.0.0.1:8002'
}

foreach ($name in $environment.Keys) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

function Quote-Argument([string]$Value) {
    return '"' + $Value.Replace('"', '\"') + '"'
}

function Add-StartedProcess([string]$Name, $Process) {
    try {
        $executablePath = (Get-Process -Id $Process.Id -ErrorAction Stop).Path
    }
    catch {
        Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
        throw "The $Name process exited before startup completed."
    }

    [void]$started.Add([pscustomobject]@{
        name = $Name
        id = $Process.Id
        executable_path = $executablePath
    })
}

function Show-PublicUrl([string]$Url) {
    Write-Host "`nPublic demo is ready:`n$Url`n"
    try {
        Set-Clipboard -Value $Url
        Write-Host 'The URL has been copied to the clipboard.'
    }
    catch {}
}

try {
    $existing = Read-PublicDemoState -Paths $paths
    if (Test-PublicDemoStateHealthy -State $existing) {
        try {
            Wait-PublicDemoHttp -Uri 'http://127.0.0.1:4175/' -ExpectedStatus 200 -TimeoutSeconds 5
            Wait-PublicDemoHttp -Uri ($existing.url + '/') -ExpectedStatus 200 -TimeoutSeconds 10
            Show-PublicUrl -Url $existing.url
            exit 0
        }
        catch {
            [void](Stop-PublicDemoStateProcesses -State $existing)
        }
    }
    elseif ($existing) {
        [void](Stop-PublicDemoStateProcesses -State $existing)
    }

    Remove-Item -LiteralPath $paths.StatePath, $paths.UrlPath -Force -ErrorAction SilentlyContinue

    Assert-PublicDemoPrerequisites -Paths $paths
    Assert-PublicDemoPortAvailable -Port 8002
    Assert-PublicDemoPortAvailable -Port 4175
    $cloudflared = Get-PublicDemoCloudflared -Paths $paths

    New-Item -ItemType Directory -Path $paths.LogRoot -Force | Out-Null
    foreach ($name in $environment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $environment[$name], 'Process')
    }

    Push-Location $paths.FrontendPath
    try {
        & npm.cmd run build
        if ($LASTEXITCODE -ne 0) {
            throw 'Frontend public-demo build failed.'
        }
    }
    finally {
        Pop-Location
    }

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

    $state = [pscustomobject]@{
        url = $url
        processes = @($started)
    }
    Save-PublicDemoState -Paths $paths -State $state
    Set-Content -LiteralPath $paths.UrlPath -Value $url -Encoding Ascii
    Show-PublicUrl -Url $url
    Write-Host 'Share it only with intended testers. Run stop-public-demo.cmd when the demo ends.'
}
catch {
    Write-Error $_.Exception.Message
    if ($started.Count -gt 0) {
        [void](Stop-PublicDemoStateProcesses -State ([pscustomobject]@{ processes = @($started) }))
    }
    Remove-Item -LiteralPath $paths.StatePath, $paths.UrlPath -Force -ErrorAction SilentlyContinue
    exit 1
}
finally {
    foreach ($name in $environment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
    }
}
