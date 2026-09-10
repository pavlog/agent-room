// Delete only an ended room, atomically checking its status before removing data.
// Explicit keys avoid matching another room or unrelated application data.
export const DELETE_ROOM_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'missing' end
local room = cjson.decode(raw)
if room.status ~= 'ended' then return 'active' end
redis.call('DEL', unpack(KEYS, 1, 7))
redis.call('SREM', KEYS[8], ARGV[1])
return 'deleted'
`;

export async function deleteLocalRoom(redis, code) {
  if (typeof code !== 'string' || !/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}(?:-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}){2}$/.test(code)) {
    return 'invalid';
  }
  return redis.eval(DELETE_ROOM_SCRIPT, {
    keys: ['room:', 'room-msgs:', 'room-msg-count:', 'room-report:', 'task-board:', 'turn-state:', 'room-webhooks:'].map(prefix => prefix + code).concat('task-board:rooms'),
    arguments: [code],
  });
}
