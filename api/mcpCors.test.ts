// Who may reach the MCP endpoint from a browser.
//
// The endpoint takes no bearer token on purpose — the room code in the tool
// arguments is the credential. That is defensible for a deployment reached by
// MCP clients, but a local server also listens where the user's browser can
// reach it, and `Access-Control-Allow-Origin: *` then lets any page they visit
// call it and read the answers. These tests pin the two modes and, more
// importantly, that a foreign Origin is refused rather than merely unreadable.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { mcpCorsMode, allowedMcpOrigins, applyMcpCors } from './mcp.js';

const saved = process.env.AGENT_ROOM_MCP_CORS;
afterEach(() => {
  if (saved === undefined) delete process.env.AGENT_ROOM_MCP_CORS;
  else process.env.AGENT_ROOM_MCP_CORS = saved;
  vi.restoreAllMocks();
});

/** Minimal response double: records the headers that were set. */
function resDouble() {
  const headers: Record<string, string> = {};
  return { headers, setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; } } as never;
}
const headersOf = (r: unknown) => (r as { headers: Record<string, string> }).headers;

describe('mcpCorsMode', () => {
  it('defaults to any so an unaware deployment is unchanged', () => {
    delete process.env.AGENT_ROOM_MCP_CORS;
    expect(mcpCorsMode()).toBe('any');
    process.env.AGENT_ROOM_MCP_CORS = '';
    expect(mcpCorsMode()).toBe('any');
  });

  it('reads both modes case-insensitively', () => {
    process.env.AGENT_ROOM_MCP_CORS = 'ANY';
    expect(mcpCorsMode()).toBe('any');
    process.env.AGENT_ROOM_MCP_CORS = ' Same-Origin ';
    expect(mcpCorsMode()).toBe('same-origin');
  });

  it('fails closed on a typo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.AGENT_ROOM_MCP_CORS = 'sameorigin';
    expect(mcpCorsMode()).toBe('same-origin');
    expect(warn).toHaveBeenCalled();
  });
});

describe('allowedMcpOrigins', () => {
  it('accepts both loopback spellings on the configured port', () => {
    const set = allowedMcpOrigins('http://localhost:5173');
    expect([...set].sort()).toEqual(['http://127.0.0.1:5173', 'http://localhost:5173']);
    expect(allowedMcpOrigins('http://127.0.0.1:5173').has('http://localhost:5173')).toBe(true);
  });

  it('does not widen a real host to loopback', () => {
    const set = allowedMcpOrigins('https://www.agent-room.com');
    expect([...set]).toEqual(['https://www.agent-room.com']);
  });

  it('yields nothing for an unparseable base rather than guessing', () => {
    expect(allowedMcpOrigins('not a url').size).toBe(0);
  });
});

describe('any mode (the hosted rule, unchanged)', () => {
  it('answers every origin with a wildcard', () => {
    const res = resDouble();
    expect(applyMcpCors('https://evil.example', res, 'any')).toBe(true);
    expect(headersOf(res)['access-control-allow-origin']).toBe('*');
    expect(headersOf(res)['access-control-allow-methods']).toContain('POST');
  });
});

describe('same-origin mode (local installs)', () => {
  it('lets a non-browser client through and tells caches Origin matters', () => {
    const res = resDouble();
    // Claude Code, Cursor and curl send no Origin at all.
    expect(applyMcpCors(undefined, res, 'same-origin')).toBe(true);
    expect(headersOf(res)['vary']).toBe('Origin');
    expect(headersOf(res)['access-control-allow-origin']).toBeUndefined();
  });

  // PUBLIC_BASE_URL is read once at module load, so pass the base in rather
  // than mutating env after the import and wondering why nothing changed.
  const LOCAL = 'http://localhost:5173';

  it('echoes this server’s own origin', () => {
    for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
      const res = resDouble();
      expect(applyMcpCors(origin, res, 'same-origin', LOCAL), origin).toBe(true);
      expect(headersOf(res)['access-control-allow-origin']).toBe(origin);
    }
  });

  it('refuses any other site, and sends it no allow header', () => {
    for (const origin of [
      'https://evil.example',
      'http://localhost:5174',   // same host, different port
      'https://localhost:5173',  // same host and port, different scheme
      'null',                    // sandboxed iframe / file:// page
    ]) {
      const res = resDouble();
      expect(applyMcpCors(origin, res, 'same-origin', LOCAL), origin).toBe(false);
      expect(headersOf(res)['access-control-allow-origin']).toBeUndefined();
    }
  });
});
