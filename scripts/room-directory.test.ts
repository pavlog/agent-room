import { describe, expect, it } from 'vitest';
// The local server uses native ESM so it can start without a TypeScript runtime.
// @ts-expect-error JavaScript runtime helper is tested directly.
import { listLocalRooms } from './room-directory.mjs';

const a = 'ABC-DEF-GHJ';
const b = 'BCD-EFG-HJK';
function fixture() {
  const data = new Map<string, string>([
    [`room:${a}`, JSON.stringify({ code: a, topic: 'First', status: 'active', createdAt: 100, createdBy: 'Host', participants: [{ privateKey: 'fixture-only' }], hostKey: 'fixture-only' })],
    [`room:${b}`, JSON.stringify({ code: b, topic: 'Second', status: 'ended', createdAt: 200 })],
    [`room-msg-count:${a}`, '700'],
  ]);
  const last = new Map([[`room-msgs:${a}`, JSON.stringify({ time: 300, text: 'Private fixture transcript' })]]);
  return {
    data, last,
    redis: {
      async *scanIterator() { yield [`room:${a}`, `room:${b}`, `room:${a}`, 'room:invalid']; },
      async get(key: string) { return data.get(key) ?? null; },
      async ttl() { return 30; },
      async lIndex(key: string) { return last.get(key) ?? null; },
    },
  };
}
describe('local room activity summaries', () => {
  it('sorts by last message activity and uses lifetime counts without disclosing private data', async () => {
    const { redis } = fixture();
    const rooms = await listLocalRooms(redis, 1000);
    expect(rooms.map((room: { code: string }) => room.code)).toEqual([a, b]);
    expect(rooms[0]).toMatchObject({ lastActivityAt: 300, messageCount: 700, expiresAt: 31000, participantCount: 1 });
    expect(rooms[1]).toMatchObject({ lastActivityAt: 200, messageCount: null });
    expect(JSON.stringify(rooms)).not.toMatch(/fixture-only|Private fixture transcript|privateKey|hostKey/);
  });
  it('handles corrupt room/message data and unknown counts without inventing activity', async () => {
    const { redis, data, last } = fixture();
    data.set(`room:${b}`, '{bad');
    data.set(`room-msg-count:${a}`, '12garbage');
    last.set(`room-msgs:${a}`, '{bad');
    const rooms = await listLocalRooms(redis);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ lastActivityAt: 100, messageCount: null });
  });
  it('omits rooms expiring during the scan', async () => {
    const { redis } = fixture();
    redis.ttl = async () => -2;
    expect(await listLocalRooms(redis)).toEqual([]);
  });
  it('rejects out-of-range dates that would crash browser date formatting', async () => {
    const { redis, data, last } = fixture();
    const room = JSON.parse(data.get(`room:${b}`)!);
    data.set(`room:${b}`, JSON.stringify({ ...room, createdAt: 1e30 }));
    last.set(`room-msgs:${a}`, JSON.stringify({ time: 1e30 }));
    const rooms = await listLocalRooms(redis);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].lastActivityAt).toBe(100);
  });
});
