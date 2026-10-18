import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({ resolve: { alias: { '@agent-room/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)), '@agent-room/upstash-client': fileURLToPath(new URL('./packages/upstash-client/src/index.ts', import.meta.url)) } } });
