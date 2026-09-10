import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadAttachment } from './upload.js';

afterEach(() => { vi.unstubAllGlobals(); });
const file = () => new File(['Example'], 'example.txt', { type: 'text/plain' });
const attachment = {
  id: 'example', type: 'file', name: 'example.txt', mime: 'text/plain', size: 7,
  url: 'https://example.org/example.txt', uploadedAt: 1,
};
function response(body: unknown, status = 201) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe('attachment upload responses', () => {
  it('accepts a complete uploaded attachment', async () => {
    response(attachment);
    await expect(uploadAttachment(file(), 'ABC-DEF-GHJ')).resolves.toEqual(attachment);
  });
  it.each([null, {}, { ...attachment, name: null }, { ...attachment, size: -1 },
    { ...attachment, url: 'javascript:alert(1)' }, { ...attachment, url: '/relative' },
  ])('rejects invalid attachment data %# before it reaches the draft', async body => {
    response(body);
    await expect(uploadAttachment(file(), 'ABC-DEF-GHJ')).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it('handles non-JSON successful responses as upload errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Error</html>')));
    await expect(uploadAttachment(file(), 'ABC-DEF-GHJ')).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it.each([null, { error: {}, message: [] }])('handles malformed error bodies %#', async body => {
    response(body, 503);
    await expect(uploadAttachment(file(), 'ABC-DEF-GHJ')).rejects.toMatchObject({ code: 'upload_failed', status: 503, message: 'Upload failed (503).' });
  });
  it('preserves a valid server error message', async () => {
    response({ error: 'unavailable', message: 'Uploads are not configured.' }, 503);
    await expect(uploadAttachment(file(), 'ABC-DEF-GHJ')).rejects.toMatchObject({ code: 'unavailable', message: 'Uploads are not configured.' });
  });
});
