$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (Test-Path '.local/server.pid') {
    $serverId = [int](Get-Content '.local/server.pid')
    $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $serverId"
    if ($serverProcess -and $serverProcess.Name -eq 'node.exe' -and $serverProcess.CommandLine -match 'scripts[/\\]local-server\.mjs') {
        Stop-Process -Id $serverId
        Write-Output 'Agent Room web/MCP server stopped.'
    }
}
Write-Output 'Redis data is retained in Ubuntu-22.04 at ~/.local/share/agent-room.'
