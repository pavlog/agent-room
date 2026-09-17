#!/usr/bin/env bash
# macOS launcher for the local Agent Room — the counterpart of start.bat.
# Only macOS is tested: the identity checks read BSD `ps -o lstart=` output and
# the port check uses BSD `lsof` flags.
# Starts a dedicated Redis on 6389 and the web/MCP server on 5173, both bound
# to loopback only. Nothing here contacts an external service. See LOCAL-SETUP.md.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/local-process-macos.sh
. "$root/scripts/local-process-macos.sh"

data_dir="$HOME/.local/share/agent-room"
state_dir="$root/.local"
redis_port=6389
web_port=5173

mkdir -p "$data_dir" "$state_dir"

command -v redis-server >/dev/null || { echo "redis-server not found. Install it with: brew install redis" >&2; exit 1; }
command -v node >/dev/null || { echo "node not found. Install Node 22+ with: brew install node" >&2; exit 1; }
[ -f "$root/.env.local" ] || { echo "Missing .env.local. Run: npm run setup:local" >&2; exit 1; }

# Redis: adopt only an instance that answers on our dedicated port with our own
# data directory; never reuse an unrelated listener.
if redis-cli -h 127.0.0.1 -p "$redis_port" ping >/dev/null 2>&1; then
  current_dir="$(redis-cli -h 127.0.0.1 -p "$redis_port" config get dir | tail -1)"
  if [ "$current_dir" != "$data_dir" ]; then
    echo "Port $redis_port is used by an unmanaged Redis (dir: $current_dir). Not touching it." >&2
    exit 1
  fi
  echo "Redis already running on $redis_port."
else
  redis-server --bind 127.0.0.1 --port "$redis_port" --daemonize yes --appendonly yes \
    --dir "$data_dir" --logfile "$data_dir/redis.log" --pidfile "$data_dir/redis.pid"
  for _ in $(seq 1 30); do
    redis-cli -h 127.0.0.1 -p "$redis_port" ping >/dev/null 2>&1 && break
    sleep 0.5
  done
  redis-cli -h 127.0.0.1 -p "$redis_port" ping >/dev/null 2>&1 \
    || { echo "Redis did not start. See $data_dir/redis.log" >&2; exit 1; }
  echo "Started Redis on $redis_port (append-only, data in $data_dir)."
fi

# Refuse an occupied port unless it belongs to the recorded launch of this
# checkout — the same rule start-local.ps1 applies.
if lsof -nP -iTCP:"$web_port" -sTCP:LISTEN >/dev/null 2>&1; then
  if running_pid="$(verify_local_server_identity "$root")"; then
    echo "Agent Room is already running (pid $running_pid): http://localhost:$web_port"
    exit 0
  fi
  echo "Port $web_port is in use by a process this checkout did not start. Identify it before stopping it." >&2
  exit 1
fi

cd "$root"
node "$(expected_server_script "$root")" >>"$state_dir/server.log" 2>&1 &
pid=$!
write_local_server_record "$root" "$pid"

for _ in $(seq 1 60); do
  curl -sf "http://127.0.0.1:$web_port/health" >/dev/null 2>&1 && break
  sleep 0.5
done
if curl -sf "http://127.0.0.1:$web_port/health" >/dev/null 2>&1; then
  echo "Agent Room: http://localhost:$web_port | MCP: http://localhost:$web_port/mcp (pid $pid)"
else
  echo "Server did not become healthy. See $state_dir/server.log" >&2
  exit 1
fi
