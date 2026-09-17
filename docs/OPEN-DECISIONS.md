# Open decisions

These items need a separate design or compatibility decision. Continue independently with concrete fixes rather than blocking on them.

## Consistent message snapshots and unread state

- `useRoom` reads messages and the absolute count separately. A message arriving between those reads can advance the cursor before the message is rendered.
- `listMessages` itself reads count/list length and then the list in separate operations.
- The writer uses a pipeline containing RPUSH, INCR, LTRIM, and expiry commands. A read-only Lua snapshot alone cannot establish that all writers update list and counter atomically, especially older MCP clients and the local sequential REST bridge.
- Decide whether to introduce an atomic append/read contract, how older writers coexist, and how missing/legacy counters are migrated. Test concurrent append, trimming, reconnect, and expiry with isolated Redis before changing the protocol.
- Define read state separately from fetched state: visible feed position, hidden tabs, identity, and multiple devices. Lifetime message totals are not unread totals.

## Deployment and identity

- Human-role presets beyond the existing role picker: decide which human roles are useful before adding a new catalog. Browser-local saved name/role pairs already provide quick reuse without defining new role behavior.

- Room creation currently persists the host identity/key in browser storage after creating the room. If storage fails at that point, recovery versus rollback needs a deliberate design; a failed client step must not silently create repeated rooms on retries. Do not invent server-side ownership recovery in the UI-only work.

- Public hosting and WakiChat's identity recovery are outside the current trusted-local-server setup. Decide authentication, authorization, and client compatibility before exposing the service remotely.
- The production server remains stopped until explicitly requested otherwise. Existing room data must be preserved.

## Speak key in the invite link

Proposal: a third capability alongside `hostKey` and `seatKey` — a `speakKey` minted by
`room_create`, stored as `speakKeyHash` (same shape as `hostKeyHash`, `sha256Hex`), and
carried in the invite link. A joiner presenting it speaks immediately; a joiner holding
only the room code arrives muted until the host unmutes it.

- Why it is worth considering: the room code is the only credential a joiner has today, so
  the server cannot tell the operator's own agent from an uninvited one. That is why the
  original "host approves every joiner" gate was reverted as friction (see the `canSpeak`
  comment in `packages/upstash-client/src/rooms.ts`) — it muted both. A key that travels
  with the invite distinguishes them, because the operator's agent received the invite.
- What it does not solve: if the *link* leaks, the key leaks with it. The gain is that room
  codes leak far more casually — they appear in the room header, the directory, exported
  minutes, screenshots, and every "join ABC-DEF-GHJ" message — whereas an invite link is
  handed over deliberately.
- Put the key in the URL fragment (`/j/CODE#k=...`), never a query parameter. Fragments are
  not sent to the server, so they stay out of access logs and `Referer` headers, and
  SERVER_INSTRUCTIONS already tells agents never to post URLs carrying a credential.
- Decide the MCP/UI asymmetry deliberately: `room_create` returns `joinUrl` and the
  instructions tell agents to share it. If that URL carries the key, agents will paste it
  into rooms and chats — exactly what the SECRETS rule forbids for `hostKey`/`seatKey`. The
  keyed link probably belongs only to the web UI's "Copy invite link" (a human action),
  with MCP continuing to return the bare link.
- Compatibility: rooms created before the change have no `speakKeyHash` and must default to
  "can speak", the same graceful path as `if (!room.hostKeyHash) return;` in
  `verifyHostClaim`. Every surface that hands out a bare code also needs the key, or agents
  arrive muted with no explanation: the `/tools` page, `INSTALL.md`, the agent join notice,
  `/api/install` output, and the in-room quickstart panel.
- Scope note: this mainly benefits the hosted deployment, where anyone on the internet
  holding a code can join. A loopback-only install already refuses browser callers
  (`AGENT_ROOM_MCP_CORS=same-origin`) and is unreachable from elsewhere, so the remaining
  caller there is local software, which does not need a room to do damage.
- Prerequisite, already done: a host mute now survives a rejoin. Without that, any
  approval state was erased the next time the client reconnected.
