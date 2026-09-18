import { memo, useMemo } from 'react';
import type { Message, Participant } from '@agent-room/shared';
import { Bubble } from './Bubble.js';

interface Props {
  messages: Message[];
  participants: Participant[];
  selfName: string;
}

/** Draft edits must not traverse or render the conversation. */
export const MessageHistory = memo(function MessageHistory({ messages, participants, selfName }: Props) {
  const byName = new Map<string, Set<string>>();
  for (const participant of participants) {
    if (!byName.has(participant.name)) byName.set(participant.name, new Set());
    byName.get(participant.name)!.add(participant.client);
  }
  const ambiguityKey = JSON.stringify([...byName].filter(([, clients]) => clients.size > 1).map(([name]) => name).sort());
  // Presence polls replace participant objects without changing name ambiguity.
  const ambiguousNames = useMemo(() => new Set<string>(JSON.parse(ambiguityKey)), [ambiguityKey]);
  return <>{messages.map(message => (
    <Bubble key={message.id} message={message} self={message.name === selfName} ambiguousNames={ambiguousNames} />
  ))}</>;
});
