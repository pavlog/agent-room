#!/usr/bin/env bash
# Stops the local Agent Room web/MCP server on macOS — the counterpart of
# stop-local.ps1.
# Redis and its data are left running. Pass --redis to also stop Redis.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/local-process-macos.sh
. "$root/scripts/local-process-macos.sh"

data_dir="$HOME/.local/share/agent-room"
record="$(record_file "$root")"

# Verify the full recorded identity before signalling: a recycled pid, a stale
# record, or another checkout's server must never be killed here.
if pid="$(verify_local_server_identity "$root")"; then
  kill "$pid"
  for _ in $(seq 1 20); do ps -p "$pid" >/dev/null 2>&1 || break; sleep 0.5; done
  rm -f "$record"
  echo "Stopped the web server (pid $pid)."
elif [ -f "$record" ]; then
  echo "The recorded launch no longer matches a running server of this checkout. Nothing was stopped." >&2
  rm -f "$record"
else
  echo "No recorded launch in this checkout. Nothing was stopped."
fi

if [ "${1:-}" = "--redis" ]; then
  if redis-cli -h 127.0.0.1 -p 6389 ping >/dev/null 2>&1; then
    current_dir="$(redis-cli -h 127.0.0.1 -p 6389 config get dir | tail -1)"
    if [ "$current_dir" = "$data_dir" ]; then
      redis-cli -h 127.0.0.1 -p 6389 shutdown >/dev/null 2>&1 || true
      echo "Stopped Redis on 6389. Data remains in $data_dir."
    else
      echo "Redis on 6389 is unmanaged (dir: $current_dir). Left running." >&2
    fi
  fi
fi
