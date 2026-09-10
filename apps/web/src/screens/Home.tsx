import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { isValidCode } from '@agent-room/shared';
import { TopNav } from '../components/TopNav.js';
import { ENV } from '../env.js';

type RoomSummary = {
  code: string; topic: string; status: string; createdAt: number;
  createdBy: string; participantCount: number; expiresAt: number | null;
  lastActivityAt?: number; messageCount?: number | null;
};

export function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [showEnded, setShowEnded] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let requestSequence = 0;
    let settledSequence = 0;
    async function load() {
      const request = ++requestSequence;
      const canApply = () => !controller.signal.aborted && request >= settledSequence;
      try {
        const response = await fetch('/api/local/rooms', {
          headers: { Authorization: `Bearer ${ENV.upstash.token}` },
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Cannot load rooms. Check that the local server is running.');
        const data = await response.json();
        if (!Array.isArray(data.rooms)) throw new Error('The room directory requires the local server.');
        if (canApply()) { settledSequence = request; setRooms(data.rooms); setError(''); }
      } catch (err) {
        if (canApply()) { settledSequence = request; setError(err instanceof Error ? err.message : 'Cannot load rooms.'); }
      } finally { if (canApply()) setLoading(false); }
    }
    void load();
    const timer = setInterval(() => { void load(); }, 10000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [refresh]);
  const active = rooms.filter(room => room.status === 'active');
  const ended = rooms.filter(room => room.status === 'ended');
  const candidates = showEnded ? rooms : active;
  const search = query.trim().toLocaleLowerCase();
  const visible = candidates.filter(room => !search ||
    [room.topic, room.code, room.createdBy].some(value => value.toLocaleLowerCase().includes(search)));
  function join() {
    const bare = code.trim().toUpperCase().replace(/-/g, '');
    const normalized = bare.match(/.{1,3}/g)?.join('-') ?? '';
    if (!isValidCode(normalized)) { setCodeError('Enter a valid 9-character room code.'); return; }
    navigate(`/j/${normalized}`);
  }
  return (
    <div className="min-h-screen bg-surface-soft text-ink">
      <TopNav />
      <main className="mx-auto max-w-4xl px-5 py-10 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Your local server</p>
            <h1 className="mt-2 text-3xl font-bold">Rooms</h1>
            <p className="mt-2 text-sm text-ink-muted">A shared conversation for you and your AI agents.</p>
          </div>
          <Link to="/new" className="rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white">+ Create room</Link>
        </header>
        <form onSubmit={e => { e.preventDefault(); join(); }} className="rounded-xl border border-border bg-white p-5">
          <label htmlFor="room-code" className="block text-sm font-semibold mb-2">Have an invitation code?</label>
          <div className="flex gap-2">
            <input id="room-code" value={code} onChange={e => { setCode(e.target.value); setCodeError(''); }} placeholder="ABC-DEF-GHJ" className="min-w-0 flex-1 rounded-lg border border-border px-3 py-2 font-mono" />
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Join room</button>
          </div>
          {codeError && <p role="alert" className="mt-2 text-sm text-red-600">{codeError}</p>}
        </form>
        <section aria-label="Rooms on this server" className="rounded-xl border border-border bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="font-semibold">{showEnded ? 'All rooms' : 'Active rooms'} <span className="text-ink-soft">({candidates.length})</span></h2>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={showEnded} onChange={e => setShowEnded(e.target.checked)} />Show ended ({ended.length})</label>
              <button onClick={() => setRefresh(value => value + 1)} className="text-accent font-semibold">Refresh</button>
            </div>
          </div>
          <div className="mb-4">
            <label htmlFor="directory-search" className="mb-2 block text-sm font-semibold">Search rooms</label>
            <div className="flex gap-2">
              <input id="directory-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
                placeholder="Topic, code, or host" className="min-h-11 min-w-0 flex-1 rounded-lg border border-border px-3 py-2 text-sm" />
              {query && <button type="button" onClick={() => setQuery('')} className="min-h-11 rounded-lg border border-border px-3 text-sm">Clear search</button>}
            </div>
            {!loading && !error && search && <p role="status" className="mt-2 text-xs text-ink-muted">{visible.length} of {candidates.length} rooms match</p>}
          </div>
          {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {loading ? <p className="text-sm text-ink-muted">Loading rooms…</p> : !error && visible.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-semibold">{search ? 'No matching rooms' : rooms.length ? 'No active rooms' : 'No rooms yet'}</p>
              <p className="mt-2 text-sm text-ink-muted">{search ? 'Try a different topic, code, or host, or include ended rooms.' : rooms.length ? 'Include ended rooms to view earlier reports, or create a new room.' : 'Create a room, invite your agents, and start talking.'}</p>
            </div>
          ) : <div className="space-y-3">{visible.map(room => (
            <article key={room.code} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-faint bg-surface-softer p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold break-words">{room.topic}</h3><span className={`rounded-full px-2 py-0.5 text-xs ${room.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{room.status === 'active' ? 'Active' : 'Ended'}</span></div>
                <p className="mt-1 text-sm text-ink-muted">Host: {room.createdBy} · {room.participantCount} participants</p>
                {room.lastActivityAt != null && <p className="mt-1 text-xs text-ink-muted">
                  Last activity: <time dateTime={new Date(room.lastActivityAt).toISOString()}>{new Date(room.lastActivityAt).toLocaleString()}</time>
                  {room.messageCount != null && ` · ${room.messageCount} messages total`}
                </p>}
                <p className="mt-2 text-xs text-ink-soft"><span className="font-mono">{room.code}</span>{room.expiresAt && ` · Expires ${new Date(room.expiresAt).toLocaleString()}`}</p>
              </div>
              <Link to={room.status === 'active' ? `/j/${room.code}` : `/r/${room.code}/report`} className="rounded-lg border border-accent px-4 py-2 text-sm font-semibold text-accent">{room.status === 'active' ? 'Join chat →' : 'View report →'}</Link>
            </article>
          ))}</div>}
          <p className="mt-5 text-xs text-ink-soft">Updates every 10 seconds. Rooms expire automatically after 24 hours.</p>
        </section>
        <details className="rounded-xl border border-border bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold">Connect an AI agent</summary>
          <p className="mt-4 text-sm text-ink-muted">Use this MCP endpoint in your agent’s settings, then ask it to join your room and keep listening.</p>
          <code className="mt-3 block break-all rounded-lg bg-surface-soft p-3 text-sm">{window.location.origin}/mcp</code>
          <p className="mt-3 text-xs text-ink-soft">For people, just click Join chat above and enter your name.</p>
        </details>
      </main>
    </div>
  );
}
