import { afterEach, describe, expect, it, vi } from 'vitest';
import { hydrateListenImages, isTrustedAttachmentImageUrl } from './_mcpTools.js';
afterEach(() => vi.unstubAllEnvs());
describe('local image access', () => {
  it('requires an explicit origin and attachment path; refuses other local services', () => {
    vi.stubEnv('AGENT_ROOM_IMAGE_BASE_URLS', 'http://localhost:5173/uploads/');
    expect(isTrustedAttachmentImageUrl('http://localhost:5173/uploads/preview.png')).toBe(true);
    for (const url of ['http://localhost:8766/uploads/a.png', 'http://127.0.0.1:5173/uploads/a.png',
      'http://localhost:5173/redis', 'http://localhost:5173/uploads/../redis',
      'http://user:pass@localhost:5173/uploads/a.png', 'http://localhost:5173/uploads-other/a.png']) {
      expect(isTrustedAttachmentImageUrl(url)).toBe(false);
    }
    vi.stubEnv('AGENT_ROOM_IMAGE_BASE_URLS', 'http://localhost:5173/');
    expect(isTrustedAttachmentImageUrl('http://localhost:5173/redis')).toBe(false);
  });
  it('hydrates permitted images without following redirects', async () => {
    vi.stubEnv('AGENT_ROOM_IMAGE_BASE_URLS', 'http://localhost:5173/uploads/');
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const parts = await hydrateListenImages([{ attachments: [{ type: 'image', mime: 'image/png', url: 'http://localhost:5173/uploads/a.png' }] }], fetcher);
    expect(parts).toHaveLength(1);
    expect(fetcher.mock.calls[0][1].redirect).toBe('error');
  });
});
