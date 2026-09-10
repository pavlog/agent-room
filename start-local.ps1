$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
try {
    $health = Invoke-RestMethod 'http://127.0.0.1:5173/health' -TimeoutSec 2
    if ($health.status -eq 'ok' -and $health.redis -eq 'PONG') {
        Write-Output 'Agent Room is already running at http://localhost:5173'
        exit 0
    }
} catch {}
wsl -d Ubuntu-22.04 -- sh -lc 'mkdir -p ~/.local/share/agent-room; timeout 3 redis-cli -p 6389 ping >/dev/null 2>&1 || redis-server --bind 127.0.0.1 --port 6389 --daemonize yes --appendonly yes --dir ~/.local/share/agent-room --pidfile ~/.local/share/agent-room/redis.pid --logfile ~/.local/share/agent-room/redis.log'
if ($LASTEXITCODE -ne 0) { throw 'Could not start local Redis in Ubuntu-22.04' }
New-Item -ItemType Directory -Force -Path '.local' | Out-Null
$serverProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList 'scripts/local-server.mjs' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput '.local/server.log' -RedirectStandardError '.local/server-error.log' -PassThru
$serverProcess.Id | Set-Content '.local/server.pid'
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
