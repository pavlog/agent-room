import { listLocalRooms } from './room-directory.mjs';
import express from 'express';
import { createClient } from 'redis';
import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
process.loadEnvFile(path.join(root, '.env.local'));
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
if (!token) throw new Error('Set UPSTASH_REDIS_REST_TOKEN in .env.local');
const redis = createClient({ url: process.env.LOCAL_REDIS_URL || 'redis://127.0.0.1:6389' });
redis.on('error', error => console.error('Redis:', error.message));
await redis.connect();
const app = express();
app.disable('x-powered-by');
const json = express.json({ limit: '12mb' });

app.get('/api/local/rooms', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers.authorization !== `Bearer ${token}`) return res.status(401).json({ error: 'Unauthorized' });
  const rooms = await listLocalRooms(redis);
  res.json({ rooms });
});

// Local Upstash-compatible bridge; bind the entire service to loopback only.
app.use('/redis', json, (req, res, next) => {
  if (req.headers.authorization !== `Bearer ${token}`) return res.status(401).json({ error: 'Unauthorized' });
  next();
});
async function command(cmd) {
  if (!Array.isArray(cmd) || !cmd.length || !cmd.every(v => typeof v === 'string' || typeof v === 'number')) {
    return { error: 'Expected a Redis command array' };
  }
  try { return { result: await redis.sendCommand(cmd.map(String)) }; }
  catch (error) { return { error: error.message }; }
}
app.post('/redis', async (req, res) => res.json(await command(req.body)));
app.post('/redis/pipeline', async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Expected an array' });
  const results = [];
  for (const cmd of req.body) results.push(await command(cmd));
  res.json(results);
});
app.get('/redis/*path', async (req, res) => res.json(await command(req.params.path)));

mkdirSync(path.join(root, '.local'), { recursive: true });
for (const name of ['mcp', 'report-page', 'report-og', 'upload', 'delete-room-blobs', 'install']) {
  const outfile = path.join(root, '.local', `${name}.mjs`);
  await build({ entryPoints: [path.join(root, 'api', `${name}.ts`)], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  const handler = (await import(pathToFileURL(outfile).href)).default;
  const routes = name === 'mcp' ? ['/mcp', '/api/mcp'] : [`/api/${name}`];
  app.all(routes, ...(name === 'upload' ? [] : [json]), handler);
}
app.get('/health', async (_req, res) => res.json({ status: 'ok', redis: await redis.ping() }));
app.use(express.static(path.join(root, 'apps/web/dist')));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(root, 'apps/web/dist/index.html')));
app.use((error, _req, res, _next) => {
  console.error(error);
  if (!res.headersSent) res.status(500).json({ error: error.message });
});
const server = app.listen(5173, '127.0.0.1', () => console.log('Agent Room: http://localhost:5173 | MCP: http://localhost:5173/mcp'));
async function stop() { server.close(); await redis.quit(); process.exit(0); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
