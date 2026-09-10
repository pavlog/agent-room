import { describe, expect, it, vi } from 'vitest';
import { deleteLocalRoom, DELETE_ROOM_SCRIPT } from './delete-local-room.mjs';

describe('local room deletion', () => {
  it.each(['*', '../other', 'ABC-DEF-GH?', '', null])('rejects invalid code %s before accessing Redis', async code => {
    const redis = { eval: vi.fn() };
    expect(await deleteLocalRoom(redis, code)).toBe('invalid');
    expect(redis.eval).not.toHaveBeenCalled();
  });
  it.each(['active', 'missing', 'deleted'])('returns the atomic status check result %s', async result => {
    const redis = { eval: vi.fn().mockResolvedValue(result) };
    expect(await deleteLocalRoom(redis, 'ABC-DEF-GHJ')).toBe(result);
    expect(redis.eval).toHaveBeenCalledWith(DELETE_ROOM_SCRIPT, {
      keys: ['room:ABC-DEF-GHJ', 'room-msgs:ABC-DEF-GHJ', 'room-msg-count:ABC-DEF-GHJ',
        'room-report:ABC-DEF-GHJ', 'task-board:ABC-DEF-GHJ', 'turn-state:ABC-DEF-GHJ',
        'room-webhooks:ABC-DEF-GHJ', 'task-board:rooms'], arguments: ['ABC-DEF-GHJ'],
    });
  });
  it('propagates Redis failure rather than reporting success', async () => {
    await expect(deleteLocalRoom({ eval: vi.fn().mockRejectedValue(new Error('Offline')) }, 'ABC-DEF-GHJ')).rejects.toThrow('Offline');
  });
});
