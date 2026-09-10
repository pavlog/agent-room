function Test-LocalServerIdentity {
    param($ProcessInfo, $Record, [string]$Root)
    if (-not $ProcessInfo -or -not $Record) { return $false }
    try {
        $expectedScript = [IO.Path]::GetFullPath((Join-Path $Root 'scripts/local-server.mjs'))
        if ($Record.scriptPath -ne $expectedScript -or $Record.id -ne $ProcessInfo.ProcessId) { return $false }
        if ([IO.Path]::GetFileName($ProcessInfo.ExecutablePath) -ne 'node.exe') { return $false }
        if ($ProcessInfo.CreationDate.ToUniversalTime().Ticks.ToString() -ne $Record.startedAtUtcTicks) { return $false }
        # The launcher passes exactly one quoted, absolute script argument.
        $pattern = '^\s*(?:"[^"]+"|\S+)\s+"' + [regex]::Escape($expectedScript) + '"\s*$'
        return [bool]($ProcessInfo.CommandLine -match $pattern)
    } catch { return $false }
}
