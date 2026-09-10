import { describe, expect, it } from 'vitest';
import { draftKey, readDraft, writeDraft } from './roomDraft.js';

describe('room drafts', () => {
  it('isolates room and identity pairs even when names contain separators', () => {
    expect(draftKey('A:B', 'C')).not.toBe(draftKey('A', 'B:C'));
    expect(draftKey('room', 'Alex')).not.toBe(draftKey('room', 'Sam'));
  });
  it('retains exact text and removes an empty draft', () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      removeItem: (key: string) => { entries.delete(key); },
    };
    expect(writeDraft(storage, 'test', '  draft\nsecond line')).toBe(true);
    expect(readDraft(storage, 'test')).toBe('  draft\nsecond line');
    writeDraft(storage, 'test', '');
    expect(entries.has('test')).toBe(false);
  });
  it('survives blocked storage without breaking the composer', () => {
    const fail = () => { throw new Error('Storage blocked'); };
    expect(readDraft({ getItem: fail }, 'test')).toBe('');
    expect(writeDraft({ setItem: fail, removeItem: fail }, 'test', 'draft')).toBe(false);
    expect(writeDraft({ setItem: fail, removeItem: fail }, 'test', '')).toBe(false);
  });
});
