function Start-LocalRedis {
    # systemd services alone do not keep a WSL distribution alive.
    $stateDir = Join-Path (Split-Path $PSScriptRoot -Parent) '.local'
    New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
    $keeperFile = Join-Path $stateDir 'wsl-keeper.json'
    $keeperValid = $false
    if (Test-Path -LiteralPath $keeperFile) {
        try {
            $saved = Get-Content -LiteralPath $keeperFile -Raw | ConvertFrom-Json
            $keeperId = [int]$saved.id
            $info = Get-CimInstance Win32_Process -Filter "ProcessId = $keeperId"
            $keeperValid = $info -and [IO.Path]::GetFileName($info.ExecutablePath) -eq 'wsl.exe' -and $info.CreationDate.ToUniversalTime().Ticks.ToString() -eq $saved.created -and $info.CommandLine -match ' -d Ubuntu-22\.04 --exec sleep infinity$'
        } catch { $keeperValid = $false }
    }
    if (-not $keeperValid) {
        $keeper = Start-Process -FilePath 'wsl.exe' -ArgumentList '-d Ubuntu-22.04 --exec sleep infinity' -WindowStyle Hidden -PassThru
        $info = Get-CimInstance Win32_Process -Filter "ProcessId = $($keeper.Id)"
        if (-not $info) { throw 'WSL keeper exited before startup.' }
        @{ id = $keeper.Id; created = $info.CreationDate.ToUniversalTime().Ticks.ToString() } | ConvertTo-Json | Set-Content -LiteralPath $keeperFile
    }
    $account = (& wsl.exe -d Ubuntu-22.04 -- id -un | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $account -notmatch '^[a-z_][a-z0-9_-]*[$]?$') { throw 'Could not identify the Ubuntu-22.04 account.' }
    (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'ensure-local-redis.sh') -Raw).Replace("`r", '') | & wsl.exe -d Ubuntu-22.04 -u root -- bash -s -- $account
    if ($LASTEXITCODE -ne 0) { throw 'Could not start the Agent Room Redis service in WSL.' }
}
