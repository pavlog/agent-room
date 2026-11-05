import { createClient } from 'redis';

/** A shared connection with bounded health probes. Never replay failed writes:
 * a lost reply does not prove the command was not committed by Redis. */
export async function connectLocalRedis({ url, intervalMs = 5000, timeoutMs = 5000,
  log = (event) => console.error(JSON.stringify(event)),
} = {}) {
  const redis = createClient({ url, disableOfflineQueue: true,
    socket: { connectTimeout: timeoutMs, reconnectStrategy: false },
  });
  let stopped = false;
  let timer;
  const report = (event, error) => log({ time: new Date().toISOString(), component: 'redis', event,
    ...(error ? { error: error.name || 'Error' } : {}) });
  redis.on('error', error => report('connection-error', error));
  const destroy = () => { if (redis.isOpen) redis.destroy(); };
  async function bounded(operation) {
    let deadline;
    try {
      return await Promise.race([operation(), new Promise((_, reject) => {
        deadline = setTimeout(() => {
          const error = new Error('Redis response deadline exceeded');
          error.name = 'RedisDeadlineError';
          reject(error);
          destroy();
        }, timeoutMs);
      })]);
    } finally { clearTimeout(deadline); }
  }
  async function connect() {
    await bounded(() => redis.connect());
    report('connected');
  }
  async function tick() {
    if (stopped) return;
    try {
      if (!redis.isReady) {
        destroy();
        await connect();
      } else {
        await bounded(() => redis.ping());
      }
    } catch (error) {
      report('probe-failed', error);
      destroy();
    } finally {
      if (!stopped) {
        timer = setTimeout(tick, intervalMs);
        timer.unref();
      }
    }
  }
  try { await connect(); } catch (error) { destroy(); throw error; }
  timer = setTimeout(tick, intervalMs);
  timer.unref();
  return { redis, close() { stopped = true; clearTimeout(timer); destroy(); } };
}
