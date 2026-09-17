// Webhook egress policy. This is the one path where a room can send its
// contents off the machine, so the rules get tests: the `public` default has
// to stay exactly what the hosted deployment already relies on, `loopback` has
// to reject anything that is not this machine, and neither may ever accept a
// metadata address.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { validateWebhookUrl, webhookMode } from './_webhookDispatch.js';
import { listTools } from './_mcpTools.js';

const ENV_KEYS = ['AGENT_ROOM_WEBHOOKS', 'AGENT_ROOM_WEBHOOK_ALLOW_HTTP'] as const;
const saved = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

const ok = (url: string, mode?: Parameters<typeof validateWebhookUrl>[1]) =>
  validateWebhookUrl(url, mode).ok;

describe('webhookMode', () => {
  it('defaults to public so an unaware deployment is unchanged', () => {
    delete process.env.AGENT_ROOM_WEBHOOKS;
    expect(webhookMode()).toBe('public');
    process.env.AGENT_ROOM_WEBHOOKS = '';
    expect(webhookMode()).toBe('public');
  });

  it('accepts the three modes case-insensitively', () => {
    for (const [raw, expected] of [['public', 'public'], ['LOOPBACK', 'loopback'], [' off ', 'off']] as const) {
      process.env.AGENT_ROOM_WEBHOOKS = raw;
      expect(webhookMode()).toBe(expected);
    }
  });

  it('fails closed on a typo rather than widening egress', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.AGENT_ROOM_WEBHOOKS = 'loopbak';
    expect(webhookMode()).toBe('off');
    expect(warn).toHaveBeenCalled();
  });
});

describe('public mode (the hosted rule, unchanged)', () => {
  it('takes a public https URL', () => {
    expect(ok('https://hooks.example.com/room', 'public')).toBe(true);
  });

  it('refuses http, loopback, private, and embedded credentials', () => {
    for (const url of [
      'http://hooks.example.com/room',
      'https://localhost/hook',
      'https://127.0.0.1/hook',
      'https://10.0.0.5/hook',
      'https://192.168.1.10/hook',
      'https://gateway.local/hook',
      'https://thing.internal/hook',
      'https://user:pw@hooks.example.com/room',
    ]) {
      expect(ok(url, 'public'), url).toBe(false);
    }
  });

  it('still refuses link-local when ALLOW_HTTP opens private ranges', () => {
    process.env.AGENT_ROOM_WEBHOOK_ALLOW_HTTP = '1';
    expect(ok('http://10.0.0.5/hook', 'public')).toBe(true);
    expect(ok('http://169.254.169.254/latest/meta-data/', 'public')).toBe(false);
    expect(ok('http://169.254.42.7/hook', 'public')).toBe(false);
    expect(ok('http://metadata.google.internal/x', 'public')).toBe(false);
  });
});

describe('loopback mode (local-only installs)', () => {
  it('takes a receiver on this machine, with or without TLS', () => {
    for (const url of [
      'http://localhost:9000/hook',
      'http://127.0.0.1:9000/hook',
      'https://127.0.0.1/hook',
      'http://[::1]:9000/hook',
      'http://10.0.0.5/hook',
      'http://192.168.1.10/hook',
      'http://dev.localhost/hook',
    ]) {
      expect(ok(url, 'loopback'), url).toBe(true);
    }
  });

  it('refuses anything that would leave the machine', () => {
    for (const url of [
      'https://hooks.example.com/room',
      'http://hooks.example.com/room',
      'https://8.8.8.8/hook',
      'http://user:pw@127.0.0.1/hook',
      'ftp://127.0.0.1/hook',
      'not-a-url',
    ]) {
      expect(ok(url, 'loopback'), url).toBe(false);
    }
  });

  it('refuses link-local and metadata even though they are not public', () => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.42.7/hook',
      'http://metadata.google.internal/x',
      'http://[fe80::1]/hook',
    ]) {
      expect(ok(url, 'loopback'), url).toBe(false);
    }
  });
});

describe('off mode', () => {
  it('refuses every URL, including a valid local one', () => {
    for (const url of ['https://hooks.example.com/room', 'http://127.0.0.1:9000/hook']) {
      expect(ok(url, 'off'), url).toBe(false);
    }
  });

  it('drops room_webhook from the tool surface', () => {
    delete process.env.AGENT_ROOM_WEBHOOKS;
    expect(listTools('full').map(t => t.name)).toContain('room_webhook');
    process.env.AGENT_ROOM_WEBHOOKS = 'off';
    expect(listTools('full').map(t => t.name)).not.toContain('room_webhook');
  });
});

describe('off mode refuses the call, not just the listing', () => {
  // The hidden aliases are the interesting case: an agent carrying a saved
  // `room_webhook_register` rule must not reach registration either.
  const stubClient = { post: async () => ({}) } as never;

  it.each(['room_webhook', 'room_webhook_register'])('refuses %s', async (name) => {
    process.env.AGENT_ROOM_WEBHOOKS = 'off';
    const { callTool } = await import('./_mcpTools.js');
    const res = await callTool(stubClient, 'full', name, {
      code: 'AAA-BBB-CCC', name: 'Host', action: 'register', url: 'https://hooks.example.com/x',
    });
    const body = JSON.parse((res.content[0] as { text: string }).text);
    expect(body.registered).toBeFalsy();
    expect(String(body.error)).toMatch(/unknown_tool|webhooks_disabled/);
  });
});

describe('the tool surface reflects the mode', () => {
  it('stops advertising public HTTPS in loopback mode', () => {
    process.env.AGENT_ROOM_WEBHOOKS = 'loopback';
    const tool = listTools('full').find(t => t.name === 'room_webhook')!;
    expect(tool.description).toContain('refuses public URLs');
    expect(tool.description).not.toContain('via public HTTPS POST');
  });
});
