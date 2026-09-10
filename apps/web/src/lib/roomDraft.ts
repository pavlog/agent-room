/** Drafts remain in this browser tab and are isolated by room and identity. */
export function draftKey(code: string, name: string): string {
  return `room-draft:${JSON.stringify([code, name])}`;
}

export function readDraft(storage: Pick<Storage, 'getItem'>, key: string): string {
  try { return storage.getItem(key) ?? ''; } catch { return ''; }
}

export function writeDraft(storage: Pick<Storage, 'setItem' | 'removeItem'>, key: string, text: string): boolean {
  try {
    if (text) storage.setItem(key, text);
    else storage.removeItem(key);
    return true;
  } catch { return false; }
}
