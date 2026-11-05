# Local Redis connection recovery

The local server probes its shared Redis connection every five seconds with a
five-second response deadline. A failed probe destroys the connection and fails
pending commands. A later probe reconnects. Startup also bounds the Redis handshake.
Offline queuing is disabled. Failed writes are never replayed automatically: a lost
reply does not prove the write failed. This recovers connections without restarting
the room server or Redis; it does not diagnose the original network failure.

Connection events log UTC timestamps and error classes, without credentials or
room contents. Shutdown cancels recovery. Health checks return 503 on failure.

## Validation

Use a disposable Redis instance on an unused port, never the production room store.
Set `AGENT_ROOM_TEST_REDIS_URL`, then run:

```
node node_modules/vitest/vitest.mjs run scripts/local-redis-client.integration.test.ts
```

The real Redis client connects through a TCP proxy that drops replies while
leaving the socket open. Tests verify bounded failure, reconnection, no replay of
an already committed INCR, shutdown, and a stalled initial handshake. Random test
keys are removed. Without the test URL the suite is skipped.

The reviewed [noogalabs Redis tests](https://github.com/noogalabs/agent-room/blob/main/packages/room-persistence/test/redis-lua.integration.test.ts)
cover atomic room/receipt operations and stale-version rejection. That file does
not cover silent connection failure or reconnection.
