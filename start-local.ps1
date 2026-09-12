$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot 'scripts/local-process.ps1')
. (Join-Path $PSScriptRoot 'scripts/local-redis.ps1')
$listeners = @(Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)
if ($listeners.Count) {
    if (-not (Test-Path '.local/server-process.json')) { throw 'Port 5173 is occupied by an unverified process. Nothing was started or stopped.' }
    $record = Get-Content '.local/server-process.json' -Raw | ConvertFrom-Json
    $serverId = 0
    if (-not [int]::TryParse([string]$record.id, [ref]$serverId) -or $serverId -le 0) { throw 'Invalid server process record.' }
    $info = Get-CimInstance Win32_Process -Filter "ProcessId = $serverId"
    if (($listeners | Where-Object { $_.OwningProcess -ne $serverId }) -or -not (Test-LocalServerIdentity $info $record $PSScriptRoot)) {
        throw 'Port 5173 belongs to an unverified process or another checkout. Nothing was started or stopped.'
    }
    Start-LocalRedis
    $health = $null
    for ($retry = 0; $retry -lt 15; $retry++) {
        try { $health = Invoke-RestMethod 'http://127.0.0.1:5173/health' -TimeoutSec 2 } catch {}
        if ($health.status -eq 'ok' -and $health.redis -eq 'PONG') { break }
        Start-Sleep -Seconds 1
    }
    if ($health.status -eq 'ok' -and $health.redis -eq 'PONG') {
        Write-Output 'Agent Room is already running at http://localhost:5173'
        exit 0
    }
    throw 'The recorded server is listening but unhealthy. No second server was started.'
}
foreach ($required in @('.env.local', 'apps/web/.env.local', 'apps/web/dist/index.html', 'node_modules/express/package.json', 'node_modules/redis/package.json', 'node_modules/esbuild/package.json')) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Missing $required. Complete LOCAL-SETUP.md before starting services." }
}
$nodeVersion = & (Get-Command node).Source -p 'process.versions.node'
if ($LASTEXITCODE -ne 0 -or ([version]$nodeVersion).Major -lt 22) { throw 'Node.js 22 or newer is required.' }
Start-LocalRedis
New-Item -ItemType Directory -Force -Path '.local' | Out-Null
$scriptPath = Join-Path $PSScriptRoot 'scripts/local-server.mjs'
$serverProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList ('"' + $scriptPath + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput '.local/server.log' -RedirectStandardError '.local/server-error.log' -PassThru
$serverProcess.Id | Set-Content '.local/server.pid'
$info = Get-CimInstance Win32_Process -Filter "ProcessId = $($serverProcess.Id)"
if (-not $info) { throw 'Server exited before its process identity could be recorded.' }
@{ id = $serverProcess.Id; scriptPath = $scriptPath; startedAtUtcTicks = $info.CreationDate.ToUniversalTime().Ticks.ToString(); processStartTicks = $serverProcess.StartTime.ToUniversalTime().Ticks.ToString() } | ConvertTo-Json | Set-Content '.local/server-process.json'
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if ($serverProcess.HasExited) { throw 'Server exited. See .local/server-error.log' }
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:5173/health' -TimeoutSec 2
        if ($health.status -eq 'ok' -and $health.redis -eq 'PONG') {
            Write-Output "Agent Room is ready (PID $($serverProcess.Id)): http://localhost:5173"
            exit 0
        }
    } catch {}
    Start-Sleep -Seconds 1
}
throw 'Server did not become healthy. See .local/server-error.log'
