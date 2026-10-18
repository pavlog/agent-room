import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from 'redis';
import { appendMessage, readMessageBatch } from '../packages/upstash-client/src/messages.js';
import type { UpstashClient } from '../packages/upstash-client/src/client.js';
import type { Message } from '@agent-room/shared';

// Run only against an explicitly supplied disposable Redis, never production.
const url = process.env.AGENT_ROOM_TEST_REDIS_URL;
const suite = url ? describe : describe.skip;
suite('atomic message cursors with real Redis', () => {
  const redis = createClient({ url });
  const code = 'TST-CUR-SOR';
  const keys = [`room:${code}`, `room-msgs:${code}`, `room-msg-count:${code}`];
  const store: UpstashClient = {
    command: cmd => redis.sendCommand(cmd.map(String)) as never,
    pipeline: cmds => Promise.all(cmds.map(cmd => redis.sendCommand(cmd.map(String)))) as never,
  };
  const message = (id: number): Message => ({ id, type: 'msg', text: `test ${id}`, name: 'Tester',
    client: 'web', role: '', initials: 'TE', color: '#000', time: id });
  beforeAll(async () => {
    await redis.connect();
    await redis.del(keys);
    await redis.set(keys[0], JSON.stringify({ code, topic: 'isolated test', status: 'active', version: 1,
      createdAt: Date.now(), createdBy: 'Tester', participants: [{ name: 'Tester', client: 'web', canSpeak: true }] }));
    await redis.rPush(keys[1], Array.from({ length: 1000 }, (_, i) => JSON.stringify(message(12558 + i))));
    await redis.set(keys[2], '13557');
  });
  afterAll(async () => { await redis.del(keys); await redis.quit(); });
  it('recovers once after trimming and does not replay or skip concurrent appends', async () => {
    const first = await readMessageBatch(store, code, 1000);
    expect(first.cursor).toBe(13557);
    expect(first.messages).toHaveLength(1000);
    expect(first.historyTruncated).toBe(true);
    expect((await readMessageBatch(store, code, first.cursor)).messages).toEqual([]);
    const writes = Promise.all(Array.from({ length: 50 }, (_, i) => appendMessage(store, code, message(13558 + i))));
    const during = await readMessageBatch(store, code, first.cursor);
    await writes;
    const after = await readMessageBatch(store, code, during.cursor);
    const received = [...during.messages, ...after.messages];
    expect(new Set(received.map(m => m.id)).size).toBe(50);
    expect(received).toHaveLength(50);
    expect(after.cursor).toBe(13607);
    expect(await redis.lLen(keys[1])).toBe(1000);
    expect(await redis.ttl(keys[1])).toBeGreaterThan(0);
    expect(await redis.ttl(keys[2])).toBeGreaterThan(0);
  });
});
