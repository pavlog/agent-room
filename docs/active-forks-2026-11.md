# Active fork review — 2026-11-01

Read-only review of the 28 forks returned by GitHub, comparing default branches
against upstream main and inspecting selected feature branches. A recent push is
not proof of original work: it may be a sync or a push to another branch. Counts
below are relative to upstream, not estimates of feature quality. No fork was run.

| Fork | Evidence of independent work | Useful candidates and limits |
| --- | --- | --- |
| [WakiChat / wwahmed](https://github.com/wwahmed/agent-room) | main: 656 ahead, 29 behind; pushed October 5 | Permission prompts pinned above the composer, room cards indicating an unanswered owner question, stable mobile reading position, server-reported presence. Permission controls depend on its agent launcher; they are not a standalone UI transplant. |
| [noogalabs / AscendOps](https://github.com/noogalabs/agent-room) | main: 78 ahead, 21 behind; pushed September 9 | Durable authenticated seats, human session lifecycle, identity reconciliation, and real Redis CAS tests. Its durable persistence architecture differs from our local bridge. Prioritize a targeted review of identity and concurrent-write protections. |
| [704986409](https://github.com/704986409/agent-room) | main only has three documentation commits; desktop integration branch is 258 ahead, 2 behind, last commit October 28 | Windows client installer with install/repair/status/uninstall; desktop agent wake/reconnect work. Separate branch also fixes Redis outage recovery and retention deadlines. Most work is outside main and needs a dedicated security/compatibility review. |
| [CeleBin](https://github.com/CeleBin/agent-room) | main: 4 ahead, 21 behind; pushed October 29 | Browser room API abstraction instead of direct store operations. An architectural reference for moving writes behind the server, not a complete proof of authorization correctness. |
| [Useless007](https://github.com/Useless007/agent-room) | No main commits ahead of upstream despite a November 1 push | The task-board work is already represented in upstream. Inspected develop and task-semantics branches; no new main feature to import from this snapshot. |

Other default branches with independent commits: yueyang2009 adds a local-index
ignore rule; nomadmeve adds a room HTTP endpoint. Neither is a priority for our
current local deployment. Other default branches in this snapshot had no commits
ahead of upstream.

## Source pointers

- [Pinned permission prompt implementation](https://github.com/wwahmed/agent-room/commit/3235ccaf180a80ab52ad98953f78b99009cd9455).
- [Server-supplied presence rendering](https://github.com/wwahmed/agent-room/blob/main/apps/web/src/lib/presence.ts).
- [Redis CAS guard tests](https://github.com/noogalabs/agent-room/commit/ca924384e06dc03371fb9f88bcb1b4e9c7f8e826).
- [AscendOps architecture and identity](https://github.com/noogalabs/agent-room#ascendops-additions).
- [Windows installer](https://github.com/704986409/agent-room/tree/feat/windows-oneclick-installer/install/windows).
- [Desktop integration branch](https://github.com/704986409/agent-room/tree/feat/desktop-v1-integration).
- [Redis outage/retention fixes](https://github.com/704986409/agent-room/tree/fix/v1.1-p0-ar06-ar09).
- [Browser room API client](https://github.com/CeleBin/agent-room/blob/main/apps/web/src/lib/roomApi.ts).

## Recommendation

After the upstream task-inbox/checks/speaking-turn port, investigate atomic room
mutations and durable participant identity, then explicit waiting-for-human UI.
The remaining shared room CAS implementation is a more direct reliability target
than adopting a complete desktop launcher. Keep Deliver mode deferred.
