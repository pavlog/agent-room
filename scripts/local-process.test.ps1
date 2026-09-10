$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-process.ps1')
$root = 'C:\Test Workspace\AgentRoom'
$script = Join-Path $root 'scripts/local-server.mjs'
$created = [datetime]'2026-01-01T00:00:00Z'
$record = [pscustomobject]@{ id = 1234; scriptPath = $script; startedAtUtcTicks = $created.ToUniversalTime().Ticks.ToString() }
$info = [pscustomobject]@{ ProcessId = 1234; ExecutablePath = 'C:\Program Files\nodejs\node.exe'; CreationDate = $created; CommandLine = '"C:\Program Files\nodejs\node.exe" "' + $script + '"' }
if (-not (Test-LocalServerIdentity $info $record $root)) { throw 'Valid matching launch was rejected' }
$info.CreationDate = $created.AddSeconds(1)
if (Test-LocalServerIdentity $info $record $root) { throw 'Reused PID was accepted' }
$info.CreationDate = $created
if (Test-LocalServerIdentity $info $record 'C:\Other Checkout') { throw 'Another checkout was accepted' }
$info.CommandLine += ' --extra-argument'
if (Test-LocalServerIdentity $info $record $root) { throw 'A different invocation was accepted' }
$info.CommandLine = 'node scripts/local-server.mjs'
if (Test-LocalServerIdentity $info $record $root) { throw 'Ambiguous relative launch was accepted' }
if (Test-LocalServerIdentity $null $record $root) { throw 'Missing process was accepted' }
Write-Output 'PASS: matching identity, stale PID, other checkout, unexpected arguments, legacy launch, and missing process.'
