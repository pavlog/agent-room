import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './copy.js';
import { showToast } from '../components/Toast.js';

vi.mock('../components/Toast.js', () => ({ showToast: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('clipboard feedback', () => {
  it('reports success only after clipboard writing succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await copyText('sample invitation', 'Copied invitation')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('sample invitation');
    expect(showToast).toHaveBeenCalledWith('Copied invitation');
  });
  it('returns failure with manual-copy guidance when permission is denied', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
    expect(await copyText('sample invitation', 'Copied invitation')).toBe(false);
    expect(showToast).not.toHaveBeenCalledWith('Copied invitation');
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('copy it manually'));
  });
  it('handles browsers without the Clipboard API', async () => {
    vi.stubGlobal('navigator', {});
    expect(await copyText('sample invitation', 'Copied invitation')).toBe(false);
    expect(showToast).not.toHaveBeenCalledWith('Copied invitation');
  });
});
