#!/usr/bin/env bash
# Tests the process-identity checks with synthetic records — the counterpart of
# local-process.test.ps1, for the macOS scripts. It starts and stops only a
# temporary idle Node
# process in a temp fixture; it never launches the application, binds a port,
# or connects to Redis.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$here/local-process-macos.sh"

pass=0 fail=0
check() { # description expected(ok|reject) actual_exit
  if [ "$2" = "$3" ]; then pass=$((pass+1)); printf 'ok   %s\n' "$1"
  else fail=$((fail+1)); printf 'FAIL %s (expected %s, got %s)\n' "$1" "$2" "$3"; fi
}
verdict() { verify_local_server_identity "$1" >/dev/null 2>&1 && echo ok || echo reject; }

fixture="$(mktemp -d "${TMPDIR:-/tmp}/agent-room-identity-test-XXXXXX")"
cleanup() {
  [ -n "${stub_pid:-}" ] && kill "$stub_pid" 2>/dev/null || true
  case "$fixture" in */agent-room-identity-test-*) rm -rf "$fixture" ;;
    *) echo "Unsafe cleanup path: $fixture" >&2; exit 1 ;;
  esac
}
trap cleanup EXIT

mkdir -p "$fixture/scripts" "$fixture/.local"
# An idle stub at the exact path a real record must name.
printf 'setTimeout(() => {}, 600000);\n' > "$fixture/scripts/local-server.mjs"
node "$fixture/scripts/local-server.mjs" & stub_pid=$!
sleep 1

record="$(record_file "$fixture")"

check "no record at all is rejected" reject "$(verdict "$fixture")"

write_local_server_record "$fixture" "$stub_pid"
check "freshly written record verifies" ok "$(verdict "$fixture")"
check "verify echoes the recorded pid" "$stub_pid" "$(verify_local_server_identity "$fixture")"

# A legacy pid-only file is not sufficient to authorize a stop.
printf '{"pid":%d}\n' "$stub_pid" > "$record"
check "legacy pid-only record is rejected" reject "$(verdict "$fixture")"

printf 'not json at all' > "$record"
check "malformed record is rejected" reject "$(verdict "$fixture")"

# A stale start time means the pid was recycled.
node -e '
  const fs = require("node:fs");
  const [file, id, scriptPath] = process.argv.slice(1);
  fs.writeFileSync(file, JSON.stringify({ id: Number(id), scriptPath, startedAt: "Thu Jan  1 00:00:00 1970" }));
' "$record" "$stub_pid" "$fixture/scripts/local-server.mjs"
check "stale start time is rejected" reject "$(verdict "$fixture")"

# Another checkout's server must not be adoptable.
node -e '
  const fs = require("node:fs");
  const [file, id, startedAt] = process.argv.slice(1);
  fs.writeFileSync(file, JSON.stringify({ id: Number(id), scriptPath: "/somewhere/else/scripts/local-server.mjs", startedAt }));
' "$record" "$stub_pid" "$(process_start_time "$stub_pid")"
check "foreign scriptPath is rejected" reject "$(verdict "$fixture")"

# A pid that is not running at all.
write_local_server_record "$fixture" "$stub_pid"
kill "$stub_pid"; wait "$stub_pid" 2>/dev/null || true
unset stub_pid
check "record for a dead process is rejected" reject "$(verdict "$fixture")"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
