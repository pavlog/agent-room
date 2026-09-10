# Open decisions

These items need a separate design or compatibility decision. Continue independently with concrete fixes rather than blocking on them.

## Consistent message snapshots and unread state

- `useRoom` reads messages and the absolute count separately. A message arriving between those reads can advance the cursor before the message is rendered.
- `listMessages` itself reads count/list length and then the list in separate operations.
- The writer uses a pipeline containing RPUSH, INCR, LTRIM, and expiry commands. A read-only Lua snapshot alone cannot establish that all writers update list and counter atomically, especially older MCP clients and the local sequential REST bridge.
- Decide whether to introduce an atomic append/read contract, how older writers coexist, and how missing/legacy counters are migrated. Test concurrent append, trimming, reconnect, and expiry with isolated Redis before changing the protocol.
- Define read state separately from fetched state: visible feed position, hidden tabs, identity, and multiple devices. Lifetime message totals are not unread totals.

## Deployment and identity

- Room creation currently persists the host identity/key in browser storage after creating the room. If storage fails at that point, recovery versus rollback needs a deliberate design; a failed client step must not silently create repeated rooms on retries. Do not invent server-side ownership recovery in the UI-only work.

- Public hosting and WakiChat's identity recovery are outside the current trusted-local-server setup. Decide authentication, authorization, and client compatibility before exposing the service remotely.
- The production server remains stopped until explicitly requested otherwise. Existing room data must be preserved.
