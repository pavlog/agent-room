import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Create matching local credentials without printing or replacing them. */
export function setupLocal(root) {
  const serverFile = path.join(root, '.env.local');
  const webFile = path.join(root, 'apps', 'web', '.env.local');
  if (!existsSync(path.join(root, 'apps', 'web'))) throw new Error('Run setup in an Agent Room checkout.');
  if (existsSync(serverFile) || existsSync(webFile)) {
    throw new Error('Local settings already exist. Nothing was changed. Review both environment files manually to preserve existing credentials.');
  }
  const token = randomBytes(32).toString('hex');
  const server = `# Generated local settings. Never commit this file.\nLOCAL_REDIS_URL=redis://127.0.0.1:6389\nUPSTASH_REDIS_REST_URL=http://127.0.0.1:5173/redis\nUPSTASH_REDIS_REST_TOKEN=${token}\n`;
  const web = `# Generated local settings. Never commit this file.\nVITE_UPSTASH_REDIS_REST_URL=http://127.0.0.1:5173/redis\nVITE_UPSTASH_REDIS_REST_TOKEN=${token}\n`;
  writeFileSync(serverFile, server, { flag: 'wx', mode: 0o600 });
  try { writeFileSync(webFile, web, { flag: 'wx', mode: 0o600 }); }
  catch (error) { unlinkSync(serverFile); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    setupLocal(fileURLToPath(new URL('../', import.meta.url)));
    console.log('Created local server and browser settings. Credentials were not printed. Next: npm ci, then npm run build:ordered.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
