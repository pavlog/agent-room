import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { parseRoomDirectory, type RoomSummary } from '../lib/roomDirectory.js';
import { ENV } from '../env.js';


/** Local room navigation inspired by WakiChat; keeps this fork's API contract. */
export function RoomSwitcher({ currentCode, beforeNavigate }: { currentCode: string; beforeNavigate?: () => boolean }) {
  const [open, setOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  useEffect(() => { setOpen(false); }, [currentCode]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    search.current?.focus();
    setLoading(true);
    setError('');
    setRooms([]);
    setQuery('');
    async function load() {
      try {
        const response = await fetch('/api/local/rooms', {
          headers: { Authorization: `Bearer ${ENV.upstash.token}` },
          cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        const valid = parseRoomDirectory(data).filter(room => room.status === 'active');
        if (!controller.signal.aborted) setRooms(valid);
      } catch {
        if (!controller.signal.aborted) setError('Room list unavailable. Open the directory to retry or join by code.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [open]);

  function close() { setOpen(false); trigger.current?.focus(); }
  const visible = rooms.filter(room => `${room.topic} ${room.code}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div>
      <button ref={trigger} type="button" onClick={() => open ? close() : setOpen(true)}
        aria-expanded={open} aria-controls="room-switcher" aria-haspopup="dialog"
        className="min-h-11 rounded-lg border border-border px-3 text-xs font-semibold text-ink">Rooms</button>
        <dialog ref={dialog} id="room-switcher" aria-label="Switch room"
          onCancel={event => { event.preventDefault(); close(); }}
          onClick={event => { if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
          } }}
          className="m-auto max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-4 text-ink shadow-xl backdrop:bg-black/30">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Switch room</h2>
            <button type="button" onClick={close} className="min-h-11 px-3 text-sm">Close</button>
          </div>
          <label htmlFor="room-search" className="block text-sm text-ink-muted">Search active rooms</label>
          <input ref={search} id="room-search" value={query} onChange={event => setQuery(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-surface p-3 text-ink" />
          <div className="mt-3 max-h-[45vh] overflow-y-auto" aria-live="polite">
            {loading ? <p className="p-3 text-sm">Loading rooms…</p> : error ? <p role="alert" className="p-3 text-sm">{error}</p> : visible.length === 0 ? <p className="p-3 text-sm">No matching active rooms.</p> : visible.map(room => (
              <Link key={room.code} to={room.code === currentCode ? `/r/${room.code}` : `/j/${room.code}`} onClick={event => {
                if (room.code !== currentCode && beforeNavigate && !beforeNavigate()) { event.preventDefault(); return; }
                close();
              }}
                aria-current={room.code === currentCode ? 'page' : undefined}
                className="mb-2 block rounded-lg border border-border p-3 hover:bg-accent-tint">
                <span className="block break-words font-semibold">{room.topic}{room.code === currentCode && ' · Current room'}</span>
                <span className="text-xs text-ink-muted">{room.code} · {room.participantCount} participants</span>
                {room.lastActivityAt != null && <span className="mt-1 block text-xs text-ink-muted">
                  Last activity: {new Date(room.lastActivityAt).toLocaleString()}
                  {room.messageCount != null && ` · ${room.messageCount} messages total`}
                </span>}
              </Link>
            ))}
          </div>
          <Link to="/" onClick={event => {
            if (beforeNavigate && !beforeNavigate()) { event.preventDefault(); return; }
            close();
          }} className="mt-3 block py-3 text-sm font-semibold text-accent">Open room directory →</Link>
        </dialog>
    </div>
  );
}
