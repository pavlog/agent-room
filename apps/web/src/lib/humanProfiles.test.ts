import { describe, expect, it } from 'vitest';
import { parseHumanProfiles, rememberHumanProfile, HUMAN_PROFILES_KEY } from './humanProfiles.js';

describe('saved human profiles', () => {
  it('ignores malformed storage and keeps only name and role', () => {
    expect(parseHumanProfiles('{')).toEqual([]);
    expect(parseHumanProfiles(JSON.stringify([null, {}, { name: ' ', role: '' }, { name: ' Example ', role: ' Reviewer ', hostKey: 'excluded' }]))).toEqual([{ name: 'Example', role: 'Reviewer' }]);
  });
  it('deduplicates pairs, keeps different roles, and limits history to eight', () => {
    const profiles = [{ name: 'Example', role: 'Reviewer' }, { name: 'Example', role: 'Reviewer' },
      ...Array.from({ length: 10 }, (_, i) => ({ name: 'Example', role: `Role ${i}` }))];
    expect(parseHumanProfiles(JSON.stringify(profiles))).toHaveLength(8);
    expect(parseHumanProfiles(JSON.stringify(profiles))[1]?.role).toBe('Role 0');
  });
  it('moves a reused profile to the front without storing credentials', () => {
    const values = new Map([[HUMAN_PROFILES_KEY, JSON.stringify([{ name: 'Example', role: 'Reviewer' }, { name: 'Example', role: 'Host' }])]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(rememberHumanProfile(storage, { name: 'Example', role: 'Host' })).toEqual([{ name: 'Example', role: 'Host' }, { name: 'Example', role: 'Reviewer' }]);
  });
});
