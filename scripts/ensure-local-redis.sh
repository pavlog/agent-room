#!/bin/bash
# Managed Agent Room service; invoked as root by the Windows launcher.
set -euo pipefail
account=${1:?Expected the WSL account name}
user_home=$(getent passwd "$account" | cut -d: -f6)
test -n "$user_home"
test "$(ps -p 1 -o comm= | tr -d ' ')" = systemd
test -x /usr/bin/redis-server
test -x /usr/bin/redis-cli
unit=/etc/systemd/system/agent-room-redis.service
if test -e "$unit"; then
    grep -q '^# Managed by Agent Room launcher$' "$unit" || { echo 'Unmanaged Redis service; refusing to overwrite.' >&2; exit 1; }
else
    # Refuse to adopt an unrelated instance already using this port.
    if timeout 3 /usr/bin/redis-cli -p 6389 ping >/dev/null 2>&1; then
        echo 'Port 6389 already has an unmanaged Redis instance. Stop it explicitly first.' >&2
        exit 1
    fi
    install -d -o "$account" -m 700 "$user_home/.local/share/agent-room"
    cat > "$unit" <<EOF
# Managed by Agent Room launcher
[Unit]
Description=Agent Room persistent Redis
After=network.target
[Service]
Type=simple
User=$account
ExecStart=/usr/bin/redis-server --bind 127.0.0.1 --port 6389 --daemonize no --appendonly yes --dir "$user_home/.local/share/agent-room" --logfile "$user_home/.local/share/agent-room/redis.log"
Restart=on-failure
RestartSec=2
TimeoutStopSec=60
[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
fi
systemctl enable agent-room-redis.service >/dev/null
systemctl start agent-room-redis.service
for attempt in {1..20}; do
    if test "$(timeout 2 /usr/bin/redis-cli -p 6389 ping 2>/dev/null || true)" = PONG; then
        echo 'Agent Room Redis is ready.'
        exit 0
    fi
    sleep 1
done
echo 'Redis did not become ready. Check journalctl -u agent-room-redis.' >&2
exit 1
