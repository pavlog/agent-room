# Collaboration interface review

## Scope and outcome

Reviewed WakiChat-inspired room navigation and the inherited task board, then completed focused checks for human entry, drafts, message submission, attachments, and refresh recovery. The production service stayed stopped throughout validation; browser checks used mocked data and ephemeral loopback ports, without accessing existing rooms or Redis.

Implemented changes are summarized in the README's **Fork changes** section. The task board and mobile Chat/Tasks/People tabs were already included upstream; they were not imported again.

## Validation

- Production TypeScript/Vite build and the web test suite.
- Human entry at 390px and 1280px: blank-name and ended-room gates, repeated submit protection, and persistence of the name assigned by the server.
- Room switcher: filtering, search, unavailable-directory handling, modal keyboard navigation, Escape/focus restoration, and mobile bounds.
- Drafts: separate room/participant keys, reload recovery, clearing, and blocked-storage behavior.
- Pending sends: overlapping-call rejection, preservation of newly typed text after failure or success, and release of the sending guard.
- Attachments: partial-success retention, overlapping-batch rejection, exclusion during sending, and attachment limits. Actual cloud uploads were not performed.
- Task refresh: reversed response order, retention of the last successful board, retry recovery, room-change invalidation, and initial failure.

Browser and handler harnesses use synthetic participants and files. They do not establish production cloud-storage, authentication, or deployment compatibility. Native tab-close warnings remain subject to browser support.

## Activity and unread indicators

WakiChat's room sidebar was used as a navigation reference. This fork's `/api/local/rooms` response now exposes last activity and lifetime message totals in addition to creation time, status, host, participant count, and expiration. It reads the existing `room-msg-count` counter and the timestamp of the last retained message without returning message text. Legacy rooms without a counter report an unknown total; rooms without a usable last message fall back to creation time. `npm run test:local` checks summaries against fake Redis data, including corrupt and expired rooms.

Unread badges are deferred until the API and client have an explicit read-position contract. A follow-up should define how hidden tabs, retained/truncated history, multiple devices, and reconnects affect read state. The existing message poller reads the transcript and lifetime counter separately, so a concurrently arriving message could be counted before it has been rendered. Do not treat that counter as a proven read position or report a message as read merely because background polling fetched it.

WakiChat's private hosting configuration, identity recovery, and authentication stack remain outside this change set. No additional features should be added merely to keep the scheduled review running.
