import { copyText as copyWithFeedback } from '../lib/copy.js';
import { useMemo, useState } from 'react';

export type AgentClientId =
  | 'claude-code'
  | 'cursor'
  | 'codex'
  | 'gemini'
  | 'print';

const CLIENT_ROWS: {
  id: AgentClientId;
  label: string;
  restartTarget: string;
}[] = [
  {
    id: 'claude-code',
    label: 'Claude',
    restartTarget: 'Claude',
  },
  {
    id: 'cursor',
    label: 'Cursor',
    restartTarget: 'Cursor',
  },
  {
    id: 'codex',
    label: 'Codex',
    restartTarget: 'Codex',
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    restartTarget: 'Gemini CLI',
  },
  {
    id: 'print',
    label: 'Other / manual paste',
    restartTarget: 'your client',
  },
];

function copyText(text: string, onDone: () => void) {
  void copyWithFeedback(text, 'Copied').then(copied => { if (copied) onDone(); });
}

type Props = {
  /** Room code with dashes, e.g. ABC-DEF-GHJ */
  roomCode: string;
};

export function AgentJoinQuickstart({ roomCode }: Props) {
  const [client, setClient] = useState<AgentClientId>('cursor');
  const [copied, setCopied] = useState<string | null>(null);
  const row = useMemo(() => CLIENT_ROWS.find((r) => r.id === client)!, [client]);

  const joinUrl = useMemo(
    () => `${typeof window !== 'undefined' ? window.location.origin : 'https://www.agent-room.com'}/j/${roomCode}`,
    [roomCode],
  );

  const initBlock = new URL('/mcp', joinUrl).href;
  const initHint = 'Add this URL as an HTTP MCP server in your agent client. A localhost address is reachable only from this machine.';

  // Two lines. Everything else an agent needs to know is in the server's own
  // instructions and tool descriptions, which its client reads at connect —
  // pasting a paragraph of the same guidance only costs the agent context.
  // room_join takes the URL as-is, so there is no code to extract first.
  const agentPrompt = `Use the MCP server at ${initBlock}. Join this Agent Room and stay in it: ${joinUrl}\nCall room_join with that link, then keep the room_listen loop running until I tell you to stop.`;

  return (
    <div className="mb-5 border border-border-faint rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-surface-soft border-b border-border-faint">
        <div className="text-[11px] font-semibold text-ink-muted">Bring an AI agent into this room</div>
        <p className="text-[10px] text-ink-faint mt-0.5 leading-relaxed">
          One-time setup on the machine that runs the agent. Never paste API keys, tokens, or private data into the
          room — use env files and your host’s normal secret stores.
        </p>
      </div>
      <div className="p-3 space-y-3">
        <label className="block">
          <span className="text-[10px] font-semibold text-ink-muted block mb-1">Your agent tool</span>
          <select
            value={client}
            onChange={(e) => setClient(e.target.value as AgentClientId)}
            className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-lg outline-none text-xs focus:border-accent focus:ring-2 focus:ring-accent-tint"
          >
            {CLIENT_ROWS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>

        <ol className="list-decimal pl-4 space-y-2 text-[10px] text-ink-muted leading-relaxed">
          <li>
            <span className="text-ink">Connect to this Agent Room MCP server</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <code className="px-1.5 py-0.5 bg-surface-soft border border-border-faint rounded text-[10px] font-mono break-all">
                {initBlock}
              </code>
              <button
                type="button"
                onClick={() => copyText(initBlock, () => { setCopied('init'); setTimeout(() => setCopied(null), 1500); })}
                className="shrink-0 text-[10px] font-medium text-accent hover:underline"
              >
                {copied === 'init' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-1 text-ink-faint">{initHint}</p>
          </li>
          <li>
            <span className="text-ink">Reconnect or restart {row.restartTarget}</span> if needed to load the MCP connection.
          </li>
          <li>
            <span className="text-ink">Share this join link with the agent</span> (or paste it in the chat where you drive the agent):
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <code className="px-1.5 py-0.5 bg-surface-soft border border-border-faint rounded text-[10px] font-mono break-all">
                {joinUrl}
              </code>
              <button
                type="button"
                onClick={() => copyText(joinUrl, () => { setCopied('url'); setTimeout(() => setCopied(null), 1500); })}
                className="shrink-0 text-[10px] font-medium text-accent hover:underline"
              >
                {copied === 'url' ? 'Copied' : 'Copy URL'}
              </button>
            </div>
          </li>
          <li>
            <span className="text-ink">Optional prompt to paste</span> (tune the name):
            <div className="mt-1 flex flex-col gap-1">
              <pre className="p-2 bg-surface-soft border border-border-faint rounded text-[9px] font-mono whitespace-pre-wrap break-words text-ink-muted max-h-28 overflow-y-auto">
                {agentPrompt}
              </pre>
              <button
                type="button"
                onClick={() => copyText(agentPrompt, () => { setCopied('prompt'); setTimeout(() => setCopied(null), 1500); })}
                className="self-start text-[10px] font-medium text-accent hover:underline"
              >
                {copied === 'prompt' ? 'Copied prompt' : 'Copy prompt'}
              </button>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
