/** Read-only summaries. Never return transcripts, keys, or participant identities. */
export async function listLocalRooms(redis, now = Date.now()) {
  const rooms = [];
  const seen = new Set();
  for await (const keys of redis.scanIterator({ MATCH: 'room:*', COUNT: 100 })) {
    for (const key of keys) {
      if (!/^room:[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(key) || seen.has(key)) continue;
      seen.add(key);
      const raw = await redis.get(key);
      if (!raw) continue;
      let room;
      try { room = JSON.parse(raw); } catch { continue; }
      if (!room || key !== `room:${room.code}` || typeof room.topic !== 'string'
        || !['active', 'ended'].includes(room.status) || !Number.isFinite(room.createdAt)) continue;
      const [ttl, lastRaw, countRaw] = await Promise.all([
        redis.ttl(key), redis.lIndex(`room-msgs:${room.code}`, -1), redis.get(`room-msg-count:${room.code}`),
      ]);
      if (ttl === -2) continue;
      let lastActivityAt = room.createdAt;
      if (lastRaw) {
        try {
          const last = JSON.parse(lastRaw);
          if (Number.isFinite(last?.time)) lastActivityAt = Math.max(lastActivityAt, last.time);
        } catch { /* Keep the creation-time fallback for malformed legacy data. */ }
      }
      const parsedCount = typeof countRaw === 'string' && /^\d+$/.test(countRaw) ? Number(countRaw) : NaN;
      rooms.push({
        code: room.code, topic: room.topic, status: room.status, createdAt: room.createdAt,
        createdBy: typeof room.createdBy === 'string' ? room.createdBy : '',
        participantCount: Array.isArray(room.participants) ? room.participants.length : 0,
        expiresAt: ttl >= 0 ? now + ttl * 1000 : null,
        lastActivityAt,
        // This is the lifetime counter, not the length of the retained transcript.
        // Legacy rooms without a counter stay unknown rather than showing zero.
        messageCount: Number.isSafeInteger(parsedCount) ? parsedCount : null,
      });
    }
  }
  return rooms.sort((a, b) => b.lastActivityAt - a.lastActivityAt || b.createdAt - a.createdAt || a.code.localeCompare(b.code));
}
