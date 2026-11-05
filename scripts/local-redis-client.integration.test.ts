import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { createClient } from 'redis';
import { connectLocalRedis } from './local-redis-client.mjs';

const url = process.env.AGENT_ROOM_TEST_REDIS_URL;
const cleanup: Array<() => Promise<unknown> | void> = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
async function proxy() {
  const target = new URL(url!);
  const pairs: Array<{ downstream: net.Socket; upstream: net.Socket; dropReplies: boolean }> = [];
  let connections = 0;
  const server = net.createServer(downstream => {
    connections++;
    const upstream = net.connect(Number(target.port), target.hostname);
    const pair = { downstream, upstream, dropReplies: false };
    pairs.push(pair);
    downstream.on('data', chunk => upstream.write(chunk));
    upstream.on('data', chunk => { if (!pair.dropReplies) downstream.write(chunk); });
    downstream.on('error', () => {}); upstream.on('error', () => downstream.destroy());
    downstream.on('close', () => upstream.destroy());
    upstream.on('close', () => downstream.destroy());
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => { for (const p of pairs) { p.downstream.destroy(); p.upstream.destroy(); }
    return new Promise<void>(resolve => server.close(() => resolve())); });
  return { url: `redis://127.0.0.1:${(server.address() as net.AddressInfo).port}`,
    blackhole: () => { for (const p of pairs) p.dropReplies = true; },
    connections: () => connections,
  };
}
async function eventually(check: () => Promise<boolean>) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('Recovery deadline exceeded');
}
describe.skipIf(!url)('local Redis connection recovery over real TCP and Redis', () => {
  it('fails a lost reply, reconnects, and never replays a committed write', async () => {
    const direct = createClient({ url }); await direct.connect();
    cleanup.push(() => direct.destroy());
    const key = `test:recovery:${randomUUID()}`;
    cleanup.push(async () => { await direct.del(key); });
    const p = await proxy();
    const events: any[] = [];
    const managed = await connectLocalRedis({ url: p.url, intervalMs: 50, timeoutMs: 150, log: e => events.push(e) });
    cleanup.push(managed.close);
    await managed.redis.set(key, '0');
    p.blackhole();
    const failed = managed.redis.incr(key).then(() => false, () => true);
    await eventually(async () => await direct.get(key) === '1');
    expect(await failed).toBe(true);
    await eventually(async () => p.connections() > 1 && managed.redis.isReady);
    expect(await managed.redis.ping()).toBe('PONG');
    expect(await direct.get(key)).toBe('1');
    expect(events.some(e => e.event === 'probe-failed')).toBe(true);
    expect(events.every(e => typeof e.time === 'string')).toBe(true);
  });
  it('close cancels recovery and leaves no new connections', async () => {
    const p = await proxy();
    const managed = await connectLocalRedis({ url: p.url, intervalMs: 40, timeoutMs: 100, log: () => {} });
    p.blackhole(); managed.close();
    const count = p.connections();
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(p.connections()).toBe(count);
    expect(managed.redis.isOpen).toBe(false);
  });
  it('bounds startup when TCP connects but the Redis handshake never answers', async () => {
    const sockets: net.Socket[] = [];
    const server = net.createServer(socket => { sockets.push(socket); socket.on('data', () => {}); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    cleanup.push(() => { sockets.forEach(s => s.destroy()); return new Promise<void>(resolve => server.close(() => resolve())); });
    const start = Date.now();
    await expect(connectLocalRedis({ url: `redis://127.0.0.1:${(server.address() as net.AddressInfo).port}`,
      timeoutMs: 100, log: () => {} })).rejects.toThrow('deadline');
    expect(Date.now() - start).toBeLessThan(1500);
  });
});
