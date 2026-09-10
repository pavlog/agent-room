import { useCallback, useRef, useState, type SetStateAction } from 'react';
import { draftKey, readDraft, writeDraft } from '../lib/roomDraft.js';

/** Room is keyed by code in the router, so each mount owns one draft key. */
export function useRoomDraft(code: string, name: string) {
  const key = draftKey(code, name);
  const [text, updateText] = useState(() => {
    try { return readDraft(sessionStorage, key); } catch { return ''; }
  });
  const current = useRef(text);
  const [saved, setSaved] = useState(true);
  const setText = useCallback((next: SetStateAction<string>) => {
    const value = typeof next === 'function' ? next(current.current) : next;
    current.current = value;
    // Write synchronously so navigation in the same tick cannot lose a draft.
    // Storage failure must never prevent editing or sending a message.
    try { setSaved(writeDraft(sessionStorage, key, value)); } catch { setSaved(false); }
    updateText(value);
  }, [key]);
  return { text, setText, saved };
}
