$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$fixture = Join-Path $tempRoot ('agent-room-launch-test-' + [guid]::NewGuid().ToString('N'))
$checkout = Join-Path $fixture 'checkout with spaces'
$dummyProcess = $null
try {
    New-Item -ItemType Directory -Path (Join-Path $checkout 'scripts'), (Join-Path $checkout '.local') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $repoRoot 'stop-local.ps1') -Destination $checkout
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'local-process.ps1') -Destination (Join-Path $checkout 'scripts')
    # Exercise the exact Node-version preflight through Windows PowerShell.
    $versionCheck = Get-Content (Join-Path $repoRoot 'start-local.ps1') | Where-Object { $_ -match '^\$nodeVersion =|^if \(\$LASTEXITCODE.*\[version\]' }
    $versionFile = Join-Path $fixture 'version.ps1'
    $versionCheck | Set-Content $versionFile
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $versionFile
    if ($LASTEXITCODE -ne 0) { throw 'Node version check failed in Windows PowerShell' }

    $script = Join-Path $checkout 'scripts/local-server.mjs'
    'setInterval(() => {}, 1000);' | Set-Content $script
    $dummyProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList ('"' + $script + '"') -WorkingDirectory $checkout -WindowStyle Hidden -PassThru
    $info = Get-CimInstance Win32_Process -Filter "ProcessId = $($dummyProcess.Id)"
    if (-not $info) { throw 'Dummy process exited unexpectedly' }
    $record = @{
        id = $dummyProcess.Id
        scriptPath = $script
        startedAtUtcTicks = $info.CreationDate.ToUniversalTime().Ticks.ToString()
        processStartTicks = $dummyProcess.StartTime.ToUniversalTime().Ticks.ToString()
    }
    $recordFile = Join-Path $checkout '.local/server-process.json'
    $expectedCreation = $record.startedAtUtcTicks
    $record.startedAtUtcTicks = '0'
    $record | ConvertTo-Json | Set-Content $recordFile
    # Run in-process so the expected refusal can be caught without noisy native stderr.
    $refused = $false
    try { & (Join-Path $checkout 'stop-local.ps1') } catch { $refused = $true }
    $dummyProcess.Refresh()
    if (-not $refused -or $dummyProcess.HasExited) { throw 'Stale identity did not preserve the dummy process' }
    $record.startedAtUtcTicks = $expectedCreation
    $record | ConvertTo-Json | Set-Content $recordFile
    & (Join-Path $checkout 'stop-local.ps1')
    if (-not $dummyProcess.WaitForExit(5000)) { throw 'Matching identity did not stop the dummy process' }
    Write-Output 'PASS: Windows PowerShell Node preflight, path with spaces, stale identity refusal, and verified stop.'
} finally {
    if ($dummyProcess -and -not $dummyProcess.HasExited) { $dummyProcess.Kill(); $dummyProcess.WaitForExit() }
    Set-Location $repoRoot
    $resolved = [IO.Path]::GetFullPath($fixture)
    if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or -not (Split-Path $resolved -Leaf).StartsWith('agent-room-launch-test-')) { throw 'Unsafe fixture cleanup path' }
    if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
