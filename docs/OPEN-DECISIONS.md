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

## An agent blocked in its own client looks identical to a dead one

Symptom: an agent stops participating because its *client* is waiting on its own
operator — a permission prompt, or a clarifying question it asked in its session instead
of in the room. The room sees nothing. It does not speak, and it does not leave.

- The room cannot tell this apart from a terminated client. `participantPresence` in
  `Room.tsx` derives everything from two timestamps: while the listen lease is live
  (`listenUntil > now`, `LISTEN_LEASE_MS` = 15s) it shows "Listening now", then "Online"
  inside `PRESENCE_STALE_MS` (60s), "Idle — not listening" up to
  `PRESENCE_DISCONNECTED_MS` (5 min), and "Disconnected — host can remove" after that.
  A blocked agent walks the same path as a killed one, so the UI ends up nudging the host
  to remove a participant that may well come back mid-prompt.
- SERVER_INSTRUCTIONS already covers the half of this that agents control: "everything
  you have to say about the room goes through room_send, not back to your own user — text
  written there is invisible to the room and ends your turn." That does not help when the
  client blocks *before* the agent can act, which is the permission-prompt case.
- In sequential and moderator mode the turn machinery limits the damage: a holder that
  stops renewing loses the floor at `FIRST_RESPONSE_GRACE_MS` (150s) or
  `TURN_HARD_CAP_MS` (600s), and the host can force it with `room_admin skip`. In open
  mode there is no floor to reclaim and therefore no signal at all — the room simply goes
  quiet while everyone waits on a participant that is stuck.

Options, none obviously right:

1. **Agent-reported.** Post `room_send kind:'status'` ("waiting on my operator") before
   blocking. Cheap and needs no protocol change, but only works when the agent chooses to
   ask — a client-side permission prompt suspends it with no chance to report.
2. **Hook-reported.** The stdio client's `Stop` / `UserPromptSubmit` hooks fire exactly at
   these boundaries and could post the status automatically. Only available on the
   `agent-room-mcp` path, not to a client pointed at the HTTP endpoint, so the signal
   would exist for some participants and not others.
3. **Presence vocabulary.** Split "lease lapsed but seen recently" from "probably gone",
   and stop recommending removal for the former. Purely local to the UI and honest about
   what is known, but it still cannot say *why* the agent is quiet.
4. **Protocol.** An explicit away/back signal, or an `away` reason on `room_listen`, so a
   blocked agent's last act is to mark itself away. Cleanest for readers of the room,
   largest change, and still dependent on the agent getting a turn to speak.

What to decide: whether this signal is best-effort agent-reported, hook-reported, or
inferred from timing; and what a room in open mode should do about a participant others
are visibly waiting on. Worth checking first whether idle detection should mention it at
all, since the existing 5-minute idle prompt already asks the host whether to keep the
room open.
