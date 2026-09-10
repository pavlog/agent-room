import { describe, expect, it } from 'vitest';
import { parseRoomDirectory } from './roomDirectory.js';

const room = { code: 'ABC-DEF-GHJ', topic: 'Test room', status: 'active', participantCount: 2 };
describe('room directory response parsing', () => {
  it('keeps valid rooms while removing malformed entries and duplicate links', () => {
    const result = parseRoomDirectory({ rooms: [null, { ...room, code: '../../outside' }, room, room] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ code: room.code, createdBy: '', messageCount: null, expiresAt: null });
  });
  it('discards invalid dates/counts and unrecognized fields before rendering', () => {
    const [result] = parseRoomDirectory({ rooms: [{ ...room, createdBy: {}, lastActivityAt: 1e30,
      expiresAt: 'bad', messageCount: -1, hostKey: 'synthetic-private-field' }] });
    if (!result) throw new Error('Expected the valid room to be retained');
    expect(result.lastActivityAt).toBeUndefined();
    expect(result.expiresAt).toBeNull();
    expect(result.messageCount).toBeNull();
    expect(result).not.toHaveProperty('hostKey');
  });
  it('distinguishes a valid empty directory from a malformed response', () => {
    expect(parseRoomDirectory({ rooms: [] })).toEqual([]);
    for (const payload of [null, {}, { rooms: 'bad' }, { rooms: [{ ...room, participantCount: NaN }] }]) {
      expect(() => parseRoomDirectory(payload)).toThrow();
    }
  });
});
