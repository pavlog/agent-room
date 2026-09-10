import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
// @ts-expect-error Native ESM setup script is tested without a TS runtime.
import { setupLocal } from './setup-local.mjs';

function isolated(test: (root: string) => void) {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-room-setup-test-'));
  mkdirSync(path.join(root, 'apps/web'), { recursive: true });
  try { test(root); } finally {
    if (path.dirname(root) !== path.resolve(tmpdir()) || !path.basename(root).startsWith('agent-room-setup-test-')) throw new Error('Unsafe cleanup path');
    rmSync(root, { recursive: true, force: true });
  }
}
describe('local environment setup', () => {
  it('creates matching credentials and loopback endpoints', () => isolated(root => {
    setupLocal(root);
    const server = readFileSync(path.join(root, '.env.local'), 'utf8');
    const web = readFileSync(path.join(root, 'apps/web/.env.local'), 'utf8');
    const token = server.match(/^UPSTASH_REDIS_REST_TOKEN=(.*)$/m)![1];
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(web).toContain(`VITE_UPSTASH_REDIS_REST_TOKEN=${token}`);
    expect(server).toContain('http://127.0.0.1:5173/redis');
    expect(() => setupLocal(root)).toThrow('already exist');
    expect(readFileSync(path.join(root, '.env.local'), 'utf8')).toBe(server);
  }));
  it('does not overwrite or supplement a partial existing setup', () => isolated(root => {
    const web = path.join(root, 'apps/web/.env.local');
    writeFileSync(web, '# existing settings');
    expect(() => setupLocal(root)).toThrow('already exist');
    expect(readFileSync(web, 'utf8')).toBe('# existing settings');
    expect(existsSync(path.join(root, '.env.local'))).toBe(false);
  }));
});
