import { isValidCode } from '@agent-room/shared';

export type RoomSummary = {
  code: string; topic: string; status: 'active' | 'ended'; createdBy: string;
  participantCount: number; expiresAt: number | null;
  createdAt?: number; lastActivityAt?: number; messageCount: number | null;
};

const timestamp = (value: unknown): value is number => typeof value === 'number'
  && Number.isFinite(value) && value >= 0 && value <= 8640000000000000;
const count = (value: unknown): value is number => typeof value === 'number'
  && Number.isSafeInteger(value) && value >= 0;

/** Validate the HTTP boundary before values reach date formatting and links. */
export function parseRoomDirectory(payload: unknown): RoomSummary[] {
  if (!payload || typeof payload !== 'object' || !('rooms' in payload) || !Array.isArray(payload.rooms)) {
    throw new Error('The server returned an invalid room directory.');
  }
  const rooms: RoomSummary[] = [];
  const seen = new Set<string>();
  for (const value of payload.rooms) {
    if (!value || typeof value !== 'object' || typeof value.code !== 'string' || !isValidCode(value.code)
      || typeof value.topic !== 'string' || !['active', 'ended'].includes(value.status)
      || !count(value.participantCount) || seen.has(value.code)) continue;
    seen.add(value.code);
    rooms.push({
      code: value.code, topic: value.topic, status: value.status,
      createdBy: typeof value.createdBy === 'string' ? value.createdBy : '',
      participantCount: value.participantCount,
      expiresAt: timestamp(value.expiresAt) ? value.expiresAt : null,
      ...(timestamp(value.createdAt) ? { createdAt: value.createdAt } : {}),
      ...(timestamp(value.lastActivityAt) ? { lastActivityAt: value.lastActivityAt } : {}),
      messageCount: count(value.messageCount) ? value.messageCount : null,
    });
  }
  if (payload.rooms.length && !rooms.length) throw new Error('The server returned no valid room entries.');
  return rooms;
}
