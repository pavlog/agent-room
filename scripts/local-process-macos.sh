# Identity checks for the local server process — the macOS counterpart of
# local-process.ps1. Sourced by start-local-macos.sh / stop-local-macos.sh;
# sourcing has no side effects.
#
# A stop must never signal a process this checkout did not start. PIDs are
# recycled, so the pid alone is not an identity: the record also pins the
# absolute script path and the process start time, and all three must still
# agree with a live `node` process. Anything else — a legacy pid-only file, a
# malformed record, a different checkout's path, a reused pid with a newer
# start time — fails closed.

record_file() { printf '%s/.local/server-process.json' "$1"; }

expected_server_script() { printf '%s/scripts/local-server.mjs' "$1"; }

# Kernel-reported start time; the tie-breaker a recycled pid cannot forge.
process_start_time() {
  ps -p "$1" -o lstart= 2>/dev/null | tr -s ' ' | sed 's/^ *//; s/ *$//'
}

write_local_server_record() {
  local root=$1 pid=$2
  node -e '
    const fs = require("node:fs");
    const [file, id, scriptPath, startedAt] = process.argv.slice(1);
    fs.writeFileSync(file, JSON.stringify({ id: Number(id), scriptPath, startedAt }) + "\n");
  ' "$(record_file "$root")" "$pid" "$(expected_server_script "$root")" "$(process_start_time "$pid")"
}

# Echoes the pid and returns 0 only when the recorded identity still matches a
# live node process running exactly this checkout's server.
verify_local_server_identity() {
  local root=$1 file line pid recorded_script recorded_started cmd expected
  file="$(record_file "$root")"
  [ -f "$file" ] || return 1
  expected="$(expected_server_script "$root")"

  # A record missing any of the three fields is not an identity. Reading it
  # with node avoids hand-parsing JSON with sed.
  line="$(node -e '
    const fs = require("node:fs");
    try {
      const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      if (typeof r.id !== "number" || !Number.isInteger(r.id) || r.id <= 0) process.exit(1);
      if (typeof r.scriptPath !== "string" || !r.scriptPath) process.exit(1);
      if (typeof r.startedAt !== "string" || !r.startedAt) process.exit(1);
      process.stdout.write([r.id, r.scriptPath, r.startedAt].join("\t"));
    } catch { process.exit(1); }
  ' "$file")" || return 1

  IFS=$(printf '\t') read -r pid recorded_script recorded_started <<REC
$line
REC

  [ "$recorded_script" = "$expected" ] || return 1
  cmd="$(ps -p "$pid" -o command= 2>/dev/null)" || return 1
  [ -n "$cmd" ] || return 1
  # Must be node, and must be running the script the record names.
  case "$cmd" in node\ *|*/node\ *) ;; *) return 1 ;; esac
  case "$cmd" in *"$expected"*) ;; *) return 1 ;; esac
  [ "$(process_start_time "$pid")" = "$recorded_started" ] || return 1

  printf '%s' "$pid"
}
