$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
. (Join-Path $PSScriptRoot 'scripts/local-process.ps1')
if (Test-Path '.local/server-process.json') {
    $record = Get-Content '.local/server-process.json' -Raw | ConvertFrom-Json
    $serverId = 0
    if (-not [int]::TryParse([string]$record.id, [ref]$serverId) -or $serverId -le 0) { throw 'Invalid server process record; no process was stopped.' }
    $info = Get-CimInstance Win32_Process -Filter "ProcessId = $serverId"
    if (Test-LocalServerIdentity $info $record $PSScriptRoot) {
        $process = Get-Process -Id $serverId -ErrorAction SilentlyContinue
        if ($process -and $process.StartTime.ToUniversalTime().Ticks.ToString() -eq $record.processStartTicks) {
            Stop-Process -InputObject $process
            Write-Output 'Agent Room web/MCP server stopped.'
        }
    } elseif ($info) {
        throw 'Process identity does not match this checkout and launch; no process was stopped.'
    } else { Write-Output 'The recorded server process is no longer running.' }
} elseif (Test-Path '.local/server.pid') {
    Write-Output 'Legacy PID file has no launch identity; no process was stopped.'
} else {
    Write-Output 'No recorded server process.'
}
Write-Output 'Redis data is retained in Ubuntu-22.04 at ~/.local/share/agent-room.'
